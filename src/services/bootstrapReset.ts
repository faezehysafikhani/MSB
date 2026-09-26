// باید پیش از Initialize شدن سرویس‌ها اجرا شود (سرویس‌ها در لحظه Import داده
// را می‌خوانند)؛ به همین دلیل اولین Import در main.tsx است.
//
// داده نمونه (با برچسب «نمونه») در این موارد بارگذاری می‌شود:
// - اگر در این مرورگر هرگز بارگذاری یا بازنشانی نشده باشد؛
// - اگر نسخه قدیمی‌تری از آن قبلاً بارگذاری شده باشد.
// بارگذاری فقط رکوردهای «demo-» را جایگزین می‌کند و داده دستی را پاک نمی‌کند.
// اگر مدیر داده نمونه را بازنشانی کرده باشد، دیگر خودکار برنمی‌گردد.
import { DEMO_DATA_VERSION, getDemoDataInfo, loadDemoData } from './demoDataService';

const PREFIX = 'postbank-mosavabat-v1:';

try {
  const markerSaved = window.localStorage.getItem(`${PREFIX}demoDataVersion`) !== null;
  const info = getDemoDataInfo();
  if (!markerSaved || (info && info.version < DEMO_DATA_VERSION)) loadDemoData();
} catch {
  // دسترسی به localStorage ممکن نیست؛ سامانه بدون داده نمونه اجرا می‌شود.
}
