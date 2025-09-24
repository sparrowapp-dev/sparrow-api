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

export interface TFAPIResponseType {
  body: string;
  headers: object;
  status: string;
}

export type TFKeyValueStoreType = {
  key: string;
  value: string;
};