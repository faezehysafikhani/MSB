import { DashboardKPIs, DepartmentPerformance, ApiResponse, ResolutionNotice } from '../types';
import { mockMeetings, mockResolutions, mockTasks, mockApprovals, mockDepartments, mockUsers } from '../mock/data';
import { apiClient } from './api/apiClient';
import { isMeetingRelatedToUser, isResolutionRelatedToUser } from './userScope';
import { loadLocalCollection } from './localStore';
import { compareJalali, toEnglishDigits } from '../utils/jalaliDate';

const JALALI_MONTH_NAMES = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];

export interface MonthlyMeetingTrend {
  month: string;
  meetingsCount: number;
  resolutionsCount: number;
  completedResolutionsCount: number;
}

export interface ResolutionStatusDistribution {
  statusKey: string;
  statusLabel: string;
  count: number;
  percentage: number;
  color: string;
}

export interface IReportService {
  getDashboardKPIs(currentUserId?: string): Promise<ApiResponse<DashboardKPIs>>;
  getDepartmentPerformances(): Promise<ApiResponse<DepartmentPerformance[]>>;
  getResolutionStatusDistribution(): Promise<ApiResponse<ResolutionStatusDistribution[]>>;
  getMonthlyTrends(): Promise<ApiResponse<MonthlyMeetingTrend[]>>;
  getSemiAnnualReport(fromDateJalali: string, toDateJalali: string): Promise<ApiResponse<SemiAnnualReport>>;
  getNotificationLettersReport(filters?: NotificationLettersReportFilters): Promise<ApiResponse<NotificationLetterReportRow[]>>;
}

export interface NotificationLettersReportFilters {
  fromDateJalali?: string;
  toDateJalali?: string;
  proposerDepartment?: string;
  resolutionNumber?: string;
  notificationLetterNumber?: string;
}

/** One row of «گزارش ابلاغ مصوبات». Every field is read from the real
 *  ResolutionNotice / Resolution pair — no duplicated reporting data. */
export interface NotificationLetterReportRow {
  noticeId: string;
  resolutionId: string;
  subject: string;
  notificationLetterNumber: string;
  resolutionNumber: string;
  dateJalali: string;
  proposerDepartment: string;
  description: string;
}

export interface SemiAnnualReport {
  total: number; completed: number; inProgress: number; notStarted: number; overdue: number; fulfillmentPercent: number;
  byDepartment: { name: string; count: number; completed: number }[];
  byMeeting: { id: string; name: string; count: number }[];
  importantOrOverdue: typeof mockResolutions;
}

class MockReportService implements IReportService {
  public async getDashboardKPIs(currentUserId?: string): Promise<ApiResponse<DashboardKPIs>> {
    const users = loadLocalCollection('users', mockUsers);
    const meetings = loadLocalCollection('meetings', mockMeetings);
    const resolutions = loadLocalCollection('resolutions', mockResolutions);
    const tasks = loadLocalCollection('tasks', mockTasks);
    const approvals = loadLocalCollection('approvals', mockApprovals);
    const currentUser = users.find((user) => user.id === currentUserId);
    const scopedMeetings = currentUserId
      ? meetings.filter((meeting) => isMeetingRelatedToUser(meeting, currentUserId))
      : meetings;
    const scopedResolutions = currentUser
      ? resolutions.filter((resolution) => isResolutionRelatedToUser(resolution, currentUser))
      : currentUserId ? [] : resolutions;

    const totalMeetings = scopedMeetings.length;
    const totalResolutions = scopedResolutions.length;
    const inProgressResolutions = scopedResolutions.filter((r) => r.executionStatus === 'IN_PROGRESS').length;
    const completedClosedResolutions = scopedResolutions.filter((r) => r.executionStatus === 'APPROVED_CLOSED').length;
    const pendingApprovalResolutions = scopedResolutions.filter((r) => r.executionStatus === 'PENDING_APPROVAL').length;
    const overdueResolutions = scopedResolutions.filter((r) => r.executionStatus === 'OVERDUE').length;

    const myPendingTasksCount = tasks.filter(
      (t) => (t.assignedToUserId === currentUserId || !currentUserId) && (t.status === 'IN_PROGRESS' || t.status === 'NEW' || t.status === 'OVERDUE')
    ).length;

    const myPendingApprovalsCount = approvals.filter(
      (a) => (a.assignedApproverId === currentUserId || !currentUserId) && a.status === 'PENDING'
    ).length;

    const kpis: DashboardKPIs = {
      totalMeetings,
      totalResolutions,
      inProgressResolutions,
      completedClosedResolutions,
      pendingApprovalResolutions,
      overdueResolutions,
      myPendingTasksCount,
      myPendingApprovalsCount,
    };

    return apiClient.simulateNetwork(kpis, 100);
  }

