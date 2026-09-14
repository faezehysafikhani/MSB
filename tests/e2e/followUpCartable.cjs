const { chromium } = require('playwright');
const BASE = 'http://localhost:4179';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`); };

// Jalali helpers mirrored from src/utils/jalaliDate.ts, used only to compute
// the dates this test seeds and the values it expects.
const div = (a, b) => Math.trunc(a / b);
const j2g = (jy, jm, jd) => { let y = jy + 1595; let days = -355668 + 365 * y + div(y, 33) * 8 + div((y % 33) + 3, 4) + jd; days += jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186; let gy = 400 * div(days, 146097); days %= 146097; if (days > 36524) { gy += 100 * div(--days, 36524); days %= 36524; if (days >= 365) days++; } gy += 4 * div(days, 1461); days %= 1461; if (days > 365) { gy += div(days - 1, 365); days = (days - 1) % 365; } let gd = days + 1; const leap = (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0; const md = [0, 31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; let gm; for (gm = 1; gm <= 12 && gd > md[gm]; gm++) gd -= md[gm]; return [gy, gm, gd]; };
const g2j = (gy, gm, gd) => { const gm2 = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; const gy2 = gm > 2 ? gy + 1 : gy; let days = 355666 + 365 * gy + div(gy2 + 3, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + gm2.slice(0, gm).reduce((s, v) => s + v, 0); let jy = -1595 + 33 * div(days, 12053); days %= 12053; jy += 4 * div(days, 1461); days %= 1461; if (days > 365) { jy += div(days - 1, 365); days = (days - 1) % 365; } const jm = days < 186 ? 1 + div(days, 31) : 7 + div(days - 186, 30); const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30); return [jy, jm, jd]; };
const pad = (n) => String(n).padStart(2, '0');
const fmt = ([y, m, d]) => `${y}/${pad(m)}/${pad(d)}`;
const today = () => { const n = new Date(); return fmt(g2j(n.getFullYear(), n.getMonth() + 1, n.getDate())); };
const addDays = (v, n) => { const [y, m, d] = v.split('/').map(Number); const [gy, gm, gd] = j2g(y, m, d); const dt = new Date(gy, gm - 1, gd); dt.setDate(dt.getDate() + n); return fmt(g2j(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())); };
const monthLen = (y, m) => m <= 6 ? 31 : m <= 11 ? 30 : (() => { const [gy, gm, gd] = j2g(y, 12, 30); const [by, bm] = g2j(gy, gm, gd); return by === y && bm === 12 ? 30 : 29; })();
const addMonths = (v, n) => { const [y, m, d] = v.split('/').map(Number); const zb = m - 1 + n; const ny = y + Math.floor(zb / 12); const nm = ((zb % 12) + 12) % 12 + 1; return fmt([ny, nm, Math.min(d, monthLen(ny, nm))]); };

const TODAY = today();

const switchUser = async (page, label) => {
  await page.locator('button:has-text("کاربر:")').first().click();
  await page.waitForTimeout(300);
  await page.locator('div.absolute button').filter({ hasText: label }).first().click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
};

const readLS = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(`postbank-mosavabat-v1:${k}`) || 'null'), key);

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
  page.on('dialog', async (d) => { await d.accept(); });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  await page.evaluate(({ TODAY, plus30, minus1 }) => {
    const base = {
      meetingId: 'meet-1001', meetingTitle: 'هیئت مدیره - زیرساخت', meetingNumber: 'جلسه-۱۴۰۵-۱۴۲',
      proposerName: 'مهندس پوریا حسینی', proposerDepartment: 'اداره کل فناوری اطلاعات',
      requestDescription: 'شرح درخواست تست پیگیری', reviewResultNotes: 'نتیجه بررسی تست پیگیری',
      approvalStatus: 'APPROVED', mainResponsibleUserId: 'user-9', mainResponsibleName: 'مهندس سارا نیک‌نام',
      responsibleDepartmentId: 'dept-1', responsibleDepartmentName: 'اداره کل فناوری اطلاعات',
      assignedDateJalali: TODAY, deadlineJalali: '1405/08/22', priority: 'MEDIUM',
      referrals: [], verificationConfig: { requiresVerification: false, mode: 'SEQUENTIAL', currentStepIndex: 0, steps: [] },
      attachments: [], createdAt: new Date().toISOString(), executionStatus: 'IN_PROGRESS',
    };
    const plan = (type, start) => ({ enabled: true, type, startDateJalali: start, nextFollowUpDateJalali: start });
    localStorage.setItem('postbank-mosavabat-v1:resolutions', JSON.stringify([
      { ...base, id: 'r-weekly', resolutionNumber: 'مصوبه-QA-هفتگی', topicTitle: 'موضوع پیگیری هفتگی', followUp: plan('WEEKLY', TODAY) },
      { ...base, id: 'r-monthly', resolutionNumber: 'مصوبه-QA-ماهانه', topicTitle: 'موضوع پیگیری ماهانه', followUp: plan('MONTHLY', TODAY) },
      { ...base, id: 'r-quarterly', resolutionNumber: 'مصوبه-QA-فصلی', topicTitle: 'موضوع پیگیری فصلی', followUp: plan('QUARTERLY', TODAY) },
      { ...base, id: 'r-custom-future', resolutionNumber: 'مصوبه-QA-سفارشی-آینده', topicTitle: 'موضوع سفارشی آینده', followUp: plan('CUSTOM', plus30) },
      { ...base, id: 'r-custom-due', resolutionNumber: 'مصوبه-QA-سفارشی-رسیده', topicTitle: 'موضوع سفارشی رسیده', followUp: plan('CUSTOM', minus1) },
      { ...base, id: 'r-closed', resolutionNumber: 'مصوبه-QA-خاتمه', topicTitle: 'موضوع خاتمه‌یافته', executionStatus: 'APPROVED_CLOSED', followUp: plan('WEEKLY', TODAY) },
    ]));
    localStorage.setItem('postbank-mosavabat-v1:resolutionFollowUps', JSON.stringify([
      { id: 'fu-seed', resolutionId: 'r-custom-due', resolutionNumber: 'مصوبه-QA-سفارشی-رسیده', resolutionTitle: 'موضوع سفارشی رسیده', followUpDateJalali: minus1, text: 'پیگیری قبلی ثبت‌شده در سوابق.', attachments: [{ id: 'att-seed', fileName: 'سابقه-پیگیری.pdf', fileSizeBytes: 2048, fileExtension: 'pdf', uploadDate: minus1, uploadedBy: 'مسئول دفتر', downloadUrl: '#' }], createdByUserId: 'user-17', createdByName: 'مسئول دفتر', createdAt: new Date().toISOString() },
    ]));
    // Seeded so User B can reach the follow-up route straight from the bell,
    // bypassing the (hidden) menu entirely.
    localStorage.setItem('postbank-mosavabat-v1:notifications', JSON.stringify([
      { id: 'notif-direct', recipientUserId: 'user-9', title: 'ورود مستقیم', message: 'ورود مستقیم به کارتابل پیگیری', dateJalali: TODAY, timeString: '۰۹:۰۰', isRead: false, type: 'FOLLOW_UP', targetRoute: 'follow-up' },
    ]));
  }, { TODAY, plus30: addDays(TODAY, 30), minus1: addDays(TODAY, -1) });

  // ================= Test 1 — Permission =================
  await switchUser(page, 'مسئول دفتر');
  check('CR-A Test1 کاربر دارای مجوز منوی «پیگیری» را می‌بیند', await page.locator('aside button:has-text("پیگیری")').count() > 0);

  await page.locator('aside button:has-text("پیگیری")').first().click();
  await page.waitForTimeout(900);

  // ================= Test 2/3/4/5 — schedule & cartable membership ============
  const bodyText = await page.locator('body').innerText();
  check('CR-A Test2 مصوبه هفتگی در کارتابل است', bodyText.includes('موضوع پیگیری هفتگی'));
  check('CR-A Test3 مصوبه ماهانه در کارتابل است', bodyText.includes('موضوع پیگیری ماهانه'));
  check('CR-A Test4 مصوبه فصلی در کارتابل است', bodyText.includes('موضوع پیگیری فصلی'));
  check('CR-A Test5 سفارشی رسیده در کارتابل است', bodyText.includes('موضوع سفارشی رسیده'));
  check('CR-A Test5 سفارشی آینده هنوز در کارتابل نیست', !bodyText.includes('موضوع سفارشی آینده'));
  check('CR-A بند۱۴ مصوبه خاتمه‌یافته در کارتابل فعال نیست', !bodyText.includes('موضوع خاتمه‌یافته'));

  // Record a follow-up through the UI for each schedule type and assert the
  // next due date is computed by the real calendar, not string splicing.
  const recordFollowUp = async (topic, text, withFile) => {
    const row = page.locator('tbody tr').filter({ hasText: topic }).first();
    await row.locator('button:has-text("پیگیری")').click();
    await page.waitForTimeout(500);
    const form = page.locator('tr').filter({ hasText: 'ثبت پیگیری جدید' });
    await form.locator('textarea').fill(text);
    if (withFile) {
      await form.locator('input[type="file"]').setInputFiles({ name: 'گزارش-پیگیری.pdf', mimeType: 'application/pdf', buffer: Buffer.from('follow-up evidence') });
      await page.waitForTimeout(200);
    }
    await form.locator('button:has-text("ثبت پیگیری")').click();
    await page.waitForTimeout(900);
  };

  await recordFollowUp('موضوع پیگیری هفتگی', 'پیگیری اول هفتگی انجام شد.', true);
  await recordFollowUp('موضوع پیگیری ماهانه', 'پیگیری اول ماهانه انجام شد.', false);
  await recordFollowUp('موضوع پیگیری فصلی', 'پیگیری اول فصلی انجام شد.', false);

  const resolutions = await readLS(page, 'resolutions');
  const byId = (id) => resolutions.find((r) => r.id === id);
  check('CR-A Test2 موعد بعدی هفتگی = امروز + ۷ روز', byId('r-weekly').followUp.nextFollowUpDateJalali === addDays(TODAY, 7), `${byId('r-weekly').followUp.nextFollowUpDateJalali} vs ${addDays(TODAY, 7)}`);
  check('CR-A Test3 موعد بعدی ماهانه = امروز + ۱ ماه', byId('r-monthly').followUp.nextFollowUpDateJalali === addMonths(TODAY, 1), `${byId('r-monthly').followUp.nextFollowUpDateJalali} vs ${addMonths(TODAY, 1)}`);
  check('CR-A Test4 موعد بعدی فصلی = امروز + ۳ ماه', byId('r-quarterly').followUp.nextFollowUpDateJalali === addMonths(TODAY, 3), `${byId('r-quarterly').followUp.nextFollowUpDateJalali} vs ${addMonths(TODAY, 3)}`);
  check('CR-A بند۱۶ LastFollowUpDate ثبت شد', byId('r-weekly').followUp.lastFollowUpDateJalali === TODAY);
  check('CR-A بند۱۹ وضعیت اجرای مصوبه دست‌نخورده ماند', ['r-weekly', 'r-monthly', 'r-quarterly'].every((id) => byId(id).executionStatus === 'IN_PROGRESS'));

  const records = await readLS(page, 'resolutionFollowUps');
  const weeklyRecord = records.find((r) => r.resolutionId === 'r-weekly');
  check('CR-A Test6 متن پیگیری ذخیره شد', weeklyRecord?.text === 'پیگیری اول هفتگی انجام شد.');
  check('CR-A Test6 فایل پیوست به همان Follow-up Record ذخیره شد', weeklyRecord?.attachments?.[0]?.fileName === 'گزارش-پیگیری.pdf');
  check('CR-A Test6 مسئول پیگیری ثبت شد', weeklyRecord?.createdByName === 'مسئول دفتر');

  // ================= Test 6 — persistence across refresh + item leaves list ===
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.locator('aside button:has-text("پیگیری")').first().click();
  await page.waitForTimeout(900);
  const afterReload = await page.locator('body').innerText();
  check('CR-A بند۱۶ مصوبه پس از ثبت پیگیری از لیست فعلی خارج شد', !afterReload.includes('موضوع پیگیری هفتگی'));

  // The recorded follow-ups survive the refresh in storage...
  const recordsAfterReload = await readLS(page, 'resolutionFollowUps');
  check('CR-A Test6 رکوردهای پیگیری پس از Refresh باقی مانده‌اند', recordsAfterReload.filter((r) => ['r-weekly', 'r-monthly', 'r-quarterly'].includes(r.resolutionId)).length === 3);

  // ...and the history renders in the cartable for a row that is still due.
  const dueRow = page.locator('tbody tr').filter({ hasText: 'موضوع سفارشی رسیده' }).first();
  await dueRow.locator('button:has-text("پیگیری")').click();
  await page.waitForTimeout(800);
  const historyText = await page.locator('body').innerText();
  check('CR-A بند۱۳ تاریخچه پیگیری نمایش داده می‌شود', historyText.includes('پیگیری قبلی ثبت‌شده در سوابق.'));
  check('CR-A بند۱۳ فایل پیوست در تاریخچه دیده می‌شود', historyText.includes('سابقه-پیگیری.pdf'));
  check('CR-A بند۱۳ مسئول پیگیری در تاریخچه دیده می‌شود', historyText.includes('مسئول پیگیری: مسئول دفتر'));

  // ================= Test 1 (cont.) — User B =================
  await switchUser(page, 'مهندس سارا نیک‌نام');
  check('CR-A Test1 کاربر بدون مجوز منوی «پیگیری» را نمی‌بیند', await page.locator('aside button:has-text("پیگیری")').count() === 0);

  // Reach the route directly via the seeded notification, bypassing the menu.
  await page.locator('button[title="اعلان‌ها و اطلاعیه‌ها"]').first().click();
  await page.waitForTimeout(400);
  await page.locator('text=ورود مستقیم به کارتابل پیگیری').first().click();
  await page.waitForTimeout(900);
  const deniedText = await page.locator('body').innerText();
  check('CR-A Test1 ورود مستقیم به Route پیگیری برای کاربر بدون مجوز Reject شد', deniedText.includes('دسترسی غیرمجاز') && !deniedText.includes('کارتابل پیگیری مصوبات'));

  console.log(`\nFOLLOW-UP: ${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
