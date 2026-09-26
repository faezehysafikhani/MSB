// باید پیش از Initialize شدن سرویس‌ها اجرا شود (سرویس‌ها در لحظه Import داده
// را می‌خوانند)؛ به همین دلیل اولین Import در main.tsx است.
//
// داده نمونه (با برچسب «نمونه») در این موارد بارگذاری می‌شود:
// - اگر در این مرورگر هرگز بارگذاری یا بازنشانی نشده باشد؛
// - اگر نسخه قدیمی‌تری از آن قبلاً بارگذاری شده باشد.
// بارگذاری فقط رکوردهای «demo-» را جایگزین می‌کند و داده دستی را پاک نمی‌کند.
// اگر مدیر داده نمونه را بازنشانی کرده باشد، دیگر خودکار برنمی‌گردد.
import { mockUsers } from '../mock/data';

const PREFIX = 'postbank-mosavabat-v1:';

try {
  // کاربر درخواست کرده است فقط سه فرد عملیاتی بمانند. این مهاجرت یک‌بار
  // فهرست افراد و تمام پرونده‌های وابستهٔ قبلی را پاک می‌کند تا نام یا ارجاع
  // پنهانی از افراد حذف‌شده در جلسه‌ها و کارتابل‌ها باقی نماند.
  const rosterVersionKey = `${PREFIX}rosterVersion`;
  if (window.localStorage.getItem(rosterVersionKey) !== '1') {
    window.localStorage.setItem(`${PREFIX}users`, JSON.stringify(mockUsers));
    ['meetings', 'resolutions', 'tasks', 'approvals', 'activityLogs', 'notifications', 'boardMinutes', 'resolutionNotices', 'resolutionFollowUps', 'governanceAudit', 'outcomeLetters', 'archiveFolders', 'archiveItems', 'proposals'].forEach((key) => window.localStorage.setItem(`${PREFIX}${key}`, '[]'));
    window.localStorage.setItem(`${PREFIX}currentUserId`, JSON.stringify('user-14'));
    window.localStorage.setItem(`${PREFIX}signatureWorkflowSettings`, JSON.stringify({ stages: {
      RESOLUTION_STEP_1: { mode: 'USER', userId: 'user-8' },
      RESOLUTION_STEP_2: { mode: 'USER', userId: 'user-9' },
      RESOLUTION_STEP_3: { mode: 'USER', userId: 'user-14' },
      RESOLUTION_NOTICE: { mode: 'MEETING_SECRETARY' },
    } }));
    // داده نمونهٔ قدیمی افراد حذف‌شده را بازنگرداند.
    window.localStorage.setItem(`${PREFIX}demoDataVersion`, JSON.stringify({ version: 999, loadedAt: new Date().toISOString() }));
    window.localStorage.setItem(rosterVersionKey, '1');
  }
} catch {
  // دسترسی به localStorage ممکن نیست؛ سامانه با داده پایه اجرا می‌شود.
}
