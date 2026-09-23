import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, BookOpen, CircleHelp, Info, ListChecks, MousePointerClick, Search, Tags, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toPersianDigits } from '../../utils/formatters';
import { COMMON_ERRORS, GUIDE_ROLES, GUIDE_TOPICS, GuideRole, STATUS_GLOSSARY } from './guideContent';

const TONE: Record<string, string> = {
  primary: 'dash-chip dash-chip-primary',
  warning: 'dash-chip dash-chip-warning',
  danger: 'dash-chip dash-chip-danger',
  success: 'dash-chip bg-emerald-50 text-emerald-700 border-emerald-200',
  neutral: 'dash-chip',
};

const normalize = (value: string) => value.replace(/[يى]/g, 'ی').replace(/ك/g, 'ک').replace(/‌/g, ' ').toLowerCase();

/** نقش پیش‌فرض راهنما بر اساس نقش کاربر فعلی. */
const roleForUser = (role: string, permissions: string[] = []): GuideRole => {
  if (role === 'ADMIN') return 'ADMIN';
  if (role === 'SECRETARY') return permissions.includes('NOTIFY_RESOLUTION') ? 'OFFICE' : 'SECRETARY';
  if (role === 'CEO' || role === 'DEPT_MANAGER') return 'MANAGER';
  if (role === 'AUDITOR') return 'VERIFIER';
  if (role === 'EXPERT_ASSIGNEE') return permissions.includes('SUBMIT_TASK_COMPLETION') || permissions.includes('VIEW_TASKS') ? 'ASSIGNEE' : 'STAFF';
  return 'ALL';
};

