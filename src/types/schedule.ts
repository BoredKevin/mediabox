export interface ScheduleItem {
  start: string;
  sub: string;
}

export type ScheduleData = Record<string, ScheduleItem[]>;

export interface CurrentAndNextSchedule {
  current: ScheduleItem;
  next: ScheduleItem;
}
