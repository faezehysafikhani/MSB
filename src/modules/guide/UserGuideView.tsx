import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpen, ChevronDown, CircleHelp, ClipboardCheck, Crown, FileSignature, Info, Lightbulb, Search, Settings, ShieldCheck, Tags, UserCog, Users, X } from 'lucide-react';
import { useApp, AppRoute } from '../../context/AppContext';
import { toPersianDigits } from '../../utils/formatters';
import { COMMON_ERRORS, GUIDE_TOPICS, GuideRole, GuideTopic, STATUS_GLOSSARY } from './guideContent';

type RoleId = Exclude<GuideRole, 'ALL'>;

/** کارت نقش‌ها: هر نقش از کجا شروع می‌کند. */
const ROLES: { id: RoleId; label: string; icon: React.ElementType; start: string; route: AppRoute }[] = [
  { id: 'STAFF', label: 'کاربر عادی', icon: Lightbulb, start: 'مصوبات پیشنهادی', route: 'proposals' },
  { id: 'OFFICE', label: 'مسئول دفتر', icon: ClipboardCheck, start: 'مصوبات پیشنهادی و کارتابل ابلاغ', route: 'proposals' },
  { id: 'SECRETARY', label: 'دبیر جلسه', icon: Users, start: 'مدیریت جلسات', route: 'meetings' },
  { id: 'MANAGER', label: 'مدیر / امضاکننده', icon: Crown, start: 'داشبورد ← کارهای من', route: 'dashboard' },
  { id: 'ASSIGNEE', label: 'مجری', icon: UserCog, start: 'وظایف ارجاعی من', route: 'tasks' },
  { id: 'VERIFIER', label: 'صحه‌گذار', icon: ShieldCheck, start: 'کارتابل صحه‌گذاری', route: 'approvals' },
  { id: 'ADMIN', label: 'ادمین', icon: Settings, start: 'تنظیمات', route: 'settings' },
];

const TONE: Record<string, string> = {
  primary: 'bg-blue-50 text-blue-700 ring-blue-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  neutral: 'bg-slate-50 text-slate-700 ring-slate-200',
};

const normalize = (value: string) => value.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').toLowerCase();

const roleForUser = (role: string, permissions: string[] = []): RoleId => {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'SECRETARY') return permissions.includes('NOTIFY_RESOLUTION') ? 'OFFICE' : 'SECRETARY';
  if (role === 'CEO' || role === 'DEPT_MANAGER') return 'MANAGER';
  if (role === 'AUDITOR') return 'VERIFIER';
  if (role === 'EXPERT_ASSIGNEE') return 'ASSIGNEE';
  return 'STAFF';
};

const TopicItem: React.FC<{ topic: GuideTopic; open: boolean; onToggle: () => void; onGo: (route: AppRoute) => void }> = ({ topic, open, onToggle, onGo }) => (
  <li className={`gd-item ${open ? 'gd-item-open' : ''}`}>
    <button onClick={onToggle} className="gd-item-head" aria-expanded={open}>
      <span className="gd-item-dot" />
      <span className="min-w-0 flex-1 text-right">
        <span className="block text-[13.5px] font-extrabold text-slate-900">{topic.title}</span>
        {!open && <span className="block truncate text-[11.5px] text-slate-500">{topic.summary}</span>}
      </span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && (
      <div className="gd-item-body">
        <p className="text-[12.5px] leading-7 text-slate-600">{topic.summary}</p>
        {topic.steps && (
          <ol className="mt-3 space-y-2">
            {topic.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[12.5px] leading-6 text-slate-700">
                <span className="gd-step-num">{toPersianDigits(i + 1)}</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}
        {topic.tips?.map((tip) => <p key={tip} className="mt-3 flex gap-2 rounded-xl bg-blue-50 px-3 py-2 text-[12px] leading-6 text-slate-700"><Info className="mt-1 h-4 w-4 shrink-0 text-blue-600" />{tip}</p>)}
        {topic.note && <p className="mt-3 flex gap-2 rounded-xl bg-amber-50 px-3 py-2 text-[12px] leading-6 text-amber-900"><AlertCircle className="mt-1 h-4 w-4 shrink-0" />{topic.note}</p>}
        {(topic.menu || topic.route) && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
            {topic.menu ? <span className="text-[11.5px] text-slate-500">منو: <b className="text-slate-700">{topic.menu}</b></span> : <span />}
            {topic.route && <button onClick={() => onGo(topic.route!)} className="app-btn-primary !py-2">برو به این بخش<ArrowLeft className="h-4 w-4" /></button>}
          </div>
        )}
      </div>
    )}
  </li>
);