export const UserGuideView: React.FC = () => {
  const { navigateTo, currentUser } = useApp();
  const [query, setQuery] = useState('');
  const [role, setRole] = useState<GuideRole>('ALL');
  const suggestedRole = roleForUser(currentUser.role, currentUser.permissions);

  const topics = useMemo(() => {
    const q = normalize(query.trim());
    return GUIDE_TOPICS.filter((t) => (role === 'ALL' || t.roles.includes(role) || t.roles.includes('ALL')))
      .filter((t) => !q || normalize([t.title, t.summary, t.section, ...(t.steps || []), ...(t.tips || []), t.menu || '', t.note || ''].join(' ')).includes(q));
  }, [query, role]);

  const sections = useMemo(() => {
    const map = new Map<string, typeof topics>();
    topics.forEach((t) => map.set(t.section, [...(map.get(t.section) || []), t]));
    return [...map.entries()];
  }, [topics]);

  const q = normalize(query.trim());
  const showGlossary = !q || normalize(STATUS_GLOSSARY.map((g) => g.items.map((i) => `${i.label} ${i.meaning}`).join(' ')).join(' ') + ' وضعیت').includes(q);
  const showErrors = !q || normalize(COMMON_ERRORS.map((e) => `${e.problem} ${e.solution}`).join(' ') + ' خطا مشکل').includes(q);

  const scrollTo = (id: string) => document.getElementById(`guide-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="space-y-5">
      <section className="dash-hero">
        <div className="relative z-10">
          <span className="dash-hero-badge"><BookOpen className="h-3.5 w-3.5" />راهنمای کاربری</span>
          <h2 className="mt-3 text-xl font-black text-white">هر کار، در چند گام کوتاه</h2>
          <p className="mt-1 max-w-2xl text-[12.5px] leading-7 text-blue-50/90">موضوع را جستجو کنید یا نقش خود را انتخاب کنید. برای هر کار، مراحل، منوی مرتبط و دکمه ورود مستقیم آمده است.</p>
          <div className="relative mt-4 max-w-xl">
            <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="مثلاً: ابلاغ، امضا، گزارش پیشرفت، جانشین…"
              aria-label="جستجو در راهنما"
              className="w-full rounded-2xl border-0 bg-white py-3 pr-10 pl-10 text-[13px] text-slate-800 shadow-lg outline-none ring-2 ring-white/40 focus:ring-4 focus:ring-sky-300/60"
            />
            {query && <button onClick={() => setQuery('')} className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100" aria-label="پاک کردن جستجو"><X className="h-4 w-4" /></button>}
          </div>
        </div>
      </section>

      <div className="app-tabs" role="tablist" aria-label="نقش">
        {GUIDE_ROLES.map((r) => (
          <button key={r.id} role="tab" aria-selected={role === r.id} onClick={() => setRole(r.id)} className="app-tab">
            {r.label}{r.id === suggestedRole && r.id !== 'ALL' && <span className="rounded-full bg-blue-100 px-1.5 text-[9px] text-blue-800">نقش شما</span>}
          </button>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[15rem_1fr]">
        {/* فهرست موضوعی */}
        <nav className="dash-card h-fit lg:sticky lg:top-4 hidden lg:block" aria-label="فهرست موضوعی">
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-extrabold text-slate-500"><ListChecks className="h-3.5 w-3.5" />فهرست موضوعی</p>
          <ul className="space-y-3">
            {sections.map(([section, items]) => (
              <li key={section}>
                <p className="text-[11px] font-black text-[var(--app-primary)]">{section}</p>
                <ul className="mt-1 space-y-0.5 border-r-2 border-blue-100 pr-2">
                  {items.map((t) => <li key={t.id}><button onClick={() => scrollTo(t.id)} className="w-full rounded-lg px-2 py-1 text-right text-[11.5px] font-bold text-slate-600 hover:bg-blue-50 hover:text-slate-900">{t.title}</button></li>)}
                </ul>
              </li>
            ))}
            {showGlossary && <li><button onClick={() => scrollTo('statuses')} className="text-[11px] font-black text-[var(--app-primary)]">معنی وضعیت‌ها</button></li>}
            {showErrors && <li><button onClick={() => scrollTo('errors')} className="text-[11px] font-black text-[var(--app-primary)]">مشکلات رایج</button></li>}
          </ul>
        </nav>

        <div className="min-w-0 space-y-6">
          {sections.length === 0 && !showGlossary && !showErrors && (
            <div className="dash-card text-center"><CircleHelp className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-700">موضوعی با «{query}» پیدا نشد.</p><p className="mt-1 text-xs text-slate-500">واژه دیگری امتحان کنید یا نقش «همه» را انتخاب کنید.</p></div>
          )}

          {sections.map(([section, items]) => (
            <section key={section} className="space-y-3">
              <h3 className="flex items-center gap-2 text-[13px] font-black text-slate-800"><span className="h-4 w-1.5 rounded-full bg-gradient-to-b from-sky-400 to-blue-700" />{section}<span className="text-[11px] font-bold text-slate-400">({toPersianDigits(items.length)})</span></h3>
              <div className="grid gap-3 xl:grid-cols-2">
                {items.map((t) => (
                  <article key={t.id} id={`guide-${t.id}`} className="dash-card scroll-mt-4 flex flex-col">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-[14px] font-black text-slate-900">{t.title}</h4>
                      <div className="flex flex-wrap justify-end gap-1">{t.roles.filter((r) => r !== 'ALL').map((r) => <span key={r} className="dash-chip dash-chip-primary">{GUIDE_ROLES.find((x) => x.id === r)?.label}</span>)}</div>
                    </div>
                    <p className="mt-1.5 text-[12px] leading-7 text-slate-600">{t.summary}</p>
                    {t.steps && (
                      <ol className="mt-3 space-y-1.5">
                        {t.steps.map((step, i) => (
                          <li key={i} className="flex gap-2.5 text-[12px] leading-6 text-slate-700">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[10px] font-black text-[var(--app-primary)] ring-1 ring-blue-100">{toPersianDigits(i + 1)}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {t.tips && t.tips.map((tip) => <p key={tip} className="mt-2.5 flex gap-2 rounded-xl bg-blue-50/60 px-3 py-2 text-[11.5px] leading-6 text-slate-700"><Info className="mt-1 h-3.5 w-3.5 shrink-0 text-[var(--app-primary)]" />{tip}</p>)}
                    {t.note && <p className="mt-2.5 flex gap-2 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2 text-[11.5px] leading-6 text-amber-900"><AlertCircle className="mt-1 h-3.5 w-3.5 shrink-0" />{t.note}</p>}
                    {(t.menu || t.route) && (
                      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                        {t.menu ? <span className="flex items-center gap-1.5 text-[11px] text-slate-500"><MousePointerClick className="h-3.5 w-3.5" />{t.menu}</span> : <span />}
                        {t.route && <button onClick={() => navigateTo(t.route!)} className="dash-link">ورود به بخش<ArrowLeft className="h-3.5 w-3.5" /></button>}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </section>
          ))}

          {showGlossary && (
            <section id="guide-statuses" className="dash-card scroll-mt-4">
              <h3 className="flex items-center gap-2 text-[13px] font-black text-slate-800"><Tags className="h-4 w-4 text-[var(--app-primary)]" />معنی وضعیت‌های اصلی</h3>
              <div className="mt-3 grid gap-4 xl:grid-cols-2">
                {STATUS_GLOSSARY.map((g) => (
                  <div key={g.group}>
                    <p className="mb-2 text-[11px] font-extrabold text-slate-500">{g.group}</p>
                    <ul className="space-y-1.5">
                      {g.items.map((i) => <li key={i.label} className="flex flex-wrap items-center gap-2 text-[11.5px] leading-6"><span className={TONE[i.tone]}>{i.label}</span><span className="text-slate-600">{i.meaning}</span></li>)}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {showErrors && (
            <section id="guide-errors" className="dash-card scroll-mt-4">
              <h3 className="flex items-center gap-2 text-[13px] font-black text-slate-800"><CircleHelp className="h-4 w-4 text-[var(--app-primary)]" />مشکلات و خطاهای رایج</h3>
              <div className="mt-3 divide-y divide-slate-100">
                {COMMON_ERRORS.map((e) => (
                  <details key={e.problem} className="group py-2.5">
                    <summary className="cursor-pointer list-none text-[12.5px] font-bold text-slate-800 marker:hidden flex items-center justify-between gap-2">{e.problem}<span className="text-slate-400 transition group-open:rotate-45 text-lg leading-none">+</span></summary>
                    <p className="mt-1.5 text-[12px] leading-7 text-slate-600">{e.solution}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
