import {
  ApiResponse,
  AppNotification,
  Attachment,
  Resolution,
  ResolutionExecutionStatus,
  ResolutionFollowUpPlan,
  ResolutionFollowUpRecord,
  ResolutionFollowUpType,
  User,
} from '../types';
import { mockNotifications, mockUsers } from '../mock/data';
import { apiClient } from './api/apiClient';
import { resolutionService } from './resolutionService';
import { loadLocalCollection, saveLocalCollection } from './localStore';
import { addJalaliDays, addJalaliMonths, compareJalali, todayJalali } from '../utils/jalaliDate';

/**
 * Single source of truth for "how close to its due date counts as due".
 * Never re-declare this threshold inside a component — read it from here.
 */
export const FOLLOW_UP_NEAR_DUE_DAYS = 3;

/**
 * Execution statuses for which a follow-up is still meaningful. A resolution
 * that is closed, rejected back, or archived drops out of the active cartable
 * on its own — no status of the execution workflow is ever written by this
 * service, it is only read.
 */
const CLOSED_EXECUTION_STATUSES: ResolutionExecutionStatus[] = [
  'APPROVED_CLOSED',
  'REJECTED_RETURNED',
  'ARCHIVED',
];

export interface RecordFollowUpDto {
  resolutionId: string;
  text: string;
  followUpDateJalali: string;
  nextDeadlineJalali?: string;
  notes?: string;
  attachments?: Attachment[];
}

export interface FollowUpCartableRow {
  resolution: Resolution;
  plan: ResolutionFollowUpPlan;
  /** True once the due date has actually arrived (vs. merely approaching). */
  isDue: boolean;
  daysRemaining: number;
}

export interface IFollowUpService {
  getFollowUpCartable(actor: User): Promise<ApiResponse<FollowUpCartableRow[]>>;
  getFollowUpRecords(resolutionId: string): Promise<ApiResponse<ResolutionFollowUpRecord[]>>;
  recordFollowUp(dto: RecordFollowUpDto, actor: User): Promise<ApiResponse<ResolutionFollowUpRecord>>;
}

/**
 * Given a schedule and the date it should count from, returns the next due
 * date. All date maths goes through the Jalali calendar helpers — never
 * through string splicing — so month and year boundaries are exact.
 *
 * CUSTOM has no recurring interval of its own: its only job is "start
 * following this resolution up from date X", so once a follow-up has been
 * recorded the next due date comes from the deadline the user picks in the
 * follow-up form (see recordFollowUp).
 */
export const computeNextFollowUpDate = (
  type: ResolutionFollowUpType,
  fromDateJalali: string
): string | undefined => {
  switch (type) {
    case 'WEEKLY':
      return addJalaliDays(fromDateJalali, 7) || undefined;
    case 'MONTHLY':
      return addJalaliMonths(fromDateJalali, 1) || undefined;
    case 'QUARTERLY':
      return addJalaliMonths(fromDateJalali, 3) || undefined;
    case 'CUSTOM':
    default:
      return undefined;
  }
};

/**
 * The date a plan is next due, or undefined when there is nothing scheduled.
 * A plan that has never been followed up falls back to its start date; one
 * that has been, and carries no next date, is simply not due.
 */
export const nextDueDate = (plan: ResolutionFollowUpPlan): string | undefined =>
  plan.nextFollowUpDateJalali || (plan.lastFollowUpDateJalali ? undefined : plan.startDateJalali);

/**
 * Builds the plan stored on a newly-registered resolution. The first due
 * date is the start date itself — the resolution becomes followable from
 * that day on, which is exactly what the «سفارشی» option is for.
 */
export const buildFollowUpPlan = (
  type: ResolutionFollowUpType,
  startDateJalali: string,
  enabled = true
): ResolutionFollowUpPlan => ({
  enabled,
  type,
  startDateJalali,
  nextFollowUpDateJalali: startDateJalali,
});

class MockFollowUpService implements IFollowUpService {
  private canView(actor: User) {
    return actor.role === 'ADMIN' || (actor.permissions || []).includes('VIEW_RESOLUTION_FOLLOWUP');
  }

  private canManage(actor: User) {
    return actor.role === 'ADMIN' || (actor.permissions || []).includes('MANAGE_RESOLUTION_FOLLOWUP');
  }

  private loadRecords(): ResolutionFollowUpRecord[] {
    return loadLocalCollection<ResolutionFollowUpRecord[]>('resolutionFollowUps', []);
  }

  public async getFollowUpCartable(actor: User): Promise<ApiResponse<FollowUpCartableRow[]>> {
    if (!this.canView(actor)) throw new Error('شما مجاز به مشاهده کارتابل پیگیری نیستید.');

    const today = todayJalali();
    const horizon = addJalaliDays(today, FOLLOW_UP_NEAR_DUE_DAYS) || today;
    // Read through resolutionService so the cartable always sees the same
    // in-memory resolutions every other screen does.
    const response = await resolutionService.getResolutions({ pageSize: 1000 });

    const rows = response.data.items
      .filter((resolution) => {
        const plan = resolution.followUp;
        if (!plan?.enabled) return false;
        // A resolution that is finished, returned, or archived is no longer
        // worth following up — it leaves the active list on its own.
        if (CLOSED_EXECUTION_STATUSES.includes(resolution.executionStatus)) return false;
        const due = nextDueDate(plan);
        // Already followed up with no next date set (a «سفارشی» plan whose
        // follow-up form left the next deadline empty) — it waits out of the
        // list until someone schedules the next one.
        if (!due) return false;
        // Due already, or within the central near-due window.
        return compareJalali(due, horizon) <= 0;
      })
      .map<FollowUpCartableRow>((resolution) => {
        const plan = resolution.followUp!;
        const due = nextDueDate(plan)!;
        return {
          resolution,
          plan,
          isDue: compareJalali(due, today) <= 0,
          daysRemaining: this.daysBetween(today, due),
        };
      })
      .sort((a, b) => compareJalali(nextDueDate(a.plan), nextDueDate(b.plan)));

    return apiClient.simulateNetwork(rows, 130);
  }