export const UserGuideView: React.FC = () => {
  const { navigateTo, currentUser } = useApp();
  const myRole = roleForUser(currentUser.role, currentUser.permissions);
  const [role, setRole] = useState<RoleId>(myRole);
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [panel, setPanel] = useState<'statuses' | 'errors'>('statuses');

  const q = normalize(query.trim());
  const roleInfo = ROLES.find((r) => r.id === role)!;

  const { roleTopics, generalTopics } = useMemo(() => {
    const matches = (t: GuideTopic) => normalize([t.title, t.summary, ...(t.steps || []), ...(t.tips || []), t.menu || '', t.note || ''].join(' ')).includes(q);
    if (q) return { roleTopics: GUIDE_TOPICS.filter(matches), generalTopics: [] as GuideTopic[] };
    return {
      roleTopics: GUIDE_TOPICS.filter((t) => t.roles.includes(role)),
      generalTopics: GUIDE_TOPICS.filter((t) => t.roles.includes('ALL') && !t.roles.includes(role)),
    };
  }, [q, role]);

  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <div className="space-y-4">
      {/* سربرگ و جستجو */}
      <section className="info-band flex-wrap">
        <span className="info-band-icon"><BookOpen className="h-5 w-5" /></span>
        <div className="min-w-0">
          <h2 className="text-[15px] font-black text-white">راهنمای کاربری</h2>
          <p className="text-[11.5px] text-blue-100">نقش خود را انتخاب کنید یا سؤالتان را جستجو کنید</p>
        </div>
        <div className="relative w-full sm:mr-auto sm:w-80">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="مثلاً: چطور مصوبه را امضا کنم؟" aria-label="جستجو در راهنما" className="w-full rounded-xl border-0 bg-white py-2.5 pr-9 pl-9 text-[12.5px] text-slate-800 shadow-md outline-none focus:ring-4 focus:ring-sky-300/60" />
          {query && <button onClick={() => setQuery('')} className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="پاک کردن جستجو"><X className="h-4 w-4" /></button>}
        </div>
      </section>

      {/* انتخاب نقش */}
      {!q && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
          {ROLES.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => { setRole(id); setOpenId(null); }} aria-pressed={role === id} className="gd-role">
              <span className="gd-role-icon"><Icon className="h-5 w-5" /></span>
              <span className="text-[12px] font-extrabold">{label}</span>
              {id === myRole && <span className="gd-role-me">نقش شما</span>}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-4">
          {!q && (
            <div className="gd-start">
              <FileSignature className="h-5 w-5 shrink-0 text-blue-600" />
              <p className="min-w-0 flex-1 text-[12.5px] text-slate-700">{roleInfo.label} از <b className="text-slate-900">«{roleInfo.start}»</b> شروع می‌کند.</p>
              <button onClick={() => navigateTo(roleInfo.route)} className="db-link shrink-0">باز کردن</button>
            </div>
          )}

          <section className="db-card">
            <header className="db-card-head"><h2>{q ? `نتایج جستجو (${toPersianDigits(roleTopics.length)})` : `کارهای ${roleInfo.label}`}</h2></header>
            {roleTopics.length === 0 ? (
              <div className="db-empty"><CircleHelp className="h-8 w-8 text-slate-300" /><p>موردی پیدا نشد. واژه دیگری امتحان کنید.</p></div>
            ) : (
              <ul className="space-y-2">{roleTopics.map((t) => <TopicItem key={t.id} topic={t} open={openId === t.id} onToggle={() => toggle(t.id)} onGo={navigateTo} />)}</ul>
            )}
          </section>

          {generalTopics.length > 0 && (
            <section className="db-card">
              <header className="db-card-head"><h2>برای همه کاربران</h2></header>
              <ul className="space-y-2">{generalTopics.map((t) => <TopicItem key={t.id} topic={t} open={openId === t.id} onToggle={() => toggle(t.id)} onGo={navigateTo} />)}</ul>
            </section>
          )}
        </div>

        {/* وضعیت‌ها و مشکلات رایج */}
        <aside className="db-card h-fit lg:sticky lg:top-4">
          <div className="db-seg mb-3 flex w-full">
            <button onClick={() => setPanel('statuses')} aria-pressed={panel === 'statuses'} className="flex-1"><Tags className="ml-1 inline h-3.5 w-3.5" />معنی وضعیت‌ها</button>
            <button onClick={() => setPanel('errors')} aria-pressed={panel === 'errors'} className="flex-1"><CircleHelp className="ml-1 inline h-3.5 w-3.5" />مشکلات رایج</button>
          </div>
          {panel === 'statuses' ? (
            <div className="space-y-3">
              {STATUS_GLOSSARY.map((g) => (
                <div key={g.group}>
                  <p className="mb-1.5 text-[11px] font-extrabold text-slate-500">{g.group}</p>
                  <ul className="space-y-1.5">
                    {g.items.map((i) => (
                      <li key={i.label} className="text-[11.5px] leading-6">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ring-1 ${TONE[i.tone]}`}>{i.label}</span>
                        <span className="block text-slate-600">{i.meaning}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {COMMON_ERRORS.map((e) => (
                <details key={e.problem} className="group py-2">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[12px] font-bold text-slate-800">{e.problem}<ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" /></summary>
                  <p className="mt-1 text-[11.5px] leading-6 text-slate-600">{e.solution}</p>
                </details>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
};
