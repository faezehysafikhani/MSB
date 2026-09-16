const { chromium } = require('playwright');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:4179';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`); };

const readProposals = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('postbank-mosavabat-v1:proposals') || '[]'));
const statusOf = async (page, id) => (await readProposals(page)).find((p) => p.id === id)?.status;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
  page.on('dialog', async (d) => { await d.accept(); });

  await page.addInitScript(() => {
    window.loadUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:users') || 'null');
      if (stored && stored.length) return stored;
      const data = await import('/src/mock/data.ts');
      return data.mockUsers;
    };
    window.actor = async (id) => (await window.loadUsers()).find((u) => u.id === id);
  });
  // این Suite یک مرورگرِ از قبل Reset‌شده را شبیه‌سازی می‌کند: Marker پیش از
  // بارگذاری هر صفحه ثبت می‌شود تا Reset یک‌باره داده‌های Seed تست را پاک نکند.
  await page.addInitScript(() => {
    localStorage.setItem('postbank-mosavabat-v1:operationalResetVersion', '1');
  });


  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // Two proposals already approved by the CEO, waiting on the office manager.
  await page.evaluate(() => {
    const base = {
      proposerName: 'مهندس سارا نیک‌نام', proposerUserId: 'user-9',
      proposerDepartmentId: 'dept-1', proposerDepartmentName: 'اداره کل فناوری اطلاعات',
      presenterUserId: 'user-9', presenterName: 'مهندس سارا نیک‌نام',
      description: 'شرح پیشنهاد تست چرخه تأیید', rationale: 'دلیل تست',
      dateJalali: '1405/06/20', attachments: [], status: 'APPROVED',
      history: [], createdAt: new Date().toISOString(),
    };
    localStorage.setItem('postbank-mosavabat-v1:proposals', JSON.stringify([
      { ...base, id: 'prop-approve', title: 'پیشنهاد مسیر تأیید' },
      { ...base, id: 'prop-return', title: 'پیشنهاد مسیر برگشت' },
    ]));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  // ===== مسئول دفتر → تبدیل به تایید جلسه (هر دو) =====
  await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const office = await window.actor('user-17');
    await mod.proposalService.confirmForMeeting('prop-approve', office);
    await mod.proposalService.confirmForMeeting('prop-return', office);
  });
  await page.waitForTimeout(500);
  check('تبدیل به تایید جلسه → در انتظار تأیید دبیر جلسه', await statusOf(page, 'prop-approve') === 'PENDING_SECRETARY_CONFIRMATION');

  // ===== مسیر ۱: دبیر جلسه تأیید می‌کند =====
  await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const secretary = await window.actor('user-8');
    await mod.proposalService.finalizeMeetingConfirmation('prop-approve', 'APPROVED', undefined, secretary);
  });
  await page.waitForTimeout(500);

  const afterApprove = await statusOf(page, 'prop-approve');
  check('باگ اصلی: تأیید دبیر جلسه دیگر به APPROVED برنمی‌گردد', afterApprove !== 'APPROVED', afterApprove);
  check('تأیید دبیر جلسه → «تایید جلسه شده»', afterApprove === 'CONFIRMED_FOR_MEETING', afterApprove);

  // The loop is only truly broken if the office manager can no longer re-convert it.
  const reconvert = await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const office = await window.actor('user-17');
    try { await mod.proposalService.confirmForMeeting('prop-approve', office); return 'ALLOWED'; }
    catch (e) { return e.message; }
  });
  check('چرخه بسته شد: مسئول دفتر نمی‌تواند دوباره تبدیل کند', reconvert !== 'ALLOWED', reconvert);
  check('وضعیت پس از تلاش مجدد دست‌نخورده ماند', await statusOf(page, 'prop-approve') === 'CONFIRMED_FOR_MEETING');

  // ===== مسیر ۲: دبیر جلسه «جهت اصلاح» می‌زند =====
  await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const secretary = await window.actor('user-8');
    await mod.proposalService.finalizeMeetingConfirmation('prop-return', 'RETURNED_FOR_REVISION', 'اصلاح عنوان لازم است', secretary);
  });
  await page.waitForTimeout(500);

  const afterReturn = await statusOf(page, 'prop-return');
  check('برگشت دبیر جلسه → کارتابل مسئول دفتر، نه مستقیم پیشنهاددهنده', afterReturn === 'RETURNED_BY_SECRETARY', afterReturn);

  // پیشنهاددهنده هنوز نباید بتواند اصلاح و ارسال مجدد کند.
  const earlyResubmit = await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const proposer = await window.actor('user-9');
    try { await mod.proposalService.resubmitProposal('prop-return', { title: 'x', description: 'y' }, proposer); return 'ALLOWED'; }
    catch (e) { return e.message; }
  });
  check('پیشنهاددهنده پیش از اقدام مسئول دفتر نمی‌تواند اصلاح کند', earlyResubmit !== 'ALLOWED', earlyResubmit);

  // مسئول دفتر آن را جهت اصلاح به پیشنهاددهنده برمی‌گرداند.
  await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const office = await window.actor('user-17');
    await mod.proposalService.forwardSecretaryReturnToProposer('prop-return', 'لطفاً عنوان اصلاح شود', office);
  });
  await page.waitForTimeout(500);
  check('مسئول دفتر «جهت اصلاح» زد → کارتابل پیشنهاددهنده', await statusOf(page, 'prop-return') === 'RETURNED_FOR_REVISION');

  // و حالا پیشنهاددهنده می‌تواند اصلاح و ارسال مجدد کند.
  await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const proposer = await window.actor('user-9');
    await mod.proposalService.resubmitProposal('prop-return', { title: 'پیشنهاد مسیر برگشت (اصلاح‌شده)', description: 'شرح اصلاح‌شده' }, proposer);
  });
  await page.waitForTimeout(500);
  check('پیشنهاددهنده اصلاح و ارسال مجدد کرد → کارتابل مدیرعامل', await statusOf(page, 'prop-return') === 'RESUBMITTED');

  // ===== دسترسی: فقط مسئول دفتر مسیر برگشت را جلو می‌برد =====
  const byProposer = await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const proposer = await window.actor('user-9');
    try { await mod.proposalService.forwardSecretaryReturnToProposer('prop-approve', 'x', proposer); return 'ALLOWED'; }
    catch (e) { return e.message; }
  });
  check('کاربر عادی نمی‌تواند برگشت دبیر جلسه را منتقل کند', byProposer !== 'ALLOWED', byProposer);

  // ===== تاریخچه هر دو مسیر ثبت شده باشد =====
  const proposals = await readProposals(page);
  const returned = proposals.find((p) => p.id === 'prop-return');
  check('تاریخچه: برگشت دبیر جلسه ثبت شد', (returned.history || []).some((h) => h.action.includes('برگشت تایید جلسه توسط دبیر جلسه')));
  check('تاریخچه: برگشت مسئول دفتر به پیشنهاددهنده ثبت شد', (returned.history || []).some((h) => h.action.includes('پس از برگشت دبیر جلسه')));

  // ===== دبیر جلسه دیگر این موارد را در کارتابلش نمی‌بیند =====
  const stillQueued = proposals.filter((p) => p.status === 'PENDING_SECRETARY_CONFIRMATION').length;
  check('کارتابل دبیر جلسه خالی شد', stillQueued === 0, String(stillQueued));

  console.log(`\nPROPOSAL CONFIRMATION LOOP: ${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
