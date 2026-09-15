import { AgendaItem, Meeting, Resolution, User, UserRole } from '../types';

// Roles with organization-wide meeting visibility: ADMIN (system-wide), CEO
// (chairs/approves every meeting's agenda) and SECRETARY (مسئول دفتر — runs
// the meeting/proposal secretariat on the CEO's behalf, so their view must
// cover every meeting, not just ones they're personally listed on). Every
// other role only sees meetings they organize, secretary, or are a member of
// (see the participantUserId filter in meetingService.getMeetings).
export const hasOrgWideMeetingAccess = (role: UserRole): boolean =>
  role === 'ADMIN' || role === 'CEO' || role === 'SECRETARY';

const normalizeName = (value?: string) => (value || '')
  .replace(/\b(جناب|سرکار|خانم|آقای|دکتر|مهندس)\b/g, '')
  .replace(/[()]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

export const isMeetingRelatedToUser = (meeting: Meeting, userId: string): boolean =>
  meeting.organizerId === userId ||
  meeting.secretaryId === userId ||
  meeting.members.some((member) => member.userId === userId);

export const isResolutionRelatedToUser = (resolution: Resolution, user: User): boolean => {
  const userName = normalizeName(user.fullName);

  return resolution.mainResponsibleUserId === user.id ||
    normalizeName(resolution.mainResponsibleName) === userName ||
    normalizeName(resolution.proposerName) === userName ||
    resolution.referrals.some((referral) =>
      (referral.targetType === 'USER' && referral.targetId === user.id) ||
      (referral.targetType === 'DEPARTMENT' && referral.targetId === user.departmentId)
    ) ||
    resolution.verificationConfig.steps.some((step) => step.approverId === user.id) ||
    resolution.signatureWorkflow?.steps.some((step) => step.signerUserId === user.id) ||
    // Department-wide visibility: everyone in the owning department can see the resolution,
    // not just the person it was personally assigned/referred to.
    (Boolean(resolution.responsibleDepartmentId) && resolution.responsibleDepartmentId === user.departmentId);
};

/**
 * دید کامل روی همه بندهای دستور جلسه («تایید جلسه»‌های یک جلسه).
 * نقش‌های مدیریتی موجود (ADMIN / CEO / مسئول دفتر)، برگزارکننده و دبیرِ
 * خودِ همان جلسه، و دارنده مجوز تأیید نهایی تایید جلسه (دبیر جلسه) —
 * همگی Scope فعلی‌شان حفظ می‌شود و محدود نمی‌شوند.
 */
export const canSeeAllAgendaItems = (meeting: Meeting, user: User): boolean =>
  hasOrgWideMeetingAccess(user.role) ||
  meeting.organizerId === user.id ||
  meeting.secretaryId === user.id ||
  (user.permissions || []).includes('APPROVE_MEETING_CONFIRMATION');

/**
 * یک بند دستور جلسه برای کاربر عادی قابل مشاهده است اگر:
 *  - خودش در «افراد مرتبط» همان بند باشد، یا
 *  - ارائه‌دهنده همان بند باشد، یا
 *  - بند اصلاً افراد مرتبط تعریف‌شده نداشته باشد (بند عمومی جلسه).
 * بندی که افراد مرتبط دارد و کاربر جزو آنها نیست، برای او قابل مشاهده
 * نیست — نه در UI و نه در داده‌ای که Service برمی‌گرداند.
 */
export const isAgendaItemRelatedToUser = (agenda: AgendaItem, user: User): boolean => {
  const related = agenda.relatedUsers || [];
  if (related.length === 0) return true;
  return related.some((item) => item.userId === user.id) ||
    agenda.presenter === user.fullName ||
    agenda.presenterName === user.fullName;
};

/**
 * فیلتر بندهای دستور جلسه بر اساس کاربر. اگر actor داده نشود (مسیرهای
 * داخلی/سیستمی) جلسه دست‌نخورده برمی‌گردد.
 */
export const scopeMeetingAgendaToUser = (meeting: Meeting, actor?: User): Meeting => {
  if (!actor || canSeeAllAgendaItems(meeting, actor)) return meeting;
  return {
    ...meeting,
    agendaItems: meeting.agendaItems.filter((agenda) => isAgendaItemRelatedToUser(agenda, actor)),
  };
};
