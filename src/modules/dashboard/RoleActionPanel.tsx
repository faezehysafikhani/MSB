import React from 'react';
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, FileCheck2, Send, ShieldCheck } from 'lucide-react';
import { AppRoute, useApp } from '../../context/AppContext';

interface RoleActionPanelProps {
  tasks: number;
  approvals: number;
  overdue: number;
  upcomingMeetings: number;
}

export const RoleActionPanel: React.FC<RoleActionPanelProps> = ({ tasks, approvals, overdue, upcomingMeetings }) => {
  const { currentUser, navigateTo } = useApp();
  let title = 'اقدام بعدی من';
  let description = 'کارهای نیازمند پیگیری شما در اولویت نمایش داده می‌شوند.';
  let actionLabel = 'مشاهده وظایف من';
  let route: AppRoute = 'tasks';
  let Icon = CheckCircle2;
  let count = tasks;

  if (currentUser.role === 'SECRETARY') {
    title = 'پیشخوان دبیرخانه'; description = 'جلسات، پیشنهادها و ابلاغ‌های نیازمند اقدام را مدیریت کنید.';
    actionLabel = 'مدیریت جلسات'; route = 'meetings'; Icon = CalendarDays; count = upcomingMeetings;
  } else if (currentUser.role === 'DEPT_MANAGER' || currentUser.role === 'CEO') {
    title = 'پیشخوان مدیریت'; description = 'تصمیم‌های در انتظار، تأخیرها و وضعیت اجرای واحدها را مرور کنید.';
    actionLabel = overdue > 0 ? 'مشاهده موارد معوق' : 'مشاهده مصوبات'; route = 'resolutions'; Icon = FileCheck2; count = overdue;
  } else if (currentUser.role === 'ADMIN') {
    title = 'پیشخوان راهبری سامانه'; description = 'گردش‌های در انتظار، وضعیت اجرا و آماده‌بودن داده‌های سازمان را کنترل کنید.';
    actionLabel = approvals > 0 ? 'کارتابل صحه‌گذاری' : 'مرور مصوبات'; route = approvals > 0 ? 'approvals' : 'resolutions'; Icon = approvals > 0 ? ShieldCheck : ClipboardCheck; count = approvals;
  } else if (approvals > 0) {
    title = 'موارد در انتظار صحه‌گذاری من'; description = 'گزارش و مستندات اجرا را بررسی و تصمیم خود را ثبت کنید.';
    actionLabel = 'ورود به کارتابل صحه‌گذاری'; route = 'approvals'; Icon = ShieldCheck; count = approvals;
  }

  return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></div>
        <div><p className="text-xs font-extrabold text-slate-900">{title}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{description}</p></div>
      </div>
      <button onClick={() => navigateTo(route)} className="inline-flex items-center gap-2 rounded-xl bg-teal-800 px-3.5 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-teal-700">
        {actionLabel}{count > 0 && <span className="rounded-full bg-white/20 px-1.5 py-0.5">{count.toLocaleString('fa-IR')}</span>}<ArrowLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  </section>;
};
