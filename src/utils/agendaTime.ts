import { AgendaItem } from '../types';
import { toEnglishDigits } from './jalaliDate';

/** "۱۰:۳۰" یا "10:30" → دقیقه از ابتدای شبانه‌روز */
export const timeToMinutes = (value: string): number => {
  const [h, m] = toEnglishDigits(value).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** اختلاف دو ساعت به دقیقه؛ اگر نامعتبر بود، همان ۳۰ دقیقه پیش‌فرض قبلی. */
export const getMinutesDiff = (start: string, end: string): number => {
  const diff = timeToMinutes(end) - timeToMinutes(start);
  return diff > 0 ? diff : 30;
};

/**
 * تنها Validation بازه زمانی بند دستور جلسه در کل سامانه.
 * هم «افزودن بند در ایجاد جلسه»، هم «افزودن از تایید جلسه» و هم «افزودن
 * دستور کار از مسیر افزودن مدعو/دستور» از همین استفاده می‌کنند تا منطق
 * موازی ساخته نشود.
 *
 * قاعده: بازه باید داخل پنجره شروع/پایان خود جلسه باشد و با هیچ بند
 * دیگری همپوشانی نداشته باشد (start < otherEnd && end > otherStart).
 * بندهای خارج‌شده از دستورکار (isRemoved) جای زمانی را اشغال نمی‌کنند.
 */
export const validateAgendaTimeSlot = (
  slotStart: string,
  slotEnd: string,
  meetingStart: string,
  meetingEnd: string,
  existingAgendas: AgendaItem[]
): string | null => {
  const start = timeToMinutes(slotStart);
  const end = timeToMinutes(slotEnd);
  if (end <= start) return 'ساعت پایان بند باید بعد از ساعت شروع آن باشد.';

  const meetingStartMin = timeToMinutes(meetingStart);
  const meetingEndMin = timeToMinutes(meetingEnd);
  if (start < meetingStartMin || end > meetingEndMin) {
    return `بازه زمانی بند باید بین ساعت شروع (${meetingStart}) و پایان (${meetingEnd}) جلسه باشد.`;
  }

  const overlapping = existingAgendas.some((item) => {
    if (item.isRemoved) return false;
    if (!item.startTime || !item.endTime) return false;
    return start < timeToMinutes(item.endTime) && end > timeToMinutes(item.startTime);
  });
  if (overlapping) return 'این بازه زمانی با یکی از بندهای دستور جلسه دیگر همپوشانی دارد.';

  return null;
};

/**
 * نمایش بازه بند: «۱۰:۰۰ تا ۱۰:۳۰». برای بندهای قدیمی که هنوز
 * startTime/endTime ندارند، به همان نمایش «... دقیقه» برمی‌گردد.
 */
export const formatAgendaTimeRange = (agenda: AgendaItem): string => {
  if (agenda.startTime && agenda.endTime) return `${agenda.startTime} تا ${agenda.endTime}`;
  const minutes = agenda.allocatedMinutes ?? agenda.estimatedMinutes;
  return minutes ? `${minutes} دقیقه` : '—';
};
