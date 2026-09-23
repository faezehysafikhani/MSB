import { toPersianDigits } from './formatters';
import { addJalaliDays, todayJalali } from './jalaliDate';

/** تاریخ جاری شمسی؛ برای مقدار پیش‌فرض فرم‌ها، نه داده‌های نمونه. */
export const getCurrentJalaliDate = (): string => toPersianDigits(todayJalali());

export const addDaysToJalaliDate = (date: string, days: number): string => {
  return toPersianDigits(addJalaliDays(date, days) || todayJalali());
};

export const formatJalaliFallback = (value?: string): string =>
  value ? toPersianDigits(value) : '—';

/** ساعت جاری به‌صورت «۰۹:۳۰» برای ثبت رویدادها. */
export const getCurrentTimeString = (): string =>
  new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', hour12: false });
