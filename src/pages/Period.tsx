import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Settings, Droplets } from 'lucide-react';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameDay, 
  addMonths, 
  subMonths, 
  getDay,
  differenceInDays,
  addDays,
  parseISO
} from 'date-fns';
import type { PeriodRecord, PeriodSettings, PeriodDayRecord } from '@/types';

interface PeriodProps {
  periodRecords: PeriodRecord[];
  periodSettings: PeriodSettings;
  addPeriodRecord: (record: Omit<PeriodRecord, 'id'>) => void;
  deletePeriodRecord: (id: string) => void;
  updatePeriodRecord: (id: string, updates: Partial<PeriodRecord>) => void;
  updatePeriodSettings: (settings: Partial<PeriodSettings>) => void;
}

// 症状选项
const symptomOptions = ['痛经', '头痛', '疲劳', '腹胀', '长痘', '腰痛', '恶心', '失眠'];

// 情绪选项
const moodOptions = [
  { emoji: '😊', value: 'happy' },
  { emoji: '😌', value: 'calm' },
  { emoji: '😴', value: 'tired' },
  { emoji: '😢', value: 'sad' },
  { emoji: '😤', value: 'angry' },
  { emoji: '😰', value: 'anxious' }
];

// 开关组件
function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input 
        type="checkbox" 
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className="w-12 h-7 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-pink-400"></div>
    </label>
  );
}

