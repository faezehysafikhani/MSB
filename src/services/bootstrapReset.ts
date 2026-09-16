import { runOneTimeOperationalReset } from './dataReset';

/**
 * Side-effect module: Reset یک‌باره داده عملیاتی را همین‌جا، در لحظه
 * Import اجرا می‌کند.
 *
 * چرا یک ماژول جداگانه؟ چون سرویس‌هایی مثل resolutionService و userService
 * داده را در همان لحظه Import در حافظه می‌خوانند
 * (`private resolutions = loadLocalCollection(...)`). اگر Reset در بدنه
 * main.tsx صدا زده شود، دیر است: سرویس‌ها داده قدیمی را از قبل در حافظه
 * گرفته‌اند و اولین persist() آن را دوباره روی Storage می‌نویسد.
 *
 * بنابراین این ماژول باید پیش از هر Import دیگری در main.tsx بیاید.
 */
runOneTimeOperationalReset();
