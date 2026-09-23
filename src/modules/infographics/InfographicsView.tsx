import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Lightbulb,
  PenTool,
  RotateCcw,
  Scale,
  Send,
  ShieldCheck,
  UserCog,
  Workflow,
} from 'lucide-react';
import { useApp, AppRoute } from '../../context/AppContext';
import { toPersianDigits } from '../../utils/formatters';

/**
 * اینفوگراف مسیر سامانه — مطابق گردش واقعی کد:
 * proposalService → meetingService → resolutionService (امضا، ابلاغ، اجرا،
 * صحه‌گذاری) و followUpService. هر مرحله نقش مسئول، اقدام اصلی، خروجی و
 * منوی مرتبط را نشان می‌دهد.
 */
interface Stage {
  id: number;
  title: string;
  icon: React.ElementType;
  role: string;
  action: string;
  output: string;
  details: string[];
  menu: string;
  route: AppRoute;
  phase: 'proposal' | 'meeting' | 'resolution' | 'execution';
  parallel?: boolean;
}

const STAGES: Stage[] = [
  { id: 1, phase: 'proposal', title: 'پیشنهاد مصوبه', icon: Lightbulb, role: 'هر کاربر (پیشنهاددهنده)', action: 'ثبت عنوان، شرح، دلیل و پیوست پیشنهاد', output: 'پیشنهاد در کارتابل مدیرعامل', menu: 'مصوبات پیشنهادی ← ثبت پیشنهاد', route: 'proposals', details: ['کاربر عادی فقط اجازه ثبت و پیگیری پیشنهاد خود را دارد.', 'مسئول دفتر می‌تواند پیشنهادها را از فایل Excel هم وارد کند.'] },
  { id: 2, phase: 'proposal', title: 'بررسی و تصمیم', icon: Scale, role: 'مسئول دفتر، مدیرعامل و دبیر جلسه', action: 'تصمیم مدیرعامل ← تبدیل به تأیید جلسه در دفتر ← تأیید نهایی دبیر', output: 'پیشنهاد آماده افزودن به دستور جلسه', menu: 'مصوبات پیشنهادی ← کارتابل هر نقش', route: 'proposals', details: ['مدیرعامل: تأیید، رد، بازگشت جهت اصلاح، «عدم نیاز به طرح» یا دستور مستقیم.', 'دبیر جلسه در صورت نیاز پیشنهاد را برای اصلاح به دفتر برمی‌گرداند.'] },
  { id: 3, phase: 'meeting', title: 'برنامه‌ریزی جلسه', icon: CalendarDays, role: 'دبیر جلسه / مسئول دفتر', action: 'تعیین زمان، مکان، اعضا، مدعوین و دستور جلسه', output: 'جلسه با دعوتنامه ارسال‌شده', menu: 'مدیریت جلسات ← جلسه جدید', route: 'meetings', details: ['دستور جلسه پیش از دعوت به تأیید مدیرعامل می‌رسد.', 'دعوتنامه با امضای دبیر جلسه برای اعضا و مدعوین ارسال می‌شود.'] },
  { id: 4, phase: 'resolution', title: 'ثبت مصوبه', icon: FileCheck2, role: 'دبیر جلسه', action: 'ثبت نتیجه هر بند و صدور مصوبه با مجری، مهلت و اولویت', output: 'مصوبه در انتظار امضا', menu: 'جزئیات جلسه ← ثبت مصوبه برای بند', route: 'resolutions', details: ['برای هر بند دستور جلسه فقط یک مصوبه ثبت می‌شود.', 'صحه‌گذاران و برنامه پیگیری (هفتگی، ماهانه، فصلی) همین‌جا تعیین می‌شوند.'] },
  { id: 5, phase: 'resolution', title: 'امضا', icon: PenTool, role: 'مسئول دفتر ← مدیرعامل ← مدیر سیستم', action: 'امضای ترتیبی صورت‌جلسه مصوبه', output: 'مصوبه در انتظار ابلاغ رسمی', menu: 'بانک مصوبات ← جزئیات مصوبه ← امضا', route: 'resolutions', details: ['امضاکنندگان در «تنظیمات گردش امضا» قابل تغییرند.', 'جانشین فعال امضا می‌تواند به‌جای امضاکننده اصلی امضا کند.'] },
  { id: 6, phase: 'resolution', title: 'ابلاغ', icon: Send, role: 'مسئول دفتر + دبیر جلسه', action: 'ثبت ابلاغ با شماره نامه خودکار و امضای ابلاغیه', output: 'مصوبه ابلاغ‌شده و وظیفه در کارتابل مجری', menu: 'کارتابل ابلاغ', route: 'notification-inbox', details: ['تا امضای ابلاغیه توسط دبیر جلسه، وظیفه اجرایی ساخته نمی‌شود.', 'تاریخ و ساعت ابلاغ از زمان واقعی سیستم ثبت می‌شود.'] },
  { id: 7, phase: 'execution', title: 'اقدام مجری', icon: UserCog, role: 'مجری (مسئول اجرا)', action: 'ثبت گزارش پیشرفت، موانع و پیوست؛ اعلام اتمام', output: 'در انتظار صحه‌گذاری یا خاتمه مستقیم', menu: 'وظایف ارجاعی من', route: 'tasks', details: ['اگر مصوبه صحه‌گذار نداشته باشد، با اعلام اتمام مختومه می‌شود.', 'عبور از مهلت، وضعیت را خودکار «عقب‌افتاده» می‌کند و اعلان می‌فرستد.'] },
  { id: 8, phase: 'execution', title: 'پیگیری', icon: ClipboardCheck, role: 'مسئول دفتر', action: 'پیگیری دوره‌ای طبق برنامه و ثبت نتیجه', output: 'سابقه پیگیری و موعد بعدی', menu: 'پیگیری', route: 'follow-up', parallel: true, details: ['هم‌زمان با اجرای مجری انجام می‌شود و وضعیت مصوبه را تغییر نمی‌دهد.', 'مواردی که موعدشان رسیده یا نزدیک است در کارتابل پیگیری دیده می‌شوند.'] },
  { id: 9, phase: 'execution', title: 'صحه‌گذاری و خاتمه', icon: ShieldCheck, role: 'صحه‌گذار (ناظر / مدیر)', action: 'بررسی گزارش و مستندات؛ تأیید یا بازگشت', output: 'مصوبه مختومه یا بازگشت به مجری', menu: 'کارتابل صحه‌گذاری', route: 'approvals', details: ['صحه‌گذاری می‌تواند ترتیبی یا موازی و چندمرحله‌ای باشد.', 'مصوبه مختومه قابل انتقال به بایگانی است.'] },
];

