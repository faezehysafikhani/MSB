import {
  Resolution,
  ResolutionApprovalStatus,
  ResolutionExecutionStatus,
  PriorityLevel,
  VerificationConfig,
  ResolutionReferral,
  ActivityLog,
  ApiResponse,
  ApiFilterParams,
  PagedResult,
  User,
  ResolutionNotice,
  AppNotification,
  ResolutionFollowUpPlan,
  DocumentSignature,
} from '../types';
import type { ResolutionProgressReport } from '../types';
import { mockResolutions, mockActivityLogs, mockTasks, mockApprovals, mockMeetings, mockNotifications } from '../mock/data';
import { apiClient } from './api/apiClient';
import { mockUsers } from '../mock/data';
import { isResolutionRelatedToUser } from './userScope';
import { loadLocalCollection, saveLocalCollection } from './localStore';
import { issueNotificationLetterNumber } from './notificationLetterNumbering';
import { resolveSignatureImageUrl } from '../utils/signatureImage';

export interface CreateResolutionDto {
  meetingId: string;
  meetingTitle: string;
  meetingNumber: string;
  agendaItemId?: string;
  agendaItemTitle?: string;
  topicTitle: string;
  proposerName: string;
  proposerDepartment: string;
  requestDescription: string;
  reviewResultNotes?: string;
  approvalStatus: ResolutionApprovalStatus;
  
  // Execution details (if approved)
  executionDescription?: string;
  mainResponsibleUserId?: string;
  mainResponsibleName?: string;
  responsibleDepartmentId?: string;
  responsibleDepartmentName?: string;
  assignedDateJalali?: string;
  deadlineJalali?: string;
  priority?: PriorityLevel;
  referrals?: ResolutionReferral[];
  verificationConfig?: VerificationConfig;
  attachments?: Resolution['attachments'];
  letterNumber?: string;
  // «برنامه پیگیری مصوبه» chosen by the office manager while registering the
  // resolution. Monitoring metadata only — it never influences the signature,
  // ابلاغ, execution or verification workflows below.
  followUp?: ResolutionFollowUpPlan;
}

export interface IResolutionService {
  getResolutions(params?: ApiFilterParams & { approvalStatus?: string; executionStatus?: string; meetingId?: string; relatedUserId?: string; proposerDepartmentName?: string }): Promise<ApiResponse<PagedResult<Resolution>>>;
  getResolutionById(id: string): Promise<ApiResponse<Resolution | null>>;
  createResolution(dto: CreateResolutionDto): Promise<ApiResponse<Resolution>>;
  updateResolution(id: string, dto: Partial<Resolution>): Promise<ApiResponse<Resolution>>;
  deleteResolution(id: string): Promise<ApiResponse<boolean>>;
  getResolutionActivityLogs(resolutionId: string): Promise<ApiResponse<ActivityLog[]>>;
  completeResolutionTask(resolutionId: string, completionNotes: string, attachments?: Resolution['attachments']): Promise<ApiResponse<Resolution>>;
  approveVerificationStep(resolutionId: string, stepNumber: number, comments: string, approverName: string): Promise<ApiResponse<Resolution>>;
  rejectVerificationStep(resolutionId: string, stepNumber: number, rejectionReason: string, approverName: string): Promise<ApiResponse<Resolution>>;
  signResolution(resolutionId: string, signerUserId: string): Promise<ApiResponse<Resolution>>;
  updateExecutionProgress(resolutionId: string, report: ResolutionProgressReport): Promise<ApiResponse<Resolution>>;
  markMeetingMinutesFinalized(meetingId: string): Promise<ApiResponse<number>>;
  appendResolutionTimelineEntry(entry: ActivityLog): void;
  releaseMeetingResolutionsForExecution(meetingId: string): Promise<ApiResponse<number>>;
  // Records the independent ابلاغ (official notification) step for a
  // resolution whose three main signatures are already complete — the one
  // real transition that unlocks execution. Called from both the کارتابل
  // ابلاغ inbox and the resolution's own detail form; never a second,
  // parallel notification path.
  notifyResolution(resolutionId: string, notificationDateJalali: string, actor: User): Promise<ApiResponse<Resolution>>;
}

class MockResolutionService implements IResolutionService {
  private resolutions: Resolution[] = loadLocalCollection('resolutions', mockResolutions);
  private activityLogs: ActivityLog[] = loadLocalCollection('activityLogs', mockActivityLogs);

  private persist() {
    saveLocalCollection('resolutions', this.resolutions);
    saveLocalCollection('activityLogs', this.activityLogs);
  }

