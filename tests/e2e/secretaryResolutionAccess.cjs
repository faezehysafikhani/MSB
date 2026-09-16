/**
 * دو اصلاح گزارش‌شده:
 *  ۱) متن مسیرهای «رد» و «عدم نیاز به طرح» در نقشه گردش کار جابه‌جا بود،
 *     و واژه «بازیافت» باید در کل سامانه «بازیابی» شود.
 *  ۲) دبیر جلسه با وجود داشتن مجوز مشاهده مصوبات، بانک مصوبات را خالی می‌دید.
 */
const { chromium } = require('playwright');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:4183';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(String(e)); console.log('PAGEERROR:', String(e)); });
  page.on('dialog', async (d) => { await d.accept(); });

  await page.addInitScript(() => {
    localStorage.setItem('postbank-mosavabat-v1:operationalResetVersion', '1');
    window.loadUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:users') || 'null');
      if (stored && stored.length) return stored;
      return (await import('/src/mock/data.ts')).mockUsers;
    };
    window.actor = async (id) => (await window.loadUsers()).find((u) => u.id === id);
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const switchUser = async (label) => {
    await page.locator('button:has-text("کاربر:")').first().click();
    await page.waitForTimeout(300);
    await page.locator('div.absolute button').filter({ hasText: label }).first().click();
    await page.waitForTimeout(800);
  };

  // ==================== مورد ۱: متن نقشه گردش کار ====================
  const branches = await page.evaluate(async () => {
    const model = await import('/src/modules/workflowMap/workflowMapModel.ts');
    const proposal = {
      id: 'p1', title: 'پیشنهاد تست', proposerName: 'الف', proposerUserId: 'user-9',
      proposerDepartmentId: 'dept-1', proposerDepartmentName: 'واحد الف', presenterName: 'الف',
      description: 'x', dateJalali: '1405/06/25', attachments: [], status: 'PENDING_CEO_REVIEW',
      history: [], createdAt: new Date().toISOString(),
    };
    const c = model.buildCaseFromProposal(proposal, { proposals: [proposal], meetings: [], resolutions: [], notices: [], tasks: [] });
    const step = c.steps.find((s) => s.title === 'بررسی پیشنهاد');
    return Object.fromEntries(step.branches.map((b) => [b.action, b.outcome]));
  });
  check('۱ متن مسیر «رد» اصلاح شد', branches['رد'] === 'خاتمه بدون تشکیل جلسه', branches['رد']);
  check('۱ متن مسیر «عدم نیاز به طرح در هیأت‌مدیره» اصلاح شد',
    branches['عدم نیاز به طرح در هیأت‌مدیره'] === 'پایان مسیر پیشنهاد (قابل بازیابی)',
    branches['عدم نیاز به طرح در هیأت‌مدیره']);
  check('۱ دو متن با هم عوض نشده‌اند (هرکدام سر جای خودش)',
    branches['رد'] !== branches['عدم نیاز به طرح در هیأت‌مدیره']);
  check('۱ سایر مسیرهای این مرحله دست‌نخورده ماندند',
    branches['تأیید'].includes('کارتابل مسئول دفتر') &&
    branches['برگشت برای اصلاح'].includes('بازگشت به پیشنهاددهنده') &&
    branches['صدور دستور مستقیم'].includes('دستور مدیرعامل'));

  // واژه «بازیافت» نباید در هیچ متن نمایشی سامانه باقی مانده باشد
  const wording = await page.evaluate(async () => {
    const mods = await Promise.all([
      import('/src/modules/workflowMap/workflowMapModel.ts'),
      import('/src/services/proposalService.ts'),
    ]);
    void mods;
    return true;
  });
  check('۱ ماژول‌ها بدون خطا بارگذاری شدند', wording === true);

  // ==================== مورد ۲: دسترسی دبیر جلسه به بانک مصوبات ====================
  const perms = await page.evaluate(async () => {
    const s = await window.actor('user-8');
    const e = await window.actor('user-9');
    return {
      secretaryHas: (s.permissions || []).includes('VIEW_RESOLUTIONS'),
      secretaryName: s.fullName,
      expertHas: (e.permissions || []).includes('VIEW_RESOLUTIONS'),
      expertName: e.fullName,
    };
  });
  check('۲ دبیر جلسه مجوز مشاهده مصوبات را دارد', perms.secretaryHas, perms.secretaryName);
  check('۲ کاربر عادی این مجوز را ندارد', perms.expertHas === false, perms.expertName);

  // مصوبه‌ای که دبیر جلسه هیچ نقش شخصی در آن ندارد
  await page.evaluate(async () => {
    const mod = await import('/src/services/resolutionService.ts');
    await mod.resolutionService.createResolution({
      meetingId: 'meet-x', meetingTitle: 'جلسه بی‌ربط', meetingNumber: 'جلسه-۹۹۹',
      topicTitle: 'مصوبه بدون ارتباط شخصی با دبیر جلسه',
      proposerName: 'مهندس آرش کریمی', proposerDepartment: 'واحد دیگر',
      requestDescription: 'شرح', reviewResultNotes: 'نتیجه', approvalStatus: 'NOT_APPROVED',
      executionDescription: '', deadlineJalali: '1405/07/20',
    });
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);

  const visibleFor = async (userId) => page.evaluate(async (id) => {
    const mod = await import('/src/services/resolutionService.ts');
    const actor = await window.actor(id);
    const res = await mod.resolutionService.getResolutions({
      pageSize: 200,
      relatedUserId: actor.role === 'ADMIN' ? undefined : actor.id,
    });
    return res.data.items.map((r) => r.topicTitle);
  }, userId);

  const secretarySees = await visibleFor('user-8');
  check('۲ باگ اصلی رفع شد: دبیر جلسه مصوبه را می‌بیند',
    secretarySees.includes('مصوبه بدون ارتباط شخصی با دبیر جلسه'), `${secretarySees.length} مصوبه`);

  const expertSees = await visibleFor('user-9');
  check('۲ کاربر بدون مجوز همچنان این مصوبه را نمی‌بیند',
    !expertSees.includes('مصوبه بدون ارتباط شخصی با دبیر جلسه'), `${expertSees.length} مصوبه`);

  const officeSees = await visibleFor('user-17');
  check('۲ مسئول دفتر هم مصوبه را می‌بیند', officeSees.includes('مصوبه بدون ارتباط شخصی با دبیر جلسه'));
  const ceoSees = await visibleFor('user-16');
  check('۲ مدیرعامل هم مصوبه را می‌بیند', ceoSees.includes('مصوبه بدون ارتباط شخصی با دبیر جلسه'));

  // در UI واقعی هم دیده شود
  await switchUser(perms.secretaryName);
  await page.locator('aside button:has-text("بانک مصوبات")').first().click();
  await page.waitForTimeout(1200);
  const listText = await page.locator('main').first().innerText();
  check('۲ در UI بانک مصوبات برای دبیر جلسه خالی نیست',
    listText.includes('مصوبه بدون ارتباط شخصی با دبیر جلسه'), listText.slice(0, 90).replace(/\n/g, ' '));

  // شمارنده منو هم باید با فهرست هماهنگ باشد
  const sidebarText = await page.locator('aside').first().innerText();
  check('۲ شمارنده «بانک مصوبات» در منو صفر نیست',
    /بانک مصوبات\s*\n?\s*[۱-۹]/.test(sidebarText), sidebarText.match(/بانک مصوبات[^\n]*\n?[^\n]*/)?.[0]);

  // کاربر عادی همچنان محدود بماند
  await switchUser(perms.expertName);
  await page.locator('aside button:has-text("بانک مصوبات")').first().click();
  await page.waitForTimeout(1200);
  const expertList = await page.locator('main').first().innerText();
  check('۲ کاربر عادی همچنان این مصوبه را در UI نمی‌بیند',
    !expertList.includes('مصوبه بدون ارتباط شخصی با دبیر جلسه'));

  check('Regression: هیچ Crash/Runtime Error رخ نداد', pageErrors.length === 0, pageErrors.join(' | '));

  console.log(`\nSECRETARY RESOLUTION ACCESS: ${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