  /** Whole days from `from` to `to`, counted on the real calendar. */
  private daysBetween(from: string, to: string): number {
    for (let offset = 0; offset <= FOLLOW_UP_NEAR_DUE_DAYS; offset++) {
      if (compareJalali(addJalaliDays(from, offset) || from, to) === 0) return offset;
    }
    return compareJalali(to, from) < 0 ? 0 : FOLLOW_UP_NEAR_DUE_DAYS;
  }

  public async getFollowUpRecords(resolutionId: string): Promise<ApiResponse<ResolutionFollowUpRecord[]>> {
    const records = this.loadRecords()
      .filter((record) => record.resolutionId === resolutionId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return apiClient.simulateNetwork(records, 90);
  }

  public async recordFollowUp(dto: RecordFollowUpDto, actor: User): Promise<ApiResponse<ResolutionFollowUpRecord>> {
    if (!this.canManage(actor)) throw new Error('شما مجاز به ثبت پیگیری نیستید.');
    if (!dto.text.trim()) throw new Error('ثبت متن پیگیری الزامی است.');
    if (!dto.followUpDateJalali.trim()) throw new Error('ثبت تاریخ پیگیری الزامی است.');

    const resolutionResponse = await resolutionService.getResolutionById(dto.resolutionId);
    const resolution = resolutionResponse.data;
    if (!resolution) throw new Error('مصوبه یافت نشد');
    if (!resolution.followUp?.enabled) throw new Error('برنامه پیگیری برای این مصوبه فعال نیست.');

    const now = new Date();
    const record: ResolutionFollowUpRecord = {
      id: `followup-${now.getTime()}`,
      resolutionId: resolution.id,
      resolutionNumber: resolution.resolutionNumber,
      resolutionTitle: resolution.topicTitle,
      followUpDateJalali: dto.followUpDateJalali.trim(),
      nextDeadlineJalali: dto.nextDeadlineJalali?.trim() || undefined,
      text: dto.text.trim(),
      notes: dto.notes?.trim() || undefined,
      attachments: dto.attachments || [],
      createdByUserId: actor.id,
      createdByName: actor.fullName,
      createdAt: now.toISOString(),
    };
    saveLocalCollection('resolutionFollowUps', [record, ...this.loadRecords()]);

    // An explicitly-chosen deadline always wins over the recurring schedule;
    // otherwise the schedule advances from the date just followed up.
    const updatedPlan: ResolutionFollowUpPlan = {
      ...resolution.followUp,
      lastFollowUpDateJalali: record.followUpDateJalali,
      nextFollowUpDateJalali:
        record.nextDeadlineJalali
        || computeNextFollowUpDate(resolution.followUp.type, record.followUpDateJalali),
    };

    // Reuse the existing resolution timeline rather than inventing a second
    // history mechanism — the entry is informational only.
    resolutionService.appendResolutionTimelineEntry({
      id: `log-followup-${resolution.id}-${now.getTime()}`,
      targetType: 'RESOLUTION',
      targetId: resolution.id,
      action: 'ثبت پیگیری مصوبه',
      actorName: actor.fullName,
      actorRole: actor.title,
      timestampJalali: record.followUpDateJalali,
      timeString: now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      details: `${record.text}${record.nextDeadlineJalali ? ` | موعد بعدی: ${record.nextDeadlineJalali}` : ''}`,
      badgeColor: 'amber',
    });
    // Written through resolutionService so its in-memory copy stays
    // authoritative — the follow-up plan is the only field touched, execution
    // status/tasks/signatures are never written from here.
    const saved = await resolutionService.updateResolution(resolution.id, { followUp: updatedPlan });

    this.notifyFollowUpOwners(saved.data, record.followUpDateJalali);

    return apiClient.simulateNetwork(record, 140);
  }

  /**
   * Tells whoever holds the follow-up permission that the next due date is
   * set — written straight into the shared notifications collection the bell
   * already reads, so no parallel notification system is introduced.
   */
  private notifyFollowUpOwners(resolution: Resolution, dateJalali: string) {
    const nextDue = resolution.followUp?.nextFollowUpDateJalali;
    if (!nextDue) return;
    const users = loadLocalCollection('users', mockUsers);
    const recipients = users.filter(
      (user) => user.role !== 'ADMIN' && (user.permissions || []).includes('VIEW_RESOLUTION_FOLLOWUP')
    );
    if (recipients.length === 0) return;
    const now = new Date();
    const notifications = loadLocalCollection('notifications', mockNotifications);
    const created: AppNotification[] = recipients.map((user) => ({
      id: `notif-followup-${now.getTime()}-${user.id}`,
      recipientUserId: user.id,
      title: 'موعد پیگیری مصوبه',
      message: `موعد بعدی پیگیری مصوبه «${resolution.resolutionNumber}» تاریخ ${nextDue} تعیین شد.`,
      dateJalali,
      timeString: now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      type: 'FOLLOW_UP',
      targetRoute: 'follow-up',
      targetResolutionId: resolution.id,
    }));
    saveLocalCollection('notifications', [...created, ...notifications]);
  }
}

export const followUpService: IFollowUpService = new MockFollowUpService();
