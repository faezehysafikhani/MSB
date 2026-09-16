/**
 * «تأیید نهایی تایید جلسه» یک تصمیم اداری است و امضا محسوب نمی‌شود، پس
 * «جانشین امضا» نباید هیچ اثری روی آن داشته باشد.
 *
 * این Suite همین قاعده را قفل می‌کند تا دوباره سهواً به هم وصل نشوند، و
 * در کنارش تأیید می‌کند که جانشینی روی مراحل واقعی امضا همچنان کار می‌کند.
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

  const names = await page.evaluate(async () => {
    const s = await window.actor('user-8');
    const d = await window.actor('user-9');
    return { secretary: s.fullName, delegate: d.fullName };
  });

  // دبیر جلسه، یک کاربر عادی را جانشین امضای خود می‌کند (جانشینی فعال).
  const delegated = await page.evaluate(async () => {
    const mod = await import('/src/services/signatureDelegationService.ts');
    try {
      mod.setDelegation({ ownerUserId: 'user-8', delegateUserId: 'user-9', isActive: true }, await window.actor('user-8'));
      return 'OK';
    } catch (e) { return e.message; }
  });
  check('جانشین امضای دبیر جلسه تعیین شد (جانشینی فعال است)', delegated === 'OK', delegated);

  // پیشنهاد تا مرحله «در انتظار تأیید نهایی دبیر جلسه» پیش می‌رود.
  const propId = await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const res = await mod.proposalService.createProposal({
      title: 'پیشنهاد تست تایید جلسه اداری', description: 'شرح', rationale: 'دلیل',
      proposerName: 'مهندس آرش کریمی', proposerUserId: 'user-10',
      proposerDepartmentId: 'dept-1', proposerDepartmentName: 'اداره کل فناوری اطلاعات',
      presenterUserId: 'user-10', presenterName: 'مهندس آرش کریمی',
    });
    const id = res.data.id;
    await mod.proposalService.reviewProposal(id, 'APPROVED', 'تأیید', await window.actor('user-16'));
    await mod.proposalService.confirmForMeeting(id, await window.actor('user-17'));
    return id;
  });
  const statusOf = async () => page.evaluate((id) =>
    JSON.parse(localStorage.getItem('postbank-mosavabat-v1:proposals') || '[]').find((p) => p.id === id)?.status, propId);
  check('پیشنهاد در انتظار تأیید نهایی دبیر جلسه است',
    await statusOf() === 'PENDING_SECRETARY_CONFIRMATION', await statusOf());

  // ===== قاعده اصلی: جانشین امضا نباید بتواند تایید جلسه را نهایی کند =====
  const delegateTry = await page.evaluate(async (id) => {
    const mod = await import('/src/services/proposalService.ts');
    try { await mod.proposalService.finalizeMeetingConfirmation(id, 'APPROVED', undefined, await window.actor('user-9')); return 'ALLOWED'; }
    catch (e) { return e.message; }
  }, propId);
  check('جانشین امضا نمی‌تواند تأیید نهایی تایید جلسه را انجام دهد', delegateTry !== 'ALLOWED', delegateTry);
  check('وضعیت پیشنهاد پس از تلاش جانشین دست‌نخورده ماند',
    await statusOf() === 'PENDING_SECRETARY_CONFIRMATION', await statusOf());

  const switchUser = async (label) => {
    await page.locator('button:has-text("کاربر:")').first().click();
    await page.waitForTimeout(300);
    await page.locator('div.absolute button').filter({ hasText: label }).first().click();
    await page.waitForTimeout(800);
  };
  const openProposals = async () => {
    await page.locator('aside button:has-text("مصوبات پیشنهادی")').first().click();
    await page.waitForTimeout(1000);
  };
  // متن دکمه‌های تب مستقیماً خوانده می‌شود؛ «دبیر جلسه» در برچسب وضعیت
  // آیتم‌ها هم می‌آید، پس فقط دکمه‌هایی که با آن شروع می‌شوند شمرده می‌شوند.
  const secretaryTabs = async () =>
    (await page.locator('main button').allInnerTexts())
      .map((t) => t.trim())
      .filter((t) => t.startsWith('دبیر جلسه'));

  await switchUser(names.delegate);
  await openProposals();
  check('کارتابل «دبیر جلسه» برای جانشین امضا نمایش داده نمی‌شود',
    (await secretaryTabs()).length === 0, JSON.stringify(await secretaryTabs()));
  let body = await page.locator('main').first().innerText();
  check('مورد تایید جلسه در کارتابل جانشین دیده نمی‌شود',
    !body.includes('پیشنهاد تست تایید جلسه اداری'));
  check('هیچ برچسب «جانشینی» در کارتابل مصوبات پیشنهادی نیست', !body.includes('جانشینی'));

  // ===== خود دبیر جلسه مثل قبل کار می‌کند =====
  await switchUser(names.secretary);
  await openProposals();
  const ownerTabs = await secretaryTabs();
  check('کارتابل «دبیر جلسه» برای خود دبیر جلسه هست', ownerTabs.length === 1, JSON.stringify(ownerTabs));
  check('برچسب تب بدون پسوند جانشینی است',
    ownerTabs.length === 1 && !ownerTabs[0].includes('جانشینی'), JSON.stringify(ownerTabs));

  const ownerResult = await page.evaluate(async (id) => {
    const mod = await import('/src/services/proposalService.ts');
    await mod.proposalService.finalizeMeetingConfirmation(id, 'APPROVED', undefined, await window.actor('user-8'));
    const stored = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:proposals') || '[]').find((p) => p.id === id);
    const h = (stored.history || []).find((x) => String(x.action).includes('تأیید نهایی تایید جلسه'));
    return { status: stored.status, action: h?.action, actor: h?.actorName };
  }, propId);
  check('دبیر جلسه خودش تأیید نهایی را انجام داد', ownerResult.status === 'CONFIRMED_FOR_MEETING', ownerResult.status);
  check('سابقه دقیقاً مثل قبل و بدون اشاره به جانشینی ثبت شد',
    ownerResult.action === 'تأیید نهایی تایید جلسه توسط دبیر جلسه', ownerResult.action);
  check('نام اقدام‌کننده در سابقه خود دبیر جلسه است', ownerResult.actor === names.secretary, ownerResult.actor);

  // ===== جانشینی روی مراحل واقعی امضا همچنان کار می‌کند =====
  const signingStillDelegated = await page.evaluate(async () => {
    const del = await import('/src/services/signatureDelegationService.ts');
    return {
      // قاعده امضا: جانشین فعالِ همان امضاکننده مجاز است
      delegateAllowed: del.resolveSigningAuthority('user-8', 'user-9'),
      ownerAllowed: del.resolveSigningAuthority('user-8', 'user-8'),
      strangerAllowed: del.resolveSigningAuthority('user-8', 'user-13'),
      // تابع مخصوص مجوزها باید حذف شده باشد تا دوباره به تایید جلسه وصل نشود
      permissionHelperRemoved: typeof del.getDelegationGrantingPermission === 'undefined',
    };
  });
  check('جانشینی روی امضا دست‌نخورده است: جانشین مجاز به امضاست',
    signingStillDelegated.delegateAllowed.allowed === true && signingStillDelegated.delegateAllowed.asDelegate === true);
  check('امضاکننده اصلی همچنان مستقیم امضا می‌کند',
    signingStillDelegated.ownerAllowed.allowed === true && signingStillDelegated.ownerAllowed.asDelegate === false);
  check('کاربر غیرمرتبط همچنان مجاز به امضا نیست', signingStillDelegated.strangerAllowed.allowed === false);
  check('تابع اتصال جانشینی به مجوزها حذف شد', signingStillDelegated.permissionHelperRemoved === true);

  check('Regression: هیچ Crash/Runtime Error رخ نداد', pageErrors.length === 0, pageErrors.join(' | '));

  console.log(`\nMEETING CONFIRMATION vs SIGNATURE DELEGATION: ${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
