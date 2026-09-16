/**
 * باگ گزارش‌شده: پس از تعیین جانشین برای دبیر جلسه، «تایید جلسه»ای که
 * مسئول دفتر می‌زند همچنان فقط به کارتابل دبیر جلسه می‌رفت و جانشین آن را
 * نمی‌دید. این Suite همان سناریو را از ابتدا تا انتها می‌سنجد.
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

  // user-8 دبیر جلسه (دارنده APPROVE_MEETING_CONFIRMATION)، user-9 کاربر عادی
  const whoHasPermission = await page.evaluate(async () => {
    const users = await window.loadUsers();
    const s = users.find((u) => u.id === 'user-8');
    const d = users.find((u) => u.id === 'user-9');
    return {
      secretaryHas: (s.permissions || []).includes('APPROVE_MEETING_CONFIRMATION'),
      delegateHas: (d.permissions || []).includes('APPROVE_MEETING_CONFIRMATION'),
      secretaryName: s.fullName, delegateName: d.fullName,
    };
  });
  check('دبیر جلسه مجوز تأیید تایید جلسه را دارد', whoHasPermission.secretaryHas, whoHasPermission.secretaryName);
  check('کاربر جانشین این مجوز را ندارد (باید صرفاً از راه جانشینی برسد)',
    whoHasPermission.delegateHas === false, whoHasPermission.delegateName);

  // پیشنهاد، تأیید مدیرعامل، و «تبدیل به تایید جلسه» توسط مسئول دفتر
  const propId = await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const res = await mod.proposalService.createProposal({
      title: 'پیشنهاد تست جانشینی تایید جلسه', description: 'شرح', rationale: 'دلیل',
      proposerName: 'مهندس سارا نیک‌نام', proposerUserId: 'user-9',
      proposerDepartmentId: 'dept-1', proposerDepartmentName: 'اداره کل فناوری اطلاعات',
      presenterUserId: 'user-9', presenterName: 'مهندس سارا نیک‌نام',
    });
    const id = res.data.id;
    await mod.proposalService.reviewProposal(id, 'APPROVED', 'تأیید', await window.actor('user-16'));
    await mod.proposalService.confirmForMeeting(id, await window.actor('user-17'));
    return id;
  });
  const statusOf = async () => page.evaluate((id) =>
    JSON.parse(localStorage.getItem('postbank-mosavabat-v1:proposals') || '[]').find((p) => p.id === id)?.status, propId);
  check('«تبدیل به تایید جلسه» توسط مسئول دفتر انجام شد',
    await statusOf() === 'PENDING_SECRETARY_CONFIRMATION', await statusOf());

  // ——— پیش از تعیین جانشین: جانشین نباید دسترسی داشته باشد ———
  const beforeDelegation = await page.evaluate(async (id) => {
    const mod = await import('/src/services/proposalService.ts');
    try { await mod.proposalService.finalizeMeetingConfirmation(id, 'APPROVED', undefined, await window.actor('user-9')); return 'ALLOWED'; }
    catch (e) { return e.message; }
  }, propId);
  check('پیش از تعیین جانشین، کاربر عادی نمی‌تواند تأیید کند', beforeDelegation !== 'ALLOWED', beforeDelegation);

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

  await switchUser(whoHasPermission.delegateName);
  await openProposals();
  // عبارت «دبیر جلسه» در برچسب وضعیت آیتم‌ها هم می‌آید، پس دقیقاً روی
  // دکمه تب بررسی می‌شود نه کل متن صفحه.
  const secretaryTab = () => page.locator('main button').filter({ hasText: /^دبیر جلسه( \(جانشینی\))?( |\n|$)/ });
  check('پیش از تعیین جانشین، تب «دبیر جلسه» برای این کاربر دیده نمی‌شود',
    await secretaryTab().count() === 0, `tabs=${await secretaryTab().count()}`);
  let body = await page.locator('main').first().innerText();

  // ——— دبیر جلسه، این کاربر را جانشین خود می‌کند ———
  const delegated = await page.evaluate(async () => {
    const mod = await import('/src/services/signatureDelegationService.ts');
    const secretary = await window.actor('user-8');
    try {
      mod.setDelegation({ ownerUserId: 'user-8', delegateUserId: 'user-9', isActive: true }, secretary);
      return 'OK';
    } catch (e) { return e.message; }
  });
  check('دبیر جلسه جانشین خود را تعیین کرد', delegated === 'OK', delegated);

  // ——— باگ اصلی: حالا باید در کارتابل جانشین دیده شود ———
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await openProposals();
  body = await page.locator('main').first().innerText();
  check('باگ اصلی رفع شد: تب «دبیر جلسه» در کارتابل جانشین ظاهر شد',
    await secretaryTab().count() > 0, `tabs=${await secretaryTab().count()}`);
  check('تب به‌وضوح «جانشینی» را نشان می‌دهد', body.includes('جانشینی'), body.match(/دبیر جلسه[^\n]*/)?.[0]);
  check('مورد «تایید جلسه» در کارتابل جانشین دیده می‌شود', body.includes('پیشنهاد تست جانشینی تایید جلسه'));
  check('کارتابل صریحاً می‌گوید به جانشینی از چه کسی است',
    body.includes(`به جانشینی از ${whoHasPermission.secretaryName}`), body.match(/به جانشینی از[^\n]*/)?.[0]);

  // ——— جانشین اقدام می‌کند ———
  await page.locator('main button').filter({ hasText: 'تأیید نهایی' }).first().click();
  await page.waitForTimeout(1400);
  check('جانشین توانست تأیید نهایی تایید جلسه را انجام دهد',
    await statusOf() === 'CONFIRMED_FOR_MEETING', await statusOf());

  const history = await page.evaluate((id) =>
    JSON.parse(localStorage.getItem('postbank-mosavabat-v1:proposals') || '[]')
      .find((p) => p.id === id)?.history || [], propId);
  const entry = history.find((h) => String(h.action).includes('تأیید نهایی تایید جلسه'));
  check('سابقه می‌گوید اقدام به جانشینی انجام شده', Boolean(entry) && entry.action.includes('به جانشینی از'), entry?.action);
  check('سابقه نام اقدام‌کننده واقعی را ثبت کرده',
    Boolean(entry) && entry.actorName === whoHasPermission.delegateName, entry?.actorName);
  check('سابقه نام شخص اصلی را هم نگه داشته',
    Boolean(entry) && entry.action.includes(whoHasPermission.secretaryName), entry?.action);

  // ——— دبیر جلسه خودش همچنان می‌تواند کار کند ———
  const ownerStillWorks = await page.evaluate(async () => {
    const mod = await import('/src/services/proposalService.ts');
    const p = await mod.proposalService.createProposal({
      title: 'پیشنهاد دوم', description: 'شرح', proposerName: 'مهندس سارا نیک‌نام', proposerUserId: 'user-9',
      proposerDepartmentId: 'dept-1', proposerDepartmentName: 'اداره کل فناوری اطلاعات',
      presenterUserId: 'user-9', presenterName: 'مهندس سارا نیک‌نام',
    });
    await mod.proposalService.reviewProposal(p.data.id, 'APPROVED', 'ok', await window.actor('user-16'));
    await mod.proposalService.confirmForMeeting(p.data.id, await window.actor('user-17'));
    await mod.proposalService.finalizeMeetingConfirmation(p.data.id, 'APPROVED', undefined, await window.actor('user-8'));
    const stored = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:proposals') || '[]').find((x) => x.id === p.data.id);
    const h = (stored.history || []).find((x) => String(x.action).includes('تأیید نهایی تایید جلسه'));
    return { status: stored.status, action: h?.action, actor: h?.actorName };
  });
  check('دبیر جلسه خودش همچنان می‌تواند تأیید کند', ownerStillWorks.status === 'CONFIRMED_FOR_MEETING', ownerStillWorks.status);
  check('اقدام مستقیم دبیر جلسه برچسب جانشینی نمی‌گیرد',
    !String(ownerStillWorks.action).includes('به جانشینی'), ownerStillWorks.action);

  // ——— جانشینی غیرفعال → دسترسی قطع می‌شود ———
  const afterDeactivate = await page.evaluate(async () => {
    const del = await import('/src/services/signatureDelegationService.ts');
    const prop = await import('/src/services/proposalService.ts');
    del.setDelegation({ ownerUserId: 'user-8', delegateUserId: 'user-9', isActive: false }, await window.actor('user-8'));
    const p = await prop.proposalService.createProposal({
      title: 'پیشنهاد سوم', description: 'شرح', proposerName: 'مهندس سارا نیک‌نام', proposerUserId: 'user-9',
      proposerDepartmentId: 'dept-1', proposerDepartmentName: 'اداره کل فناوری اطلاعات',
      presenterUserId: 'user-9', presenterName: 'مهندس سارا نیک‌نام',
    });
    await prop.proposalService.reviewProposal(p.data.id, 'APPROVED', 'ok', await window.actor('user-16'));
    await prop.proposalService.confirmForMeeting(p.data.id, await window.actor('user-17'));
    try { await prop.proposalService.finalizeMeetingConfirmation(p.data.id, 'APPROVED', undefined, await window.actor('user-9')); return 'ALLOWED'; }
    catch (e) { return e.message; }
  });
  check('با غیرفعال شدن جانشینی، دسترسی جانشین قطع می‌شود', afterDeactivate !== 'ALLOWED', afterDeactivate);

  // ——— جانشینی هیچ مجوز دیگری منتقل نمی‌کند ———
  const noPermissionLeak = await page.evaluate(async () => {
    const del = await import('/src/services/signatureDelegationService.ts');
    del.setDelegation({ ownerUserId: 'user-8', delegateUserId: 'user-9', isActive: true }, await window.actor('user-8'));
    // user-8 مجوز NOTIFY_RESOLUTION ندارد؛ جانشینی نباید مجوزی بسازد که وجود ندارد
    return {
      forConfirmation: Boolean(del.getDelegationGrantingPermission('user-9', 'APPROVE_MEETING_CONFIRMATION')),
      forNotify: Boolean(del.getDelegationGrantingPermission('user-9', 'NOTIFY_RESOLUTION')),
      forUsers: Boolean(del.getDelegationGrantingPermission('user-9', 'MANAGE_USERS')),
    };
  });
  check('جانشینی فقط همان مجوزِ شخص اصلی را پوشش می‌دهد', noPermissionLeak.forConfirmation === true);
  check('جانشینی مجوزی که شخص اصلی ندارد را نمی‌سازد',
    noPermissionLeak.forNotify === false && noPermissionLeak.forUsers === false, JSON.stringify(noPermissionLeak));

  check('Regression: هیچ Crash/Runtime Error رخ نداد', pageErrors.length === 0, pageErrors.join(' | '));

  console.log(`\nMEETING CONFIRMATION DELEGATION: ${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
