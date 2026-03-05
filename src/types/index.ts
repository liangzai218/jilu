// 事项类型
export interface Task {
  id: string;
  name: string;
  createdAt: number;
  completions: CompletionRecord[];
}

export interface CompletionRecord {
  id: string;    // 每次完成的唯一ID
  date: number;  // 完成时间戳（精确到毫秒）
}

// 记账类型
export interface DailyIncome {
  id: string;
  date: string;
  amount: number;
  note: string;
  category?: string;
}

export interface MonthlyIncome {
  id: string;
  month: string;
  amount: number;
  note: string;
}

export interface WorkRecord {
  id: string;
  date: string;
  hours: number;
  pricePerHour: number;
  note: string;
}

// 经期每日记录详情
export interface PeriodDayRecord {
  flow: 1 | 2 | 3;  // 经量: 1=少, 2=中, 3=多
  symptoms: string[];
  mood: string | null;
}

// 经期记录类型
export interface PeriodRecord {
  id: string;
  startDate: string;
  endDate?: string;
  note?: string;
  records?: Record<string, PeriodDayRecord>;  // 日期 -> 记录详情
}

// 经期设置类型
export interface PeriodSettings {
  cycleLength: number;    // 平均周期天数（默认28）
  periodLength: number;   // 平均经期天数（默认5）
  lastPeriodStart?: string;
}

// 记事类型
export interface Note {
  id: string;
  title: string;
  content: string;
  type: 'text' | 'password';
  account?: string;
  password?: string;
  createdAt: number;
  updatedAt: number;
}

// 通知提醒类型
export interface Notification {
  id: string;
  title: string;
  body: string;
  type: 'period' | 'task';
  scheduledTime: number;
  enabled: boolean;
}

// 应用数据类型
export interface AppData {
  tasks: Task[];
  dailyIncomes: DailyIncome[];
  monthlyIncomes: MonthlyIncome[];
  workRecords: WorkRecord[];
  periodRecords: PeriodRecord[];
  periodSettings: PeriodSettings;
  notes: Note[];
  notifications: Notification[];
  settings: {
    autoSync: boolean;
    lastSync?: number;
  };
}

export type TabType = 'tasks' | 'accounting' | 'period' | 'notes' | 'settings';

// 经期状态类型
export type PeriodPhase = 'menstruation' | 'fertile' | 'ovulation' | 'safe';