  private createSignatureWorkflow() {
    const users = loadLocalCollection('users', mockUsers);
    const officeManager = users.find((user) => user.username === 'office-manager') || users.find((user) => user.role === 'SECRETARY');
    const ceo = users.find((user) => user.username === 'ceo') || users.find((user) => user.role === 'CEO');
    const admin = users.find((user) => user.id === 'user-admin') || users.find((user) => user.role === 'ADMIN');
    if (!officeManager || !ceo || !admin) throw new Error('امضاکنندگان موردنیاز در فهرست کاربران تعریف نشده‌اند');
    return {
      status: 'PENDING_OFFICE_SIGNATURE' as const,
      currentStepIndex: 0,
      steps: [
        { id: `sig-${Date.now()}-1`, signerUserId: officeManager.id, signerName: officeManager.fullName, signerTitle: officeManager.title, signerRole: 'OFFICE_MANAGER' as const, order: 1 as const, status: 'PENDING' as const },
        { id: `sig-${Date.now()}-2`, signerUserId: ceo.id, signerName: ceo.fullName, signerTitle: ceo.title, signerRole: 'CEO' as const, order: 2 as const, status: 'WAITING_TURN' as const },
        { id: `sig-${Date.now()}-3`, signerUserId: admin.id, signerName: admin.fullName, signerTitle: admin.title, signerRole: 'ADMIN' as const, order: 3 as const, status: 'WAITING_TURN' as const },
      ],
    };
  }

  private startExecution(resolution: Resolution) {
    resolution.executionStatus = 'IN_PROGRESS';
    if (!resolution.mainResponsibleUserId) return;
    const tasks = loadLocalCollection('tasks', mockTasks);
    if (tasks.some((task) => task.resolutionId === resolution.id)) return;
    tasks.unshift({
      id: `task-${Date.now()}`,
      resolutionId: resolution.id,
      resolutionNumber: resolution.resolutionNumber,
      resolutionTitle: resolution.topicTitle,
      meetingId: resolution.meetingId,
      meetingTitle: resolution.meetingTitle,
      assignedToUserId: resolution.mainResponsibleUserId,
      assignedToName: resolution.mainResponsibleName || 'مسئول اجرا',
      departmentId: resolution.responsibleDepartmentId || 'dept-1',
      departmentName: resolution.responsibleDepartmentName || 'واحد مسئول',
      referralDateJalali: resolution.assignedDateJalali || '—',
      deadlineJalali: resolution.deadlineJalali || '—',
      priority: resolution.priority,
      status: 'IN_PROGRESS',
      requiresVerification: resolution.verificationConfig.requiresVerification,
      instructions: resolution.executionDescription || resolution.requestDescription,
      attachments: resolution.attachments,
    });
    saveLocalCollection('tasks', tasks);
  }

  public async getResolutions(params?: ApiFilterParams & { approvalStatus?: string; executionStatus?: string; meetingId?: string; requiresVerification?: boolean; relatedUserId?: string; proposerDepartmentName?: string }): Promise<ApiResponse<PagedResult<Resolution>>> {
    let filtered = [...this.resolutions];

    if (params?.relatedUserId) {
      const users = loadLocalCollection('users', mockUsers);
      const relatedUser = users.find((user) => user.id === params.relatedUserId);
      filtered = relatedUser ? filtered.filter((resolution) => isResolutionRelatedToUser(resolution, relatedUser)) : [];
    }

    if (params?.searchTerm) {
      const term = params.searchTerm.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          r.topicTitle.toLowerCase().includes(term) ||
          r.resolutionNumber.toLowerCase().includes(term) ||
          r.meetingNumber.toLowerCase().includes(term) ||
          r.meetingTitle.toLowerCase().includes(term) ||
          (r.letterNumber && r.letterNumber.toLowerCase().includes(term)) ||
          r.proposerName.toLowerCase().includes(term) ||
          (r.mainResponsibleName && r.mainResponsibleName.toLowerCase().includes(term)) ||
          (r.responsibleDepartmentName && r.responsibleDepartmentName.toLowerCase().includes(term))
      );
    }

    if (params?.meetingId) {
      filtered = filtered.filter((r) => r.meetingId === params.meetingId);
    }

    if (params?.approvalStatus && params.approvalStatus !== 'ALL') {
      filtered = filtered.filter((r) => r.approvalStatus === params.approvalStatus);
    }

    if (params?.executionStatus && params.executionStatus !== 'ALL') {
      filtered = filtered.filter((r) => r.executionStatus === params.executionStatus);
    }

    if (params?.departmentId && params.departmentId !== 'ALL') {
      filtered = filtered.filter((r) => r.responsibleDepartmentId === params.departmentId);
    }

    if (params?.proposerDepartmentName && params.proposerDepartmentName !== 'ALL') {
      filtered = filtered.filter((r) => r.proposerDepartment === params.proposerDepartmentName);
    }

