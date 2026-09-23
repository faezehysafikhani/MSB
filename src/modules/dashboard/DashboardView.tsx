import React, { useState, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ShieldCheck, 
  ArrowLeft, 
  BarChart2, 
  PieChart as PieIcon,
  Layers, 
  Users, 
  Plus, 
  ChevronRight,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Tooltip,
  BarChart,
  Bar, 
  XAxis, 
  YAxis 
} from 'recharts';
import { useApp } from '../../context/AppContext';
import { reportService, meetingService, resolutionService, taskService, approvalService } from '../../services';
import { DashboardKPIs, Meeting, Resolution, Task, ApprovalCartableItem, DepartmentPerformance } from '../../types';
import { toPersianDigits, getResolutionExecutionMeta, getPriorityMeta } from '../../utils/formatters';
import { formatJalaliFallback } from '../../utils/date';
import { mockDepartments } from '../../mock/data';
import { hasOperationalData, OnboardingChecklist } from './OnboardingChecklist';
import { RoleActionPanel } from './RoleActionPanel';

const CHART_PALETTE = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7', '#ec4899', '#0ea5e9', '#ef4444'];

// Truncates long category labels on a vertical bar chart's axis so they never
// spill into the plot area and overlap the bars; the full label is still
// available on hover via the native <title> tooltip.
const renderAxisTick = (maxChars: number) => (props: { x?: number; y?: number; payload?: { value?: string | number } }) => {
  const label = String(props.payload?.value ?? '');
  const truncated = label.length > maxChars ? `${label.slice(0, maxChars - 1)}…` : label;
  return (
    // The page is RTL; without a forced ltr direction here, the browser
    // flips what "end" anchors to and the label grows into the bars instead
    // of away from them (verified by measuring rendered tick/bar rects).
    <text x={props.x} y={props.y} dy={4} textAnchor="end" direction="ltr" fontSize={10} fill="#666">
      {truncated}
      {truncated !== label && <title>{label}</title>}
    </text>
  );
};