export default function Period({
  periodRecords, periodSettings, addPeriodRecord, deletePeriodRecord, updatePeriodRecord, updatePeriodSettings
}: PeriodProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showSettings, setShowSettings] = useState(false);
  const [showRecordSheet, setShowRecordSheet] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [cycleLength, setCycleLength] = useState(periodSettings.cycleLength || 28);
  const [periodLength, setPeriodLength] = useState(periodSettings.periodLength || 5);
  const [refreshKey, setRefreshKey] = useState(0);
  
  // 设置弹窗状态
  const [remindPeriod, setRemindPeriod] = useState(true);
  const [remindOvulation, setRemindOvulation] = useState(false);
  
  // 记录表单状态
  const [isPeriod, setIsPeriod] = useState(false);
  const [flow, setFlow] = useState<1 | 2 | 3>(2);
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);

  // 排序后的记录（添加refreshKey依赖强制刷新）
  const sortedRecords = useMemo(() => {
    return [...periodRecords].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
  }, [periodRecords, refreshKey]);

  // 获取活跃的经期（未结束的）
  const activePeriod = useMemo(() => {
    return sortedRecords.find(r => !r.endDate);
  }, [sortedRecords]);

  // 计算预测数据
  const predictions = useMemo(() => {
    if (sortedRecords.length === 0) return null;

    const lastRecord = sortedRecords[0];
    const lastStart = new Date(lastRecord.startDate);
    const cycle = periodSettings.cycleLength || 28;
    
    // 下次经期预测
    const nextPeriod = new Date(lastStart);
    nextPeriod.setDate(nextPeriod.getDate() + cycle);
    
    // 排卵日预测（下次经期前14天）
    const ovulationDate = new Date(nextPeriod);
    ovulationDate.setDate(ovulationDate.getDate() - 14);
    
    // 易孕期（排卵日前5天到后2天）
    const fertileStart = new Date(ovulationDate);
    fertileStart.setDate(fertileStart.getDate() - 5);
    const fertileEnd = new Date(ovulationDate);
    fertileEnd.setDate(fertileEnd.getDate() + 2);
    
    // 经期结束日
    const periodEnd = lastRecord.endDate 
      ? new Date(lastRecord.endDate)
      : addDays(lastStart, (periodSettings.periodLength || 5) - 1);

    return {
      lastRecord,
      lastStart,
      nextPeriod,
      ovulationDate,
      fertileStart,
      fertileEnd,
      periodEnd,
      isInPeriod: !lastRecord.endDate || new Date() <= periodEnd
    };
  }, [sortedRecords, periodSettings, refreshKey]);

  // 获取当前状态
  const currentStatus = useMemo(() => {
    if (!predictions) return { phase: 'unknown' as const, days: 0, daysToNext: null };
    
    const today = new Date();
    const { lastRecord, nextPeriod, ovulationDate, fertileStart, fertileEnd, periodEnd } = predictions;
    
    // 在经期内
    if (!lastRecord.endDate || today <= periodEnd) {
      const day = differenceInDays(today, predictions.lastStart) + 1;
      return { phase: 'menstruation' as const, days: day, daysToNext: null };
    }
    
    // 距离下次经期天数
    const daysToNext = differenceInDays(nextPeriod, today);
    
    // 距离排卵日天数
    const daysToOvulation = differenceInDays(ovulationDate, today);
    
    // 判断阶段
    if (daysToNext <= 0 && daysToNext > -(periodSettings.periodLength || 5)) {
      return { phase: 'menstruation' as const, days: Math.abs(daysToNext) + 1, daysToNext: null };
    } else if (daysToOvulation >= -1 && daysToOvulation <= 1) {
      return { phase: 'ovulation' as const, days: daysToOvulation, daysToNext };
    } else if (today >= fertileStart && today <= fertileEnd) {
      return { phase: 'fertile' as const, days: daysToOvulation, daysToNext };
    } else {
      return { phase: 'safe' as const, days: daysToNext, daysToNext };
    }
  }, [predictions, periodSettings.periodLength, refreshKey]);

  // 日历数据
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOffset = getDay(monthStart);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 查找包含某日期的经期记录
  const findPeriodContaining = (date: Date) => {
    return sortedRecords.find(r => {
      const start = parseISO(r.startDate);
      const end = r.endDate ? parseISO(r.endDate) : addDays(start, (periodSettings.periodLength || 5) - 1);
      return date >= start && date <= end;
    });
  };

  // 判断日期在经期中的位置
  const getDatePeriodPosition = (date: Date) => {
    const period = findPeriodContaining(date);
    if (!period) return null;
    
    const start = parseISO(period.startDate);
    const end = period.endDate ? parseISO(period.endDate) : addDays(start, (periodSettings.periodLength || 5) - 1);
    
    const isStart = isSameDay(date, start);
    const isEnd = isSameDay(date, end);
    
    return { period, isStart, isEnd };
  };

  // 判断日期状态
  const getDateStatus = (date: Date) => {
    if (!predictions) return { type: 'normal', isPeriod: false };
    
    const { nextPeriod, ovulationDate, fertileStart, fertileEnd } = predictions;
    const today = new Date();
    
    // 检查是否在已记录的经期中
    const position = getDatePeriodPosition(date);
    if (position) {
      const { isStart, isEnd } = position;
      return { 
        type: isStart ? 'period-start' : isEnd ? 'period-end' : 'period',
        isPeriod: true,
        period: position.period,
        isStart,
        isEnd
      };
    }
    
    // 预测经期
    const predictedEnd = addDays(nextPeriod, (periodSettings.periodLength || 5) - 1);
    if (date >= nextPeriod && date <= predictedEnd && date > today) {
      return { type: 'predicted', isPeriod: false };
    }
    
    // 排卵日
    if (isSameDay(date, ovulationDate)) {
      return { type: 'ovulation', isPeriod: false };
    }
    
    // 易孕期
    if (date >= fertileStart && date <= fertileEnd && date > today) {
      return { type: 'fertile', isPeriod: false };
    }
    
    return { type: 'normal', isPeriod: false };
  };

  // 点击日期
  const onDateClick = (date: Date) => {
    setSelectedDate(date);
    const position = getDatePeriodPosition(date);
    
    // 初始化表单
    setIsPeriod(!!position);
    setFlow(2);
    setSymptoms([]);
    setMood(null);
    
    // 如果该日期有记录详情，加载它
    if (position?.period?.records) {
      const dateStr = format(date, 'yyyy-MM-dd');
      const dayRecord = position.period.records[dateStr];
      if (dayRecord) {
        setFlow(dayRecord.flow);
        setSymptoms(dayRecord.symptoms || []);
        setMood(dayRecord.mood);
      }
    }
    
    setShowRecordSheet(true);
  };

  // 处理经期开关
  const handlePeriodToggle = (newVal: boolean) => {
    setIsPeriod(newVal);
    
    if (!selectedDate) return;
    const d = format(selectedDate, 'yyyy-MM-dd');
    
    if (newVal) {
      // 开启：新开经期
      addPeriodRecord({ startDate: d, records: {} });
    } else {
      // 关闭：结束活跃经期
      if (activePeriod) {
        updatePeriodRecord(activePeriod.id, { endDate: d });
      }
    }
    
    // 强制刷新日历
    setTimeout(() => setRefreshKey(k => k + 1), 100);
  };

  // 处理月经结束
  const handlePeriodEnd = () => {
    if (activePeriod) {
      const today = new Date().toISOString().split('T')[0];
      updatePeriodRecord(activePeriod.id, { endDate: today });
      setRefreshKey(k => k + 1);
    }
  };

  // 处理月经开始
  const handlePeriodStart = () => {
    const today = new Date().toISOString().split('T')[0];
    addPeriodRecord({ startDate: today, records: {} });
    setRefreshKey(k => k + 1);
  };

  // 保存设置
  const saveSettings = () => {
    updatePeriodSettings({ cycleLength, periodLength });
    setShowSettings(false);
  };

  // 切换症状
  const toggleSymptom = (symptom: string) => {
    setSymptoms(prev => 
      prev.includes(symptom) 
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  // 保存记录
  const saveRecord = () => {
    if (!isPeriod || !selectedDate) {
      setShowRecordSheet(false);
      return;
    }
    
    const d = format(selectedDate, 'yyyy-MM-dd');
    const period = findPeriodContaining(selectedDate);
    
    if (!period) {
      alert('请先开启经期开关');
      return;
    }
    
    const newRecords = { 
      ...(period.records || {}), 
      [d]: { flow, symptoms, mood } as PeriodDayRecord
    };
    updatePeriodRecord(period.id, { records: newRecords });
    setShowRecordSheet(false);
    setRefreshKey(k => k + 1);
  };

  const daysToNext = predictions ? differenceInDays(predictions.nextPeriod, new Date()) : null;
  const isInPeriod = predictions?.isInPeriod;

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-[#F8F9FA]">
      {/* 顶部状态条 */}
      <div className="bg-gradient-to-r from-[#FF6B8A] to-[#FF8A80] p-4 text-white">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold">经期追踪</h1>
          <button 
            onClick={() => setShowSettings(true)} 
            className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
        
        {/* 倒计时区域 */}
        <div className="text-center py-6">
          <p className="text-white/80 mb-2 text-sm">
            {currentStatus.phase === 'menstruation' ? '当前处于' : '距离下次经期'}
          </p>
          
          {currentStatus.phase === 'menstruation' ? (
            <>
              <div className="text-6xl font-bold mb-1">第{currentStatus.days}天</div>
              <p className="text-white/80 text-sm">月经期</p>
            </>
          ) : (
            <>
              <div className="text-6xl font-bold mb-1">
                {daysToNext !== null && daysToNext >= 0 ? daysToNext : 0}
              </div>
              <p className="text-white/80 text-sm">天</p>
            </>
          )}

          {/* 状态标签 */}
          <div className="inline-block mt-4 px-4 py-2 rounded-full text-sm font-medium bg-white/20 border border-white/30">
            {currentStatus.phase === 'menstruation' && '月经期'}
            {currentStatus.phase === 'ovulation' && '排卵日'}
            {currentStatus.phase === 'fertile' && '易孕期'}
            {currentStatus.phase === 'safe' && '安全期'}
            {currentStatus.phase === 'unknown' && '未记录'}
          </div>

          {/* 预测日期 */}
          {predictions && (
            <p className="mt-4 text-white/80 text-sm">
              预计 {format(predictions.nextPeriod, 'M月d日')}
            </p>
          )}
        </div>

        {/* 快捷操作栏 */}
        {isInPeriod && (
          <div className="mt-2 bg-white/20 backdrop-blur rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF1744] flex items-center justify-center">
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-medium">月经结束了吗？</span>
            </div>
            <button 
              onClick={handlePeriodEnd}
              className="px-4 py-2 bg-white text-[#FF1744] rounded-lg font-medium hover:bg-white/90"
            >
              是
            </button>
          </div>
        )}

        {!isInPeriod && daysToNext !== null && daysToNext <= 3 && (
          <div className="mt-2 bg-white/20 backdrop-blur rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FF1744] flex items-center justify-center">
                <Droplets className="w-5 h-5 text-white" />
              </div>
              <span className="text-white font-medium">月经来了吗？</span>
            </div>
            <button 
              onClick={handlePeriodStart}
              className="px-4 py-2 bg-white text-[#FF1744] rounded-lg font-medium hover:bg-white/90"
            >
              是
            </button>
          </div>
        )}
      </div>

      {/* 日历区域 */}
      <div className="flex-1 bg-white -mt-4 rounded-t-3xl p-4">
        {/* 月份导航 */}
        <div className="flex items-center justify-between mb-4">
          <button 
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} 
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-lg font-semibold text-gray-800">
            {format(currentMonth, 'yyyy年MM月')}
          </span>
          <button 
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} 
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
          >
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* 星期标题 */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map(day => (
            <div key={day} className="text-center text-sm text-gray-500 py-2">{day}</div>
          ))}
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: startDayOffset }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {days.map(day => {
            const status = getDateStatus(day);
            const isToday = isSameDay(day, new Date());
            
            // 基础样式
            let cellClass = 'day aspect-square flex flex-col items-center justify-center relative cursor-pointer transition-all ';
            
            // 经期样式 - 区分开始/中间/结束
            if (status.type === 'period-start') {
              cellClass += 'bg-gradient-to-br from-[#FF1744] to-[#D50000] text-white rounded-l-xl rounded-r-md ';
            } else if (status.type === 'period-end') {
              cellClass += 'bg-gradient-to-br from-[#FF1744] to-[#D50000] text-white rounded-r-xl rounded-l-md ';
            } else if (status.type === 'period') {
              cellClass += 'bg-gradient-to-br from-[#FF1744] to-[#D50000] text-white rounded-md ';
            } else if (status.type === 'predicted') {
              cellClass += 'bg-[#FFEBEE] border-2 border-dashed border-[#FF8A80] text-[#C62828] rounded-lg ';
            } else if (status.type === 'fertile') {
              cellClass += 'bg-[#E8F5E9] border border-[#A5D6A7] text-[#2E7D32] rounded-lg ';
            } else if (status.type === 'ovulation') {
              cellClass += 'text-gray-800 rounded-lg ';
            } else {
              cellClass += 'hover:bg-gray-100 rounded-lg ';
            }
            
            // 今日选中框
            if (isToday) {
              cellClass += 'border-2 border-gray-800 ';
            }
            
            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateClick(day)}
                className={cellClass}
              >
                <span className={`num ${isToday ? 'font-bold' : ''}`}>
                  {format(day, 'd')}
                </span>
                {status.type === 'ovulation' && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-gray-800" />
                )}
              </button>
            );
          })}
        </div>

        {/* 图例 */}
        <div className="flex gap-4 mt-6 overflow-x-auto pb-2">
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#FF1744]" />
            <span className="text-xs text-gray-600">经期</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#FFEBEE] border border-dashed border-[#FF8A80]" />
            <span className="text-xs text-gray-600">预测经期</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-gray-800" />
            <span className="text-xs text-gray-600">排卵日</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <div className="w-3 h-3 rounded-full bg-[#E8F5E9] border border-[#A5D6A7]" />
            <span className="text-xs text-gray-600">易孕期</span>
          </div>
        </div>

        {/* 历史记录 */}
        <div className="mt-6">
          <h3 className="font-semibold text-gray-700 mb-3">历史记录</h3>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {sortedRecords.map(record => {
              const duration = record.endDate 
                ? differenceInDays(parseISO(record.endDate), parseISO(record.startDate)) + 1
                : differenceInDays(new Date(), parseISO(record.startDate)) + 1;
              
              return (
                <div key={record.id} className="flex items-center justify-between bg-gray-50 rounded-xl p-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-800">
                        {format(parseISO(record.startDate), 'M月d日')}
                      </span>
                      {!record.endDate && (
                        <span className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">进行中</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500">
                      持续 {duration} 天
                      {record.endDate && (
                        <span> · 结束于 {format(parseISO(record.endDate), 'M月d日')}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => { deletePeriodRecord(record.id); setRefreshKey(k => k + 1); }}
                    className="w-8 h-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg"
                  >
                    <span className="text-lg">&times;</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 记录面板 */}
      {showRecordSheet && selectedDate && (
        <>
          <div 
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setShowRecordSheet(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white rounded-t-3xl z-50 max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="p-4">
              {/* 拖动指示条 */}
              <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-4" />
              
              {/* 头部 */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b">
                <div>
                  <div className="text-xl font-bold">{format(selectedDate, 'M月d日')}</div>
                  {findPeriodContaining(selectedDate) && (
                    <span className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full">
                      经期第{differenceInDays(selectedDate, parseISO(findPeriodContaining(selectedDate)!.startDate)) + 1}天
                    </span>
                  )}
                </div>
                <button 
                  onClick={() => setShowRecordSheet(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100"
                >
                  <span className="text-xl text-gray-500">&times;</span>
                </button>
              </div>

              {/* 经期开关 */}
              <div className="flex items-center justify-between py-4 border-b mb-4">
                <span className="text-base font-medium">标记为经期</span>
                <ToggleSwitch checked={isPeriod} onChange={handlePeriodToggle} />
              </div>

              {/* 记录区域 */}
              {isPeriod && (
                <div className="space-y-6">
                  {/* 经量 */}
                  <div>
                    <label className="block text-sm text-gray-500 mb-3">经量</label>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((level) => (
                        <button
                          key={level}
                          onClick={() => setFlow(level as 1 | 2 | 3)}
                          className={`flex-1 py-2 px-4 rounded-full border text-sm transition-all ${
                            flow === level
                              ? 'bg-[#FF6B8A] text-white border-[#FF6B8A]'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {level === 1 ? '少' : level === 2 ? '中' : '多'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 症状 */}
                  <div>
                    <label className="block text-sm text-gray-500 mb-3">症状</label>
                    <div className="flex flex-wrap gap-2">
                      {symptomOptions.map((symptom) => (
                        <button
                          key={symptom}
                          onClick={() => toggleSymptom(symptom)}
                          className={`py-2 px-4 rounded-full border text-sm transition-all ${
                            symptoms.includes(symptom)
                              ? 'bg-[#FF6B8A] text-white border-[#FF6B8A]'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {symptom}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 情绪 */}
                  <div>
                    <label className="block text-sm text-gray-500 mb-3">情绪</label>
                    <div className="flex gap-3">
                      {moodOptions.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => setMood(m.value === mood ? null : m.value)}
                          className={`w-12 h-12 rounded-full border-2 text-2xl flex items-center justify-center transition-all ${
                            mood === m.value
                              ? 'border-[#FF6B8A] bg-pink-50 scale-110'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          {m.emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 保存按钮 */}
                  <Button 
                    onClick={saveRecord}
                    className="w-full bg-[#FF6B8A] hover:bg-[#E91E63] text-white py-4 rounded-xl font-semibold"
                  >
                    保存记录
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* 设置对话框 */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>设置</DialogTitle></DialogHeader>
          <div className="space-y-6 pt-2">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-700">周期长度</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setCycleLength(Math.max(21, cycleLength - 1))}
                  className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center"
                >
                  -
                </button>
                <span className="w-6 text-center font-semibold">{cycleLength}</span>
                <button 
                  onClick={() => setCycleLength(Math.min(35, cycleLength + 1))}
                  className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-700">经期长度</span>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setPeriodLength(Math.max(2, periodLength - 1))}
                  className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center"
                >
                  -
                </button>
                <span className="w-6 text-center font-semibold">{periodLength}</span>
                <button 
                  onClick={() => setPeriodLength(Math.min(8, periodLength + 1))}
                  className="w-7 h-7 rounded-md border border-gray-300 flex items-center justify-center"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-700">经期提醒</span>
              <ToggleSwitch checked={remindPeriod} onChange={setRemindPeriod} />
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-gray-700">排卵提醒</span>
              <ToggleSwitch checked={remindOvulation} onChange={setRemindOvulation} />
            </div>

            <Button onClick={saveSettings} className="w-full bg-[#FF6B8A] hover:bg-[#E91E63]">
              保存设置
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