  public async getDepartmentPerformances(): Promise<ApiResponse<DepartmentPerformance[]>> {
    const resolutions = loadLocalCollection('resolutions', mockResolutions);
    const list: DepartmentPerformance[] = mockDepartments.map((dept) => {
      const deptResolutions = resolutions.filter((r) => r.responsibleDepartmentId === dept.id);
      const totalAssigned = deptResolutions.length;
      const completed = deptResolutions.filter((r) => r.executionStatus === 'APPROVED_CLOSED').length;
      const inProgress = deptResolutions.filter((r) => r.executionStatus === 'IN_PROGRESS').length;
      const pendingApproval = deptResolutions.filter((r) => r.executionStatus === 'PENDING_APPROVAL').length;
      const overdue = deptResolutions.filter((r) => r.executionStatus === 'OVERDUE').length;
      const completionRatePercent = totalAssigned > 0 ? Math.round((completed / totalAssigned) * 100) : 0;

      return {
        departmentName: dept.name,
        totalAssigned,
        completed,
        inProgress,
        pendingApproval,
        overdue,
        completionRatePercent,
      };
    });

    return apiClient.simulateNetwork(list, 150);
  }

  public async getResolutionStatusDistribution(): Promise<ApiResponse<ResolutionStatusDistribution[]>> {
    const resolutions = loadLocalCollection('resolutions', mockResolutions);
    const total = resolutions.length || 1;
    const inProgress = resolutions.filter((r) => r.executionStatus === 'IN_PROGRESS').length;
    const closed = resolutions.filter((r) => r.executionStatus === 'APPROVED_CLOSED').length;
    const pendingVerif = resolutions.filter((r) => r.executionStatus === 'PENDING_APPROVAL').length;
    const overdue = resolutions.filter((r) => r.executionStatus === 'OVERDUE').length;
    const notStarted = resolutions.filter((r) => r.executionStatus === 'NOT_STARTED').length;

    const data: ResolutionStatusDistribution[] = [
      { statusKey: 'IN_PROGRESS', statusLabel: 'در حال انجام', count: inProgress, percentage: Math.round((inProgress / total) * 100), color: '#3b82f6' },
      { statusKey: 'APPROVED_CLOSED', statusLabel: 'خاتمه یافته و تایید شده', count: closed, percentage: Math.round((closed / total) * 100), color: '#10b981' },
      { statusKey: 'PENDING_APPROVAL', statusLabel: 'در انتظار صحه‌گذاری', count: pendingVerif, percentage: Math.round((pendingVerif / total) * 100), color: '#a855f7' },
      { statusKey: 'OVERDUE', statusLabel: 'عقب‌افتاده از موعد', count: overdue, percentage: Math.round((overdue / total) * 100), color: '#ef4444' },
      { statusKey: 'NOT_STARTED', statusLabel: 'برنامه‌ریزی / شروع نشده', count: notStarted, percentage: Math.round((notStarted / total) * 100), color: '#f59e0b' },
    ];

    return apiClient.simulateNetwork(data, 100);
  }

  public async getMonthlyTrends(): Promise<ApiResponse<MonthlyMeetingTrend[]>> {
    // Derived entirely from the real meetings/resolutions data (never a
    // fixed/sample series) so this chart always matches whatever is
    // actually in the system, month by month.
    const meetings = loadLocalCollection('meetings', mockMeetings);
    const resolutions = loadLocalCollection('resolutions', mockResolutions);
    // dateJalali is stored with Persian digits (e.g. "۱۴۰۵/۰۶/۰۸"), so
    // normalize to ASCII before parsing.
    const toEnglishDigits = (value: string) => value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
    const jalaliMonthName = (dateJalali: string): string | null => {
      const monthNumber = parseInt(toEnglishDigits(dateJalali).split('/')[1], 10);
      if (!monthNumber || monthNumber < 1 || monthNumber > 12) return null;
      return JALALI_MONTH_NAMES[monthNumber - 1];
    };

    const byMonth = new Map<string, MonthlyMeetingTrend>();
    const ensureMonth = (month: string): MonthlyMeetingTrend => {
      let entry = byMonth.get(month);
      if (!entry) {
        entry = { month, meetingsCount: 0, resolutionsCount: 0, completedResolutionsCount: 0 };
        byMonth.set(month, entry);
      }
      return entry;
    };

    meetings.forEach((meeting) => {
      const month = jalaliMonthName(meeting.dateJalali);
      if (!month) return;
      ensureMonth(month).meetingsCount += 1;
    });
    resolutions.forEach((resolution) => {
      const meeting = meetings.find((item) => item.id === resolution.meetingId);
      const month = jalaliMonthName(meeting?.dateJalali || resolution.assignedDateJalali || '');
      if (!month) return;
      const entry = ensureMonth(month);
      entry.resolutionsCount += 1;
      if (resolution.executionStatus === 'APPROVED_CLOSED') entry.completedResolutionsCount += 1;
    });

    const trends = JALALI_MONTH_NAMES.filter((month) => byMonth.has(month)).map((month) => byMonth.get(month)!);
    return apiClient.simulateNetwork(trends, 120);
  }

