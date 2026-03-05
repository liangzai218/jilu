import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ChevronLeft, ChevronRight, TrendingUp, AlertCircle } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths, 
  getDay,
  parseISO,
  isAfter,
  startOfDay
} from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { DailyIncome, WorkRecord } from '@/types';

interface AccountingProps {
  dailyIncomes: DailyIncome[];
  workRecords: WorkRecord[];
  addDailyIncome: (income: Omit<DailyIncome, 'id'>) => void;
  addWorkRecord: (record: Omit<WorkRecord, 'id'>) => void;
  deleteDailyIncome: (id: string) => void;
  deleteWorkRecord: (id: string) => void;
}

type RecordType = 'salary' | 'hourly' | 'bonus' | 'other';

const typeLabels: Record<RecordType, string> = {
  salary: '工资',
  hourly: '工时',
  bonus: '奖金',
  other: '其他'
};

export default function Accounting({
  dailyIncomes, workRecords,
  addDailyIncome, addWorkRecord,
  deleteDailyIncome, deleteWorkRecord,
}: AccountingProps) {
  const [mode, setMode] = useState<'daily' | 'monthly' | 'hourly'>('daily');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  
  // 底部面板状态
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState<'add' | 'detail'>('add');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedRecords, setSelectedRecords] = useState<(DailyIncome | WorkRecord)[]>([]);
  const [selectedMonthTotal, setSelectedMonthTotal] = useState(0);
  
  // 表单状态
  const [amount, setAmount] = useState('');
  const [selectedType, setSelectedType] = useState<RecordType>('salary');
  const [note, setNote] = useState('');
  const [hours, setHours] = useState('');
  const [pricePerHour, setPricePerHour] = useState('');
  
  // 确认弹窗状态
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);
  const [confirmTitle, setConfirmTitle] = useState('');
  const [confirmText, setConfirmText] = useState('');
  
  // Toast状态
  const [toast, setToast] = useState({ show: false, message: '' });

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2000);
  };

  const vibrate = (pattern: number[]) => {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  };

  // 判断是否为未来日期
  const isFutureDate = (date: Date) => isAfter(startOfDay(date), startOfDay(new Date()));
  
  // 判断是否为未来月份
  const isFutureMonth = (year: number, month: number) => {
    const now = new Date();
    return year > now.getFullYear() || (year === now.getFullYear() && month > now.getMonth());
  };

  // 统计计算
  const currentMonthStr = new Date().toISOString().slice(0, 7);
  const thisMonthDaily = dailyIncomes.filter(i => i.date.startsWith(currentMonthStr)).reduce((sum, i) => sum + i.amount, 0);
  const thisMonthWork = workRecords.filter(r => r.date.startsWith(currentMonthStr)).reduce((sum, r) => sum + r.hours * r.pricePerHour, 0);
  const totalWorkIncome = workRecords.reduce((sum, r) => sum + r.hours * r.pricePerHour, 0);

  // 日历数据
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 获取某天收入
  const getDayIncome = (date: Date) => {
    if (mode === 'hourly') {
      return workRecords
        .filter(r => isSameDay(parseISO(r.date), date))
        .reduce((sum, r) => sum + r.hours * r.pricePerHour, 0);
    }
    return dailyIncomes
      .filter(i => isSameDay(parseISO(i.date), date))
      .reduce((sum, i) => sum + i.amount, 0);
  };

  // 获取某天记录
  const getDayRecords = (date: Date) => {
    if (mode === 'hourly') {
      return workRecords.filter(r => isSameDay(parseISO(r.date), date));
    }
    return dailyIncomes.filter(i => isSameDay(parseISO(i.date), date));
  };

  // 获取某月记录
  const getMonthRecords = (year: number, month: number) => {
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;
    return dailyIncomes.filter(i => i.date.startsWith(monthStr));
  };

  // 图表数据
  const chartData = useMemo(() => {
    const data = [];
    
    if (mode === 'monthly') {
      // 年视图：显示12个月
      for (let i = 0; i < 12; i++) {
        const monthStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
        const monthRecords = dailyIncomes.filter(r => r.date.startsWith(monthStr));
        const total = monthRecords.reduce((sum, r) => sum + r.amount, 0);
        data.push({ date: `${i + 1}月`, amount: total });
      }
    } else {
      // 月视图：显示当月每天
      for (const day of days) {
        const amount = getDayIncome(day);
        data.push({ date: format(day, 'd'), amount });
      }
    }
    return data;
  }, [dailyIncomes, workRecords, currentDate, currentYear, mode]);

  const monthTotal = mode === 'hourly' 
    ? workRecords.filter(r => r.date.startsWith(format(currentDate, 'yyyy-MM'))).reduce((sum, r) => sum + r.hours * r.pricePerHour, 0)
    : dailyIncomes.filter(i => i.date.startsWith(format(currentDate, 'yyyy-MM'))).reduce((sum, i) => sum + i.amount, 0);
  
  const avgDaily = monthTotal > 0 ? monthTotal / days.length : 0;

  // 切换模式
  const switchMode = (newMode: 'daily' | 'monthly' | 'hourly') => {
    vibrate([10]);
    setMode(newMode);
    setCurrentDate(new Date());
  };

  // 月份导航
  const prevPeriod = () => {
    vibrate([10]);
    if (mode === 'monthly') {
      setCurrentYear(y => y - 1);
    } else {
      setCurrentDate(d => subMonths(d, 1));
    }
  };

  const nextPeriod = () => {
    vibrate([10]);
    if (mode === 'monthly') {
      setCurrentYear(y => y + 1);
    } else {
      setCurrentDate(d => addMonths(d, 1));
    }
  };

  // 点击日期
  const onDateClick = (date: Date) => {
    // 禁止选择未来日期
    if (isFutureDate(date)) {
      vibrate([30, 20, 30]);
      showToast('不能选择未来日期');
      return;
    }

    const dateStr = format(date, 'yyyy-MM-dd');
    const records = getDayRecords(date);
    
    vibrate([15]);
    setSelectedDate(dateStr);
    
    if (records.length === 0) {
      setSheetMode('add');
      setAmount('');
      setNote('');
      setHours('');
      setPricePerHour('');
      setSelectedType(mode === 'hourly' ? 'hourly' : 'salary');
    } else {
      setSheetMode('detail');
      setSelectedRecords(records);
    }
    
    setShowBottomSheet(true);
  };

  // 点击月份
  const onMonthClick = (monthIndex: number) => {
    // 禁止选择未来月份
    if (isFutureMonth(currentYear, monthIndex)) {
      vibrate([30, 20, 30]);
      showToast('不能选择未来月份');
      return;
    }

    const monthStr = `${currentYear}-${String(monthIndex + 1).padStart(2, '0')}`;
    const records = getMonthRecords(currentYear, monthIndex);
    const total = records.reduce((sum, r) => sum + r.amount, 0);
    
    vibrate([15]);
    setSelectedDate(monthStr);
    setSelectedMonthTotal(total);
    
    if (records.length === 0) {
      setSheetMode('add');
      setAmount('');
      setNote('');
      setHours('');
      setPricePerHour('');
      setSelectedType('salary');
    } else {
      setSheetMode('detail');
      setSelectedRecords(records);
    }
    
    setShowBottomSheet(true);
  };

  // 确认添加
  const confirmAdd = () => {
    // 空金额拦截
    if (mode === 'hourly') {
      if (!hours || !pricePerHour || parseFloat(hours) <= 0 || parseFloat(pricePerHour) <= 0) {
        vibrate([50, 30, 50]);
        showToast('金额不能为空');
        return;
      }
      
      const total = parseFloat(hours) * parseFloat(pricePerHour);
      setConfirmTitle('确认添加');
      setConfirmText(`确定添加工时记录？\n${hours}小时 × ¥${pricePerHour}/小时 = ¥${total.toFixed(2)}`);
      setConfirmAction(() => () => {
        addWorkRecord({
          date: selectedDate,
          hours: parseFloat(hours),
          pricePerHour: parseFloat(pricePerHour),
          note
        });
        showToast('添加成功');
        setShowBottomSheet(false);
        vibrate([10, 50, 10]);
      });
    } else {
      if (!amount || parseFloat(amount) <= 0) {
        vibrate([50, 30, 50]);
        showToast('金额不能为空');
        return;
      }
      
      setConfirmTitle('确认添加');
      setConfirmText(`确定添加 ${typeLabels[selectedType]} ¥${parseFloat(amount).toFixed(2)}？`);
      setConfirmAction(() => () => {
        addDailyIncome({
          date: selectedDate,
          amount: parseFloat(amount),
          note,
          category: selectedType
        });
        showToast('添加成功');
        setShowBottomSheet(false);
        vibrate([10, 50, 10]);
      });
    }
    
    setShowConfirm(true);
    vibrate([15, 30, 15]);
  };

  // 删除记录
  const deleteRecord = (id: string, type: 'daily' | 'work') => {
    setConfirmTitle('确认删除');
    setConfirmText('确定删除这条记录吗？');
    setConfirmAction(() => () => {
      if (type === 'daily') {
        deleteDailyIncome(id);
      } else {
        deleteWorkRecord(id);
      }
      showToast('删除成功');
      setShowBottomSheet(false);
      vibrate([10, 50, 10]);
    });
    setShowConfirm(true);
    vibrate([20]);
  };

  // 渲染年月标签
  const periodLabel = mode === 'monthly' 
    ? `${currentYear}年` 
    : `${currentDate.getFullYear()}年${currentDate.getMonth() + 1}月`;

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYearNum = today.getFullYear();

  return (
    <div className="flex flex-col h-full bg-gray-50 p-4 pb-24 overflow-y-auto">
      {/* 顶部卡片 */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-3">
          <div className="flex-1 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-2xl p-4 text-white shadow-lg">
            <div className="text-emerald-100 text-sm mb-1">本月收入</div>
            <div className="text-2xl font-bold">¥{(thisMonthDaily + thisMonthWork).toFixed(2)}</div>
          </div>
          <div className="flex-1 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl p-4 text-white shadow-lg">
            <div className="text-blue-100 text-sm mb-1">工时收入</div>
            <div className="text-2xl font-bold">¥{totalWorkIncome.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* 模式切换 */}
      <div className="mb-4">
        <div className="bg-white rounded-xl p-1 flex shadow-sm">
          <button 
            onClick={() => switchMode('daily')} 
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'daily' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            按日
          </button>
          <button 
            onClick={() => switchMode('monthly')} 
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'monthly' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            按月
          </button>
          <button 
            onClick={() => switchMode('hourly')} 
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
              mode === 'hourly' ? 'bg-emerald-500 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            工时
          </button>
        </div>
      </div>

      {/* 日历视图 */}
      <div className="mb-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          {/* 年月导航 */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevPeriod} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div className="text-lg font-bold text-gray-800">{periodLabel}</div>
            <button onClick={nextPeriod} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </div>
          
          {/* 日历网格 */}
          {mode === 'monthly' ? (
            // 年视图 - 12个月
            <div className="grid grid-cols-4 gap-3 text-sm">
              {Array.from({ length: 12 }, (_, i) => {
                const monthStr = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
                const monthRecords = dailyIncomes.filter(r => r.date.startsWith(monthStr));
                const total = monthRecords.reduce((sum, r) => sum + r.amount, 0);
                const isCurrentMonth = currentYearNum === currentYear && currentMonth === i;
                const isFuture = isFutureMonth(currentYear, i);
                
                return (
                  <button
                    key={i}
                    onClick={() => onMonthClick(i)}
                    disabled={isFuture}
                    className={`
                      aspect-[1.2] flex flex-col items-center justify-center rounded-xl relative
                      ${isFuture ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : ''}
                      ${!isFuture && isCurrentMonth && total > 0 ? 'bg-emerald-500 text-white border-2 border-gray-800' : ''}
                      ${!isFuture && isCurrentMonth && total === 0 ? 'bg-white border-2 border-gray-800' : ''}
                      ${!isFuture && !isCurrentMonth && total > 0 ? 'bg-emerald-500 text-white' : ''}
                      ${!isFuture && !isCurrentMonth && total === 0 ? 'bg-gray-50 hover:bg-gray-100' : ''}
                    `}
                  >
                    <div className="font-bold text-lg relative z-10">{i + 1}月</div>
                    {total > 0 && <div className="text-xs mt-1 opacity-90 relative z-10">¥{total.toFixed(0)}</div>}
                  </button>
                );
              })}
            </div>
          ) : (
            // 月视图 - 7列
            <>
              <div className="grid grid-cols-7 gap-1 text-sm mb-2">
                {weekDays.map(day => (
                  <div key={day} className="text-center text-gray-400 py-2 font-medium">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startDay }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square" />
                ))}
                {days.map(day => {
                  const income = getDayIncome(day);
                  const hasRecord = income > 0;
                  const isToday = isSameDay(day, new Date());
                  const isFuture = isFutureDate(day);
                  
                  return (
                    <button
                      key={day.toISOString()}
                      onClick={() => onDateClick(day)}
                      disabled={isFuture}
                      className={`
                        aspect-square flex flex-col items-center justify-center text-sm rounded-lg transition-all
                        ${isFuture ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'cursor-pointer'}
                        ${!isFuture && mode === 'hourly' && isToday && hasRecord ? 'bg-blue-500 text-white border-2 border-gray-800' : ''}
                        ${!isFuture && mode === 'hourly' && isToday && !hasRecord ? 'bg-white border-2 border-gray-800' : ''}
                        ${!isFuture && mode === 'hourly' && !isToday && hasRecord ? 'bg-blue-500 text-white hover:bg-blue-600' : ''}
                        ${!isFuture && mode === 'hourly' && !isToday && !hasRecord ? 'hover:bg-gray-100' : ''}
                        ${!isFuture && mode !== 'hourly' && isToday && hasRecord ? 'bg-emerald-500 text-white border-2 border-gray-800' : ''}
                        ${!isFuture && mode !== 'hourly' && isToday && !hasRecord ? 'bg-white border-2 border-gray-800' : ''}
                        ${!isFuture && mode !== 'hourly' && !isToday && hasRecord ? 'bg-emerald-500 text-white hover:bg-emerald-600' : ''}
                        ${!isFuture && mode !== 'hourly' && !isToday && !hasRecord ? 'hover:bg-gray-100' : ''}
                      `}
                    >
                      <div className="font-medium">{format(day, 'd')}</div>
                      {hasRecord && <div className="text-[10px]">¥{income.toFixed(0)}</div>}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>

      {/* 提示语 */}
      <div className="mb-4">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center gap-2 text-sm text-blue-700">
          <AlertCircle className="w-5 h-5" />
          <span>点击日期查看明细，点击空白日期添加记录</span>
        </div>
      </div>

      {/* 收入趋势 */}
      <div className="mb-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <div className="text-lg font-bold text-gray-800 mb-4 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-emerald-500" />
            收入趋势
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `¥${v}`} />
                <Tooltip formatter={(v: number) => `¥${v.toFixed(2)}`} />
                <Line 
                  type="monotone" 
                  dataKey="amount" 
                  stroke={mode === 'hourly' ? '#3b82f6' : '#10b981'} 
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-4 text-sm text-gray-600 border-t pt-3">
            <span>{mode === 'monthly' ? '年度累计' : '本月累计'}: ¥{monthTotal.toFixed(2)}</span>
            <span>{mode === 'monthly' ? '月均' : '日均'}: ¥{avgDaily.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* 底部滑出面板 */}
      {showBottomSheet && (
        <>
          {/* 遮罩层 */}
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowBottomSheet(false)}
          />
          
          {/* 面板 */}
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[80vh] overflow-y-auto animate-slide-up">
            <div className="p-4">
              {/* 拖动指示条 */}
              <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              
              {/* 面板标题 */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {sheetMode === 'add' ? '添加记录' : `${selectedDate} 明细`}
                </h3>
                <button 
                  onClick={() => setShowBottomSheet(false)} 
                  className="p-2 hover:bg-gray-100 rounded-full"
                >
                  <span className="text-2xl text-gray-500">&times;</span>
                </button>
              </div>

              {/* 日期显示 */}
              <div className="bg-gray-100 rounded-xl p-3 mb-4 text-center">
                <span className="text-gray-600">{selectedDate}</span>
              </div>

              {sheetMode === 'add' ? (
                // 添加表单
                <div className="space-y-4">
                  {mode === 'hourly' ? (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">工时（小时）</label>
                        <Input
                          type="number"
                          placeholder="0.0"
                          value={hours}
                          onChange={(e) => setHours(e.target.value)}
                          className="text-lg font-semibold"
                          step="0.5"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">工价（¥/小时）</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={pricePerHour}
                          onChange={(e) => setPricePerHour(e.target.value)}
                          className="text-lg font-semibold"
                          step="0.01"
                        />
                      </div>
                      {hours && pricePerHour && (
                        <div className="bg-blue-50 rounded-xl p-3 text-center">
                          <p className="text-sm text-gray-600">预计收入</p>
                          <p className="text-2xl font-bold text-blue-600">
                            ¥{(parseFloat(hours) * parseFloat(pricePerHour)).toFixed(2)}
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">金额（¥）</label>
                        <Input
                          type="number"
                          placeholder="0.00"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          className="text-lg font-semibold"
                          step="0.01"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">类型</label>
                        <div className="grid grid-cols-4 gap-2">
                          {(Object.keys(typeLabels) as RecordType[]).map((type) => (
                            <button
                              key={type}
                              onClick={() => setSelectedType(type)}
                              className={`py-2 rounded-lg border text-sm font-medium transition-all ${
                                selectedType === type
                                  ? 'border-2 border-emerald-500 bg-emerald-50 text-emerald-700'
                                  : 'border-gray-200 hover:bg-gray-50'
                              }`}
                            >
                              {typeLabels[type]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">备注（可选）</label>
                    <Input
                      type="text"
                      placeholder="例如：项目奖金"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </div>

                  <Button 
                    onClick={confirmAdd} 
                    className="w-full bg-emerald-500 hover:bg-emerald-600 text-white py-4 rounded-xl font-semibold text-lg shadow-lg"
                  >
                    确认添加
                  </Button>
                </div>
              ) : (
                // 明细列表
                <div className="space-y-3">
                  {/* 按月模式显示月统计 */}
                  {mode === 'monthly' && selectedMonthTotal > 0 && (
                    <div className="bg-emerald-50 rounded-xl p-3 text-center mb-3">
                      <p className="text-sm text-gray-600">该月总收入</p>
                      <p className="text-xl font-bold text-emerald-600">¥{selectedMonthTotal.toFixed(2)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        平均每天: ¥{(selectedMonthTotal / 30).toFixed(2)}
                      </p>
                    </div>
                  )}
                  
                  {selectedRecords.length === 0 ? (
                    <p className="text-gray-400 text-center py-4">暂无记录</p>
                  ) : (
                    selectedRecords.map((record) => (
                      <div key={record.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                        <div>
                          <div className="font-semibold text-gray-800">
                            ¥{('hours' in record) 
                              ? (record.hours * record.pricePerHour).toFixed(2)
                              : record.amount.toFixed(2)
                            }
                          </div>
                          <div className="text-xs text-gray-500">
                            {('hours' in record) 
                              ? `${record.hours}小时 × ¥${record.pricePerHour}/小时`
                              : typeLabels[(record as DailyIncome).category as RecordType] || '其他'
                            }
                            {record.note && ` · ${record.note}`}
                          </div>
                        </div>
                        <button
                          onClick={() => deleteRecord(record.id, 'hours' in record ? 'work' : 'daily')}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))
                  )}
                  <button
                    onClick={() => {
                      setSheetMode('add');
                      setAmount('');
                      setNote('');
                      setHours('');
                      setPricePerHour('');
                    }}
                    className="w-full border-2 border-dashed border-emerald-300 text-emerald-600 py-3 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                    添加新记录
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 确认弹窗 */}
      {showConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowConfirm(false)} />
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative z-10 animate-scale-in">
            <h4 className="text-lg font-bold text-gray-800 mb-2">{confirmTitle}</h4>
            <p className="text-gray-600 mb-6 whitespace-pre-line">{confirmText}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowConfirm(false)} 
                className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-medium hover:bg-gray-50"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  confirmAction?.();
                  setShowConfirm(false);
                }}
                className="flex-1 py-3 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600"
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-gray-800 text-white px-6 py-3 rounded-full shadow-lg z-[70] text-sm font-medium animate-fade-in">
          {toast.message}
        </div>
      )}
    </div>
  );
}