    const comparableDate = (value?: string) => {
      const source = value?.includes('T') ? new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date(value)).replace(/[\u200e\u200f]/g, '') : (value || '');
      return source.replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit))).replace(/\D/g, '');
    };
    if (params?.fromDateJalali) {
      const from = comparableDate(params.fromDateJalali);
      filtered = filtered.filter((r) => comparableDate(r.assignedDateJalali || r.createdAt) >= from);
    }
    if (params?.toDateJalali) {
      const to = comparableDate(params.toDateJalali);
      filtered = filtered.filter((r) => comparableDate(r.assignedDateJalali || r.createdAt) <= to);
    }

    if (params?.requiresVerification !== undefined) {
      filtered = filtered.filter((r) => r.verificationConfig.requiresVerification === params.requiresVerification);
    }

    filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const pageIndex = params?.pageIndex || 1;
    const pageSize = params?.pageSize || 10;
    const totalCount = filtered.length;
    const startIndex = (pageIndex - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return apiClient.simulateNetwork<PagedResult<Resolution>>({
      items,
      totalCount,
      pageIndex,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
    }, 150);
  }

  public async getResolutionById(id: string): Promise<ApiResponse<Resolution | null>> {
    const item = this.resolutions.find((r) => r.id === id) || null;
    return apiClient.simulateNetwork(item, 100);
  }

  public async createResolution(dto: CreateResolutionDto): Promise<ApiResponse<Resolution>> {
    const nextNum = this.resolutions.length + 98;
    const isApproved = dto.approvalStatus === 'APPROVED';
    const meetingResolutionNumber = this.resolutions.filter((resolution) => resolution.meetingId === dto.meetingId).length + 1;

    const newResolution: Resolution = {
      id: `res-${Date.now()}`,
      resolutionNumber: `مصوبه-۱۴۰۳-${nextNum}`,
      meetingResolutionNumber: String(meetingResolutionNumber),
      letterNumber: dto.letterNumber,
      meetingId: dto.meetingId,
      meetingTitle: dto.meetingTitle,
      meetingNumber: dto.meetingNumber,
      agendaItemId: dto.agendaItemId,
      agendaItemTitle: dto.agendaItemTitle,
      topicTitle: dto.topicTitle,
      proposerName: dto.proposerName,
      proposerDepartment: dto.proposerDepartment,
      requestDescription: dto.requestDescription,
      reviewResultNotes: dto.reviewResultNotes,
      approvalStatus: dto.approvalStatus,
      
      executionDescription: isApproved ? dto.executionDescription : '',
      mainResponsibleUserId: isApproved ? dto.mainResponsibleUserId : undefined,
      mainResponsibleName: isApproved ? dto.mainResponsibleName : undefined,
      responsibleDepartmentId: isApproved ? dto.responsibleDepartmentId : undefined,
      responsibleDepartmentName: isApproved ? dto.responsibleDepartmentName : undefined,
      assignedDateJalali: isApproved ? (dto.assignedDateJalali || '۱۴۰۳/۰۶/۲۸') : undefined,
      deadlineJalali: isApproved ? dto.deadlineJalali : undefined,
      priority: dto.priority || 'MEDIUM',
      executionStatus: isApproved ? 'PENDING_OFFICE_SIGNATURE' : 'NOT_STARTED',
      referrals: dto.referrals || [],
      verificationConfig: dto.verificationConfig || {
        requiresVerification: false,
        mode: 'SEQUENTIAL',
        currentStepIndex: 0,
        steps: [],
      },
      signatureWorkflow: isApproved ? this.createSignatureWorkflow() : undefined,
      attachments: dto.attachments || [],
      createdAt: new Date().toISOString(),
      followUp: dto.followUp,
    };

    this.resolutions.unshift(newResolution);

    // Add activity logs to the existing resolution timeline.
    const createdAt = Date.now();
    this.activityLogs.unshift({
      id: `log-${createdAt}`,
      targetType: 'RESOLUTION',
      targetId: newResolution.id,
      action: isApproved ? 'مصوبه تصویب شد' : 'ثبت نتیجه بررسی جلسه',
      actorName: 'دبیر شورای راهبری',
      actorRole: 'دبیرخانه جلسات',
      timestampJalali: '۱۴۰۳/۰۶/۲۸',
      timeString: '۱۱:۳۰',
      details: isApproved ? 'نتیجه بررسی جلسه به‌عنوان مصوبه ثبت شد.' : `وضعیت بررسی: ${dto.approvalStatus}`,
      badgeColor: isApproved ? 'teal' : 'amber',
    });
    if (isApproved) {
      this.activityLogs.unshift({
        id: `log-${createdAt}-minutes`,
        targetType: 'RESOLUTION',
        targetId: newResolution.id,
        action: 'صورت‌جلسه مصوبه ایجاد شد',
        actorName: 'دبیر شورای راهبری',
        actorRole: 'دبیرخانه جلسات',
        timestampJalali: '۱۴۰۳/۰۶/۲۸',
        timeString: '۱۱:۳۰',
        details: 'صورت‌جلسه رسمی برای امضای ترتیبی مسئول دفتر، مدیرعامل و ادمین ایجاد گردید.',
        badgeColor: 'blue',
      });
    }

    this.persist();

    return apiClient.simulateNetwork(newResolution, 200);
  }

  public async signResolution(resolutionId: string, signerUserId: string): Promise<ApiResponse<Resolution>> {
    const resolution = this.resolutions.find((item) => item.id === resolutionId);
    if (!resolution?.signatureWorkflow) throw new Error('صورت‌جلسه امضای مصوبه یافت نشد');
    if (resolution.signatureWorkflow.status === 'COMPLETED') throw new Error('تمام امضاهای این مصوبه قبلاً تکمیل شده است');

    const currentIndex = resolution.signatureWorkflow.currentStepIndex;
    const currentStep = resolution.signatureWorkflow.steps[currentIndex];
    if (!currentStep || currentStep.status !== 'PENDING') throw new Error('مرحله فعالی برای امضا وجود ندارد');
    if (currentStep.signerUserId !== signerUserId) throw new Error('نوبت امضای این کاربر نیست');

    const now = new Date();
    currentStep.status = 'SIGNED';
    currentStep.signedAt = now.toISOString();
    currentStep.signedDateJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replace(/[\u200e\u200f]/g, '');
    currentStep.signedTimeString = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    // Snapshot of THIS signer's own signature image (never the acting user's),
    // taken at signing time so replacing a signature later cannot rewrite a
    // document that was already signed.
    const signerRecord = loadLocalCollection('users', mockUsers).find((user) => user.id === currentStep.signerUserId);
    currentStep.signatureImageUrl = resolveSignatureImageUrl(signerRecord?.signatureUrl);

    this.activityLogs.unshift({
      id: `log-${Date.now()}`,
      targetType: 'RESOLUTION',
      targetId: resolution.id,
      action: `${currentStep.signerTitle} صورت‌جلسه مصوبه را امضا کرد`,
      actorName: currentStep.signerName,
      actorRole: currentStep.signerTitle,
      timestampJalali: currentStep.signedDateJalali,
      timeString: currentStep.signedTimeString,
      details: `امضای دیجیتال Mock مرحله ${currentStep.order} با شناسه کاربر ${currentStep.signerUserId} ثبت شد.`,
      badgeColor: 'teal',
    });

    const nextStep = resolution.signatureWorkflow.steps[currentIndex + 1];
    if (nextStep) {
      nextStep.status = 'PENDING';
      resolution.signatureWorkflow.currentStepIndex = currentIndex + 1;
      resolution.signatureWorkflow.status = nextStep.signerRole === 'CEO' ? 'PENDING_CEO_SIGNATURE' : 'PENDING_ADMIN_SIGNATURE';
      resolution.executionStatus = resolution.signatureWorkflow.status;
    } else {
      resolution.signatureWorkflow.status = 'COMPLETED';
      // ابلاغ is now its own independent, explicitly-triggered step (see
      // notifyResolution) rather than something the old collective-minutes
      // signature chain used to gate — a resolution reaches «در انتظار
      // ابلاغ» the instant its three main signatures finish, full stop.
      resolution.executionStatus = 'WAITING_NOTIFICATION';
      this.activityLogs.unshift({
        id: `log-${Date.now()}-execution`,
        targetType: 'RESOLUTION',
        targetId: resolution.id,
        action: 'تکمیل امضاهای اصلی مصوبه و انتظار ابلاغ',
        actorName: currentStep.signerName,
        actorRole: currentStep.signerTitle,
        timestampJalali: currentStep.signedDateJalali,
        timeString: currentStep.signedTimeString,
        details: 'هر سه امضای اصلی مصوبه تکمیل شد؛ مصوبه در کارتابل ابلاغ مسئول دفتر منتظر است.',
        badgeColor: 'blue',
      });
      this.notifyOfficeManagersReadyForNotification(resolution);
    }

    this.persist();
    return apiClient.simulateNetwork(resolution, 160);
  }

  /**
   * Appends one entry to the shared resolution timeline. Exposed so sibling
   * services (e.g. followUpService) record history through this service's own
   * in-memory log array instead of writing the activityLogs collection behind
   * its back, which a later persist() would silently overwrite.
   */
  public appendResolutionTimelineEntry(entry: ActivityLog): void {
    this.activityLogs.unshift(entry);
    this.persist();
  }

  public async updateResolution(id: string, dto: Partial<Resolution>): Promise<ApiResponse<Resolution>> {
    const index = this.resolutions.findIndex((r) => r.id === id);
    if (index === -1) {
      throw new Error('مصوبه یافت نشد');
    }
    this.resolutions[index] = { ...this.resolutions[index], ...dto };
    this.persist();
    return apiClient.simulateNetwork(this.resolutions[index], 150);
  }

  public async updateExecutionProgress(resolutionId: string, report: ResolutionProgressReport): Promise<ApiResponse<Resolution>> {
    const resolution = this.resolutions.find((item) => item.id === resolutionId);
    if (!resolution) throw new Error('مصوبه یافت نشد');
    if (resolution.signatureWorkflow && resolution.signatureWorkflow.status !== 'COMPLETED') throw new Error('ثبت پیشرفت پیش از تکمیل امضاهای مصوبه مجاز نیست');
    if (['APPROVED_CLOSED', 'PENDING_APPROVAL'].includes(resolution.executionStatus)) throw new Error('برای مصوبه خاتمه‌یافته یا در حال صحه‌گذاری نمی‌توان گزارش پیشرفت ثبت کرد');
    resolution.executionStartDateJalali = resolution.executionStartDateJalali || report.reportDateJalali;
    resolution.progressPercent = report.progressPercent;
    resolution.lastAction = report.actionDescription;
    resolution.obstacles = report.obstacles;
    resolution.progressReports = [...(resolution.progressReports || []), report];
    resolution.executionStatus = report.status;
    if (report.attachments.length > 0) resolution.attachments = [...resolution.attachments, ...report.attachments];
    this.activityLogs.unshift({
      id: `log-progress-${Date.now()}`,
      targetType: 'RESOLUTION',
      targetId: resolution.id,
      action: `ثبت گزارش پیشرفت ${report.progressPercent} درصدی`,
      actorName: report.reporterName,
      actorRole: 'مسئول اجرای مصوبه',
      timestampJalali: report.reportDateJalali,
      timeString: report.reportTimeString,
      details: `${report.actionDescription}${report.obstacles ? ` | موانع: ${report.obstacles}` : ''}`,
      badgeColor: report.status === 'OVERDUE' ? 'red' : report.status === 'NEEDS_FOLLOW_UP' ? 'amber' : 'blue',
    });
    this.persist();
    return apiClient.simulateNetwork(resolution, 140);
  }

  public async markMeetingMinutesFinalized(meetingId: string): Promise<ApiResponse<number>> {
    const eligible = this.resolutions.filter((item) => item.meetingId === meetingId && item.signatureWorkflow?.status === 'COMPLETED' && item.executionStatus === 'WAITING_MINUTES_SIGNATURE');
    eligible.forEach((resolution) => {
      resolution.executionStatus = 'WAITING_NOTIFICATION';
      this.activityLogs.unshift({ id: `log-minutes-${resolution.id}-${Date.now()}`, targetType: 'RESOLUTION', targetId: resolution.id, action: 'نهایی‌شدن صورت‌جلسه تجمیعی', actorName: 'دبیرخانه هیأت‌مدیره', actorRole: 'دبیرخانه', timestampJalali: new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date()).replace(/[\u200e\u200f]/g, ''), timeString: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }), details: 'مصوبه آماده تهیه و ارسال ابلاغیه رسمی شد.', badgeColor: 'purple' });
    });
    this.persist();
    return apiClient.simulateNetwork(eligible.length, 100);
  }

  public async releaseMeetingResolutionsForExecution(meetingId: string): Promise<ApiResponse<number>> {
    const eligible = this.resolutions.filter((item) => item.meetingId === meetingId && item.executionStatus === 'WAITING_NOTIFICATION');
    eligible.forEach((resolution) => {
      resolution.executionStatus = 'NOTIFIED';
      this.activityLogs.unshift({ id: `log-notice-${resolution.id}-${Date.now()}`, targetType: 'RESOLUTION', targetId: resolution.id, action: 'ابلاغ رسمی مصوبه', actorName: 'دبیرخانه هیأت‌مدیره', actorRole: 'دبیرخانه', timestampJalali: new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date()).replace(/[\u200e\u200f]/g, ''), timeString: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }), details: `ابلاغیه صادر و مصوبه به ${resolution.mainResponsibleName || 'مسئول اجرا'} ارجاع شد.`, badgeColor: 'teal' });
      this.startExecution(resolution);
    });
    this.persist();
    return apiClient.simulateNetwork(eligible.length, 120);
  }

  // Notifies every user currently holding NOTIFY_RESOLUTION (the office
  // manager persona) that a resolution just reached «در انتظار ابلاغ» —
  // mirrors the same notifications collection AppContext/proposalService
  // already write to, so it shows up in the same bell without a new
  // notification system.
  private notifyOfficeManagersReadyForNotification(resolution: Resolution) {
    const users = loadLocalCollection('users', mockUsers);
    const recipients = users.filter((user) => user.role !== 'ADMIN' && (user.permissions || []).includes('NOTIFY_RESOLUTION'));
    if (recipients.length === 0) return;
    const now = new Date();
    const dateJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replace(/[‎‏]/g, '');
    const timeString = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });
    const notifications = loadLocalCollection('notifications', mockNotifications);
    const newOnes: AppNotification[] = recipients.map((user) => ({
      id: `notif-notify-resolution-${Date.now()}-${user.id}`,
      recipientUserId: user.id,
      title: 'آماده ابلاغ',
      message: `مصوبه شماره «${resolution.resolutionNumber}» (${resolution.topicTitle}) آماده ابلاغ است.`,
      dateJalali,
      timeString,
      isRead: false,
      type: 'APPROVAL_REQUEST',
      targetRoute: 'notification-inbox',
    }));
    saveLocalCollection('notifications', [...newOnes, ...notifications]);
  }

  public async notifyResolution(resolutionId: string, notificationDateJalali: string, actor: User): Promise<ApiResponse<Resolution>> {
    // Permission-gated, not role-hardcoded — any role granted
    // NOTIFY_RESOLUTION later can act here too. ADMIN keeps its usual
    // implicit-superuser access, matching every other permission check
    // across the app.
    const canNotify = actor.role === 'ADMIN' || (actor.permissions || []).includes('NOTIFY_RESOLUTION');
    if (!canNotify) throw new Error('شما مجاز به ثبت ابلاغ این مصوبه نیستید.');
    if (!notificationDateJalali.trim()) throw new Error('ثبت تاریخ ابلاغ الزامی است.');

    const resolution = this.resolutions.find((item) => item.id === resolutionId);
    if (!resolution) throw new Error('مصوبه یافت نشد');
    if (resolution.executionStatus !== 'WAITING_NOTIFICATION') throw new Error('این مصوبه در کارتابل ابلاغ نیست.');

    const now = new Date();
    const dateJalali = new Intl.DateTimeFormat('fa-IR-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now).replace(/[‎‏]/g, '');
    const timeString = now.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' });

    resolution.notifiedDateJalali = notificationDateJalali.trim();
    resolution.notifiedByUserId = actor.id;
    resolution.notifiedByName = actor.fullName;
    resolution.notifiedAt = now.toISOString();
    resolution.executionStatus = 'NOTIFIED';

    // دبیر جلسه of the originating meeting is recorded on the notice as the
    // countersigning secretary of record — a distinct signature context
    // from the resolution's own three main signatures, never a fourth step
    // in that chain (see ResolutionNotice.secretaryUserId/secretaryName).
    const meetings = loadLocalCollection('meetings', mockMeetings);
    const meeting = meetings.find((item) => item.id === resolution.meetingId);
    const notices = loadLocalCollection<ResolutionNotice[]>('resolutionNotices', []);
    // امضای دبیر جلسه روی ابلاغیه — its own signature context, resolved from
    // the meeting's real دبیر جلسه, never from the office manager acting here.
    const secretaryUser = meeting ? loadLocalCollection('users', mockUsers).find((user) => user.id === meeting.secretaryId) : undefined;
    const secretarySignature: DocumentSignature | undefined = meeting?.secretaryId
      ? {
          signerUserId: meeting.secretaryId,
          signerName: meeting.secretaryName,
          signerTitle: secretaryUser?.title || 'دبیر جلسه',
          context: 'RESOLUTION_NOTIFICATION',
          signedAt: now.toISOString(),
          signedDateJalali: notificationDateJalali.trim(),
          signedTimeString: timeString,
          signatureImageUrl: resolveSignatureImageUrl(secretaryUser?.signatureUrl),
        }
      : undefined;
    const recipientName = resolution.mainResponsibleName || resolution.proposerName;
    const recipientDepartment = resolution.responsibleDepartmentName || resolution.proposerDepartment;
    // Reserved only now — every validation above has already passed, so an
    // abandoned or rejected ابلاغ never consumes a letter number.
    const notificationLetterNumber = issueNotificationLetterNumber();
    const notice: ResolutionNotice = {
      id: `notice-${Date.now()}`,
      noticeNumber: `ابلاغ-${now.getFullYear()}-${notices.length + 1}`,
      notificationLetterNumber,
      resolutionId: resolution.id,
      resolutionNumber: resolution.resolutionNumber,
      meetingId: resolution.meetingId,
      dateJalali: notificationDateJalali.trim(),
      recipientName,
      recipientDepartment,
      text: `مصوبه «${resolution.topicTitle}» طی این سند در تاریخ ${notificationDateJalali.trim()} ابلاغ رسمی گردید.`,
      deadlineJalali: resolution.deadlineJalali,
      attachmentIds: resolution.attachments.map((attachment) => attachment.id),
      status: 'SENT',
      sentAt: now.toISOString(),
      createdByUserId: actor.id,
      secretaryUserId: meeting?.secretaryId,
      secretaryName: meeting?.secretaryName,
      secretarySignature: secretarySignature,
    };
    saveLocalCollection('resolutionNotices', [notice, ...notices]);
    // Mirrored onto the resolution so lists and reports can show the letter
    // number without joining the notices collection.
    resolution.notificationLetterNumber = notificationLetterNumber;

    this.activityLogs.unshift({
      id: `log-notify-${resolution.id}-${Date.now()}`,
      targetType: 'RESOLUTION',
      targetId: resolution.id,
      action: 'مصوبه ابلاغ شد',
      actorName: actor.fullName,
      actorRole: actor.title,
      timestampJalali: dateJalali,
      timeString,
      details: `شماره نامه ابلاغیه: ${notificationLetterNumber} | تاریخ ابلاغ: ${notificationDateJalali.trim()}${meeting?.secretaryName ? ` | دبیر جلسه: ${meeting.secretaryName}` : ''}`,
      badgeColor: 'teal',
    });

    this.startExecution(resolution);
    this.persist();
    return apiClient.simulateNetwork(resolution, 140);
  }

  public async deleteResolution(id: string): Promise<ApiResponse<boolean>> {
    const resolution = this.resolutions.find((item) => item.id === id);
    if (!resolution) return apiClient.simulateNetwork(false, 150);
    const previousStatus = resolution.executionStatus;
    resolution.executionStatus = 'ARCHIVED';
    this.activityLogs.unshift({ id: `log-archive-${id}-${Date.now()}`, targetType: 'RESOLUTION', targetId: id, action: 'بایگانی مصوبه بدون حذف اطلاعات', actorName: 'سامانه', actorRole: 'سیستم', timestampJalali: new Intl.DateTimeFormat('fa-IR-u-ca-persian').format(new Date()).replace(/[\u200e\u200f]/g, ''), timeString: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }), details: `وضعیت قبلی: ${previousStatus}`, badgeColor: 'purple' });
    this.persist();
    return apiClient.simulateNetwork(true, 150);
  }

  public async getResolutionActivityLogs(resolutionId: string): Promise<ApiResponse<ActivityLog[]>> {
    const logs = this.activityLogs.filter((l) => l.targetId === resolutionId);
    return apiClient.simulateNetwork(logs, 100);
  }

  /**
   * Complete Task by Assignee
   * If verification is required -> state moves to PENDING_APPROVAL and enters Approver's cartable.
   * If NOT required -> state moves directly to APPROVED_CLOSED!
   */
  public async completeResolutionTask(resolutionId: string, completionNotes: string, attachments?: Resolution['attachments']): Promise<ApiResponse<Resolution>> {
    const resIndex = this.resolutions.findIndex((r) => r.id === resolutionId);
    if (resIndex === -1) throw new Error('مصوبه یافت نشد');

    const res = this.resolutions[resIndex];
    if (res.signatureWorkflow && res.signatureWorkflow.status !== 'COMPLETED') {
      throw new Error('تا پیش از تکمیل هر سه امضا، فرآیند اجرای مصوبه قابل شروع یا تکمیل نیست');
    }
    const requiresVerif = res.verificationConfig?.requiresVerification && res.verificationConfig.steps.length > 0;

    res.completionNotes = completionNotes;
    res.completionDateJalali = '۱۴۰۳/۰۶/۲۸';
    if (attachments && attachments.length > 0) {
      res.attachments = [...res.attachments, ...attachments];
    }

    if (requiresVerif) {
      res.executionStatus = 'PENDING_APPROVAL';
      res.verificationConfig.currentStepIndex = 0;
      
      // Update/add to mockApprovals
      const firstStep = res.verificationConfig.steps[0];
      const approvals = loadLocalCollection('approvals', mockApprovals);
      approvals.unshift({
        id: `appr-${Date.now()}`,
        resolutionId: res.id,
        resolutionNumber: res.resolutionNumber,
        resolutionTitle: res.topicTitle,
        meetingTitle: res.meetingTitle,
        responsibleName: res.mainResponsibleName || 'مسئول اجرا',
        responsibleDepartment: res.responsibleDepartmentName || 'واحد اجرایی',
        completedDateJalali: '۱۴۰۳/۰۶/۲۸',
        submittedForApprovalDateJalali: '۱۴۰۳/۰۶/۲۸',
        stepNumber: 1,
        totalSteps: res.verificationConfig.steps.length,
        stepTitle: `صحه‌گذاری توسط ${firstStep.approverName}`,
        assignedApproverId: firstStep.approverId,
        status: 'PENDING',
        completionReport: completionNotes,
        attachments: res.attachments,
      });
      saveLocalCollection('approvals', approvals);

      this.activityLogs.unshift({
        id: `log-${Date.now()}`,
        targetType: 'RESOLUTION',
        targetId: res.id,
        action: 'اعلام اتمام وظیفه و ارسال جهت صحه‌گذاری',
        actorName: res.mainResponsibleName || 'مسئول اجرا',
        actorRole: 'مجری مصوبه',
        timestampJalali: '۱۴۰۳/۰۶/۲۸',
        timeString: '۱۵:۴۰',
        details: `گزارش تکمیل ثبت و به کارتابل ${firstStep.approverName} جهت صحه‌گذاری ارسال شد.`,
        badgeColor: 'purple',
      });
    } else {
      res.executionStatus = 'APPROVED_CLOSED';
      // The resolution is genuinely finished here (no verification stands
      // between it and closure) — keep progressPercent in sync with that
      // real terminal state instead of leaving it at whatever the last
      // progress report said (or undefined/0 if none was ever submitted).
      res.progressPercent = 100;
      this.activityLogs.unshift({
        id: `log-${Date.now()}`,
        targetType: 'RESOLUTION',
        targetId: res.id,
        action: 'اتمام وظیفه و خاتمه مستقیم مصوبه',
        actorName: res.mainResponsibleName || 'مسئول اجرا',
        actorRole: 'مجری مصوبه',
        timestampJalali: '۱۴۰۳/۰۶/۲۸',
        timeString: '۱۵:۴۰',
        details: 'به دلیل عدم نیاز به صحه‌گذاری، مصوبه مستقیماً به وضعیت خاتمه یافته تغییر یافت.',
        badgeColor: 'teal',
      });
    }

    // Also update corresponding task status
    const tasks = loadLocalCollection('tasks', mockTasks);
    const task = tasks.find((t) => t.resolutionId === resolutionId);
    if (task) {
      task.status = requiresVerif ? 'PENDING_APPROVAL' : 'CLOSED';
      task.completionNotes = completionNotes;
      task.completionDateJalali = '۱۴۰۳/۰۶/۲۸';
      if (!requiresVerif) task.progressPercent = 100;
      saveLocalCollection('tasks', tasks);
    }

    this.persist();

    return apiClient.simulateNetwork(res, 200);
  }

  /**
   * Single approver approves the resolution's one verification step -> resolution closes immediately.
   */
  public async approveVerificationStep(resolutionId: string, stepNumber: number, comments: string, approverName: string): Promise<ApiResponse<Resolution>> {
    const res = this.resolutions.find((r) => r.id === resolutionId);
    if (!res) throw new Error('مصوبه یافت نشد');

    const stepIndex = res.verificationConfig.steps.findIndex((s) => s.stepNumber === stepNumber);
    if (stepIndex !== -1) {
      res.verificationConfig.steps[stepIndex].status = 'APPROVED';
      res.verificationConfig.steps[stepIndex].comments = comments;
      res.verificationConfig.steps[stepIndex].actionDateJalali = '۱۴۰۳/۰۶/۲۸';
      res.verificationConfig.steps[stepIndex].actionTime = '۱۶:۲۰';
    }

    res.executionStatus = 'APPROVED_CLOSED';
    // Final sign-off closes the resolution for real — sync progress to 100%
    // so it can never show "Completed" alongside a stale/zero percentage.
    res.progressPercent = 100;
    this.activityLogs.unshift({
      id: `log-${Date.now()}`,
      targetType: 'RESOLUTION',
      targetId: res.id,
      action: 'تایید نهایی صحه‌گذاری و مختومه شدن مصوبه',
      actorName: approverName,
      actorRole: 'تاییدکننده نهایی',
      timestampJalali: '۱۴۰۳/۰۶/۲۸',
      timeString: '۱۶:۲۰',
      details: `با نظر: "${comments}" تایید شد و مصوبه رسماً خاتمه یافت.`,
      badgeColor: 'teal',
    });

    const approvals = loadLocalCollection('approvals', mockApprovals);
    const currentApproval = approvals.find((item) => item.resolutionId === resolutionId && item.stepNumber === stepNumber);
    if (currentApproval) currentApproval.status = 'APPROVED';
    saveLocalCollection('approvals', approvals);

    // Update task
    const tasks = loadLocalCollection('tasks', mockTasks);
    const task = tasks.find((t) => t.resolutionId === resolutionId);
    if (task) {
      task.status = 'CLOSED';
      task.progressPercent = 100;
      saveLocalCollection('tasks', tasks);
    }

    this.persist();

    return apiClient.simulateNetwork(res, 200);
  }

  /**
   * Approver rejects the verification step -> status returns to responsible user for rework
   */
  public async rejectVerificationStep(resolutionId: string, stepNumber: number, rejectionReason: string, approverName: string): Promise<ApiResponse<Resolution>> {
    const res = this.resolutions.find((r) => r.id === resolutionId);
    if (!res) throw new Error('مصوبه یافت نشد');

    const stepIndex = res.verificationConfig.steps.findIndex((s) => s.stepNumber === stepNumber);
    if (stepIndex !== -1) {
      res.verificationConfig.steps[stepIndex].status = 'REJECTED';
      res.verificationConfig.steps[stepIndex].comments = rejectionReason;
      res.verificationConfig.steps[stepIndex].actionDateJalali = '۱۴۰۳/۰۶/۲۸';
    }

    res.executionStatus = 'REJECTED_RETURNED';

    this.activityLogs.unshift({
      id: `log-${Date.now()}`,
      targetType: 'RESOLUTION',
      targetId: res.id,
      action: 'عدم تایید در صحه‌گذاری و برگشت به مجری',
      actorName: approverName,
      actorRole: 'تاییدکننده',
      timestampJalali: '۱۴۰۳/۰۶/۲۸',
      timeString: '۱۶:۳۰',
      details: `علت بازگشت: ${rejectionReason}`,
      badgeColor: 'red',
    });

    const tasks = loadLocalCollection('tasks', mockTasks);
    const task = tasks.find((t) => t.resolutionId === resolutionId);
    if (task) {
      task.status = 'RETURNED';
      task.rejectionReason = rejectionReason;
      saveLocalCollection('tasks', tasks);
    }

    const approvals = loadLocalCollection('approvals', mockApprovals);
    const currentApproval = approvals.find((item) => item.resolutionId === resolutionId && item.stepNumber === stepNumber);
    if (currentApproval) currentApproval.status = 'REJECTED';
    saveLocalCollection('approvals', approvals);
    this.persist();

    return apiClient.simulateNetwork(res, 200);
  }
}

export const resolutionService: IResolutionService = new MockResolutionService();
