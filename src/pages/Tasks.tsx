import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Plus, BarChart3, ChevronLeft, Trash2, ChevronLeft as ChevronLeftIcon, ChevronRight as ChevronRightIcon, Flame, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths, 
  getDay,
  differenceInDays
} from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Task, CompletionRecord } from '@/types';

interface TasksProps {
  tasks: Task[];
  addTask: (name: string) => void;
  deleteTask: (id: string) => void;
  completeTask: (id: string) => void;
  deleteCompletion: (taskId: string, completionId: string) => void;
  getTodayCompletedTasks: () => Task[];
  getTodayTaskCount: (taskId: string) => number;
}

// 计算连续/间隔天数信息
function calculateStreakInfo(task: Task): { 
  text: string; 
  subText: string; 
  color: string;
  isConsecutive: boolean;
  days: number;
} | null {
  const completions = task.completions;
  if (completions.length === 0) {
    return { text: '尚未开始', subText: '迈出第一步吧！', color: 'text-gray-500', isConsecutive: false, days: 0 };
  }

  // 获取所有完成日期（去重，每天只算一次）
  const completionDates = [...new Set(completions.map(c => {
    const d = new Date(c.date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }))].sort();

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  const lastDate = completionDates[completionDates.length - 1];
  const isTodayCompleted = lastDate === todayStr;

  // 计算连续天数
  let consecutiveDays = 0;
  if (isTodayCompleted) {
    consecutiveDays = 1;
    for (let i = completionDates.length - 2; i >= 0; i--) {
      const curr = new Date(completionDates[i + 1]);
      const prev = new Date(completionDates[i]);
      const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
      if (diff === 1) {
        consecutiveDays++;
      } else {
        break;
      }
    }
  } else {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    if (lastDate === yesterdayStr) {
      consecutiveDays = 1;
      for (let i = completionDates.length - 2; i >= 0; i--) {
        const curr = new Date(completionDates[i + 1]);
        const prev = new Date(completionDates[i]);
        const diff = Math.floor((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
        if (diff === 1) {
          consecutiveDays++;
        } else {
          break;
        }
      }
    } else {
      const lastCompletion = new Date(lastDate);
      const gapDays = Math.floor((today.getTime() - lastCompletion.getTime()) / (1000 * 60 * 60 * 24));
      
      if (gapDays === 1) {
        return { text: '已间隔 1 天', subText: '别断档哦', color: 'text-green-500', isConsecutive: false, days: 1 };
      } else if (gapDays === 2) {
        return { text: '已间隔 2 天', subText: '快捡起来！', color: 'text-orange-500', isConsecutive: false, days: 2 };
      } else if (gapDays === 3) {
        return { text: '已间隔 3 天', subText: '重新开始吧！', color: 'text-orange-500', isConsecutive: false, days: 3 };
      } else if (gapDays >= 4 && gapDays <= 6) {
        return { text: `已间隔 ${gapDays} 天`, subText: '任何时候都不晚', color: 'text-red-500', isConsecutive: false, days: gapDays };
      } else {
        return { text: `已间隔 ${gapDays} 天`, subText: '这次坚持久一点！', color: 'text-red-500', isConsecutive: false, days: gapDays };
      }
    }
  }

  if (consecutiveDays === 1) {
    return { text: '已连续 1 天', subText: '好的开始！', color: 'text-green-500', isConsecutive: true, days: 1 };
  } else if (consecutiveDays === 2) {
    return { text: '已连续 2 天', subText: '保持节奏', color: 'text-green-500', isConsecutive: true, days: 2 };
  } else if (consecutiveDays === 3) {
    return { text: '已连续 3 天', subText: '你真棒！', color: 'text-green-500', isConsecutive: true, days: 3 };
  } else if (consecutiveDays >= 4 && consecutiveDays <= 6) {
    return { text: `已连续 ${consecutiveDays} 天`, subText: '越来越稳了！', color: 'text-green-600', isConsecutive: true, days: consecutiveDays };
  } else if (consecutiveDays >= 7) {
    return { text: `已连续 ${consecutiveDays} 天`, subText: '习惯养成中！', color: 'text-green-700', isConsecutive: true, days: consecutiveDays };
  }

  return null;
}

export default function Tasks({ 
  tasks, 
  addTask, 
  deleteTask, 
  completeTask, 
  deleteCompletion,
  getTodayCompletedTasks, 
  getTodayTaskCount 
}: TasksProps) {
  const [newTaskName, setNewTaskName] = useState('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showStatsDialog, setShowStatsDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState('');

  // 音效
  useEffect(() => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const createSuccessSound = () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.setValueAtTime(523.25, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659.25, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(783.99, audioContext.currentTime + 0.2);
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    };
    (window as any).playSuccessSound = createSuccessSound;
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      let greet = '早上好';
      if (hour >= 12 && hour < 18) greet = '下午好';
      else if (hour >= 18) greet = '晚上好';
      setGreeting(greet);
      setCurrentTime(now.toLocaleString('zh-CN', { 
        month: 'long', 
        day: 'numeric', 
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit'
      }));
    };
    updateTime();
    const timer = setInterval(updateTime, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleAddTask = () => {
    if (newTaskName.trim()) {
      addTask(newTaskName.trim());
      setNewTaskName('');
      setShowAddDialog(false);
    }
  };

  const triggerConfetti = () => {
    const colors = ['#ff6b6b', '#feca57', '#48dbfb', '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43'];
    const duration = 1000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });
      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: colors
    });
  };

  const triggerVibration = () => {
    if (navigator.vibrate) {
      navigator.vibrate([50, 30, 50, 30, 100]);
    }
  };

  const handleCompleteClick = () => {
    if (tasks.length === 0) {
      setShowAddDialog(true);
      return;
    }
    setShowCompleteDialog(true);
  };

  const handleSelectTaskToComplete = (taskId: string) => {
    completeTask(taskId);
    triggerVibration();
    triggerConfetti();
    if ((window as any).playSuccessSound) {
      (window as any).playSuccessSound();
    }
    setShowCompleteDialog(false);
  };

  const getTotalCompletions = (task: Task) => task.completions.length;

  // 获取首页要显示的事项列表（最多3个）
  const getHomeDisplayTasks = () => {
    if (tasks.length === 0) return [];

    const todayCompleted = getTodayCompletedTasks();
    const result: { task: Task; displayText: string; displaySubText?: string; color: string; priority: number }[] = [];

    // 1. 今日已完成事项
    todayCompleted.forEach(task => {
      const count = getTodayTaskCount(task.id);
      result.push({
        task,
        displayText: `${task.name}  +${count}`,
        color: 'text-blue-600',
        priority: 3
      });
    });

    // 2. 有连续/间隔状态的事项
    tasks.forEach(task => {
      // 跳过今日已完成的
      if (todayCompleted.find(t => t.id === task.id)) return;
      
      const streakInfo = calculateStreakInfo(task);
      if (streakInfo && streakInfo.days > 0) {
        const icon = streakInfo.isConsecutive ? '🔥' : '⚠️';
        result.push({
          task,
          displayText: `${task.name}  ${icon}${streakInfo.text}`,
          displaySubText: streakInfo.subText,
          color: streakInfo.color,
          priority: streakInfo.isConsecutive ? 2 : 1
        });
      }
    });

    // 按优先级排序，最多取3个
    return result
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 3);
  };

  const homeDisplayTasks = getHomeDisplayTasks();
  const hasTasks = tasks.length > 0;
  const hasDisplayItems = homeDisplayTasks.length > 0;

  return (
    <div className="flex flex-col h-full bg-white p-4 overflow-y-auto">
      {/* 问候语和时间 */}
      <div className="text-center mt-4 mb-4">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">{greeting}</h1>
        <p className="text-lg text-gray-600">{currentTime}</p>
      </div>

      {/* 上半部操作按钮 - 放两边 */}
      <div className="flex justify-between items-center px-2 mb-6">
        <button
          onClick={() => { setNewTaskName(''); setShowAddDialog(true); }}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-10 h-10 rounded-full bg-blue-500 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-gray-600">新增事项</span>
        </button>

        <button
          onClick={() => setShowStatsDialog(true)}
          className="flex flex-col items-center gap-1"
        >
          <div className="w-10 h-10 rounded-full bg-blue-500 shadow-md flex items-center justify-center hover:scale-110 active:scale-95 transition-transform">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <span className="text-xs text-gray-600">统计</span>
        </button>
      </div>

      {/* 主要完成按钮 */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-[200px]">
        <button
          onClick={handleCompleteClick}
          className="w-44 h-44 rounded-full bg-gradient-to-br from-blue-400 via-blue-500 to-blue-600 text-white text-4xl font-bold shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center"
        >
          完成
        </button>
      </div>

      {/* 下方列表区域 */}
      <div className="mb-20 mt-4 min-h-[120px]">
        {!hasTasks ? (
          // 无任何事项
          <div className="text-center py-8">
            <p className="text-gray-400 text-sm">快去添加新事项来完成吧～</p>
          </div>
        ) : !hasDisplayItems ? (
          // 有事项但无今日完成且无状态 - 隐藏整个列表
          null
        ) : (
          // 显示最多3个事项
          <div className="bg-gray-50 rounded-lg p-3 shadow-sm space-y-2">
            {homeDisplayTasks.map(({ task, displayText, displaySubText, color }) => (
              <button
                key={task.id}
                onClick={() => setSelectedTask(task)}
                className="w-full text-left bg-white rounded-md px-3 py-2 hover:bg-gray-50 transition-colors"
              >
                <div className={`text-sm font-medium ${color}`}>
                  {displayText}
                </div>
                {displaySubText && (
                  <div className="text-xs text-gray-400 mt-0.5">{displaySubText}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 新增事项对话框 */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-sm bg-white">
          <DialogHeader><DialogTitle>新增事项</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="输入事项名称"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
              className="border-gray-300"
            />
            <Button onClick={handleAddTask} className="w-full bg-blue-500 hover:bg-blue-600" disabled={!newTaskName.trim()}>
              <Plus className="w-4 h-4 mr-2" />添加
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 统计对话框 */}
      <Dialog open={showStatsDialog} onOpenChange={setShowStatsDialog}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-hidden p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>所有事项</DialogTitle>
          </DialogHeader>
          {!selectedTask ? (
            <div className="overflow-y-auto max-h-[70vh] p-4 pt-0 space-y-2">
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-center py-4">暂无事项，请先添加</p>
              ) : (
                tasks.map(task => (
                  <button
                    key={task.id}
                    onClick={() => setSelectedTask(task)}
                    className="w-full text-left bg-gray-50 rounded-lg p-4 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-800">{task.name}</span>
                      <span className="text-sm text-blue-600">完成 {getTotalCompletions(task)} 次</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <TaskDetailView 
              task={selectedTask} 
              onBack={() => setSelectedTask(null)} 
              onDelete={() => { deleteTask(selectedTask.id); setSelectedTask(null); }}
              deleteCompletion={deleteCompletion}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* 选择事项完成对话框 */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>选择要完成的事项</DialogTitle></DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto pt-2">
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => handleSelectTaskToComplete(task.id)}
                className="w-full text-left bg-gray-50 hover:bg-blue-50 rounded-lg p-4 transition-colors border border-transparent hover:border-blue-200"
              >
                <div className="flex justify-between items-center">
                  <span className="font-medium text-gray-800">{task.name}</span>
                  <span className="text-sm text-gray-500">已完成 {getTotalCompletions(task)} 次</span>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// 任务详情视图组件
function TaskDetailView({ 
  task, 
  onBack, 
  onDelete,
  deleteCompletion
}: { 
  task: Task; 
  onBack: () => void; 
  onDelete: () => void;
  deleteCompletion: (taskId: string, completionId: string) => void;
}) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [timeRange, setTimeRange] = useState<'7' | '30' | 'all'>('7');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<CompletionRecord | null>(null);

  const completions = task.completions;
  const totalCount = completions.length;
  
  // 计算连续/间隔天数和文案
  const streakInfo = calculateStreakInfo(task);

  // 日历数据
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDay = getDay(monthStart);
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

  // 获取某天的完成次数
  const getDayCount = (date: Date) => {
    return completions.filter(c => isSameDay(new Date(c.date), date)).length;
  };

  // 图表数据
  const getChartData = () => {
    const now = new Date();
    let daysToShow = timeRange === '7' ? 7 : timeRange === '30' ? 30 : 90;
    if (timeRange === 'all') daysToShow = 365;
    
    const data = [];
    for (let i = daysToShow - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const count = completions.filter(c => isSameDay(new Date(c.date), date)).length;
      data.push({
        date: format(date, 'MM/dd'),
        count,
        fullDate: date
      });
    }
    return data;
  };

  const chartData = getChartData();
  const recent7Count = completions.filter(c => {
    const date = new Date(c.date);
    const daysAgo = differenceInDays(new Date(), date);
    return daysAgo < 7;
  }).length;
  const recent30Count = completions.filter(c => {
    const date = new Date(c.date);
    const daysAgo = differenceInDays(new Date(), date);
    return daysAgo < 30;
  }).length;

  // 筛选记录
  const filteredCompletions = selectedDate
    ? completions.filter(c => isSameDay(new Date(c.date), selectedDate))
    : completions;

  const today = new Date();
  const isToday = (date: Date) => isSameDay(date, today);

  // 处理删除记录
  const handleDeleteRecord = (record: CompletionRecord) => {
    setRecordToDelete(record);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      deleteCompletion(task.id, recordToDelete.id);
      setShowDeleteConfirm(false);
      setRecordToDelete(null);
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[70vh] overflow-hidden">
      <button onClick={onBack} className="flex items-center text-gray-600 hover:text-gray-800 p-4 pt-0">
        <ChevronLeft className="w-4 h-4 mr-1" />返回列表
      </button>

      <div className="overflow-y-auto flex-1 px-4 pb-4">
        {/* 顶部信息卡片 - 智能连续/间隔提醒 */}
        <div className="bg-gradient-to-r from-blue-100 to-purple-100 rounded-xl p-4 mb-4">
          <h3 className="text-xl font-bold text-gray-800 mb-2">{task.name}</h3>
          {streakInfo && (
            <div className={`${streakInfo.color} mb-2`}>
              <div className="flex items-center gap-1 text-lg font-semibold">
                <Flame className="w-5 h-5" />
                {streakInfo.text}
              </div>
              <div className="text-sm ml-6">{streakInfo.subText}</div>
            </div>
          )}
          <div className="text-gray-600 mt-2">总完成次数: <span className="text-blue-600 font-bold text-2xl">{totalCount}</span></div>
        </div>

        {/* 日历热力图 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">📅 日历视图</h4>
            <div className="flex gap-1 items-center">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
                <ChevronLeftIcon className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600">{format(currentMonth, 'yyyy年MM月', { locale: zhCN })}</span>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1 hover:bg-gray-100 rounded">
                <ChevronRightIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-xs text-gray-500 py-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}
            {days.map(day => {
              const count = getDayCount(day);
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const dayIsToday = isToday(day);
              
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(isSelected ? null : day)}
                  className={`
                    aspect-square flex flex-col items-center justify-center rounded-lg relative
                    ${!isSameMonth(day, currentMonth) ? 'text-gray-300' : 'text-gray-700'}
                    ${count > 0 ? 'bg-blue-100' : 'hover:bg-gray-100'}
                    ${isSelected ? 'ring-2 ring-blue-500' : ''}
                    ${dayIsToday ? 'border-2 border-gray-800' : ''}
                  `}
                >
                  <span className={`text-sm ${dayIsToday ? 'font-bold' : ''}`}>{format(day, 'd')}</span>
                  {count > 0 && (
                    <span className="text-[10px] font-semibold text-blue-600">+{count}</span>
                  )}
                  {dayIsToday && (
                    <span className="absolute bottom-0.5 right-0.5 text-[8px] text-blue-500 font-bold">今</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 趋势图表 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-semibold text-gray-700">📊 完成趋势</h4>
            <div className="flex gap-1">
              {(['7', '30', 'all'] as const).map(range => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-1 text-xs rounded ${
                    timeRange === range ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {range === 'all' ? '全部' : `近${range}天`}
                </button>
              ))}
            </div>
          </div>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval={Math.floor(chartData.length / 5)} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>近7天: {recent7Count}次</span>
            <span>近30天: {recent30Count}次</span>
          </div>
        </div>

        {/* 完成记录列表 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
          <h4 className="font-semibold text-gray-700 mb-3">
            📝 完成记录
            {selectedDate && <span className="text-sm font-normal text-gray-500 ml-2">({format(selectedDate, 'MM月dd日')})</span>}
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {filteredCompletions.length === 0 ? (
              <p className="text-gray-400 text-center py-4">{selectedDate ? '该日无记录' : '暂无完成记录'}</p>
            ) : (
              [...filteredCompletions].sort((a, b) => b.date - a.date).map((record) => (
                <button
                  key={record.id}
                  onClick={() => handleDeleteRecord(record)}
                  className="w-full flex justify-between items-center bg-gray-50 rounded-lg p-3 hover:bg-red-50 transition-colors text-left"
                >
                  <span className="text-gray-700 text-sm">
                    {new Date(record.date).toLocaleString('zh-CN', {
                      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                    })}
                  </span>
                  <span className="text-blue-600 font-semibold text-sm">+1</span>
                </button>
              ))
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2 text-center">点击记录可删除</p>
        </div>

        {/* 删除按钮 */}
        <Button variant="destructive" onClick={onDelete} className="w-full">
          <Trash2 className="w-4 h-4 mr-2" />删除此事项
        </Button>
      </div>

      {/* 删除确认对话框 */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              <p>确定删除这条记录？</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowDeleteConfirm(false)} className="flex-1">
                取消
              </Button>
              <Button onClick={confirmDelete} variant="destructive" className="flex-1">
                删除
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
