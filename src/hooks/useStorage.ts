import { useState, useEffect, useCallback } from 'react';
import type { AppData, Task, DailyIncome, MonthlyIncome, WorkRecord, PeriodRecord, PeriodSettings, Note, Notification } from '@/types';

const STORAGE_KEY = 'personal_app_data';

const defaultData: AppData = {
  tasks: [],
  dailyIncomes: [],
  monthlyIncomes: [],
  workRecords: [],
  periodRecords: [],
  periodSettings: {
    cycleLength: 28,
    periodLength: 5,
  },
  notes: [],
  notifications: [],
  settings: {
    autoSync: false,
  },
};

export function useStorage() {
  const [data, setData] = useState<AppData>(defaultData);
  const [isLoaded, setIsLoaded] = useState(false);

  // 从 localStorage 加载数据
  useEffect(() => {
    const loadData = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          setData({ ...defaultData, ...parsed });
        }
      } catch (error) {
        console.error('Failed to load data:', error);
      }
      setIsLoaded(true);
    };
    loadData();
  }, []);

  // 保存到 localStorage
  const saveData = useCallback((newData: AppData) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newData));
      setData(newData);
      return true;
    } catch (error) {
      console.error('Failed to save data:', error);
      return false;
    }
  }, []);

  // 导出所有数据为 JSON 字符串
  const exportData = useCallback(() => {
    return JSON.stringify(data);
  }, [data]);

  // 从 JSON 字符串导入数据
  const importData = useCallback((jsonString: string) => {
    try {
      const parsed = JSON.parse(jsonString);
      const newData = { ...defaultData, ...parsed };
      saveData(newData);
      return true;
    } catch (error) {
      console.error('Failed to import data:', error);
      return false;
    }
  }, [saveData]);

  // 任务相关操作
  const addTask = useCallback((name: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      name,
      createdAt: Date.now(),
      completions: [],
    };
    const newData = { ...data, tasks: [...data.tasks, newTask] };
    saveData(newData);
    return newTask.id;
  }, [data, saveData]);

  const deleteTask = useCallback((taskId: string) => {
    const newData = { ...data, tasks: data.tasks.filter(t => t.id !== taskId) };
    saveData(newData);
  }, [data, saveData]);

  const completeTask = useCallback((taskId: string) => {
    const now = Date.now();
    const newTasks = data.tasks.map(task => {
      if (task.id === taskId) {
        task.completions.push({ id: Date.now().toString(), date: now });
      }
      return task;
    });
    saveData({ ...data, tasks: newTasks });
  }, [data, saveData]);

  const deleteCompletion = useCallback((taskId: string, completionId: string) => {
    const newTasks = data.tasks.map(task => {
      if (task.id === taskId) {
        return {
          ...task,
          completions: task.completions.filter(c => c.id !== completionId)
        };
      }
      return task;
    });
    saveData({ ...data, tasks: newTasks });
  }, [data, saveData]);

  const getTodayCompletedTasks = useCallback(() => {
    const today = new Date().toDateString();
    return data.tasks.filter(task => 
      task.completions.some(c => new Date(c.date).toDateString() === today)
    );
  }, [data.tasks]);

  const getTodayTaskCount = useCallback((taskId: string) => {
    const today = new Date().toDateString();
    const task = data.tasks.find(t => t.id === taskId);
    if (!task) return 0;
    return task.completions.filter(c => new Date(c.date).toDateString() === today).length;
  }, [data.tasks]);

  // 记账相关操作
  const addDailyIncome = useCallback((income: Omit<DailyIncome, 'id'>) => {
    const newIncome: DailyIncome = { ...income, id: Date.now().toString() };
    const newData = { ...data, dailyIncomes: [...data.dailyIncomes, newIncome] };
    saveData(newData);
  }, [data, saveData]);

  const addMonthlyIncome = useCallback((income: Omit<MonthlyIncome, 'id'>) => {
    const newIncome: MonthlyIncome = { ...income, id: Date.now().toString() };
    const newData = { ...data, monthlyIncomes: [...data.monthlyIncomes, newIncome] };
    saveData(newData);
  }, [data, saveData]);

  const addWorkRecord = useCallback((record: Omit<WorkRecord, 'id'>) => {
    const newRecord: WorkRecord = { ...record, id: Date.now().toString() };
    const newData = { ...data, workRecords: [...data.workRecords, newRecord] };
    saveData(newData);
  }, [data, saveData]);

  const deleteDailyIncome = useCallback((id: string) => {
    const newData = { ...data, dailyIncomes: data.dailyIncomes.filter(i => i.id !== id) };
    saveData(newData);
  }, [data, saveData]);

  const deleteMonthlyIncome = useCallback((id: string) => {
    const newData = { ...data, monthlyIncomes: data.monthlyIncomes.filter(i => i.id !== id) };
    saveData(newData);
  }, [data, saveData]);

  const deleteWorkRecord = useCallback((id: string) => {
    const newData = { ...data, workRecords: data.workRecords.filter(r => r.id !== id) };
    saveData(newData);
  }, [data, saveData]);

  // 经期相关操作
  const addPeriodRecord = useCallback((record: Omit<PeriodRecord, 'id'>) => {
    const newRecord: PeriodRecord = { ...record, id: Date.now().toString() };
    const newData = { ...data, periodRecords: [...data.periodRecords, newRecord] };
    saveData(newData);
  }, [data, saveData]);

  const deletePeriodRecord = useCallback((id: string) => {
    const newData = { ...data, periodRecords: data.periodRecords.filter(r => r.id !== id) };
    saveData(newData);
  }, [data, saveData]);

  const updatePeriodRecord = useCallback((id: string, updates: Partial<PeriodRecord>) => {
    const newRecords = data.periodRecords.map(record => 
      record.id === id ? { ...record, ...updates } : record
    );
    saveData({ ...data, periodRecords: newRecords });
  }, [data, saveData]);

  const updatePeriodSettings = useCallback((settings: Partial<PeriodSettings>) => {
    const newData = { 
      ...data, 
      periodSettings: { ...data.periodSettings, ...settings } 
    };
    saveData(newData);
  }, [data, saveData]);

  // 预测下次经期
  const predictNextPeriod = useCallback(() => {
    if (data.periodRecords.length === 0) return null;
    
    const sorted = [...data.periodRecords].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    
    const lastStart = new Date(sorted[0].startDate);
    const cycleLength = data.periodSettings.cycleLength || 28;
    const nextDate = new Date(lastStart);
    nextDate.setDate(nextDate.getDate() + cycleLength);
    
    return nextDate;
  }, [data.periodRecords, data.periodSettings.cycleLength]);

  // 预测排卵日
  const predictOvulationDate = useCallback(() => {
    const nextPeriod = predictNextPeriod();
    if (!nextPeriod) return null;
    const ovulationDate = new Date(nextPeriod);
    ovulationDate.setDate(ovulationDate.getDate() - 14);
    return ovulationDate;
  }, [predictNextPeriod]);

  // 获取当前周期阶段
  const getCurrentPhase = useCallback(() => {
    const sorted = [...data.periodRecords].sort((a, b) => 
      new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    );
    
    if (sorted.length === 0) return null;
    
    const lastRecord = sorted[0];
    const lastStart = new Date(lastRecord.startDate);
    const today = new Date();
    const daysSinceLast = Math.floor((today.getTime() - lastStart.getTime()) / (1000 * 60 * 60 * 24));
    
    // 如果在经期内
    if (!lastRecord.endDate) {
      return { phase: 'menstruation' as const, day: daysSinceLast + 1 };
    }
    
    const periodLength = data.periodSettings.periodLength || 5;
    
    // 预测下次经期
    const nextPeriod = predictNextPeriod();
    if (!nextPeriod) return null;
    
    const daysToNext = Math.floor((nextPeriod.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // 预测排卵日
    const ovulationDate = predictOvulationDate();
    if (!ovulationDate) return null;
    
    const daysToOvulation = Math.floor((ovulationDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    // 判断阶段
    if (daysToNext <= 0 && daysToNext > -periodLength) {
      return { phase: 'menstruation' as const, day: Math.abs(daysToNext) + 1 };
    } else if (daysToOvulation >= -4 && daysToOvulation <= 1) {
      return { phase: 'ovulation' as const, day: daysToOvulation };
    } else if (daysToOvulation >= -5 && daysToOvulation <= 4) {
      return { phase: 'fertile' as const, day: daysToOvulation };
    } else {
      return { phase: 'safe' as const, day: daysSinceLast + 1 };
    }
  }, [data.periodRecords, data.periodSettings, predictNextPeriod, predictOvulationDate]);

  // 记事相关操作
  const addNote = useCallback((note: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = Date.now();
    const newNote: Note = { 
      ...note, 
      id: Date.now().toString(),
      createdAt: now,
      updatedAt: now,
    };
    const newData = { ...data, notes: [...data.notes, newNote] };
    saveData(newData);
  }, [data, saveData]);

  const updateNote = useCallback((id: string, updates: Partial<Note>) => {
    const newNotes = data.notes.map(note => 
      note.id === id ? { ...note, ...updates, updatedAt: Date.now() } : note
    );
    saveData({ ...data, notes: newNotes });
  }, [data, saveData]);

  const deleteNote = useCallback((id: string) => {
    const newData = { ...data, notes: data.notes.filter(n => n.id !== id) };
    saveData(newData);
  }, [data, saveData]);

  // 通知相关操作
  const addNotification = useCallback((notification: Omit<Notification, 'id'>) => {
    const newNotification: Notification = { 
      ...notification, 
      id: Date.now().toString() 
    };
    const newData = { 
      ...data, 
      notifications: [...data.notifications, newNotification] 
    };
    saveData(newData);
  }, [data, saveData]);

  const deleteNotification = useCallback((id: string) => {
    const newData = { 
      ...data, 
      notifications: data.notifications.filter(n => n.id !== id) 
    };
    saveData(newData);
  }, [data, saveData]);

  const toggleNotification = useCallback((id: string) => {
    const newNotifications = data.notifications.map(n => 
      n.id === id ? { ...n, enabled: !n.enabled } : n
    );
    saveData({ ...data, notifications: newNotifications });
  }, [data, saveData]);

  // 设置相关
  const updateSettings = useCallback((settings: Partial<AppData['settings']>) => {
    saveData({ ...data, settings: { ...data.settings, ...settings } });
  }, [data, saveData]);

  // 清除所有数据
  const clearAllData = useCallback(() => {
    saveData(defaultData);
  }, [saveData]);

  return {
    data,
    isLoaded,
    saveData,
    exportData,
    importData,
    clearAllData,
    // 任务
    addTask,
    deleteTask,
    completeTask,
    deleteCompletion,
    getTodayCompletedTasks,
    getTodayTaskCount,
    // 记账
    addDailyIncome,
    addMonthlyIncome,
    addWorkRecord,
    deleteDailyIncome,
    deleteMonthlyIncome,
    deleteWorkRecord,
    // 经期
    addPeriodRecord,
    deletePeriodRecord,
    updatePeriodRecord,
    updatePeriodSettings,
    predictNextPeriod,
    predictOvulationDate,
    getCurrentPhase,
    // 记事
    addNote,
    updateNote,
    deleteNote,
    // 通知
    addNotification,
    deleteNotification,
    toggleNotification,
    // 设置
    updateSettings,
  };
}
