import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileCheck2,
  Hourglass,
  Lightbulb,
  MapPin,
  PenLine,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Building2,
  Activity,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getMeetingStatusMeta, getResolutionExecutionMeta, getTaskStatusMeta, toPersianDigits } from '../../utils/formatters';
import { buildDashboardModel, daysFromToday, DashboardActionItem, DashboardPersona } from './dashboardData';

const PERSONA_LABEL: Record<DashboardPersona, string> = {
  EXECUTIVE: 'پیشخوان مدیریت',
  OFFICE: 'پیشخوان دفتر مدیرعامل',
  SECRETARY: 'پیشخوان دبیرخانه جلسات',
  ASSIGNEE: 'پیشخوان مجری',
  AUDITOR: 'پیشخوان نظارت و صحه‌گذاری',
  ADMIN: 'پیشخوان راهبری سامانه',
  STAFF: 'پیشخوان من',
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'صبح بخیر';
  if (hour < 17) return 'روز بخیر';
  return 'عصر بخیر';
};

const longToday = () => {
  const now = new Date();
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('fa-IR-u-ca-persian', options).format(now);
  return `${part({ weekday: 'long' })} ${part({ day: 'numeric' })} ${part({ month: 'long' })} ${part({ year: 'numeric' })}`;
};

const relativeDay = (days: number | null) => {
  if (days === null) return '';
  if (days === 0) return 'امروز';
  if (days === 1) return 'فردا';
  if (days === -1) return 'دیروز';
  return days > 0 ? `${toPersianDigits(days)} روز دیگر` : `${toPersianDigits(Math.abs(days))} روز گذشته`;
};

const splitDate = (date: string) => {
  const parts = toPersianDigits(date).split('/');
  const months = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
  const monthIndex = Number(date.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).split('/')[1]) - 1;
  return { day: parts[2] || '', month: months[monthIndex] || '' };
};

const TONE_CHIP: Record<DashboardActionItem['tone'], string> = {
  danger: 'dash-chip dash-chip-danger',
  warning: 'dash-chip dash-chip-warning',
  primary: 'dash-chip dash-chip-primary',
  neutral: 'dash-chip',
};

const SectionHeader: React.FC<{ icon: React.ElementType; title: string; hint?: string; action?: React.ReactNode }> = ({ icon: Icon, title, hint, action }) => (
  <div className="dash-section-head">
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="dash-section-icon"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0">
        <h2 className="text-[13px] font-extrabold text-slate-800 truncate">{title}</h2>
        {hint && <p className="text-[11px] text-slate-500 truncate">{hint}</p>}
      </div>
    </div>
    {action}
  </div>
);

const LinkButton: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => (
  <button onClick={onClick} className="dash-link shrink-0">{children}<ArrowLeft className="h-3.5 w-3.5" /></button>
);

const EmptyLine: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-[11px] text-slate-500"><CheckCircle2 className="h-4 w-4 text-slate-300" />{text}</div>
);

