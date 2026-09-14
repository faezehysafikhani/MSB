import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Calendar,
  FileCheck2,
  CheckSquare,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
  Clock,
  UserCheck,
  Settings,
  Lightbulb,
  Archive,
  PieChart,
  Send,
  ClipboardList
} from 'lucide-react';
import { useApp, AppRoute } from '../../context/AppContext';
import { toPersianDigits } from '../../utils/formatters';
import { meetingService, resolutionService, taskService, approvalService } from '../../services';
import { followUpService } from '../../services/followUpService';
import { GUIDE_SLIDES } from '../../modules/guide/UserGuideView';
import { hasOrgWideMeetingAccess } from '../../services/userScope';

interface NavGroup {
  id: string;
  title: string;
  items: {
    route: AppRoute;
    title: string;
    icon: React.ElementType;
    badge?: number;
    badgeColor?: string;
    action?: () => void;
  }[];
}

export const Sidebar: React.FC = () => {
  const {
    currentRoute,
    navigateTo,
    isSidebarCollapsed,
    toggleSidebar,
    currentUser,
    hasPermission,
    refreshTrigger
  } = useApp();

  const [counts, setCounts] = useState({ meetings: 0, resolutions: 0, tasks: 0, approvals: 0, notifyPending: 0, followUpPending: 0 });

  useEffect(() => {
    const isAdmin = currentUser.role === 'ADMIN';
    const canNotify = hasPermission('NOTIFY_RESOLUTION');
    const canFollowUp = hasPermission('VIEW_RESOLUTION_FOLLOWUP');
    Promise.all([
      meetingService.getMeetings({ pageSize: 1, participantUserId: hasOrgWideMeetingAccess(currentUser.role) ? undefined : currentUser.id }),
      resolutionService.getResolutions({ pageSize: 1, relatedUserId: isAdmin ? undefined : currentUser.id }),
      taskService.getMyTasks(currentUser.id, { pageSize: 1 }),
      approvalService.getMyApprovals(currentUser.id, { pageSize: 1, status: 'PENDING' }),
      canNotify ? resolutionService.getResolutions({ pageSize: 1, executionStatus: 'WAITING_NOTIFICATION' }) : Promise.resolve(null),
      canFollowUp ? followUpService.getFollowUpCartable(currentUser).catch(() => null) : Promise.resolve(null),
    ]).then(([meetingsRes, resRes, taskRes, apprRes, notifyRes, followUpRes]) => {
      setCounts({
        meetings: meetingsRes.isSuccess ? meetingsRes.data.totalCount : 0,
        resolutions: resRes.isSuccess ? resRes.data.totalCount : 0,
        tasks: taskRes.isSuccess ? taskRes.data.totalCount : 0,
        approvals: apprRes.isSuccess ? apprRes.data.totalCount : 0,
        notifyPending: notifyRes?.isSuccess ? notifyRes.data.totalCount : 0,
        followUpPending: followUpRes?.isSuccess ? followUpRes.data.length : 0,
      });
    });
  }, [currentUser.id, refreshTrigger]);

  const allNavGroups: NavGroup[] = [
    {
      id: 'dashboards',
      title: 'پیشخوان',
      items: [
        {
          route: 'dashboard',
          title: 'داشبورد مدیریتی',
          icon: LayoutDashboard,
        },
      ],
    },
    {
      id: 'meetings_resolutions',
      title: 'جلسات و مصوبات',
      items: [
        {
          route: 'proposals' as AppRoute,
          title: 'مصوبات پیشنهادی',
          icon: Lightbulb,
        },
        {
          route: 'meetings' as AppRoute,
          title: 'مدیریت جلسات',
          icon: Calendar,
          badge: counts.meetings,
          badgeColor: 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
        },
        {
          route: 'resolutions' as AppRoute,
          title: 'بانک مصوبات',
          icon: FileCheck2,
          badge: counts.resolutions,
          badgeColor: 'bg-teal-700 text-white',
        },
        {
          route: 'calendar' as AppRoute,
          title: 'تقویم هوشمند',
          icon: Clock,
        },
      ],
    },
    {
      id: 'cartable',
      title: 'کارتابل و تکالیف',
      items: [
        ...(currentUser.role !== 'CEO'
          ? [
              {
                route: 'tasks' as AppRoute,
                title: 'وظایف ارجاعی من',
                icon: CheckSquare,
                badge: counts.tasks,
                badgeColor: 'bg-rose-500 text-white',
              },
            ]
          : []),
        ...(hasPermission('VIEW_APPROVALS') || currentUser.role === 'ADMIN' || currentUser.role === 'DEPT_MANAGER' || currentUser.role === 'CEO'
          ? [
              {
                route: 'approvals' as AppRoute,
                title: 'کارتابل صحه‌گذاری',
                icon: ShieldCheck,
                badge: counts.approvals,
                badgeColor: 'bg-teal-50 dark:bg-teal-950 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800',
              },
            ]
          : []),
        ...(hasPermission('NOTIFY_RESOLUTION')
          ? [
              {
                route: 'notification-inbox' as AppRoute,
                title: 'کارتابل ابلاغ',
                icon: Send,
                badge: counts.notifyPending,
                badgeColor: 'bg-fuchsia-50 dark:bg-fuchsia-950 text-fuchsia-800 dark:text-fuchsia-300 border border-fuchsia-200 dark:border-fuchsia-800',
              },
            ]
          : []),
        ...(hasPermission('VIEW_RESOLUTION_FOLLOWUP')
          ? [
              {
                route: 'follow-up' as AppRoute,
                title: 'پیگیری',
                icon: ClipboardList,
                badge: counts.followUpPending,
                badgeColor: 'bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
              },
            ]
          : []),
        {
          route: 'archive' as AppRoute,
          title: 'بایگانی',
          icon: Archive,
        },
      ],
    },
    {
      id: 'reports_system',
      title: 'گزارش و راهنما',
      items: [
        {
          route: 'reports' as AppRoute,
          title: 'گزارش عملکرد',
          icon: FileSpreadsheet,
        },
        {
          route: 'infographics' as AppRoute,
          title: 'اینفوگراف',
          icon: PieChart,
        },
        ...(currentUser.role === 'ADMIN' || hasPermission('MANAGE_USERS')
          ? [
              {
                route: 'settings' as AppRoute,
                title: 'تنظیمات',
                icon: Settings,
              },
            ]
          : []),
        {
          route: 'guide' as AppRoute,
          title: 'راهنمای کاربری سامانه',
          icon: BookOpen,
          badge: GUIDE_SLIDES.length,
          badgeColor: 'bg-teal-100 dark:bg-teal-950 text-teal-800 dark:text-teal-300 text-[9px] border border-teal-200 dark:border-teal-800',
        },
      ],
    },
  ];

  const navGroups = allNavGroups.filter((g) => g.items.length > 0);

  return (
    <aside
      className={`no-print app-surface bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-l border-slate-200 dark:border-slate-800 transition-[width] duration-300 ease-in-out flex flex-col justify-start shrink-0 z-30 h-screen sticky top-0 select-none shadow-xs relative ${
        isSidebarCollapsed ? 'w-16' : 'w-64'
      }`}
    >
      {/* Floating drawer handle — the primary, always-reachable way to
          collapse/expand the sidebar, sitting on its outer edge so it never
          scrolls out of reach and reads as a deliberate "drawer" control. */}
      <button
        onClick={toggleSidebar}
        title={isSidebarCollapsed ? 'باز کردن منو' : 'جمع کردن منو'}
        className="group absolute top-6 -left-3 z-40 w-6 h-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md flex items-center justify-center text-slate-400 hover:text-white hover:bg-teal-700 hover:border-teal-700 dark:hover:bg-teal-600 dark:hover:border-teal-600 transition-all duration-200 cursor-pointer hover:scale-110 active:scale-95"
      >
        {isSidebarCollapsed ? (
          <ChevronLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
        )}
      </button>

      {/* User Info Box - Placed at the very TOP, above "پیشخوان" (Dashboard) */}
      <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 shrink-0 bg-gradient-to-b from-slate-50/80 to-transparent dark:from-slate-800/40">
        {!isSidebarCollapsed ? (
          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 flex items-center gap-2.5 shadow-2xs">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-center text-[10px] font-bold shrink-0 overflow-hidden shadow-xs ring-2 ring-white dark:ring-slate-800">
              {currentUser.avatarUrl ? (
                <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="w-full h-full object-cover" />
              ) : (
                <span>{currentUser.fullName.slice(0, 2)}</span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-extrabold text-slate-800 dark:text-slate-100 truncate">{currentUser.fullName}</p>
              <p className="text-[9px] text-teal-700 dark:text-teal-400 font-semibold truncate">{currentUser.title}</p>
            </div>
          </div>
        ) : (
          <div
            className="w-9 h-9 mx-auto rounded-lg bg-gradient-to-br from-teal-600 to-teal-800 text-white flex items-center justify-center text-[10px] font-bold shadow-xs ring-2 ring-white dark:ring-slate-800 cursor-pointer overflow-hidden"
            title={`${currentUser.fullName} - ${currentUser.title}`}
            onClick={toggleSidebar}
          >
            {currentUser.avatarUrl ? (
              <img src={currentUser.avatarUrl} alt={currentUser.fullName} className="w-full h-full object-cover" />
            ) : (
              <span>{currentUser.fullName.slice(0, 2)}</span>
            )}
          </div>
        )}
      </div>

      {/* Navigation List — scrolls independently within the sidebar itself
          (never clipped, never tied to the page's own scroll) so every item
          stays reachable no matter how tall the menu grows. */}
      <div className="flex-1 py-2 px-2 space-y-2.5 overflow-y-auto overflow-x-hidden">
        {navGroups.map((group) => (
          <div key={group.id} className="space-y-0.5">
            {/* Group Header */}
            {!isSidebarCollapsed ? (
              <div className="px-2 pt-1 pb-1 text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                {group.title}
              </div>
            ) : (
              <div className="h-2 flex items-center justify-center">
                <div className="w-4 h-px bg-slate-200 dark:bg-slate-700" />
              </div>
            )}

            {/* Group Items */}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                const isActive = currentRoute === item.route && !item.action;

                return (
                  <button
                    key={item.title}
                    onClick={() => {
                      if (item.action) {
                        item.action();
                      } else {
                        navigateTo(item.route);
                      }
                    }}
                    title={item.title}
                    className={`group relative w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all duration-150 cursor-pointer ${
                      isActive
                        ? 'app-nav-active text-white font-extrabold shadow-xs'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white font-bold hover:translate-x-[-2px]'
                    } ${isSidebarCollapsed ? 'justify-center px-1 py-2' : ''}`}
                  >
                    {/* Active-item accent bar */}
                    {isActive && !isSidebarCollapsed && (
                      <span className="absolute right-0 top-1/2 -translate-y-1/2 h-4/5 w-1 rounded-full bg-white/70" />
                    )}
                    <div className="flex items-center gap-2 truncate">
                      <ItemIcon
                        className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-400 dark:text-slate-400'
                        }`}
                      />
                      {!isSidebarCollapsed && (
                        <span className="truncate text-[12px] leading-5">{item.title}</span>
                      )}
                    </div>

                    {!isSidebarCollapsed && item.badge !== undefined && (
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full leading-tight ${
                          item.badgeColor || 'bg-teal-700 text-white'
                        }`}
                      >
                        {toPersianDigits(item.badge)}
                      </span>
                    )}

                    {/* Collapsed-state badge dot (no room for a full pill) */}
                    {isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span className="absolute top-1 left-1/2 translate-x-3 w-2 h-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-slate-900" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
