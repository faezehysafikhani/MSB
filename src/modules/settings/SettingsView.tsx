import React, { useState } from 'react';
import { Settings, Users2, PieChart, BookOpen, Network, PenTool, UserCheck, Database } from 'lucide-react';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { UserManagementTab } from './UserManagementTab';
import { LdapSettingsTab } from './LdapSettingsTab';
import { SignatureWorkflowTab } from './SignatureWorkflowTab';
import { SignatureDelegationTab } from './SignatureDelegationTab';
import { InfographicsView } from '../infographics/InfographicsView';
import { UserGuideView } from '../guide/UserGuideView';
import { useApp } from '../../context/AppContext';
import { hasDemoData, loadDemoData, resetDemoData } from '../../services/demoDataService';

type SettingsMainTab = 'GENERAL' | 'USERS' | 'SIGNATURE_WORKFLOW' | 'LDAP' | 'DELEGATION' | 'INFOGRAPHICS' | 'GUIDE' | 'DEMO';

export const SettingsView: React.FC = () => {
  const { currentUser, hasPermission, showToast } = useApp();

  // اینفوگراف و راهنمای کاربری از منوی اصلی به اینجا منتقل شده‌اند. آنها
  // مثل قبل برای همه کاربران در دسترس‌اند؛ تنظیمات عمومی و مدیریت کاربران
  // دقیقاً همان محدودیت قبلی خود را نگه می‌دارند.
  const canManageSystem = currentUser.role === 'ADMIN' || hasPermission('MANAGE_USERS');

  const tabs: { id: SettingsMainTab; label: string; icon: React.ElementType }[] = [
    ...(canManageSystem
      ? [
          { id: 'GENERAL' as SettingsMainTab, label: 'تنظیمات عمومی', icon: Settings },
          { id: 'USERS' as SettingsMainTab, label: 'مدیریت کاربران', icon: Users2 },
          // LDAP مثل بقیه تب‌های مدیریتی فقط برای مدیر سیستم / دارنده مجوز
          // مدیریت تنظیمات نمایش داده می‌شود.
          // تنظیمات گردش امضا مثل سایر تب‌های مدیریتی، همان گیت فعلی را دارد.
          { id: 'SIGNATURE_WORKFLOW' as SettingsMainTab, label: 'تنظیمات گردش امضا', icon: PenTool },
          { id: 'LDAP' as SettingsMainTab, label: 'LDAP', icon: Network },
          { id: 'DEMO' as SettingsMainTab, label: 'داده نمایشی', icon: Database },
        ]
      : []),
    // «جانشین امضا» تنظیم شخصی هر کاربر است و برای همه در دسترس است.
    { id: 'DELEGATION' as SettingsMainTab, label: 'جانشین امضا', icon: UserCheck },
    { id: 'INFOGRAPHICS' as SettingsMainTab, label: 'اینفوگراف', icon: PieChart },
    { id: 'GUIDE' as SettingsMainTab, label: 'راهنمای کاربری', icon: BookOpen },
  ];

  const [mainTab, setMainTab] = useState<SettingsMainTab>(tabs[0].id);
  const activeTab = tabs.some((t) => t.id === mainTab) ? mainTab : tabs[0].id;

  return (
    <div className="space-y-5 pb-12">
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-100">
        <h1 className="text-base font-bold text-slate-800 tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-teal-700" />
          <span>تنظیمات سامانه</span>
        </h1>
        <p className="text-xs text-slate-400 font-medium mt-0.5">
          {canManageSystem
            ? 'مدیریت اطلاعات سازمان، پنل پیامکی، تقویم، تم سامانه، مدیریت کاربران، دایرکتوری سازمانی، اینفوگراف و راهنمای کاربری'
            : 'اینفوگراف سامانه و راهنمای کاربری'}
        </p>

        <div className="flex flex-wrap bg-slate-100 p-1 rounded-2xl gap-1 text-xs font-bold mt-4 w-fit">
          {tabs.map((tabItem) => {
            const Icon = tabItem.icon;
            return (
              <button
                key={tabItem.id}
                onClick={() => setMainTab(tabItem.id)}
                className={`flex items-center gap-1.5 py-2 px-4 rounded-xl transition-all cursor-pointer ${
                  activeTab === tabItem.id ? 'bg-white text-teal-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tabItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === 'GENERAL' && <GeneralSettingsTab />}
      {activeTab === 'USERS' && <UserManagementTab />}
      {activeTab === 'SIGNATURE_WORKFLOW' && <SignatureWorkflowTab />}
      {activeTab === 'LDAP' && <LdapSettingsTab />}
      {activeTab === 'DEMO' && <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4"><div><h2 className="text-sm font-extrabold text-slate-800">داده نمایشی دمو</h2><p className="mt-1 max-w-2xl text-xs leading-6 text-slate-500">داده نمایشی با برچسب «اطلاعات نمایشی» در همان localStorage سامانه ذخیره می‌شود. بارگذاری، داده دستی را حذف نمی‌کند و فقط رکوردهای نمایشی هم‌نام را بازسازی می‌کند.</p></div><div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">وضعیت فعلی: <strong>{hasDemoData() ? 'داده نمایشی بارگذاری شده است' : 'داده نمایشی بارگذاری نشده است'}</strong></div><div className="flex flex-wrap gap-2"><button onClick={() => { if (window.confirm('داده نمایشی شامل پیشنهاد، جلسه، مصوبه، ابلاغ، ارجاع، گزارش پیشرفت و صحه‌گذاری بارگذاری می‌شود. داده‌های دستی حذف نمی‌شوند. ادامه می‌دهید؟')) { loadDemoData(); showToast('داده نمایشی', 'داده نمایشی بارگذاری شد؛ صفحه برای خواندن مجدد سرویس‌ها تازه می‌شود.', 'success'); window.setTimeout(() => window.location.reload(), 450); } }} className="rounded-xl bg-teal-800 px-4 py-2 text-xs font-bold text-white">بارگذاری داده نمایشی</button><button onClick={() => { if (window.confirm('فقط رکوردهایی که شناسه «demo-» و برچسب اطلاعات نمایشی دارند حذف می‌شوند؛ داده‌های دستی باقی می‌مانند. ادامه می‌دهید؟')) { resetDemoData(); showToast('بازنشانی داده نمایشی', 'رکوردهای نمایشی حذف شدند؛ صفحه تازه می‌شود.', 'success'); window.setTimeout(() => window.location.reload(), 450); } }} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700">بازنشانی داده نمایشی</button></div></div>}
      {activeTab === 'DELEGATION' && <SignatureDelegationTab />}
      {activeTab === 'INFOGRAPHICS' && <InfographicsView />}
      {activeTab === 'GUIDE' && <UserGuideView />}
    </div>
  );
};