export const DashboardView: React.FC = () => {
  const { navigateTo, currentUser, refreshTrigger, hasPermission, openCreateMeetingModal } = useApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => buildDashboardModel(currentUser), [currentUser, refreshTrigger]);
  const canCreateMeeting = hasPermission('CREATE_MEETING');

  // ——————————————— حالت بدون داده ———————————————
  if (!model.hasAnyData) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <section className="dash-empty">
          <div className="dash-empty-icon"><Sparkles className="h-7 w-7" /></div>
          <p className="text-xs font-bold text-[var(--app-primary)]">{greeting()}، {currentUser.fullName}</p>
          <h1 className="mt-2 text-xl font-black text-slate-900">به سامانه مدیریت جلسات و مصوبات خوش آمدید</h1>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-7 text-slate-600">
            {canCreateMeeting ? 'با برنامه‌ریزی اولین جلسه، گردش پیشنهاد تا مصوبه و پیگیری آن در همین پیشخوان دیده می‌شود.' : 'پیشنهاد خود را ثبت کنید؛ وضعیت بررسی و تصمیم آن در همین پیشخوان نمایش داده می‌شود.'}
          </p>
          <div className="mt-6 flex justify-center">
            {canCreateMeeting
              ? <button onClick={() => openCreateMeetingModal()} className="app-btn-primary"><Plus className="h-4 w-4" />برنامه‌ریزی جلسه جدید</button>
              : <button onClick={() => navigateTo('proposals')} className="app-btn-primary"><Lightbulb className="h-4 w-4" />ثبت پیشنهاد مصوبه</button>}
          </div>
          {currentUser.role === 'ADMIN' && (
            <button onClick={() => navigateTo('settings')} className="mt-4 text-[11px] font-bold text-slate-500 underline-offset-4 hover:text-[var(--app-primary)] hover:underline">برای نمایش دمو، داده نمایشی را از تنظیمات بارگذاری کنید</button>
          )}
        </section>
      </div>
    );
  }

  const next = model.actionItems[0];
  const restActions = model.actionItems.slice(1, 6);
  const isManagerView = ['EXECUTIVE', 'ADMIN', 'AUDITOR'].includes(model.persona);
  const isOfficeView = ['OFFICE', 'SECRETARY'].includes(model.persona);

  const summaryParts = [
    model.actionItems.length > 0 && `${toPersianDigits(model.actionItems.length)} اقدام در انتظار شما`,
    model.upcomingMeetings.length > 0 && `${toPersianDigits(model.upcomingMeetings.length)} جلسه پیش‌رو`,
    isManagerView && model.counts.overdue > 0 && `${toPersianDigits(model.counts.overdue)} مصوبه معوق`,
    model.persona === 'ASSIGNEE' && model.myTasks.length > 0 && `${toPersianDigits(model.myTasks.filter((t) => t.status !== 'PENDING_APPROVAL').length)} وظیفه فعال`,
  ].filter(Boolean) as string[];

  const kpis = [
    { label: 'مصوبات در حال اجرا', value: model.counts.activeResolutions, icon: TrendingUp, route: 'resolutions' as const, tone: 'primary' },
    { label: 'در گردش امضا', value: model.counts.awaitingSignature, icon: PenLine, route: 'resolutions' as const, tone: 'primary' },
    { label: 'در انتظار ابلاغ', value: model.counts.awaitingNotice, icon: Send, route: (hasPermission('NOTIFY_RESOLUTION') ? 'notification-inbox' : 'resolutions') as 'notification-inbox' | 'resolutions', tone: 'primary' },
    { label: 'در انتظار صحه‌گذاری', value: model.counts.pendingVerification, icon: ShieldCheck, route: 'resolutions' as const, tone: 'primary' },
    { label: 'مصوبات معوق', value: model.counts.overdue, icon: AlertTriangle, route: 'resolutions' as const, tone: 'danger' },
    { label: 'جلسات این ماه', value: model.counts.meetingsThisMonth, icon: CalendarDays, route: 'meetings' as const, tone: 'primary' },
  ].filter((k) => k.value > 0).slice(0, 4);

  const goTo = (item: DashboardActionItem) => navigateTo(item.route, item.params);
  const breakdownTotal = model.statusBreakdown.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-5 pb-12">
      {/* ——— سربرگ خوش‌آمد + اقدام بعدی ——— */}
      <section className="dash-hero">
        <div className="relative z-10 grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-center">
          <div className="min-w-0">
            <span className="dash-hero-badge"><Sparkles className="h-3.5 w-3.5" />{PERSONA_LABEL[model.persona]}</span>
            <h1 className="mt-3 text-xl sm:text-2xl font-black leading-tight text-white">{greeting()}، {currentUser.fullName}</h1>
            <p className="mt-1 text-[12px] text-blue-100/90">{currentUser.title} · {longToday()}</p>
            <p className="mt-3 text-[13px] leading-7 text-white/90">
              {summaryParts.length > 0 ? `امروز ${summaryParts.join('، ')} دارید.` : 'کار فوری در انتظار شما نیست؛ وضعیت پرونده‌ها را از بخش‌های زیر مرور کنید.'}
            </p>
          </div>

          <div className="dash-next">
            <p className="text-[11px] font-extrabold text-[var(--app-primary)]">اقدام بعدی من</p>
            {next ? (
              <>
                <div className="mt-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className={TONE_CHIP[next.tone]}>{next.kind}</span>
                    <h3 className="mt-2 text-sm font-extrabold leading-6 text-slate-900 line-clamp-2">{next.title}</h3>
                    <p className="mt-0.5 text-[11px] text-slate-500 truncate">{next.subtitle}</p>
                  </div>
                </div>
                <button onClick={() => goTo(next)} className="app-btn-primary mt-4 w-full justify-center">{next.cta}<ArrowLeft className="h-4 w-4" /></button>
              </>
            ) : (
              <>
                <p className="mt-2 text-[13px] font-bold text-slate-800">موردی در کارتابل شما منتظر اقدام نیست.</p>
                <button onClick={() => (canCreateMeeting ? openCreateMeetingModal() : navigateTo('proposals'))} className="app-btn-secondary mt-4 w-full justify-center">
                  {canCreateMeeting ? <><Plus className="h-4 w-4" />جلسه جدید</> : <><Lightbulb className="h-4 w-4" />ثبت پیشنهاد</>}
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ——— شاخص‌های کلیدی (فقط مقادیر غیرصفر) ——— */}
      {kpis.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map(({ label, value, icon: Icon, route, tone }) => (
            <button key={label} onClick={() => navigateTo(route)} className={`dash-kpi ${tone === 'danger' ? 'dash-kpi-danger' : ''}`}>
              <span className="dash-kpi-icon"><Icon className="h-4 w-4" /></span>
              <span className="min-w-0 text-right">
                <span className="block text-2xl font-black leading-none text-slate-900">{toPersianDigits(value)}</span>
                <span className="mt-1.5 block text-[11px] font-bold leading-5 text-slate-500">{label}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-3">
        {/* ——— ستون اصلی ——— */}
        <div className="min-w-0 space-y-5 lg:col-span-2">
          {/* کارتابل اقدام‌ها */}
          <section className="dash-card">
            <SectionHeader icon={ClipboardList} title="در انتظار تصمیم و اقدام شما" hint="امضا، تأیید، ابلاغ، صحه‌گذاری و وظایف" />
            {restActions.length === 0 ? (
              <EmptyLine text={next ? 'به‌جز اقدام بعدی، مورد دیگری در انتظار شما نیست.' : 'موردی در انتظار اقدام شما نیست.'} />
            ) : (
              <ul className="divide-y divide-slate-100">
                {restActions.map((item) => (
                  <li key={item.id}>
                    <button onClick={() => goTo(item)} className="dash-row group">
                      <span className={TONE_CHIP[item.tone]}>{item.kind}</span>
                      <span className="min-w-0 flex-1 text-right">
                        <span className="block truncate text-[12.5px] font-bold text-slate-800">{item.title}</span>
                        <span className="block truncate text-[11px] text-slate-500">{item.subtitle}</span>
                      </span>
                      <span className="dash-row-cta">{item.cta}<ArrowLeft className="h-3.5 w-3.5" /></span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* مصوبات معوق و در حال اجرا */}
          {(model.overdue.length > 0 || model.inExecution.length > 0) && (
            <section className="dash-card">
              <SectionHeader icon={TrendingUp} title="اجرای مصوبات" hint="موارد معوق در ابتدا و سپس نزدیک‌ترین مهلت‌ها" action={<LinkButton onClick={() => navigateTo('resolutions')}>بانک مصوبات</LinkButton>} />
              <ul className="space-y-2.5">
                {[...model.overdue, ...model.inExecution].slice(0, 5).map((r) => {
                  const left = daysFromToday(r.deadlineJalali);
                  const late = model.overdue.includes(r);
                  const meta = getResolutionExecutionMeta(r.executionStatus);
                  const progress = Math.max(0, Math.min(100, r.progressPercent || 0));
                  return (
                    <li key={r.id}>
                      <button onClick={() => navigateTo('resolutions', { resolutionId: r.id })} className={`dash-exec ${late ? 'dash-exec-late' : ''}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="min-w-0 flex-1 truncate text-right text-[12.5px] font-bold text-slate-800">{r.topicTitle}</span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${late ? 'bg-red-50 text-red-700 border-red-200' : meta.bg}`}>{late ? 'معوق' : meta.label}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-3">
                          <div className="dash-progress"><span style={{ width: `${progress}%` }} className={late ? 'bg-red-500' : ''} /></div>
                          <span className="w-9 text-left text-[11px] font-extrabold text-slate-600">{toPersianDigits(progress)}٪</span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slate-500">
                          <span className="truncate">{r.resolutionNumber} · {r.mainResponsibleName || 'بدون مجری'}</span>
                          <span className={late ? 'font-bold text-red-600' : ''}>مهلت {toPersianDigits(r.deadlineJalali || '—')} {left !== null && `(${relativeDay(left)})`}</span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          {/* بخش ویژه نقش */}
          {isManagerView && model.units.length > 0 && (
            <section className="dash-card">
              <SectionHeader icon={Building2} title="وضعیت واحدها" hint="بر اساس مصوبات ابلاغ‌شده و در گردش هر واحد" action={hasPermission('VIEW_REPORTS') || currentUser.role === 'ADMIN' || currentUser.role === 'CEO' ? <LinkButton onClick={() => navigateTo('reports')}>گزارش عملکرد</LinkButton> : undefined} />
              <div className="overflow-x-auto">
                <table className="dash-table">
                  <thead><tr><th>واحد</th><th>کل</th><th>جاری</th><th>معوق</th><th>خاتمه</th><th className="w-40">میانگین پیشرفت</th></tr></thead>
                  <tbody>
                    {model.units.map((u) => (
                      <tr key={u.name}>
                        <td className="min-w-[10rem] font-bold text-slate-800">{u.name}</td>
                        <td>{toPersianDigits(u.total)}</td>
                        <td>{toPersianDigits(u.active)}</td>
                        <td>{u.overdue > 0 ? <span className="dash-chip dash-chip-danger">{toPersianDigits(u.overdue)}</span> : <span className="text-slate-400">—</span>}</td>
                        <td>{toPersianDigits(u.closed)}</td>
                        <td><div className="flex items-center gap-2"><div className="dash-progress"><span style={{ width: `${u.avgProgress}%` }} /></div><span className="text-[11px] font-bold text-slate-600">{toPersianDigits(u.avgProgress)}٪</span></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {model.persona === 'ASSIGNEE' && (
            <section className="dash-card">
              <SectionHeader icon={Hourglass} title="وظایف و مهلت‌های من" hint="به ترتیب نزدیک‌ترین مهلت" action={<LinkButton onClick={() => navigateTo('tasks')}>وظایف ارجاعی من</LinkButton>} />
              {model.myTasks.length === 0 ? <EmptyLine text="وظیفه‌ای به شما ارجاع نشده است." /> : (
                <div className="overflow-x-auto">
                  <table className="dash-table">
                    <thead><tr><th>مصوبه</th><th>وضعیت</th><th>پیشرفت</th><th>مهلت</th></tr></thead>
                    <tbody>
                      {model.myTasks.map((t) => {
                        const meta = getTaskStatusMeta(t.status);
                        const late = t.status === 'OVERDUE' || (t.daysLeft !== null && t.daysLeft < 0 && t.status !== 'PENDING_APPROVAL');
                        return (
                          <tr key={t.id} className="cursor-pointer" onClick={() => navigateTo('tasks')}>
                            <td><span className="block font-bold text-slate-800">{t.resolutionTitle}</span><span className="text-[10.5px] text-slate-500">{t.resolutionNumber}</span></td>
                            <td><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${meta.bg}`}>{meta.label}</span></td>
                            <td>{toPersianDigits(t.progressPercent || 0)}٪</td>
                            <td className={late ? 'font-bold text-red-600' : 'text-slate-600'}>{toPersianDigits(t.deadlineJalali)}<span className="block text-[10px] font-normal">{relativeDay(t.daysLeft)}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {isOfficeView && (
            <section className="dash-card">
              <SectionHeader icon={Lightbulb} title="گردش پیشنهادها" hint="تعداد پیشنهادها در هر مرحله بررسی" action={<LinkButton onClick={() => navigateTo('proposals')}>مصوبات پیشنهادی</LinkButton>} />
              <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {model.proposalPipeline.map((stage, index) => (
                  <li key={stage.label}>
                    <button onClick={() => navigateTo(stage.route)} className={`dash-stage ${stage.value > 0 ? 'dash-stage-active' : ''}`}>
                      <span className="text-[10px] font-bold text-slate-400">مرحله {toPersianDigits(index + 1)}</span>
                      <span className="mt-1 block text-xl font-black text-slate-900">{toPersianDigits(stage.value)}</span>
                      <span className="mt-0.5 block text-[11px] font-bold text-slate-600">{stage.label}</span>
                    </button>
                  </li>
                ))}
              </ol>
              {model.counts.awaitingNotice > 0 && (
                <button onClick={() => navigateTo('notification-inbox')} className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-3.5 py-2.5 text-right">
                  <span className="flex items-center gap-2 text-[12px] font-bold text-slate-700"><Send className="h-4 w-4 text-[var(--app-primary)]" />{toPersianDigits(model.counts.awaitingNotice)} مصوبه در مرحله ابلاغ یا امضای ابلاغیه</span>
                  <span className="dash-link">کارتابل ابلاغ<ArrowLeft className="h-3.5 w-3.5" /></span>
                </button>
              )}
            </section>
          )}
        </div>

        {/* ——— ستون کناری ——— */}
        <div className="min-w-0 space-y-5">
          <section className="dash-card">
            <SectionHeader icon={CalendarClock} title="جلسات پیش‌رو" action={<LinkButton onClick={() => navigateTo('calendar')}>تقویم</LinkButton>} />
            {model.upcomingMeetings.length === 0 ? <EmptyLine text="جلسه‌ای برای روزهای آینده برنامه‌ریزی نشده است." /> : (
              <ul className="space-y-2.5">
                {model.upcomingMeetings.slice(0, 4).map((m) => {
                  const { day, month } = splitDate(m.dateJalali);
                  const status = getMeetingStatusMeta(m.status);
                  return (
                    <li key={m.id}>
                      <button onClick={() => navigateTo('meeting-details', { meetingId: m.id })} className="dash-meeting">
                        <span className="dash-date"><span className="text-lg font-black leading-none">{day}</span><span className="text-[10px] font-bold">{month}</span></span>
                        <span className="min-w-0 flex-1 text-right">
                          <span className="block truncate text-[12.5px] font-bold text-slate-800">{m.title}</span>
                          <span className="mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-500"><Clock3 className="h-3 w-3" />{toPersianDigits(m.startTime)} تا {toPersianDigits(m.endTime)} · {relativeDay(daysFromToday(m.dateJalali))}</span>
                          <span className="mt-0.5 flex items-center gap-1 truncate text-[10.5px] text-slate-500"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{m.location}</span></span>
                          <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${status.bg} ${status.text}`}>{status.label}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {breakdownTotal > 0 && (isManagerView || isOfficeView) && (
            <section className="dash-card">
              <SectionHeader icon={FileCheck2} title="وضعیت مصوبات" hint={`${toPersianDigits(breakdownTotal)} مصوبه تصویب‌شده`} />
              <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
                {model.statusBreakdown.map((s) => <span key={s.key} title={`${s.label}: ${s.value}`} style={{ width: `${(s.value / breakdownTotal) * 100}%`, background: s.color }} />)}
              </div>
              <ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
                {model.statusBreakdown.map((s) => (
                  <li key={s.key} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex items-center gap-1.5 text-slate-600"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label}</span><span className="font-extrabold text-slate-800">{toPersianDigits(s.value)}</span></li>
                ))}
              </ul>
              {model.performance && (
                <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
                  <div><span className="block text-base font-black text-slate-900">{toPersianDigits(model.performance.avgProgress)}٪</span><span className="text-[10px] text-slate-500">میانگین پیشرفت</span></div>
                  <div><span className="block text-base font-black text-slate-900">{toPersianDigits(model.performance.closed)}</span><span className="text-[10px] text-slate-500">خاتمه‌یافته</span></div>
                  <div><span className="block text-base font-black text-slate-900">{toPersianDigits(model.performance.closedOnTime)}</span><span className="text-[10px] text-slate-500">خاتمه در مهلت</span></div>
                </div>
              )}
            </section>
          )}

          <section className="dash-card">
            <SectionHeader icon={Activity} title="فعالیت‌های اخیر" />
            {model.activity.length === 0 ? <EmptyLine text="هنوز فعالیتی روی پرونده‌های شما ثبت نشده است." /> : (
              <ol className="dash-timeline">
                {model.activity.map((log) => (
                  <li key={log.id}>
                    <button onClick={() => (log.targetType === 'MEETING' ? navigateTo('meeting-details', { meetingId: log.targetId }) : navigateTo('resolutions', { resolutionId: log.targetId }))} className="w-full text-right">
                      <span className="block text-[12px] font-bold text-slate-800">{log.action}</span>
                      {log.details && <span className="block truncate text-[10.5px] text-slate-500">{log.details}</span>}
                      <span className="mt-0.5 block text-[10px] text-slate-400">{log.actorName} · {toPersianDigits(log.timestampJalali)} {toPersianDigits(log.timeString)}</span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
