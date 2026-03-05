import { useState, useEffect } from 'react';
import { useStorage } from '@/hooks/useStorage';
import { useNotifications } from '@/hooks/useNotifications';
import Tasks from '@/pages/Tasks';
import Accounting from '@/pages/Accounting';
import Period from '@/pages/Period';
import Notes from '@/pages/Notes';
import Settings from '@/pages/Settings';
import { CheckCircle, TrendingUp, Calendar, FileText, User } from 'lucide-react';
import type { TabType } from '@/types';

function App() {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const { 
    data, isLoaded, saveData, exportData, importData, clearAllData,
    addTask, deleteTask, completeTask, deleteCompletion, getTodayCompletedTasks, getTodayTaskCount,
    addDailyIncome, addWorkRecord, deleteDailyIncome, deleteWorkRecord,
    addPeriodRecord, deletePeriodRecord, updatePeriodRecord, updatePeriodSettings, predictNextPeriod, getCurrentPhase,
    addNote, updateNote, deleteNote,
    // Notification functions available for future use
    // addNotification, deleteNotification, toggleNotification
  } = useStorage();
  
  const { checkPeriodReminder, checkTaskReminder, requestPermission } = useNotifications();

  // 初始化通知权限
  useEffect(() => {
    requestPermission();
  }, [requestPermission]);

  // 定期检查提醒
  useEffect(() => {
    const checkReminders = () => {
      // 经期提醒
      const nextPeriod = predictNextPeriod();
      const currentPhase = getCurrentPhase();
      if (nextPeriod && currentPhase) {
        const daysToNext = Math.floor((nextPeriod.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        checkPeriodReminder(daysToNext, currentPhase.phase === 'menstruation', currentPhase.day);
      }
      
      // 任务提醒 - 检查每个任务的间隔
      data.tasks.forEach(task => {
        if (task.completions.length > 0) {
          const lastCompletion = Math.max(...task.completions.map(c => c.date));
          const daysSinceLast = Math.floor((Date.now() - lastCompletion) / (1000 * 60 * 60 * 24));
          if (daysSinceLast >= 1) {
            checkTaskReminder(task.name, daysSinceLast);
          }
        }
      });
    };

    // 首次检查
    checkReminders();
    
    // 每小时检查一次
    const interval = setInterval(checkReminders, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [data.tasks, predictNextPeriod, getCurrentPhase, checkPeriodReminder, checkTaskReminder]);

  if (!isLoaded) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-300 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'tasks':
        return (
          <Tasks
            tasks={data.tasks}
            addTask={addTask}
            deleteTask={deleteTask}
            completeTask={completeTask}
            deleteCompletion={deleteCompletion}
            getTodayCompletedTasks={getTodayCompletedTasks}
            getTodayTaskCount={getTodayTaskCount}
          />
        );
      case 'accounting':
        return (
          <Accounting
            dailyIncomes={data.dailyIncomes}
            workRecords={data.workRecords}
            addDailyIncome={addDailyIncome}
            addWorkRecord={addWorkRecord}
            deleteDailyIncome={deleteDailyIncome}
            deleteWorkRecord={deleteWorkRecord}
          />
        );
      case 'period':
        return (
          <Period
            periodRecords={data.periodRecords}
            periodSettings={data.periodSettings}
            addPeriodRecord={addPeriodRecord}
            deletePeriodRecord={deletePeriodRecord}
            updatePeriodRecord={updatePeriodRecord}
            updatePeriodSettings={updatePeriodSettings}
          />
        );
      case 'notes':
        return (
          <Notes
            notes={data.notes}
            addNote={addNote}
            updateNote={updateNote}
            deleteNote={deleteNote}
          />
        );
      case 'settings':
        return (
          <Settings
            autoSync={data.settings.autoSync}
            updateSettings={(settings) => saveData({ ...data, settings: { ...data.settings, ...settings } })}
            exportData={exportData}
            importData={importData}
            clearAllData={clearAllData}
          />
        );
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'tasks' as TabType, label: '完成', icon: CheckCircle },
    { id: 'accounting' as TabType, label: '记账', icon: TrendingUp },
    { id: 'period' as TabType, label: '经期', icon: Calendar },
    { id: 'notes' as TabType, label: '记事', icon: FileText },
    { id: 'settings' as TabType, label: '我的', icon: User },
  ];

  return (
    <div className="h-screen flex flex-col bg-white max-w-md mx-auto relative shadow-2xl">
      {/* 主内容区 */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>

      {/* 底部导航栏 */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-2 py-2 safe-area-bottom">
        <div className="flex justify-around items-center">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center px-3 py-1 rounded-lg transition-all duration-300 ${
                  isActive ? 'text-black bg-gray-100' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`} />
                <span className="text-xs mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default App;
