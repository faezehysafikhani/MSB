const { chromium } = require('playwright');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:4179';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`); };

const readLS = (page, key) => page.evaluate((k) => JSON.parse(localStorage.getItem(`postbank-mosavabat-v1:${k}`) || 'null'), key);

const switchUser = async (page, label) => {
  await page.locator('button:has-text("کاربر:")').first().click();
  await page.waitForTimeout(300);
  await page.locator('div.absolute button').filter({ hasText: label }).first().click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
};

const openArchive = async (page, tab) => {
  await page.locator('aside button:has-text("بایگانی")').first().click();
  await page.waitForTimeout(900);
  if (tab) {
    await page.locator('button').filter({ hasText: new RegExp(`^${tab}$`) }).first().click();
    await page.waitForTimeout(800);
  }
};

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR:', String(e)));
  page.on('dialog', async (d) => { await d.accept(); });
  // The users collection only reaches localStorage once something writes it,
  // so expose a helper that falls back to the same seed data the services use.
  await page.addInitScript(() => {
    window.loadUsers = async () => {
      const stored = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:users') || 'null');
      if (stored && stored.length) return stored;
      const data = await import('/src/mock/data.ts');
      return data.mockUsers;
    };
  });

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });

  // Two in-progress resolutions, both visible to user-17 and user-9.
  await page.evaluate(() => {
    const base = {
      meetingId: 'meet-1001', meetingTitle: 'هیئت مدیره - زیرساخت', meetingNumber: 'جلسه-۱۴۰۵-۱۴۲',
      proposerName: 'مهندس پوریا حسینی', proposerDepartment: 'اداره کل فناوری اطلاعات',
      requestDescription: 'شرح درخواست تست بایگانی', reviewResultNotes: 'نتیجه بررسی تست بایگانی',
      approvalStatus: 'APPROVED', mainResponsibleUserId: 'user-17', mainResponsibleName: 'مسئول دفتر',
      responsibleDepartmentId: 'dept-2', responsibleDepartmentName: 'معاونت برنامه‌ریزی و تحول سازمانی',
      assignedDateJalali: '1405/06/22', deadlineJalali: '1405/07/22', priority: 'MEDIUM',
      referrals: [], verificationConfig: { requiresVerification: false, mode: 'SEQUENTIAL', currentStepIndex: 0, steps: [] },
      attachments: [{ id: 'att-arch-1', fileName: 'سند-پیوست.pdf', fileSizeBytes: 4096, fileExtension: 'pdf', uploadDate: '1405/06/22', uploadedBy: 'مسئول دفتر', downloadUrl: '#' }],
      createdAt: new Date().toISOString(), executionStatus: 'IN_PROGRESS',
    };
    localStorage.setItem('postbank-mosavabat-v1:resolutions', JSON.stringify([
      { ...base, id: 'res-arch-personal', resolutionNumber: 'مصوبه-QA-شخصی', topicTitle: 'موضوع بایگانی شخصی' },
      { ...base, id: 'res-arch-org', resolutionNumber: 'مصوبه-QA-سازمانی', topicTitle: 'موضوع بایگانی سازمانی' },
    ]));
    localStorage.setItem('postbank-mosavabat-v1:activityLogs', JSON.stringify([
      { id: 'log-seed-arch', targetType: 'RESOLUTION', targetId: 'res-arch-personal', action: 'رویداد تاریخی پیش از بایگانی', actorName: 'سامانه', actorRole: 'سیستم', timestampJalali: '1405/06/22', timeString: '۰۹:۰۰', badgeColor: 'blue' },
    ]));
  });

  // ===================== Test 1 — personal archive ============================
  await switchUser(page, 'مسئول دفتر');
  const archivePersonal = await page.evaluate(async () => {
    const mod = await import('/src/services/archiveService.ts');
    const resMod = await import('/src/services/resolutionService.ts');
    const users = await window.loadUsers();
    const actor = users.find((u) => u.id === 'user-17');
    const resolution = (await resMod.resolutionService.getResolutionById('res-arch-personal')).data;
    await mod.archiveService.archiveResolution(resolution, 'PERSONAL', actor);
    return true;
  });
  check('CR-F Test1 بایگانی شخصی از طریق Archive Service انجام شد', archivePersonal);

  let resolutions = await readLS(page, 'resolutions');
  const personalRes = resolutions.find((r) => r.id === 'res-arch-personal');
  check('CR-F بند۱۳ اطلاعات مصوبه پس از بایگانی حفظ شد', personalRes.topicTitle === 'موضوع بایگانی شخصی' && personalRes.attachments.length === 1);
  check('CR-F بند۱۳ وضعیت کاری قبلی ذخیره شد', personalRes.archive.previousExecutionStatus === 'IN_PROGRESS');

  // Active list must no longer contain it.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.locator('aside button:has-text("بانک مصوبات")').first().click();
  await page.waitForTimeout(1200);
  let listText = await page.locator('body').innerText();
  check('CR-F Test1 مصوبه بایگانی‌شده از فهرست مصوبات خارج شد', !listText.includes('موضوع بایگانی شخصی'));
  check('CR-F بند۱۰ مصوبه بایگانی‌نشده همچنان در فهرست است', listText.includes('موضوع بایگانی سازمانی'));

  await openArchive(page, 'شخصی');
  let archiveText = await page.locator('body').innerText();
  check('CR-F Test1 مصوبه در بایگانی شخصی همان کاربر دیده می‌شود', archiveText.includes('موضوع بایگانی شخصی'));

  // ===================== Test 4 — clickable resolution ========================
  await page.locator('button:has-text("موضوع بایگانی شخصی")').first().click();
  await page.waitForTimeout(1300);
  const detailText = await page.locator('body').innerText();
  check('CR-F Test4 کلیک روی مصوبه بایگانی، جزئیات کامل را باز می‌کند', detailText.includes('موضوع بایگانی شخصی') && detailText.includes('شرح درخواست تست بایگانی'));
  check('CR-F بند۱۶ پیوست‌ها در فرم بایگانی دیده می‌شوند', detailText.includes('سند-پیوست.pdf'));
  check('CR-F بند۲۱ رویداد تاریخی قبل از بایگانی پاک نشده است', detailText.includes('رویداد تاریخی پیش از بایگانی'));
  check('CR-F بند۲۱ رویداد «بایگانی مصوبه» در Timeline ثبت شد', detailText.includes('بایگانی مصوبه'));
  await page.locator('button:has-text("بستن پنجره")').first().click().catch(() => {});
  await page.waitForTimeout(600);

  // ===================== Test 1 (cont.) — User B cannot see it ================
  await switchUser(page, 'مهندس سارا نیک‌نام');
  await openArchive(page, 'شخصی');
  const userBArchive = await page.locator('body').innerText();
  check('CR-F Test1 بایگانی شخصی کاربر A برای کاربر B دیده نمی‌شود', !userBArchive.includes('موضوع بایگانی شخصی'));

  const userBService = await page.evaluate(async () => {
    const mod = await import('/src/services/archiveService.ts');
    const users = await window.loadUsers();
    const res = await mod.archiveService.getPersonalResolutionItems(users.find((u) => u.id === 'user-9'));
    return res.data.length;
  });
  check('CR-F Test1 Service Layer هم بایگانی شخصی کاربر دیگر را برنمی‌گرداند', userBService === 0, String(userBService));

  // ===================== Test 2 — organizational folder + access =============
  await switchUser(page, 'مسئول دفتر');
  const folderId = await page.evaluate(async () => {
    const mod = await import('/src/services/archiveService.ts');
    const users = await window.loadUsers();
    const actor = users.find((u) => u.id === 'user-17');
    const sara = users.find((u) => u.id === 'user-9');
    const res = await mod.archiveService.createFolder({
      name: 'مصوبات مالی',
      description: 'پوشه تست دسترسی ترکیبی',
      scope: 'ORGANIZATION',
      access: { userIds: [sara.id], positions: ['مدیر کل امور مالی'] },
    }, actor);
    return res.data.id;
  });
  check('CR-F Test2 پوشه سازمانی «مصوبات مالی» ایجاد شد', Boolean(folderId));

  const folders = await page.evaluate(() => JSON.parse(localStorage.getItem('postbank-mosavabat-v1:archiveFolders') || '[]'));
  const created = folders.find((f) => f.id === folderId);
  check('CR-F Test2 دسترسی بر اساس شخص ذخیره شد', created.access.userIds.includes('user-9'));
  check('CR-F Test2 دسترسی بر اساس سمت ذخیره شد', created.access.positions.includes('مدیر کل امور مالی'));

  const access = await page.evaluate(async (fid) => {
    const mod = await import('/src/services/archiveService.ts');
    const users = await window.loadUsers();
    const out = {};
    for (const u of users) {
      try {
        const res = await mod.archiveService.getFolders('ORGANIZATION', u);
        out[u.id] = res.data.some((f) => f.id === fid);
      } catch { out[u.id] = false; }
    }
    // A user whose position matches the rule, for the position-based check.
    const byPosition = users.find((u) => u.title === 'مدیر کل امور مالی' && (u.permissions || []).includes('VIEW_ORGANIZATION_ARCHIVE'));
    return { out, byPositionId: byPosition ? byPosition.id : null };
  }, folderId);
  check('CR-F Test2 ایجادکننده پوشه به آن دسترسی دارد', access.out['user-17'] === true);
  check('CR-F Test2 کاربر انتخاب‌شده به پوشه دسترسی دارد', access.out['user-9'] === true);
  if (access.byPositionId) {
    check('CR-F Test2 کاربر با سمت مجاز به پوشه دسترسی دارد', access.out[access.byPositionId] === true, access.byPositionId);
  }
  const deniedCount = Object.entries(access.out).filter(([, allowed]) => !allowed).length;
  check('CR-F Test2 کاربران فاقد دسترسی پوشه را نمی‌بینند', deniedCount > 0, `${deniedCount} کاربر`);

  // ===================== Test 6 — direct service access is rejected ===========
  const directAccess = await page.evaluate(async (fid) => {
    const mod = await import('/src/services/archiveService.ts');
    const users = await window.loadUsers();
    const outsider = users.find((u) => u.role !== 'ADMIN' && u.id !== 'user-17' && u.id !== 'user-9' && u.title !== 'مدیر کل امور مالی');
    try {
      await mod.archiveService.getItems(fid, outsider);
      return 'ALLOWED';
    } catch (error) {
      return error.message;
    }
  }, folderId);
  check('CR-F Test6 دسترسی مستقیم به محتوای پوشه برای کاربر غیرمجاز Reject شد', directAccess.includes('مجوز'), directAccess);

  // ===================== Test 3 — organizational archive ======================
  await page.evaluate(async (fid) => {
    const mod = await import('/src/services/archiveService.ts');
    const resMod = await import('/src/services/resolutionService.ts');
    const users = await window.loadUsers();
    const actor = users.find((u) => u.id === 'user-17');
    const resolution = (await resMod.resolutionService.getResolutionById('res-arch-org')).data;
    await mod.archiveService.archiveResolution(resolution, 'ORGANIZATION', actor, fid);
  }, folderId);
  await page.waitForTimeout(500);

  resolutions = await readLS(page, 'resolutions');
  const orgRes = resolutions.find((r) => r.id === 'res-arch-org');
  check('CR-F Test3 مصوبه در پوشه سازمانی بایگانی شد', orgRes.archive.scope === 'ORGANIZATION' && orgRes.archive.folderName === 'مصوبات مالی');

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(700);
  await page.locator('aside button:has-text("بانک مصوبات")').first().click();
  await page.waitForTimeout(1200);
  listText = await page.locator('body').innerText();
  check('CR-F Test3 مصوبه سازمانی از فهرست اصلی خارج شد', !listText.includes('موضوع بایگانی سازمانی'));

  await openArchive(page, 'سازمانی');
  await page.locator('button:has-text("مصوبات مالی")').first().click();
  await page.waitForTimeout(900);
  archiveText = await page.locator('body').innerText();
  check('CR-F Test3 مصوبه داخل پوشه مقصد نمایش داده می‌شود', archiveText.includes('موضوع بایگانی سازمانی'));

  // ===================== Test 5 — restore is not a delete =====================
  await page.locator('button:has-text("حذف از بایگانی")').first().click();
  await page.waitForTimeout(1400);

  resolutions = await readLS(page, 'resolutions');
  const restored = resolutions.find((r) => r.id === 'res-arch-org');
  check('CR-F Test5 موجودیت مصوبه حذف نشده است', Boolean(restored));
  check('CR-F Test5 وضعیت Archive پاک شد', !restored.archive);
  check('CR-F Test5 وضعیت کاری قبلی بازگردانده شد', restored.executionStatus === 'IN_PROGRESS', restored.executionStatus);
  check('CR-F Test5 پیوست‌ها حفظ شدند', restored.attachments.length === 1);

  const archiveItems = await page.evaluate(() => JSON.parse(localStorage.getItem('postbank-mosavabat-v1:archiveItems') || '[]'));
  check('CR-F Test5 ارجاع مصوبه از پوشه حذف شد', !archiveItems.some((i) => i.resolutionId === 'res-arch-org'));

  const logs = await readLS(page, 'activityLogs');
  check('CR-F بند۲۱ رویداد «خروج مصوبه از بایگانی» ثبت شد', logs.some((l) => l.targetId === 'res-arch-org' && l.action === 'خروج مصوبه از بایگانی'));
  check('CR-F بند۱۳ تاریخچه قبلی پاک نشده است', logs.some((l) => l.targetId === 'res-arch-personal' && l.action === 'رویداد تاریخی پیش از بایگانی'));

  await page.locator('aside button:has-text("بانک مصوبات")').first().click();
  await page.waitForTimeout(1300);
  listText = await page.locator('body').innerText();
  check('CR-F Test5 مصوبه دوباره در فهرست مصوبات ظاهر شد', listText.includes('موضوع بایگانی سازمانی'));
  check('CR-F Test5 مصوبه بایگانی‌شده دیگر همزمان در فهرست نیست', !listText.includes('موضوع بایگانی شخصی'));

  console.log(`\nARCHIVE: ${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
