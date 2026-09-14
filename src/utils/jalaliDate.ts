/**
 * Shared Jalali (Persian) calendar arithmetic.
 *
 * Domain/service code must never schedule dates by comparing or splicing
 * Persian date *strings* — every calculation here round-trips through a real
 * Gregorian `Date`, or through proper Jalali month lengths, so adding a week
 * across a month boundary or a quarter across a year boundary is correct.
 *
 * The Jalali <-> Gregorian conversion is the same well-known algorithm the
 * PersianDatePicker already used; it now lives here so the picker and the
 * services share exactly one implementation.
 */

const div = (a: number, b: number) => Math.trunc(a / b);

export const jalaliToGregorian = (jy: number, jm: number, jd: number): [number, number, number] => {
  let year = jy + 1595;
  let days = -355668 + (365 * year) + (div(year, 33) * 8) + div((year % 33) + 3, 4) + jd;
  days += jm < 7 ? (jm - 1) * 31 : ((jm - 7) * 30) + 186;
  let gy = 400 * div(days, 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * div(--days, 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    gy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const isLeap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0;
  const monthDays = [0, 31, isLeap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gm = 0;
  for (gm = 1; gm <= 12 && gd > monthDays[gm]; gm++) gd -= monthDays[gm];
  return [gy, gm, gd];
};

export const gregorianToJalali = (gy: number, gm: number, gd: number): [number, number, number] => {
  const gDaysInMonth = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    (365 * gy) +
    div(gy2 + 3, 4) -
    div(gy2 + 99, 100) +
    div(gy2 + 399, 400) +
    gd +
    gDaysInMonth.slice(0, gm).reduce((sum, value) => sum + value, 0);
  let jy = -1595 + (33 * div(days, 12053));
  days %= 12053;
  jy += 4 * div(days, 1461);
  days %= 1461;
  if (days > 365) {
    jy += div(days - 1, 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
};

/** Number of days in a given Jalali month (12th month depends on leap year). */
export const jalaliMonthLength = (jy: number, jm: number): number => {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: 30 days only in a leap year — detected by asking the calendar
  // itself whether 1/30/Esfand exists, i.e. whether it round-trips.
  const [gy, gm, gd] = jalaliToGregorian(jy, 12, 30);
  const [backYear, backMonth] = gregorianToJalali(gy, gm, gd);
  return backYear === jy && backMonth === 12 ? 30 : 29;
};

export const toEnglishDigits = (value: string): string =>
  value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));

export interface JalaliParts {
  year: number;
  month: number;
  day: number;
}

/** Parses "۱۴۰۵/۰۶/۲۲" or "1405/6/22"; returns null for anything unparsable. */
export const parseJalali = (value?: string): JalaliParts | null => {
  if (!value) return null;
  const parts = toEnglishDigits(value.trim()).split(/[\/\-]/).map((part) => parseInt(part, 10));
  if (parts.length < 3 || parts.some((part) => Number.isNaN(part))) return null;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
};

const pad = (value: number) => String(value).padStart(2, '0');

export const formatJalali = ({ year, month, day }: JalaliParts): string =>
  `${year}/${pad(month)}/${pad(day)}`;

/** Today, in the Jalali calendar, as "1405/06/22". */
export const todayJalali = (): string => {
  const now = new Date();
  const [year, month, day] = gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  return formatJalali({ year, month, day });
};

/**
 * Adds a number of days using a real Gregorian `Date`, so month/year
 * boundaries and leap days are handled by the platform, not by hand.
 */
export const addJalaliDays = (value: string, days: number): string | null => {
  const parts = parseJalali(value);
  if (!parts) return null;
  const [gy, gm, gd] = jalaliToGregorian(parts.year, parts.month, parts.day);
  const date = new Date(gy, gm - 1, gd);
  date.setDate(date.getDate() + days);
  const [year, month, day] = gregorianToJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return formatJalali({ year, month, day });
};

/**
 * Adds whole Jalali months, clamping the day to the target month's length
 * (e.g. 31 Mordad + 1 month = 30 Shahrivar, not an invalid 31 Shahrivar).
 */
export const addJalaliMonths = (value: string, months: number): string | null => {
  const parts = parseJalali(value);
  if (!parts) return null;
  const zeroBased = (parts.month - 1) + months;
  const year = parts.year + Math.floor(zeroBased / 12);
  const month = ((zeroBased % 12) + 12) % 12 + 1;
  const day = Math.min(parts.day, jalaliMonthLength(year, month));
  return formatJalali({ year, month, day });
};

/** Sortable/comparable numeric form of a Jalali date, e.g. 14050622. */
export const jalaliToNumber = (value?: string): number => {
  const parts = parseJalali(value);
  if (!parts) return 0;
  return (parts.year * 10000) + (parts.month * 100) + parts.day;
};

/** Negative when a < b, zero when equal, positive when a > b. */
export const compareJalali = (a?: string, b?: string): number => jalaliToNumber(a) - jalaliToNumber(b);