  /**
   * «گزارش ابلاغیه‌ها» — one row per issued ابلاغیه. The subject, resolution
   * number and proposing unit all come from the resolution the notice points
   * at (which in turn inherits the proposing organization from its originating
   * proposal chain), and the date is the real ابلاغ date, never createdAt.
   */
  public async getNotificationLettersReport(filters?: NotificationLettersReportFilters): Promise<ApiResponse<NotificationLetterReportRow[]>> {
    const notices = loadLocalCollection<ResolutionNotice[]>('resolutionNotices', []);
    const resolutions = loadLocalCollection('resolutions', mockResolutions);

    let rows: NotificationLetterReportRow[] = notices
      // Only notices that actually carry an issued letter number belong in
      // this report; legacy bulk-issued notices predate the numbering.
      .filter((notice) => Boolean(notice.notificationLetterNumber))
      .map((notice) => {
        const resolution = resolutions.find((item) => item.id === notice.resolutionId);
        return {
          noticeId: notice.id,
          resolutionId: notice.resolutionId,
          subject: resolution?.topicTitle || notice.text,
          notificationLetterNumber: notice.notificationLetterNumber!,
          resolutionNumber: resolution?.resolutionNumber || notice.resolutionNumber,
          dateJalali: resolution?.notifiedDateJalali || notice.dateJalali,
          proposerDepartment: resolution?.proposerDepartment || notice.recipientDepartment,
          description: resolution?.reviewResultNotes || resolution?.requestDescription || notice.text,
        };
      });

    if (filters?.fromDateJalali) {
      rows = rows.filter((row) => compareJalali(row.dateJalali, filters.fromDateJalali) >= 0);
    }
    if (filters?.toDateJalali) {
      rows = rows.filter((row) => compareJalali(row.dateJalali, filters.toDateJalali) <= 0);
    }
    if (filters?.proposerDepartment && filters.proposerDepartment !== 'ALL') {
      rows = rows.filter((row) => row.proposerDepartment === filters.proposerDepartment);
    }
    if (filters?.resolutionNumber?.trim()) {
      const term = filters.resolutionNumber.trim();
      rows = rows.filter((row) => row.resolutionNumber.includes(term));
    }
    if (filters?.notificationLetterNumber?.trim()) {
      const term = toEnglishDigits(filters.notificationLetterNumber.trim());
      rows = rows.filter((row) => toEnglishDigits(row.notificationLetterNumber).includes(term));
    }

    rows.sort((a, b) => Number(b.notificationLetterNumber) - Number(a.notificationLetterNumber));
    return apiClient.simulateNetwork(rows, 130);
  }

  public async getSemiAnnualReport(fromDateJalali: string, toDateJalali: string): Promise<ApiResponse<SemiAnnualReport>> {
    const normalize = (value: string) => Number(value.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/\//g, ''));
    const from = normalize(fromDateJalali); const to = normalize(toDateJalali);
    const all = loadLocalCollection('resolutions', mockResolutions);
    const items = all.filter((item) => { const value = normalize(item.assignedDateJalali || new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date(item.createdAt)).replace(/[\u200e\u200f]/g, '')); return value >= from && value <= to; });
    const completed = items.filter((item) => item.executionStatus === 'APPROVED_CLOSED').length;
    const inProgressStatuses = ['IN_PROGRESS', 'WAITING_RESPONSE', 'NEEDS_FOLLOW_UP', 'PENDING_APPROVAL'];
    const inProgress = items.filter((item) => inProgressStatuses.includes(item.executionStatus)).length;
    const overdue = items.filter((item) => item.executionStatus === 'OVERDUE').length;
    const notStarted = Math.max(0, items.length - completed - inProgress - overdue);
    const byDepartment = [...new Set(items.map((item) => item.responsibleDepartmentName || 'تعیین نشده'))].map((name) => ({ name, count: items.filter((item) => (item.responsibleDepartmentName || 'تعیین نشده') === name).length, completed: items.filter((item) => (item.responsibleDepartmentName || 'تعیین نشده') === name && item.executionStatus === 'APPROVED_CLOSED').length }));
    const byMeeting = [...new Set(items.map((item) => item.meetingId))].map((id) => ({ id, name: items.find((item) => item.meetingId === id)?.meetingTitle || id, count: items.filter((item) => item.meetingId === id).length }));
    return apiClient.simulateNetwork({ total: items.length, completed, inProgress, notStarted, overdue, fulfillmentPercent: items.length ? Math.round((completed / items.length) * 100) : 0, byDepartment, byMeeting, importantOrOverdue: items.filter((item) => item.executionStatus === 'OVERDUE' || ['URGENT', 'CRITICAL'].includes(item.priority)) }, 140);
  }
}

export const reportService: IReportService = new MockReportService();
