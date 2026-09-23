import React, { useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  ClipboardCheck,
  FileCheck2,
  Lightbulb,
  PenTool,
  Scale,
  Send,
  ShieldCheck,
  UserCog,
  Workflow,
} from 'lucide-react';
import { useApp, AppRoute } from '../../context/AppContext';
import { toPersianDigits } from '../../utils/formatters';

/**
 * اینفوگراف تک‌صفحه‌ای مسیر سامانه — مطابق گردش واقعی کد. همه ۹ مرحله در یک
 * نگاه دیده می‌شوند؛ جزئیات مرحله انتخاب‌شده در نوار پایین می‌آید.
 */
interface Stage {
  id: number;
  title: string;
  icon: React.ElementType;
  role: string;
  action: string;
  output: string;
  menu: string;
  route: AppRoute;
  phase: 'proposal' | 'meeting' | 'resolution' | 'execution';
  note?: string;
}

const STAGES: Stage[] = [
  { id: 1, phase: 'proposal', title: 'پیشنهاد مصوبه', icon: Lightbulb, role: 'هر کاربر', action: 'ثبت عنوان، شرح، دلیل و پیوست پیشنهاد', output: 'در کارتابل مدیرعامل', menu: 'مصوبات پیشنهادی', route: 'proposals' },
  { id: 2, phase: 'proposal', title: 'بررسی و تصمیم', icon: Scale, role: 'مدیرعامل، دفتر، دبیر', action: 'تصمیم مدیرعامل ← تبدیل به تأیید جلسه در دفتر ← تأیید نهایی دبیر', output: 'آماده دستور جلسه', menu: 'مصوبات پیشنهادی', route: 'proposals', note: 'امکان بازگشت جهت اصلاح یا «عدم نیاز به طرح»' },
  { id: 3, phase: 'meeting', title: 'برنامه‌ریزی جلسه', icon: CalendarDays, role: 'دبیر / مسئول دفتر', action: 'زمان، اعضا و دستور جلسه؛ تأیید دستور توسط مدیرعامل؛ ارسال دعوتنامه', output: 'دعوتنامه ارسال‌شده', menu: 'مدیریت جلسات ← جلسه جدید', route: 'meetings' },
  { id: 4, phase: 'resolution', title: 'ثبت مصوبه', icon: FileCheck2, role: 'دبیر جلسه', action: 'ثبت نتیجه هر بند با مجری، مهلت، صحه‌گذار و برنامه پیگیری', output: 'در انتظار امضا', menu: 'جزئیات جلسه ← ثبت مصوبه', route: 'resolutions' },
  { id: 5, phase: 'resolution', title: 'امضا', icon: PenTool, role: 'دفتر ← مدیرعامل ← ادمین', action: 'امضای ترتیبی صورت‌جلسه مصوبه (قابل تنظیم؛ با جانشین امضا)', output: 'آماده ابلاغ', menu: 'بانک مصوبات', route: 'resolutions' },
  { id: 6, phase: 'resolution', title: 'ابلاغ', icon: Send, role: 'مسئول دفتر + دبیر', action: 'ثبت ابلاغ با شماره نامه خودکار و امضای ابلاغیه توسط دبیر', output: 'وظیفه در کارتابل مجری', menu: 'کارتابل ابلاغ', route: 'notification-inbox' },
  { id: 7, phase: 'execution', title: 'اقدام مجری', icon: UserCog, role: 'مجری', action: 'ثبت گزارش پیشرفت، موانع و پیوست؛ سپس اعلام اتمام', output: 'در انتظار صحه‌گذاری', menu: 'وظایف ارجاعی من', route: 'tasks', note: 'بدون صحه‌گذار، با اعلام اتمام مختومه می‌شود' },
  { id: 8, phase: 'execution', title: 'پیگیری', icon: ClipboardCheck, role: 'مسئول دفتر', action: 'پیگیری دوره‌ای (هفتگی/ماهانه/فصلی) هم‌زمان با اجرا', output: 'سابقه پیگیری', menu: 'پیگیری', route: 'follow-up', note: 'هم‌زمان با اقدام مجری؛ وضعیت را تغییر نمی‌دهد' },
  { id: 9, phase: 'execution', title: 'صحه‌گذاری و خاتمه', icon: ShieldCheck, role: 'صحه‌گذار', action: 'بررسی گزارش و مستندات؛ تأیید یا بازگشت به مجری', output: 'مصوبه مختومه', menu: 'کارتابل صحه‌گذاری', route: 'approvals' },
];

const PHASES: Record<Stage['phase'], { label: string; tone: string }> = {
  proposal: { label: 'پیشنهاد', tone: 'from-sky-400 to-sky-600' },
  meeting: { label: 'جلسه', tone: 'from-blue-500 to-blue-700' },
  resolution: { label: 'مصوبه', tone: 'from-indigo-500 to-blue-800' },
  execution: { label: 'اجرا و خاتمه', tone: 'from-blue-700 to-slate-900' },
};

export const InfographicsView: React.FC = () => {
  const { navigateTo } = useApp();
  const [activeId, setActiveId] = useState<number>(1);
  const active = STAGES.find((s) => s.id === activeId)!;
  const ActiveIcon = active.icon;

  return (
    <div className="ig-wrap">
      <section className="info-band">
        <span className="info-band-icon"><Workflow className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-black text-white">مسیر پیشنهاد تا مصوبه مختومه در ۹ مرحله</h2>
        </div>
        <ul className="hidden md:flex gap-1.5">
          {Object.entries(PHASES).map(([key, phase]) => (
            <li key={key} className="flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10.5px] font-bold text-white ring-1 ring-white/25"><span className={`h-2 w-2 rounded-full bg-gradient-to-br ${phase.tone} ring-1 ring-white/70`} />{phase.label}</li>
          ))}
        </ul>
      </section>

      <ol className="ig-grid">
        {STAGES.map((stage) => {
          const Icon = stage.icon;
          return (
            <li key={stage.id} className="ig-cell">
              <button onClick={() => setActiveId(stage.id)} aria-pressed={stage.id === activeId} className={`ig-tile ig-${stage.phase}`}>
                <span className={`ig-icon bg-gradient-to-br ${PHASES[stage.phase].tone}`}><Icon className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1 text-right">
                  <span className="flex items-center gap-1.5"><span className="ig-num">{toPersianDigits(stage.id)}</span><b className="truncate text-[13px] text-slate-900">{stage.title}</b></span>
                  <span className="mt-0.5 block truncate text-[11px] text-slate-500">{stage.role}</span>
                  <span className="mt-0.5 block truncate text-[11px] font-bold text-blue-700">← {stage.output}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <section className="ig-detail">
        <span className={`ig-icon ig-icon-lg bg-gradient-to-br ${PHASES[active.phase].tone}`}><ActiveIcon className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-black text-slate-900">{toPersianDigits(active.id)}. {active.title} <span className="text-[11px] font-bold text-slate-500">· {active.role}</span></p>
          <p className="mt-0.5 text-[12px] leading-6 text-slate-600">{active.action}{active.note && <span className="text-slate-500"> — {active.note}</span>}</p>
          <p className="text-[11px] text-slate-500">منو: <b className="text-slate-700">{active.menu}</b></p>
        </div>
        <button onClick={() => navigateTo(active.route)} className="app-btn-primary shrink-0">رفتن به بخش<ArrowLeft className="h-4 w-4" /></button>
      </section>
    </div>
  );
};
