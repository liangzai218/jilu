import { useEffect, useCallback } from 'react';

export function useNotifications() {
  // 请求通知权限
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }, []);

  // 发送本地通知
  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    
    try {
      new Notification(title, {
        icon: '/icon-192x192.png',
        badge: '/icon-72x72.png',
        tag: 'personal-app',
        requireInteraction: false,
        ...options,
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }, []);

  // 检查并发送经期提醒
  const checkPeriodReminder = useCallback((
    daysToNext: number | null,
    isInPeriod: boolean,
    periodDay: number
  ) => {
    if (daysToNext === null) return;
    
    // 经期临近提醒（3天内）
    if (!isInPeriod && daysToNext > 0 && daysToNext <= 3) {
      sendNotification('经期提醒', {
        body: `您的月经预计${daysToNext}天后开始，请提前准备`,
        tag: 'period-upcoming',
      });
    }
    
    // 经期开始确认（预测当天）
    if (!isInPeriod && daysToNext === 0) {
      sendNotification('经期提醒', {
        body: '今天是预测的经期开始日，月经来了吗？',
        tag: 'period-start',
        requireInteraction: true,
      });
    }
    
    // 经期结束确认（超过平均天数+2天）
    if (isInPeriod && periodDay > 7) {
      sendNotification('经期提醒', {
        body: `您的月经已持续${periodDay}天，是否已结束？`,
        tag: 'period-end',
      });
    }
  }, [sendNotification]);

  // 检查并发送任务提醒
  const checkTaskReminder = useCallback((
    taskName: string,
    daysSinceLast: number
  ) => {
    if (daysSinceLast >= 1) {
      sendNotification('任务提醒', {
        body: `「${taskName}」已间隔${daysSinceLast}天未完成`,
        tag: `task-${taskName}`,
      });
    }
  }, [sendNotification]);

  // 初始化通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      requestPermission();
    }
  }, [requestPermission]);

  return {
    requestPermission,
    sendNotification,
    checkPeriodReminder,
    checkTaskReminder,
    isSupported: 'Notification' in window,
    permission: 'Notification' in window ? Notification.permission : 'denied',
  };
}
