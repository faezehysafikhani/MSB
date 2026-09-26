// باید پیش از Initialize شدن سرویس‌ها اجرا شود (سرویس‌ها در لحظه Import داده
// را می‌خوانند)؛ به همین دلیل اولین Import در main.tsx است.
//
// داده نمونه (با برچسب «نمونه») در این موارد بارگذاری می‌شود:
// - اگر در این مرورگر هرگز بارگذاری یا بازنشانی نشده باشد؛
// - اگر نسخه قدیمی‌تری از آن قبلاً بارگذاری شده باشد.
// بارگذاری فقط رکوردهای «demo-» را جایگزین می‌کند و داده دستی را پاک نمی‌کند.
// اگر مدیر داده نمونه را بازنشانی کرده باشد، دیگر خودکار برنمی‌گردد.
import { DEMO_DATA_VERSION, getDemoDataInfo, loadDemoData } from './demoDataService';
import { mockUsers } from '../mock/data';

const PREFIX = 'postbank-mosavabat-v1:';

try {
  // جبران نسخه‌ای که به اشتباه فقط سه پروفایل را نگه داشته بود. این بازگردانی
  // فقط فهرست پایه کاربران را برمی‌گرداند و داده‌های عملیاتی پاک‌شده را جعل
  // یا بازسازی نمی‌کند.
  if (window.localStorage.getItem(`${PREFIX}rosterRestoreVersion`) !== '3') {
    window.localStorage.setItem(`${PREFIX}users`, JSON.stringify(mockUsers));
    window.localStorage.setItem(`${PREFIX}currentUserId`, JSON.stringify('user-admin'));
    // امضاکنندگان را به افراد مشخص وصل می‌کنیم؛ بنابراین حتی اگر یک نقش دیگر
    // در آینده اضافه شود، ترتیب سه امضای مورد تأیید تغییر نمی‌کند.
    window.localStorage.setItem(`${PREFIX}signatureWorkflowSettings`, JSON.stringify({ stages: {
      RESOLUTION_STEP_1: { mode: 'USER', userId: 'user-17' },
      RESOLUTION_STEP_2: { mode: 'USER', userId: 'user-16' },
      RESOLUTION_STEP_3: { mode: 'USER', userId: 'user-admin' },
      RESOLUTION_NOTICE: { mode: 'MEETING_SECRETARY' },
    } }));
    // فقط رکوردهای نمایشی را اضافه می‌کند؛ رکوردهای دستی کاربر دست‌نخورده
    // می‌مانند. نمونه‌ها از فهرست کاربران عملیاتی جدید استفاده می‌کنند.
    loadDemoData();
    window.localStorage.setItem(`${PREFIX}rosterRestoreVersion`, '3');
  }
  const markerSaved = window.localStorage.getItem(`${PREFIX}demoDataVersion`) !== null;
  const info = getDemoDataInfo();
  if (!markerSaved || (info && info.version < DEMO_DATA_VERSION)) loadDemoData();
} catch {
  // دسترسی به localStorage ممکن نیست؛ سامانه بدون داده نمونه اجرا می‌شود.
}