export const DashboardView: React.FC = () => {
  const { navigateTo, setIsCreateMeetingOpen, currentUser, refreshTrigger, hasPermission } = useApp();

  const [kpis, setKpis] = useState<DashboardKPIs | null>(null);
  const [recentMeetings, setRecentMeetings] = useState<Meeting[]>([]);
  const [recentResolutions, setRecentResolutions] = useState<Resolution[]>([]);
  const [urgentTasks, setUrgentTasks] = useState<Task[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ApprovalCartableItem[]>([]);
  const [departmentPerf, setDepartmentPerf] = useState<DepartmentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const isEmptyWorkspace = !hasOperationalData();
  const showManagementAnalytics = ['ADMIN', 'CEO', 'DEPT_MANAGER', 'AUDITOR'].includes(currentUser.role);

  // Chart view toggles (Pie vs Bar) matching screenshot
  const [chart1Mode, setChart1Mode] = useState<'donut' | 'bar'>('donut');
  const [chart2Mode, setChart2Mode] = useState<'bar' | 'donut'>('bar');
  const [chart3Mode, setChart3Mode] = useState<'pie' | 'bar'>('pie');

  useEffect(() => {
    loadDashboardData();
  }, [currentUser.id, refreshTrigger]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const isAdmin = currentUser.role === 'ADMIN';
      const [kpiRes, meetingsRes, resRes, taskRes, apprRes, deptPerfRes] = await Promise.all([
        reportService.getDashboardKPIs(isAdmin ? undefined : currentUser.id),
        meetingService.getMeetings({ pageSize: 5, participantUserId: isAdmin ? undefined : currentUser.id }),
        resolutionService.getResolutions({ pageSize: 6, relatedUserId: isAdmin ? undefined : currentUser.id }),
        taskService.getMyTasks(currentUser.id, { pageSize: 4, status: 'IN_PROGRESS' }),
        approvalService.getMyApprovals(currentUser.id, { pageSize: 4, status: 'PENDING' }),
        reportService.getDepartmentPerformances(),
      ]);

      if (kpiRes.isSuccess) setKpis(kpiRes.data);
      if (meetingsRes.isSuccess) setRecentMeetings(meetingsRes.data.items);
      if (resRes.isSuccess) setRecentResolutions(resRes.data.items);
      if (taskRes.isSuccess) setUrgentTasks(taskRes.data.items);
      if (apprRes.isSuccess) setPendingApprovals(apprRes.data.items);
      if (deptPerfRes.isSuccess) setDepartmentPerf(deptPerfRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // Status chart data - all values derived live from reportService KPIs
  const statusData = [
    { name: 'در حال انجام', value: kpis?.inProgressResolutions ?? 0, color: '#2563eb' },
    { name: 'برنامه‌ریزی / شروع نشده', value: kpis ? Math.max(0, kpis.totalResolutions - kpis.inProgressResolutions - kpis.pendingApprovalResolutions - kpis.completedClosedResolutions - kpis.overdueResolutions) : 0, color: '#f59e0b' },
    { name: 'در انتظار صحه‌گذاری', value: kpis?.pendingApprovalResolutions ?? 0, color: '#a855f7' },
    { name: 'خاتمه یافته', value: kpis?.completedClosedResolutions ?? 0, color: '#10b981' },
  ];
  const statusTotal = statusData.reduce((sum, s) => sum + s.value, 0);

  // Department ownership data - derived from reportService.getDepartmentPerformances()
  const rankedDeptPerf = [...departmentPerf].filter((d) => d.totalAssigned > 0).sort((a, b) => b.totalAssigned - a.totalAssigned).slice(0, 4);
  const maxDeptAssigned = Math.max(1, ...rankedDeptPerf.map((d) => d.totalAssigned));
  const departmentData = rankedDeptPerf.map((d, index) => ({
    name: d.departmentName,
    count: d.totalAssigned,
    color: CHART_PALETTE[index % CHART_PALETTE.length],
    percent: Math.round((d.totalAssigned / maxDeptAssigned) * 100),
  }));

  // Department-manager distribution - joins the same performance data with mockDepartments for manager names
  const managerData = rankedDeptPerf.map((d, index) => {
    const dept = mockDepartments.find((dep) => dep.name === d.departmentName);
    const shortCode = dept?.code?.split('-')[0] || dept?.name || '';
    return {
      name: `${dept?.managerName || d.departmentName} (${shortCode})`,
      value: d.totalAssigned,
      color: CHART_PALETTE[index % CHART_PALETTE.length],
    };
  });

  if (isEmptyWorkspace) {
    return currentUser.role === 'ADMIN'
      ? <div className="pb-12"><OnboardingChecklist /></div>
      : <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-xs"><Layers className="mx-auto h-10 w-10 text-slate-300" /><h1 className="mt-4 text-sm font-extrabold text-slate-800">هنوز داده‌ای برای نمایش نیست</h1><p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-500">پس از ثبت و ارجاع اولین جلسه یا مصوبه، کارتابل و اقدام‌های مرتبط با نقش شما در اینجا نمایش داده می‌شود.</p></div>;
  }

  return (
    <div className="space-y-6 pb-12">
      {currentUser.role === 'ADMIN' && isEmptyWorkspace && <OnboardingChecklist />}
      {/* Top Header Bar with Filter and PDF Export */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-xs border border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-slate-800 tracking-tight">داشبورد من</h1>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">| پیشخوان پایش مصوبات و جلسات سازمانی</span>
        </div>

        <div className="flex items-center gap-2.5">
          {hasPermission('CREATE_MEETING') && (
            <button
              onClick={() => setIsCreateMeetingOpen(true)}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-4 rounded-full shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>جلسه جدید</span>
            </button>
          )}
        </div>
      </div>

      <RoleActionPanel tasks={urgentTasks.length} approvals={pendingApprovals.length} overdue={kpis?.overdueResolutions ?? 0} upcomingMeetings={recentMeetings.length} />

      {/* Row 1: 4 Compact Metric KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Total Meetings */}
        <div
          onClick={() => navigateTo('meetings')}
          className="bg-white rounded-2xl px-4 py-3 shadow-xs border border-slate-100 flex items-center justify-between gap-2 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-500 font-medium truncate">تعداد کل جلسات</span>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight shrink-0">
            {toPersianDigits(kpis?.totalMeetings ?? 0)}
          </div>
        </div>

        {/* Card 2: Total Resolutions */}
        <div
          onClick={() => navigateTo('resolutions')}
          className="bg-white rounded-2xl px-4 py-3 shadow-xs border border-slate-100 flex items-center justify-between gap-2 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-500 font-medium truncate">تعداد کل مصوبات</span>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight shrink-0">
            {toPersianDigits(kpis?.totalResolutions ?? 0)}
          </div>
        </div>

        {/* Card 3: In Progress Resolutions */}
        <div
          onClick={() => navigateTo('resolutions')}
          className="bg-white rounded-2xl px-4 py-3 shadow-xs border border-slate-100 flex items-center justify-between gap-2 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0">
              <Clock className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-500 font-medium truncate">مصوبات در حال اجرا</span>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight shrink-0">
            {toPersianDigits(kpis?.inProgressResolutions ?? 0)}
          </div>
        </div>

        {/* Card 4: My Active Tasks */}
        <div
          onClick={() => navigateTo('tasks')}
          className="bg-white rounded-2xl px-4 py-3 shadow-xs border border-slate-100 flex items-center justify-between gap-2 cursor-pointer hover:shadow-md hover:border-slate-200 transition-all group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <span className="text-xs text-slate-500 font-medium truncate">اقدامات من</span>
          </div>
          <div className="text-xl font-black text-slate-800 tracking-tight shrink-0">
            {toPersianDigits(kpis?.myPendingTasksCount ?? 0)}
          </div>
        </div>
      </div>

      {/* Row 2: 3 Visual Charts */}
      <div className={`grid grid-cols-1 md:grid-cols-3 gap-5 ${showManagementAnalytics ? '' : 'hidden'}`}>
        
        {/* Chart 1: Status Distribution Donut */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <span className="text-xs font-bold text-slate-800">مصوبات بر اساس وضعیت</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[10px]">
              <button
                onClick={() => setChart1Mode('donut')}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                  chart1Mode === 'donut' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                دایره‌ای
              </button>
              <button
                onClick={() => setChart1Mode('bar')}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                  chart1Mode === 'bar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                میله‌ای
              </button>
            </div>
          </div>

          <div className="h-56 relative flex items-center justify-center">
            {chart1Mode === 'donut' ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(val) => [toPersianDigits(Number(val)), 'تعداد']}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={108} tick={renderAxisTick(12)} />
                  <Tooltip formatter={(val) => [toPersianDigits(Number(val)), 'تعداد']} />
                  <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}

            {/* Center label for donut */}
            {chart1Mode === 'donut' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-black text-slate-800">{toPersianDigits(statusTotal)}</span>
                <span className="text-[10px] text-slate-400 font-medium">مجموع</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-slate-600 font-medium">
            {statusData.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></span>
                <span>{s.name}: {toPersianDigits(s.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chart 2: Department Owner Horizontal Bars */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <span className="text-xs font-bold text-slate-800">مصوبات بر اساس واحد مالک</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[10px]">
              <button
                onClick={() => setChart2Mode('bar')}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                  chart2Mode === 'bar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                میله‌ای
              </button>
              <button
                onClick={() => setChart2Mode('donut')}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                  chart2Mode === 'donut' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                دایره‌ای
              </button>
            </div>
          </div>

          {chart2Mode === 'bar' ? (
            <div className="py-2 space-y-4">
              {departmentData.map((dept) => (
                <div key={dept.name} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{dept.name}</span>
                    <span className="font-bold text-slate-900">{toPersianDigits(dept.count)}</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${dept.percent}%`, backgroundColor: dept.color }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={departmentData} innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="count">
                    {departmentData.map((entry, index) => (
                      <Cell key={`cell-dept-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [toPersianDigits(Number(val)), 'تعداد']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {chart2Mode === 'donut' && departmentData.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-[11px] text-slate-600 font-medium">
              {departmentData.map((dept) => (
                <div key={dept.name} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dept.color }}></span>
                  <span>{dept.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="text-center pt-2 text-[10px] text-slate-400">
            {rankedDeptPerf.length > 0
              ? `بیشترین تمرکز مصوبات روی ${rankedDeptPerf[0].departmentName} است`
              : 'داده‌ای برای نمایش وجود ندارد'}
          </div>
        </div>

        {/* Chart 3: Proposer / Lead Pie */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-2">
            <span className="text-xs font-bold text-slate-800">مصوبات بر اساس مدیر واحد</span>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[10px]">
              <button
                onClick={() => setChart3Mode('pie')}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                  chart3Mode === 'pie' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                دایره‌ای
              </button>
              <button
                onClick={() => setChart3Mode('bar')}
                className={`px-2.5 py-0.5 rounded-full font-bold transition-all ${
                  chart3Mode === 'bar' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                میله‌ای
              </button>
            </div>
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              {chart3Mode === 'pie' ? (
                <PieChart>
                  <Pie
                    data={managerData}
                    outerRadius={75}
                    dataKey="value"
                  >
                    {managerData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val) => [toPersianDigits(Number(val)), 'تعداد']} />
                </PieChart>
              ) : (
                <BarChart data={managerData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" width={132} tick={renderAxisTick(15)} />
                  <Tooltip formatter={(val) => [toPersianDigits(Number(val)), 'تعداد']} />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                    {managerData.map((entry, index) => (
                      <Cell key={`cell-bar-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-[10px] text-slate-600">
            {managerData.map((m) => (
              <div key={m.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: m.color }}></span>
                <span>{m.name}: {toPersianDigits(m.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Actionable Cartable Items (Immediate user attention) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        
        {/* Pending Verification Approvals */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">موارد در انتظار صحه‌گذاری من</h3>
            </div>
            <button 
              onClick={() => navigateTo('approvals')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>مشاهده کارتابل</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">موردی در انتظار تایید شما نیست.</div>
          ) : (
            <div className="space-y-2.5">
              {pendingApprovals.map((appr) => (
                <div
                  key={appr.id}
                  onClick={() => navigateTo('approvals')}
                  className="p-3 bg-slate-50/60 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all cursor-pointer flex items-center justify-between"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-800 line-clamp-1">{appr.resolutionTitle}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      مسئول: {appr.responsibleName} ({appr.responsibleDepartment})
                    </div>
                  </div>
                  <span className="text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full shrink-0">
                    نیازمند صحه‌گذاری
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* My Active Tasks */}
        <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-red-50 text-red-600 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <h3 className="text-xs font-bold text-slate-800">وظایف ارجاع‌شده به من</h3>
            </div>
            <button 
              onClick={() => navigateTo('tasks')}
              className="text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>کارتابل وظایف</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {urgentTasks.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400">هیچ وظیفه فعالی ندارید.</div>
          ) : (
            <div className="space-y-2.5">
              {urgentTasks.map((t) => {
                const pMeta = getPriorityMeta(t.priority);
                return (
                  <div
                    key={t.id}
                    onClick={() => navigateTo('tasks')}
                    className="p-3 bg-slate-50/60 hover:bg-slate-50 rounded-xl border border-slate-100 transition-all cursor-pointer flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate">{t.resolutionTitle}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        مهلت: {toPersianDigits(t.deadlineJalali)} | اولویت: {pMeta.label}
                      </div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${pMeta.bg} ${pMeta.text} border ${pMeta.border}`}>
                      {pMeta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Row 4: Waterfall Table matching Capture.PNG */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-bold text-slate-800">مصوبات و پروژه‌های جاری سازمان</h3>
          </div>
          <button 
            onClick={() => navigateTo('resolutions')}
            className="text-xs text-blue-600 hover:text-blue-800 font-bold cursor-pointer"
          >
            مشاهده همه مصوبات
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 text-[11px]">
                <th className="py-2.5 px-3 font-semibold">ردیف</th>
                <th className="py-2.5 px-3 font-semibold">نام پروژه / عنوان مصوبه</th>
                <th className="py-2.5 px-3 font-semibold">واحد مسئول</th>
                <th className="py-2.5 px-3 font-semibold">تاریخ شروع</th>
                <th className="py-2.5 px-3 font-semibold">تاریخ پایان</th>
                <th className="py-2.5 px-3 font-semibold">وضعیت</th>
                <th className="py-2.5 px-3 font-semibold text-center">پیشرفت برنامه‌ای</th>
                <th className="py-2.5 px-3 font-semibold text-center">پیشرفت واقعی</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentResolutions.map((res, index) => {
                const sMeta = getResolutionExecutionMeta(res.executionStatus);
                const planned = 100;
                const actual = res.executionStatus === 'APPROVED_CLOSED' ? 100 : res.executionStatus === 'PENDING_APPROVAL' ? 90 : 45;

                return (
                  <tr 
                    key={res.id} 
                    onClick={() => navigateTo('resolutions', { resolutionId: res.id })}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-3 font-bold text-slate-600">{toPersianDigits(index + 1)}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{res.topicTitle}</div>
                      <div className="text-[10px] text-slate-400">{res.resolutionNumber} - {res.meetingTitle}</div>
                    </td>
                    <td className="py-3 px-3 text-slate-600 font-medium">
                      {res.responsibleDepartmentName || 'اداره کل فناوری اطلاعات'}
                    </td>
                    <td className="py-3 px-3 text-slate-500">{formatJalaliFallback(res.assignedDateJalali)}</td>
                    <td className="py-3 px-3 text-slate-500">{formatJalaliFallback(res.deadlineJalali)}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap ${sMeta.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sMeta.dot}`}></span>
                        <span>{sMeta.label}</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${planned}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700">{toPersianDigits(planned)}٪</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 w-32">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-600 rounded-full" style={{ width: `${actual}%` }}></div>
                        </div>
                        <span className="text-[10px] font-bold text-blue-700">{toPersianDigits(actual)}٪</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
