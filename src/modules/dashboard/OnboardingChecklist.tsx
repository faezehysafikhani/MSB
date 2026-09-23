import React from 'react';
import { Building2, CalendarPlus, CheckCircle2, ChevronLeft, ListChecks, ShieldCheck, UsersRound } from 'lucide-react';
import { useApp, AppRoute } from '../../context/AppContext';
import { getOrganizationProfile } from '../../services/organizationProfile';

const PREFIX = 'postbank-mosavabat-v1:';
const hasSavedItems = (key: string) => {
  try {
    const value = window.localStorage.getItem(`${PREFIX}${key}`);
    return Boolean(value && Array.isArray(JSON.parse(value)) && JSON.parse(value).length > 0);
  } catch { return false; }
};
const hasSavedValue = (key: string) => window.localStorage.getItem(`${PREFIX}${key}`) !== null;

export const hasOperationalData = () => ['proposals', 'meetings', 'resolutions', 'tasks'].some(hasSavedItems);

export const OnboardingChecklist: React.FC = () => {
  const { navigateTo, openCreateMeetingModal } = useApp();
  const profile = getOrganizationProfile();
  const steps: { title: string; description: string; icon: React.ElementType; done: boolean; action: string; route?: AppRoute; onClick?: () => void }[] = [
    { title: 'اطلاعات و نشان سازمان', description: 'نام، عنوان سامانه و نشان سازمان را ثبت کنید.', icon: Building2, done: Boolean(profile.name.trim()), action: 'تکمیل هویت', route: 'settings' },
    { title: 'واحدها و سمت‌ها', description: 'ساختار سازمانی و سمت‌های موردنیاز را تعریف کنید.', icon: ListChecks, done: hasSavedValue('customPositions'), action: 'مدیریت ساختار', route: 'settings' },
    { title: 'کاربران و نقش‌ها', description: 'کاربران را ایجاد کنید و نقش و مجوز هر نفر را تعیین کنید.', icon: UsersRound, done: hasSavedItems('users'), action: 'مدیریت کاربران', route: 'users' },
    { title: 'گردش امضا', description: 'قالب امضا و بررسی را پیش از ثبت پرونده‌ها مشخص کنید.', icon: ShieldCheck, done: hasSavedValue('signatureWorkflowSettings'), action: 'تنظیم گردش', route: 'settings' },
    { title: 'اولین جلسه', description: 'یک جلسه جدید بسازید یا داده‌های قبلی را وارد کنید.', icon: CalendarPlus, done: hasOperationalData(), action: 'ثبت جلسه', onClick: () => openCreateMeetingModal() },
  ];
  const completed = steps.filter((step) => step.done).length;
  return (
    <section className="rounded-3xl border border-teal-100 bg-gradient-to-l from-teal-50 to-white p-5 sm:p-7 shadow-xs">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-teal-100 pb-4">
        <div>
          <p className="text-xs font-bold text-teal-700">شروع کار سازمان</p>
          <h2 className="mt-1 text-lg font-black text-slate-900">سامانه هنوز داده عملیاتی ندارد</h2>
          <p className="mt-1 text-xs leading-6 text-slate-600">این مراحل با داده‌های واقعی ذخیره‌شده در همین مرورگر بررسی می‌شوند؛ داده نمونه به‌عنوان داده سازمانی محسوب نمی‌شود.</p>
        </div>
        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-teal-800 shadow-sm">{completed} از {steps.length} گام</span>
      </div>
      <ol className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between"><Icon className="h-5 w-5 text-teal-700" />{step.done ? <CheckCircle2 className="h-5 w-5 text-emerald-600" /> : <span className="text-[11px] font-bold text-slate-400">گام {index + 1}</span>}</div>
            <h3 className="mt-3 text-xs font-extrabold text-slate-800">{step.title}</h3>
            <p className="mt-1 min-h-10 text-[11px] leading-5 text-slate-500">{step.description}</p>
            <button onClick={() => { if (step.onClick) step.onClick(); else if (step.route) navigateTo(step.route); }} className="mt-3 flex items-center gap-1 text-xs font-bold text-teal-700 hover:text-teal-900">
              {step.done ? 'بازبینی' : step.action}<ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </li>;
        })}
      </ol>
    </section>
  );
};