const PHASES: Record<Stage['phase'], { label: string; tone: string; dot: string }> = {
  proposal: { label: 'پیشنهاد', tone: 'from-sky-400 to-sky-600', dot: 'bg-sky-500' },
  meeting: { label: 'جلسه', tone: 'from-blue-500 to-blue-700', dot: 'bg-blue-600' },
  resolution: { label: 'مصوبه', tone: 'from-indigo-500 to-blue-800', dot: 'bg-indigo-600' },
  execution: { label: 'اجرا و خاتمه', tone: 'from-blue-800 to-slate-900', dot: 'bg-blue-900' },
};

export const InfographicsView: React.FC = () => {
  const { navigateTo } = useApp();
  const [activeId, setActiveId] = useState<number>(1);
  const active = STAGES.find((s) => s.id === activeId)!;
  const ActiveIcon = active.icon;

  return (
    <div className="space-y-5">
      {/* سربرگ جمع‌وجور اینفوگراف */}
      <section className="info-band">
        <span className="info-band-icon"><Workflow className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-black text-white">مسیر پیشنهاد تا مصوبه مختومه</h2>
          <p className="text-[11.5px] text-blue-100">۹ مرحله · روی هر مرحله بزنید تا جزئیات آن را ببینید</p>
        </div>
        <ul className="hidden sm:flex flex-wrap gap-1.5">
          {Object.entries(PHASES).map(([key, phase]) => (
            <li key={key} className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold text-white ring-1 ring-white/25"><span className={`h-2 w-2 rounded-full bg-gradient-to-br ${phase.tone} ring-1 ring-white/70`} />{phase.label}</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-5 2xl:grid-cols-[1fr_22rem]">
        {/* نقشه مراحل: در موبایل عمودی، در تبلت دو ستون، در دسکتاپ سه ستون */}
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage, index) => {
            const Icon = stage.icon;
            const isActive = stage.id === activeId;
            return (
              <li key={stage.id} className="relative">
                <button
                  onClick={() => setActiveId(stage.id)}
                  aria-pressed={isActive}
                  className={`infographic-card infographic-${stage.phase} group ${isActive ? 'infographic-card-active' : ''}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`infographic-icon bg-gradient-to-br ${PHASES[stage.phase].tone}`}><Icon className="h-5 w-5" /></span>
                    <span className="flex items-center gap-1.5">
                      {stage.parallel && <span className="dash-chip dash-chip-primary">هم‌زمان با اجرا</span>}
                      <span className="infographic-step">{toPersianDigits(stage.id)}</span>
                    </span>
                  </div>
                  <h3 className="mt-3 text-[14px] font-black text-slate-900">{stage.title}</h3>
                  <dl className="mt-2 space-y-1.5 text-[11.5px] leading-6">
                    <div className="flex gap-1.5"><dt className="shrink-0 font-extrabold text-[var(--app-primary)]">نقش:</dt><dd className="text-slate-700">{stage.role}</dd></div>
                    <div className="flex gap-1.5"><dt className="shrink-0 font-extrabold text-[var(--app-primary)]">اقدام:</dt><dd className="text-slate-700">{stage.action}</dd></div>
                    <div className="flex gap-1.5"><dt className="shrink-0 font-extrabold text-[var(--app-primary)]">خروجی:</dt><dd className="font-bold text-slate-900">{stage.output}</dd></div>
                  </dl>
                </button>
                {index < STAGES.length - 1 && (
                  <span className="infographic-arrow" aria-hidden="true">
                    <ArrowDown className="h-4 w-4 sm:hidden" />
                    <ArrowLeft className="hidden h-4 w-4 sm:block" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        {/* جزئیات مرحله انتخاب‌شده */}
        {/* جزئیات مرحله انتخاب‌شده — نوار جمع‌وجور */}
        <aside className="info-detail order-first 2xl:order-none 2xl:sticky 2xl:top-4 h-fit">
          <div className="flex min-w-0 items-center gap-3">
            <span className={`infographic-icon bg-gradient-to-br ${PHASES[active.phase].tone}`}><ActiveIcon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="text-[10.5px] font-bold text-slate-500">مرحله {toPersianDigits(active.id)} از {toPersianDigits(STAGES.length)} · {PHASES[active.phase].label}</p>
              <h3 className="text-[15px] font-black text-slate-900">{active.title}</h3>
            </div>
          </div>
          <ul className="min-w-0 flex-1 space-y-1 text-[11.5px] leading-6 text-slate-600">
            {active.details.map((d) => <li key={d} className="flex gap-2"><span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--app-primary)]" />{d}</li>)}
            <li className="text-[11px] text-slate-500"><span className="font-extrabold text-slate-700">منو: </span>{active.menu}</li>
          </ul>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setActiveId(active.id < STAGES.length ? active.id + 1 : 1)} className="app-btn-secondary" title="مرحله بعد">{active.id < STAGES.length ? 'مرحله بعد' : <><RotateCcw className="h-4 w-4" />شروع</>}</button>
            <button onClick={() => navigateTo(active.route)} className="app-btn-primary">رفتن به بخش<ArrowLeft className="h-4 w-4" /></button>
          </div>
        </aside>
      </div>

      {/* مسیرهای برگشت */}
      <section className="dash-card">
        <h3 className="text-[13px] font-extrabold text-slate-800">مسیرهای برگشت و استثنا</h3>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4 text-[11.5px] leading-6">
          <li className="rounded-xl border border-slate-200 bg-white/70 p-3"><strong className="block text-slate-800">بازگشت جهت اصلاح</strong><span className="text-slate-600">مدیرعامل یا دبیر جلسه پیشنهاد را برای اصلاح به پیشنهاددهنده برمی‌گرداند.</span></li>
          <li className="rounded-xl border border-slate-200 bg-white/70 p-3"><strong className="block text-slate-800">عدم نیاز به طرح</strong><span className="text-slate-600">مدیرعامل بدون جلسه تصمیم می‌گیرد یا دستور مستقیم صادر می‌کند.</span></li>
          <li className="rounded-xl border border-slate-200 bg-white/70 p-3"><strong className="block text-slate-800">برگشت از صحه‌گذاری</strong><span className="text-slate-600">در صورت عدم تأیید، وظیفه با دلیل به مجری بازمی‌گردد.</span></li>
          <li className="rounded-xl border border-slate-200 bg-white/70 p-3"><strong className="block text-slate-800">بایگانی</strong><span className="text-slate-600">پیشنهاد یا مصوبه بدون حذف فیزیکی در پوشه بایگانی قرار می‌گیرد.</span></li>
        </ul>
      </section>
    </div>
  );
};
