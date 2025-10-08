export enum RunCycleEnum {
  ONCE = "once",
  DAILY = "daily",
  HOURLY = "hourly",
  WEEKLY = "weekly",
}

export enum DayOfWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export enum NotificationReceiveType {
  FAILURE = "failure",
  EVERY_TIME = "every_time",
}

export enum RequestDataTypeEnum {
  JSON = "JSON",
  XML = "XML",
  HTML = "HTML",
  TEXT = "Text",
  JAVASCRIPT = "JavaScript",
  IMAGE = "Image",
}

export interface EmailData {
  userName: string;
  scheduleName: string;
  scheduleLastestRun: string;
  scheduleRunResult: string;
  scheduleRunPassedCount: number;
  scheduleRunFailedCount: number;
  scheduleRunTotalRequest: number;
  scheduleRunPassPercentage: string; 
  scheduleTotalTime: string | number;
  scheduleRunEnvName: string;
  isSuccess: boolean;
  isFailed: boolean;
  isPartial: boolean;
}

export interface OnceConfig {
  type: RunCycleEnum.ONCE;
  executeAt: Date;
}

export interface DailyConfig {
  type: RunCycleEnum.DAILY;
  time: {
    hour: number;
    minute: number;
    second?: number;
  };
}

export interface HourlyConfig {
  type: RunCycleEnum.HOURLY;
  intervalHours: number;
  startTime?: {
    hour: number;
    minute: number;
    second?: number;
  };
}

export interface WeeklyConfig {
  type: RunCycleEnum.WEEKLY;
  days: DayOfWeek[];
  time: {
    hour: number;
    minute: number;
    second?: number;
  };
}

export type RunCycleConfig =
  | OnceConfig
  | DailyConfig
  | HourlyConfig
  | WeeklyConfig;
