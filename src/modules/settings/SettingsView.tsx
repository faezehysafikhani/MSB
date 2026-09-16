import React, { useState } from 'react';
import { Settings, Users2, PieChart, BookOpen, Network, PenTool, UserCheck } from 'lucide-react';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { UserManagementTab } from './UserManagementTab';
import { LdapSettingsTab } from './LdapSettingsTab';
import { SignatureWorkflowTab } from './SignatureWorkflowTab';
import { SignatureDelegationTab } from './SignatureDelegationTab';
import { InfographicsView } from '../infographics/InfographicsView';
import { UserGuideView } from '../guide/UserGuideView';
import { useApp } from '../../context/AppContext';

type SettingsMainTab = 'GENERAL' | 'USERS' | 'SIGNATURE_WORKFLOW' | 'LDAP' | 'DELEGATION' | 'INFOGRAPHICS' | 'GUIDE';

export const SettingsView: React.FC = () => {
  const { currentUser, hasPermission } = useApp();

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
      {activeTab === 'DELEGATION' && <SignatureDelegationTab />}
      {activeTab === 'INFOGRAPHICS' && <InfographicsView />}
      {activeTab === 'GUIDE' && <UserGuideView />}
    </div>
  );
};
