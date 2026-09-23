import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Hourglass,
  Lightbulb,
  MapPin,
  PenLine,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getMeetingStatusMeta, toPersianDigits } from '../../utils/formatters';
import { buildDashboardModel, daysFromToday, DashboardActionItem } from './dashboardData';

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
  return days > 0 ? `${toPersianDigits(days)} روز مانده` : `${toPersianDigits(Math.abs(days))} روز تأخیر`;
};

const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
const splitDate = (date: string) => {
  const western = date.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).split('/');
  return { day: toPersianDigits(Number(western[2] || 0)), month: MONTHS[Number(western[1]) - 1] || '' };
};

const TONE_DOT: Record<DashboardActionItem['tone'], string> = { danger: 'bg-red-500', warning: 'bg-amber-400', primary: 'bg-blue-500', neutral: 'bg-slate-400' };

type ResTab = 'overdue' | 'running';

export const DashboardView: React.FC = () => {
  const { navigateTo, currentUser, refreshTrigger, hasPermission, openCreateMeetingModal } = useApp();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const model = useMemo(() => buildDashboardModel(currentUser), [currentUser, refreshTrigger]);
  const canCreateMeeting = hasPermission('CREATE_MEETING');
  const [resTab, setResTab] = useState<ResTab | null>(null);

  const primaryAction = canCreateMeeting
    ? <button onClick={() => openCreateMeetingModal()} className="app-btn-primary"><Plus className="h-4 w-4" />جلسه جدید</button>
    : <button onClick={() => navigateTo('proposals')} className="app-btn-primary"><Lightbulb className="h-4 w-4" />ثبت پیشنهاد</button>;

  // ——————————— بدون داده ———————————
  if (!model.hasAnyData) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <section className="dash-empty">
          <div className="dash-empty-icon"><Sparkles className="h-7 w-7" /></div>
          <h1 className="text-xl font-black text-slate-900">{greeting()}، {currentUser.fullName}</h1>
          <p className="mx-auto mt-2 max-w-sm text-[13px] leading-7 text-slate-600">
            {canCreateMeeting ? 'هنوز جلسه‌ای ثبت نشده است. با برنامه‌ریزی اولین جلسه شروع کنید.' : 'هنوز موردی برای شما ثبت نشده است. می‌توانید پیشنهاد خود را ثبت کنید.'}
          </p>
          <div className="mt-6 flex justify-center">{primaryAction}</div>
          {currentUser.role === 'ADMIN' && (
            <button onClick={() => navigateTo('settings')} className="mt-4 text-[11px] font-bold text-slate-500 hover:text-[var(--app-primary)] hover:underline">نمایش با داده نمونه (تنظیمات ← داده نمایشی)</button>
          )}
        </section>
      </div>
    );
  }

  const lists: Record<ResTab, { label: string; items: typeof model.overdue }> = {
    overdue: { label: 'معوق', items: model.overdue },
    running: { label: 'در حال اجرا', items: model.inExecution },
  };
  const activeTab: ResTab = resTab || (model.overdue.length ? 'overdue' : 'running');
  const shownRes = lists[activeTab].items.slice(0, 5);

  const tiles = [
    { label: 'کارهای منتظر من', value: model.actionItems.length, icon: CheckCircle2, onClick: () => document.getElementById('dash-todo')?.scrollIntoView({ behavior: 'smooth' }), tone: 'blue' },
    { label: 'جلسات پیش‌رو', value: model.upcomingMeetings.length, icon: CalendarDays, onClick: () => navigateTo('calendar'), tone: 'sky' },
    { label: 'مصوبات در حال اجرا', value: model.counts.activeResolutions, icon: TrendingUp, onClick: () => navigateTo('resolutions'), tone: 'indigo' },
    { label: 'مصوبات معوق', value: model.counts.overdue, icon: AlertTriangle, onClick: () => navigateTo('resolutions'), tone: model.counts.overdue ? 'red' : 'slate' },
  ];

  const isManager = ['EXECUTIVE', 'ADMIN', 'AUDITOR'].includes(model.persona);
  const isOffice = ['OFFICE', 'SECRETARY'].includes(model.persona);

  return (
    <div className="space-y-4 pb-10">
      {/* ——— سلام و اقدام اصلی ——— */}
      <section className="db-hello">
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-slate-900">{greeting()}، {currentUser.fullName}</h1>
          <p className="mt-0.5 text-[12px] text-slate-500">{longToday()} · {currentUser.title}</p>
        </div>
        {primaryAction}
      </section>

      {/* ——— چهار عدد مهم ——— */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(({ label, value, icon: Icon, onClick, tone }) => (
          <button key={label} onClick={onClick} className={`db-tile db-tile-${tone}`}>
            <span className="db-tile-icon"><Icon className="h-5 w-5" /></span>
            <span className="text-right">
              <span className="block text-[26px] font-black leading-none">{toPersianDigits(value)}</span>
              <span className="mt-1 block text-[12px] font-bold opacity-80">{label}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ——— کارهای من ——— */}
        <section id="dash-todo" className="db-card lg:col-span-2">
          <header className="db-card-head"><h2>کارهای من</h2><span className="db-count">{toPersianDigits(model.actionItems.length)}</span></header>
          {model.actionItems.length === 0 ? (
            <div className="db-empty"><CheckCircle2 className="h-8 w-8 text-emerald-500" /><p>کاری منتظر شما نیست.</p></div>
          ) : (
            <ul className="space-y-2">
              {model.actionItems.slice(0, 6).map((item, index) => (
                <li key={item.id}>
                  <button onClick={() => navigateTo(item.route, item.params)} className={`db-todo ${index === 0 ? 'db-todo-first' : ''}`}>
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[item.tone]}`} />
                    <span className="min-w-0 flex-1 text-right">
                      {index === 0 && <span className="mb-0.5 block text-[10.5px] font-extrabold text-blue-700">اقدام بعدی من</span>}
                      <span className="block truncate text-[13px] font-extrabold text-slate-800">{item.title}</span>
                      <span className="block truncate text-[11.5px] text-slate-500">{item.kind} · {item.subtitle}</span>
                    </span>
                    <span className="db-todo-cta">{item.cta}<ArrowLeft className="h-3.5 w-3.5" /></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* ——— جلسات پیش‌رو ——— */}
        <section className="db-card">
          <header className="db-card-head"><h2>جلسات پیش‌رو</h2><button onClick={() => navigateTo('calendar')} className="db-link">تقویم</button></header>
          {model.upcomingMeetings.length === 0 ? (
            <div className="db-empty"><CalendarClock className="h-8 w-8 text-slate-300" /><p>جلسه‌ای برنامه‌ریزی نشده است.</p></div>
          ) : (
            <ul className="space-y-2">
              {model.upcomingMeetings.slice(0, 4).map((m) => {
                const { day, month } = splitDate(m.dateJalali);
                const status = getMeetingStatusMeta(m.status);
                return (
                  <li key={m.id}>
                    <button onClick={() => navigateTo('meeting-details', { meetingId: m.id })} className="db-meeting">
                      <span className="db-date"><b>{day}</b><small>{month}</small></span>
                      <span className="min-w-0 flex-1 text-right">
                        <span className="block truncate text-[12.5px] font-extrabold text-slate-800">{m.title}</span>
                        <span className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500"><Clock3 className="h-3 w-3" />{toPersianDigits(m.startTime)} · {relativeDay(daysFromToday(m.dateJalali))}</span>
                        <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-slate-500"><MapPin className="h-3 w-3 shrink-0" /><span className="truncate">{m.location}</span></span>
                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${status.bg} ${status.text}`}>{status.label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* ——— مصوبات ——— */}
        {(model.overdue.length > 0 || model.inExecution.length > 0) && (
          <section className="db-card lg:col-span-2">
            <header className="db-card-head">
              <h2>مصوبات در جریان</h2>
              <div className="db-seg">
                {(['overdue', 'running'] as ResTab[]).map((key) => (
                  <button key={key} onClick={() => setResTab(key)} aria-pressed={activeTab === key}>
                    {lists[key].label} <b className={key === 'overdue' && lists.overdue.items.length ? 'text-red-600' : ''}>{toPersianDigits(lists[key].items.length)}</b>
                  </button>
                ))}
              </div>
            </header>
            {shownRes.length === 0 ? <div className="db-empty"><CheckCircle2 className="h-8 w-8 text-emerald-500" /><p>موردی در این دسته نیست.</p></div> : (
              <ul className="space-y-2">
                {shownRes.map((r) => {
                  const late = activeTab === 'overdue';
                  const progress = Math.max(0, Math.min(100, r.progressPercent || 0));
                  return (
                    <li key={r.id}>
                      <button onClick={() => navigateTo('resolutions', { resolutionId: r.id })} className={`db-res ${late ? 'db-res-late' : ''}`}>
                        <span className="min-w-0 flex-1 text-right">
                          <span className="block truncate text-[13px] font-extrabold text-slate-800">{r.topicTitle}</span>
                          <span className="block truncate text-[11px] text-slate-500">{r.mainResponsibleName || '—'} · {r.responsibleDepartmentName || ''}</span>
                        </span>
                        <span className="hidden w-32 sm:block">
                          <span className="dash-progress block"><span style={{ width: `${progress}%` }} className={late ? 'bg-red-500' : ''} /></span>
                          <span className="mt-1 block text-center text-[10.5px] font-bold text-slate-500">{toPersianDigits(progress)}٪</span>
                        </span>
                        <span className={`w-24 shrink-0 text-left text-[11px] font-bold ${late ? 'text-red-600' : 'text-slate-500'}`}>{relativeDay(daysFromToday(r.deadlineJalali))}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {/* ——— ستون مخصوص نقش ——— */}
        <section className="db-card">
          {isManager && model.units.length > 0 ? (
            <>
              <header className="db-card-head"><h2><Building2 className="ml-1 inline h-4 w-4 text-blue-600" />وضعیت واحدها</h2></header>
              <ul className="space-y-3">
                {model.units.slice(0, 5).map((u) => (
                  <li key={u.name}>
                    <div className="flex items-center justify-between gap-2 text-[11.5px]"><span className="truncate font-bold text-slate-700">{u.name}</span><span className="shrink-0 font-extrabold text-slate-800">{toPersianDigits(u.avgProgress)}٪</span></div>
                    <div className="dash-progress mt-1"><span style={{ width: `${u.avgProgress}%` }} /></div>
                    {u.overdue > 0 && <p className="mt-0.5 text-[10.5px] font-bold text-red-600">{toPersianDigits(u.overdue)} مصوبه معوق</p>}
                  </li>
                ))}
              </ul>
            </>
          ) : model.persona === 'ASSIGNEE' ? (
            <>
              <header className="db-card-head"><h2><Hourglass className="ml-1 inline h-4 w-4 text-blue-600" />مهلت‌های من</h2></header>
              {model.myTasks.length === 0 ? <div className="db-empty"><p>وظیفه‌ای ندارید.</p></div> : (
                <ul className="space-y-2">
                  {model.myTasks.slice(0, 5).map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
                      <span className="truncate text-[12px] font-bold text-slate-700">{t.resolutionTitle}</span>
                      <span className={`shrink-0 text-[11px] font-bold ${t.daysLeft !== null && t.daysLeft < 0 ? 'text-red-600' : 'text-slate-500'}`}>{relativeDay(t.daysLeft)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : isOffice ? (
            <>
              <header className="db-card-head"><h2><Send className="ml-1 inline h-4 w-4 text-blue-600" />کارهای دفتر</h2></header>
              <ul className="space-y-2">
                {[
                  { label: 'پیشنهاد در انتظار تصمیم', value: model.proposalPipeline[0]?.value || 0, route: 'proposals' as const, icon: Lightbulb },
                  { label: 'مصوبه در گردش امضا', value: model.counts.awaitingSignature, route: 'resolutions' as const, icon: PenLine },
                  { label: 'در مرحله ابلاغ', value: model.counts.awaitingNotice, route: 'notification-inbox' as const, icon: Send },
                  { label: 'در انتظار صحه‌گذاری', value: model.counts.pendingVerification, route: 'resolutions' as const, icon: ShieldCheck },
                ].map(({ label, value, route, icon: Icon }) => (
                  <li key={label}>
                    <button onClick={() => navigateTo(route)} className="flex w-full items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2.5 hover:bg-blue-50">
                      <span className="flex items-center gap-2 text-[12px] font-bold text-slate-700"><Icon className="h-4 w-4 text-blue-600" />{label}</span>
                      <b className="text-[15px] text-slate-900">{toPersianDigits(value)}</b>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <>
              <header className="db-card-head"><h2><Activity className="ml-1 inline h-4 w-4 text-blue-600" />فعالیت‌های اخیر</h2></header>
              {model.activity.length === 0 ? <div className="db-empty"><p>فعالیتی ثبت نشده است.</p></div> : (
                <ul className="space-y-2">{model.activity.slice(0, 5).map((l) => <li key={l.id} className="text-[12px]"><b className="text-slate-800">{l.action}</b><span className="block text-[10.5px] text-slate-400">{toPersianDigits(l.timestampJalali)}</span></li>)}</ul>
              )}
            </>
          )}
        </section>
      </div>

      {/* ——— آخرین اتفاقات ——— */}
      {(isManager || isOffice || model.persona === 'ASSIGNEE') && model.activity.length > 0 && (
        <section className="db-card">
          <header className="db-card-head"><h2>آخرین اتفاقات</h2></header>
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {model.activity.slice(0, 6).map((l) => (
              <li key={l.id}>
                <button onClick={() => (l.targetType === 'MEETING' ? navigateTo('meeting-details', { meetingId: l.targetId }) : navigateTo('resolutions', { resolutionId: l.targetId }))} className="db-activity">
                  <span className="block truncate text-[12px] font-extrabold text-slate-800">{l.action}</span>
                  <span className="block truncate text-[10.5px] text-slate-500">{l.actorName} · {toPersianDigits(l.timestampJalali)}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};
