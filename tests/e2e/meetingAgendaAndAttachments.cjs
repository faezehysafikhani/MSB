/**
 * پرامپت ۳ — پیوست توضیحات جلسه، ساعت دستور جلسه، Actionهای یک‌بارمصرف
 * پرامپت ۴ — دانلود واقعی فایل، محدودسازی تایید جلسه‌ها بر اساس افراد مرتبط
 */
const { chromium } = require('playwright');
const BASE = process.env.E2E_BASE_URL || 'http://localhost:4183';
const results = [];
const check = (name, ok, extra = '') => { results.push(ok); console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}${extra ? ' — ' + extra : ''}`); };

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', headless: true });
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => { pageErrors.push(String(e)); console.log('PAGEERROR:', String(e)); });
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

  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  // ====================================================================
  // پرامپت ۴ / بند ۱: دانلود واقعی فایل
  // ====================================================================
  const dlUtil = await page.evaluate(async () => {
    const mod = await import('/src/utils/attachmentFile.ts');
    const file = new File(['محتوای واقعی فایل تست ۱۲۳'], 'گزارش-تست.txt', { type: 'text/plain' });
    const built = await mod.buildAttachmentFromFile(file, 'کاربر تست', '1405/06/25');
    const legacy = { id: 'x', fileName: 'قدیمی.pdf', fileSizeBytes: 10, fileExtension: 'pdf', uploadDate: '1403/01/01', uploadedBy: 'seed', downloadUrl: '#' };
    return {
      contentStored: built.contentStored,
      fileName: built.attachment.fileName,
      extension: built.attachment.fileExtension,
      size: built.attachment.fileSizeBytes,
      isDataUrl: built.attachment.downloadUrl.startsWith('data:'),
      hasContent: mod.hasDownloadableContent(built.attachment),
      legacyHasContent: mod.hasDownloadableContent(legacy),
      legacyDownloadReturns: mod.downloadAttachment(legacy),
    };
  });
  check('۴.۱ محتوای واقعی فایل هنگام آپلود ذخیره می‌شود', dlUtil.contentStored && dlUtil.isDataUrl);
  check('۴.۱ نام فایل درست ذخیره شد', dlUtil.fileName === 'گزارش-تست.txt', dlUtil.fileName);
  check('۴.۱ پسوند فایل درست ذخیره شد', dlUtil.extension === 'txt', dlUtil.extension);
  check('۴.۱ اندازه فایل واقعی است (نه Fake)', dlUtil.size > 0, String(dlUtil.size));
  check('۴.۱ پیوست دارای محتوا قابل دانلود تشخیص داده می‌شود', dlUtil.hasContent === true);
  check('۴.۱ پیوست فقط-Metadata قابل دانلود تشخیص داده نمی‌شود', dlUtil.legacyHasContent === false);
  check('۴.۱ دانلود پیوست بدون محتوا false برمی‌گرداند (پیام موفقیت دروغین نمی‌دهد)', dlUtil.legacyDownloadReturns === false);

  // دانلود واقعی از طریق مرورگر: فایل باید با نام و محتوای درست تحویل شود.
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await page.evaluate(async () => {
    const mod = await import('/src/utils/attachmentFile.ts');
    const file = new File(['محتوای واقعی فایل تست ۱۲۳'], 'گزارش-تست.txt', { type: 'text/plain' });
    const built = await mod.buildAttachmentFromFile(file, 'کاربر تست', '1405/06/25');
    mod.downloadAttachment(built.attachment);
  });
  const download = await downloadPromise;
  check('۴.۱ مرورگر واقعاً فایل را دانلود کرد (Download Event)', Boolean(download));
  if (download) {
    const fs = require('fs');
    const path = await download.path();
    const content = path ? fs.readFileSync(path, 'utf8') : '';
    check('۴.۱ محتوای فایل دانلودشده درست و غیرخالی است', content === 'محتوای واقعی فایل تست ۱۲۳', JSON.stringify(content).slice(0, 60));
  }

  // نام فایل: Chromium در حالت Headless نام‌های غیرلاتین را در download
  // Sanitize می‌کند (محدودیت headless-shell، نه کد سامانه)، پس اینجا روی
  // چیزی Assert می‌کنیم که خودمان کنترل می‌کنیم — مقداری که روی <a download>
  // ست می‌شود — و جداگانه با یک نام لاتین، تحویل واقعی مرورگر را می‌سنجیم.
  const anchorName = await page.evaluate(async () => {
    const mod = await import('/src/utils/attachmentFile.ts');
    const file = new File(['x'], 'گزارش-تست.txt', { type: 'text/plain' });
    const built = await mod.buildAttachmentFromFile(file, 'کاربر تست', '1405/06/25');
    let captured = null;
    const realClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () { captured = this.getAttribute('download'); };
    mod.downloadAttachment(built.attachment);
    HTMLAnchorElement.prototype.click = realClick;
    return captured;
  });
  check('۴.۱ نام کامل فایل (با پسوند) روی دانلود ست می‌شود', anchorName === 'گزارش-تست.txt', String(anchorName));

  const asciiDownloadPromise = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
  await page.evaluate(async () => {
    const mod = await import('/src/utils/attachmentFile.ts');
    const file = new File(['ascii content'], 'report-2024.txt', { type: 'text/plain' });
    const built = await mod.buildAttachmentFromFile(file, 'کاربر تست', '1405/06/25');
    mod.downloadAttachment(built.attachment);
  });
  const asciiDownload = await asciiDownloadPromise;
  check('۴.۱ نام و پسوند فایل تحویلی مرورگر درست است',
    Boolean(asciiDownload) && asciiDownload.suggestedFilename() === 'report-2024.txt',
    asciiDownload ? asciiDownload.suggestedFilename() : 'NO DOWNLOAD');

  // ====================================================================
  // پرامپت ۳ / بند ۲ + ۳: ساعت بند دستور جلسه و قاعده عدم همپوشانی
  // ====================================================================
  const timeRules = await page.evaluate(async () => {
    const mod = await import('/src/utils/agendaTime.ts');
    const existing = [
      { id: 'a1', order: 1, title: 'بند ۱', presenter: 'x', isDiscussed: false, startTime: '10:00', endTime: '10:30' },
      { id: 'a2', order: 2, title: 'بند ۲', presenter: 'y', isDiscussed: false, startTime: '11:00', endTime: '11:30', isRemoved: true },
    ];
    return {
      overlapExact: mod.validateAgendaTimeSlot('10:00', '10:30', '09:00', '12:00', existing),
      overlapPartial: mod.validateAgendaTimeSlot('10:15', '10:45', '09:00', '12:00', existing),
      adjacentOk: mod.validateAgendaTimeSlot('10:30', '11:00', '09:00', '12:00', existing),
      outsideMeeting: mod.validateAgendaTimeSlot('08:00', '08:30', '09:00', '12:00', existing),
      endBeforeStart: mod.validateAgendaTimeSlot('10:45', '10:15', '09:00', '12:00', existing),
      removedSlotFree: mod.validateAgendaTimeSlot('11:00', '11:30', '09:00', '12:00', existing),
      rangeLabel: mod.formatAgendaTimeRange(existing[0]),
      legacyLabel: mod.formatAgendaTimeRange({ id: 'old', order: 3, title: 'قدیمی', presenter: 'z', isDiscussed: false, allocatedMinutes: 30 }),
      diff: mod.getMinutesDiff('10:00', '10:45'),
    };
  });
  check('۳.۲ همپوشانی کامل رد می‌شود', Boolean(timeRules.overlapExact), timeRules.overlapExact);
  check('۳.۲ همپوشانی جزئی رد می‌شود', Boolean(timeRules.overlapPartial), timeRules.overlapPartial);
  check('۳.۲ بازه چسبیده (۱۰:۳۰ تا ۱۱:۰۰) مجاز است', timeRules.adjacentOk === null, String(timeRules.adjacentOk));
  check('۳.۲ بازه خارج از پنجره جلسه رد می‌شود', Boolean(timeRules.outsideMeeting), timeRules.outsideMeeting);
  check('۳.۲ پایان قبل از شروع رد می‌شود', Boolean(timeRules.endBeforeStart), timeRules.endBeforeStart);
  check('۳.۲ بند حذف‌شده جای زمانی را اشغال نمی‌کند', timeRules.removedSlotFree === null, String(timeRules.removedSlotFree));
  check('۳.۳ نمایش بازه به شکل «۱۰:۰۰ تا ۱۰:۳۰» است', timeRules.rangeLabel === '10:00 تا 10:30', timeRules.rangeLabel);
  check('۳.۳ بند قدیمی بدون ساعت همچنان «دقیقه» نمایش می‌دهد (Data حذف نشد)', timeRules.legacyLabel === '30 دقیقه', timeRules.legacyLabel);
  check('۳.۲ محاسبه Duration از ساعت شروع/پایان درست است', timeRules.diff === 45, String(timeRules.diff));

  // ====================================================================
  // پرامپت ۳ / بند ۵: جلوگیری از مصوبه تکراری در Business Logic
  // ====================================================================
  const dupResult = await page.evaluate(async () => {
    const mod = await import('/src/services/resolutionService.ts');
    const base = {
      meetingId: 'meet-dup', meetingTitle: 'جلسه تست', meetingNumber: 'جلسه-۱',
      agendaItemId: 'agenda-dup-1', agendaItemTitle: 'بند تست',
      topicTitle: 'موضوع مصوبه تست', proposerName: 'تست', proposerDepartment: 'تست',
      requestDescription: 'شرح', reviewResultNotes: 'نتیجه', approvalStatus: 'APPROVED',
      executionDescription: 'اجرا', deadlineJalali: '1405/07/01',
    };
    const first = await mod.resolutionService.createResolution(base);
    let second = 'ALLOWED';
    try { await mod.resolutionService.createResolution({ ...base, topicTitle: 'مصوبه دوم همان بند' }); }
    catch (e) { second = e.message; }
    // بند دیگر باید همچنان مصوبه بگیرد
    let other = 'FAILED';
    try {
      await mod.resolutionService.createResolution({ ...base, agendaItemId: 'agenda-dup-2', topicTitle: 'مصوبه بند دیگر' });
      other = 'ALLOWED';
    } catch (e) { other = e.message; }
    return { firstOk: first.isSuccess, second, other };
  });
  check('۳.۵ مصوبه اول برای بند ثبت شد', dupResult.firstOk === true);
  check('۳.۵ Service از ثبت مصوبه دوم برای همان بند جلوگیری کرد', dupResult.second !== 'ALLOWED', dupResult.second);
  check('۳.۵ بند دیگر همچنان می‌تواند مصوبه بگیرد (محدودیت بیش از حد نیست)', dupResult.other === 'ALLOWED', dupResult.other);

  // ====================================================================
  // پرامپت ۴ / بند ۲: محدودسازی تایید جلسه‌ها بر اساس افراد مرتبط
  // ====================================================================
  // X=user-9، Y=user-10، Z=user-11، K=user-12، G=user-13
  await page.evaluate(async () => {
    const users = await window.loadUsers();
    const pick = (id) => { const u = users.find((x) => x.id === id); return { userId: u.id, fullName: u.fullName }; };
    const X = pick('user-9'), Y = pick('user-10'), Z = pick('user-11'), K = pick('user-12'), G = pick('user-13');
    const members = [X, Y, Z, K, G].map((u) => ({
      userId: u.userId, fullName: u.fullName, roleTitle: 'عضو', departmentName: 'اداره کل فناوری اطلاعات',
      attendanceType: 'MEMBER', presenceStatus: 'PRESENT',
    }));
    const meetings = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:meetings') || '[]');
    meetings.unshift({
      id: 'meet-scope', meetingNumber: 'جلسه-۱۴۰۵-۹۹۹', title: 'جلسه تست محدودیت تایید جلسه',
      type: 'COMMISSION', dateJalali: '1405/06/25', startTime: '09:00', endTime: '12:00',
      location: 'سالن تست', status: 'INVITATION_SENT',
      organizerId: 'user-16', organizerName: 'مدیرعامل', secretaryId: 'user-8', secretaryName: 'مهندس جواد صادقی',
      departmentId: 'dept-1', departmentName: 'اداره کل فناوری اطلاعات', description: '',
      members, agendaItems: [
        { id: 'ag-A', order: 1, rowNumber: 1, title: 'تایید جلسه A', presenter: 'دبیر', presenterName: 'دبیر', startTime: '09:00', endTime: '09:30', allocatedMinutes: 30, isDiscussed: false, relatedUsers: [X, Y] },
        { id: 'ag-B', order: 2, rowNumber: 2, title: 'تایید جلسه B', presenter: 'دبیر', presenterName: 'دبیر', startTime: '09:30', endTime: '10:00', allocatedMinutes: 30, isDiscussed: false, relatedUsers: [X, Z] },
        { id: 'ag-C', order: 3, rowNumber: 3, title: 'تایید جلسه C', presenter: 'دبیر', presenterName: 'دبیر', startTime: '10:00', endTime: '10:30', allocatedMinutes: 30, isDiscussed: false, relatedUsers: [K, G] },
      ],
      attachments: [], history: [], resolutionsCount: 0, createdAt: new Date().toISOString(),
    });
    localStorage.setItem('postbank-mosavabat-v1:meetings', JSON.stringify(meetings));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  const visibleFor = async (userId) => page.evaluate(async (id) => {
    const mod = await import('/src/services/meetingService.ts');
    const actor = await window.actor(id);
    const res = await mod.meetingService.getMeetingById('meet-scope', actor);
    return (res.data?.agendaItems || []).map((a) => a.title.replace('تایید جلسه ', '')).sort().join(',');
  }, userId);

  check('۴.۲ User X فقط A و B را می‌بیند', await visibleFor('user-9') === 'A,B', await visibleFor('user-9'));
  check('۴.۲ User Y فقط A را می‌بیند', await visibleFor('user-10') === 'A', await visibleFor('user-10'));
  check('۴.۲ User Z فقط B را می‌بیند', await visibleFor('user-11') === 'B', await visibleFor('user-11'));
  check('۴.۲ User K فقط C را می‌بیند', await visibleFor('user-12') === 'C', await visibleFor('user-12'));
  check('۴.۲ User G فقط C را می‌بیند', await visibleFor('user-13') === 'C', await visibleFor('user-13'));

  // Scope مدیریتی خراب نشده باشد
  check('۴.۲ مسئول دفتر همه تایید جلسه‌ها را می‌بیند', await visibleFor('user-17') === 'A,B,C', await visibleFor('user-17'));
  check('۴.۲ دبیر جلسه همه تایید جلسه‌ها را می‌بیند', await visibleFor('user-8') === 'A,B,C', await visibleFor('user-8'));
  check('۴.۲ مدیرعامل همه تایید جلسه‌ها را می‌بیند', await visibleFor('user-16') === 'A,B,C', await visibleFor('user-16'));
  check('۴.۲ مدیر سیستم همه تایید جلسه‌ها را می‌بیند', await visibleFor('user-1') === 'A,B,C', await visibleFor('user-1'));

  // فیلتر در Data Source است، نه فقط UI: خود UI هم باید همین را نشان دهد.
  await page.evaluate(() => {
    const users = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:users') || 'null');
    if (users) return;
  });
  const switchUser = async (label) => {
    await page.locator('button:has-text("کاربر:")').first().click();
    await page.waitForTimeout(300);
    await page.locator('div.absolute button').filter({ hasText: label }).first().click();
    await page.waitForTimeout(700);
  };
  const yName = await page.evaluate(async () => (await window.actor('user-10')).fullName);
  await switchUser(yName);
  const openScopeMeeting = async () => {
    await page.locator('aside button:has-text("مدیریت جلسات")').first().click();
    await page.waitForTimeout(1000);
    await page.locator('main tr.cursor-pointer, main div.cursor-pointer.group').filter({ hasText: 'محدودیت تایید جلسه' }).first().click();
    await page.waitForTimeout(1300);
  };
  await openScopeMeeting();
  const uiText = await page.locator('main').first().innerText();
  check('۴.۲ در UI هم User Y فقط تایید جلسه A را می‌بیند',
    uiText.includes('تایید جلسه A') && !uiText.includes('تایید جلسه B') && !uiText.includes('تایید جلسه C'));
  check('۳.۳ در UI بند با ساعت شروع و پایان نمایش داده می‌شود (نه «دقیقه»)',
    /ساعت:\s*۰۹:۰۰ تا ۰۹:۳۰/.test(uiText), uiText.match(/ساعت:[^\n|]*/)?.[0]);

  // ====================================================================
  // پرامپت ۳ / بند ۴: «ثبت نتیجه» فقط یک بار
  // ====================================================================
  const secName = await page.evaluate(async () => (await window.actor('user-8')).fullName);
  await switchUser(secName);
  await page.waitForTimeout(900);
  let detail = await page.locator('main').first().innerText();
  check('۳.۴ پیش از ثبت نتیجه، دکمه «ثبت نتیجه» برای دبیر جلسه دیده می‌شود', detail.includes('ثبت نتیجه'));

  await page.evaluate(async () => {
    const mod = await import('/src/services/meetingService.ts');
    const actor = await window.actor('user-8');
    await mod.meetingService.recordAgendaOutcome('meet-scope', 'ag-A', 'APPROVED', 'نتیجه بررسی بند A ثبت شد', actor);
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  // Reload کاربر را به پیشخوان برمی‌گرداند؛ دوباره وارد همان جلسه می‌شویم.
  await openScopeMeeting();
  detail = await page.locator('main').first().innerText();
  const outcomeButtons = await page.locator('main button').filter({ hasText: /^ثبت نتیجه$/ }).count();
  check('۳.۴ پس از ثبت نتیجه برای A، دکمه «ثبت نتیجه» آن بند حذف شد',
    outcomeButtons < 3, `remaining=${outcomeButtons}`);
  check('۳.۴ نتیجه ثبت‌شده همچنان قابل مشاهده است', detail.includes('نتیجه بررسی بند A ثبت شد'));
  check('۳.۴ وضعیت ثبت‌شده («تصویب شد») نمایش داده می‌شود', detail.includes('تصویب شد'));

  // ====================================================================
  // پرامپت ۳ / بند ۱: پیوست توضیحات جلسه Persist می‌شود
  // ====================================================================
  const persisted = await page.evaluate(async () => {
    const mod = await import('/src/services/meetingService.ts');
    const fileMod = await import('/src/utils/attachmentFile.ts');
    const f1 = new File(['فایل یک'], 'پیوست-جلسه-۱.txt', { type: 'text/plain' });
    const f2 = new File(['فایل دو'], 'پیوست-جلسه-۲.txt', { type: 'text/plain' });
    const a1 = (await fileMod.buildAttachmentFromFile(f1, 'کاربر تست', '1405/06/25')).attachment;
    const a2 = (await fileMod.buildAttachmentFromFile(f2, 'کاربر تست', '1405/06/25')).attachment;
    const res = await mod.meetingService.createMeeting({
      title: 'جلسه با پیوست توضیحات', type: 'COMMISSION', dateJalali: '1405/06/26',
      startTime: '09:00', endTime: '11:00', location: 'سالن', organizerId: 'user-16',
      secretaryId: 'user-8', departmentId: 'dept-1', description: 'توضیحات کلی جلسه',
      members: [], agendaItems: [], attachments: [a1, a2],
    });
    const stored = JSON.parse(localStorage.getItem('postbank-mosavabat-v1:meetings') || '[]')
      .find((m) => m.id === res.data.id);
    return {
      count: stored?.attachments?.length || 0,
      names: (stored?.attachments || []).map((a) => a.fileName),
      allHaveContent: (stored?.attachments || []).every((a) => fileMod.hasDownloadableContent(a)),
    };
  });
  check('۳.۱ چند پیوست همزمان روی توضیحات جلسه ذخیره شد (Replace نشد)', persisted.count === 2, String(persisted.count));
  check('۳.۱ نام هر دو فایل درست Persist شد',
    persisted.names.includes('پیوست-جلسه-۱.txt') && persisted.names.includes('پیوست-جلسه-۲.txt'), JSON.stringify(persisted.names));
  check('۳.۱ پیوست‌های جلسه محتوای واقعی و قابل دانلود دارند', persisted.allHaveContent === true);

  check('Regression: هیچ Crash/Runtime Error در طول تست رخ نداد', pageErrors.length === 0, pageErrors.join(' | '));

  console.log(`\nMEETING AGENDA & ATTACHMENTS: ${results.filter(Boolean).length}/${results.length} passed`);
  await browser.close();
  process.exit(results.every(Boolean) ? 0 : 1);
})();
