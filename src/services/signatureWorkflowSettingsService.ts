import { Meeting, ResolutionSignerRole, User, UserRole } from '../types';
import { mockUsers } from '../mock/data';
import { loadLocalCollection, loadLocalValue, saveLocalValue } from './localStore';

/**
 * «تنظیمات گردش امضا» — تعیین اینکه امضاکننده هر Signature Stage چه کسی است.
 *
 * این ماژول هیچ مرحله‌ای به Workflow اضافه یا از آن کم نمی‌کند و ترتیب
 * Sequential امضاها را تغییر نمی‌دهد. تنها کاری که می‌کند این است که
 * «امضاکننده هر مرحله» را از حالت Hardcoded خارج می‌کند.
 *
 * مقادیر پیش‌فرض دقیقاً همان رفتار قبلی سامانه هستند، پس تا وقتی Admin
 * چیزی را تغییر ندهد، رفتار سامانه بدون تفاوت باقی می‌ماند.
 */

/** شناسه هر مرحله امضا — همان مراحلی که از قبل در سامانه وجود دارند. */
export type SignatureStageId =
  | 'RESOLUTION_STEP_1'
  | 'RESOLUTION_STEP_2'
  | 'RESOLUTION_STEP_3'
  | 'RESOLUTION_NOTICE';

export type SignerAssignmentMode =
  /** امضاکننده از روی نقش سازمانی پیدا می‌شود. */
  | 'ROLE'
  /** امضاکننده یک کاربر مشخص است. */
  | 'USER'
  /** رفتار تاریخی مرحله ابلاغ: دبیر جلسهِ همان جلسه. */
  | 'MEETING_SECRETARY';

export interface SignerAssignment {
  mode: SignerAssignmentMode;
  /** برای mode === 'ROLE' */
  role?: UserRole;
  /** برای mode === 'USER' */
  userId?: string;
}

export interface SignatureWorkflowSettings {
  stages: Record<SignatureStageId, SignerAssignment>;
}

/** توضیح هر مرحله برای UI — تنها محل تعریف این عنوان‌ها. */
export const SIGNATURE_STAGES: {
  id: SignatureStageId;
  workflow: string;
  title: string;
  order?: number;
  sequential: boolean;
  description: string;
  /** نقش ثابتی که این مرحله در Data Model مصوبه دارد (تغییر نمی‌کند). */
  resolutionSignerRole?: ResolutionSignerRole;
}[] = [
  {
    id: 'RESOLUTION_STEP_1',
    workflow: 'امضای نهایی مصوبه',
    title: 'مرحله ۱ — امضای اول',
    order: 1,
    sequential: true,
    description: 'اولین امضا از سه امضای اصلی مصوبه. تا امضای این مرحله، مرحله بعد فعال نمی‌شود.',
    resolutionSignerRole: 'OFFICE_MANAGER',
  },
  {
    id: 'RESOLUTION_STEP_2',
    workflow: 'امضای نهایی مصوبه',
    title: 'مرحله ۲ — امضای دوم',
    order: 2,
    sequential: true,
    description: 'دومین امضا؛ تنها پس از تکمیل مرحله اول فعال می‌شود.',
    resolutionSignerRole: 'CEO',
  },
  {
    id: 'RESOLUTION_STEP_3',
    workflow: 'امضای نهایی مصوبه',
    title: 'مرحله ۳ — امضای سوم',
    order: 3,
    sequential: true,
    description: 'سومین و آخرین امضا؛ پس از آن مصوبه وارد کارتابل ابلاغ می‌شود.',
    resolutionSignerRole: 'ADMIN',
  },
  {
    id: 'RESOLUTION_NOTICE',
    workflow: 'امضای ابلاغیه',
    title: 'امضای ابلاغیه مصوبه',
    sequential: false,
    description: 'امضای سند ابلاغ پس از ثبت ابلاغ توسط مسئول دفتر. تا پیش از این امضا، مصوبه وارد فاز اجرا نمی‌شود.',
  },
];

/**
 * پیش‌فرض‌ها = رفتار فعلی سامانه، بدون هیچ تفاوتی:
 * مرحله ۱ مسئول دفتر، مرحله ۲ مدیرعامل، مرحله ۳ مدیر سیستم و امضای
 * ابلاغیه دبیر جلسهِ همان جلسه.
 */
export const DEFAULT_SIGNATURE_WORKFLOW_SETTINGS: SignatureWorkflowSettings = {
  stages: {
    RESOLUTION_STEP_1: { mode: 'ROLE', role: 'SECRETARY' },
    RESOLUTION_STEP_2: { mode: 'ROLE', role: 'CEO' },
    RESOLUTION_STEP_3: { mode: 'ROLE', role: 'ADMIN' },
    RESOLUTION_NOTICE: { mode: 'MEETING_SECRETARY' },
  },
};

const SETTINGS_KEY = 'signatureWorkflowSettings';

export const getSignatureWorkflowSettings = (): SignatureWorkflowSettings => {
  const saved = loadLocalValue<Partial<SignatureWorkflowSettings>>(SETTINGS_KEY, {});
  return {
    stages: { ...DEFAULT_SIGNATURE_WORKFLOW_SETTINGS.stages, ...(saved.stages || {}) },
  };
};

export const getStageAssignment = (stageId: SignatureStageId): SignerAssignment =>
  getSignatureWorkflowSettings().stages[stageId] || DEFAULT_SIGNATURE_WORKFLOW_SETTINGS.stages[stageId];

/**
 * فقط Admin یا دارنده مجوز مدیریت کاربران (همان گیتی که سایر تب‌های
 * مدیریتی تنظیمات از قبل دارند) می‌تواند تنظیمات گردش امضا را تغییر دهد.
 * هیچ Permission موجودی تغییر نکرده و Permission جدیدی هم اضافه نشده.
 */
export const canManageSignatureWorkflow = (actor?: User): boolean =>
  Boolean(actor && (actor.role === 'ADMIN' || (actor.permissions || []).includes('MANAGE_USERS')));

export const updateStageAssignment = (
  stageId: SignatureStageId,
  assignment: SignerAssignment,
  actor: User
): SignatureWorkflowSettings => {
  if (!canManageSignatureWorkflow(actor)) {
    throw new Error('شما مجاز به تغییر تنظیمات گردش امضا نیستید.');
  }
  if (assignment.mode === 'ROLE' && !assignment.role) throw new Error('نقش امضاکننده انتخاب نشده است.');
  if (assignment.mode === 'USER' && !assignment.userId) throw new Error('کاربر امضاکننده انتخاب نشده است.');

  const settings = getSignatureWorkflowSettings();
  const next: SignatureWorkflowSettings = {
    stages: { ...settings.stages, [stageId]: assignment },
  };
  saveLocalValue(SETTINGS_KEY, next);
  return next;
};

export interface ResolvedSigner {
  userId: string;
  name: string;
  title: string;
}

/**
 * Resolve امضاکننده یک مرحله در لحظه ساخته شدن Signature Request.
 * نتیجه روی همان Request (استپ مصوبه یا رکورد ابلاغیه) Snapshot می‌شود،
 * پس تغییر بعدی تنظیمات، پرونده‌های در حال گردش را جابه‌جا نمی‌کند.
 */
export const resolveStageSigner = (
  stageId: SignatureStageId,
  context?: { meeting?: Meeting }
): ResolvedSigner | undefined => {
  const users = loadLocalCollection('users', mockUsers);
  const assignment = getStageAssignment(stageId);
  const toResolved = (user?: User): ResolvedSigner | undefined =>
    user ? { userId: user.id, name: user.fullName, title: user.title } : undefined;

  if (assignment.mode === 'USER') {
    return toResolved(users.find((user) => user.id === assignment.userId));
  }

  if (assignment.mode === 'MEETING_SECRETARY') {
    const secretaryId = context?.meeting?.secretaryId;
    const record = users.find((user) => user.id === secretaryId);
    if (record) return toResolved(record);
    // رفتار تاریخی: اگر رکورد کاربر پیدا نشد اما جلسه نام دبیر را دارد.
    return secretaryId
      ? { userId: secretaryId, name: context?.meeting?.secretaryName || 'دبیر جلسه', title: 'دبیر جلسه' }
      : undefined;
  }

  // mode === 'ROLE' — همان ترتیب جست‌وجوی قبلی حفظ شده است: ابتدا کاربران
  // شناخته‌شده سامانه (username/id ثابت) و سپس اولین کاربر فعال با آن نقش.
  const role = assignment.role;
  const preferredByRole: Partial<Record<UserRole, (user: User) => boolean>> = {
    SECRETARY: (user) => user.username === 'office-manager',
    CEO: (user) => user.username === 'ceo',
    ADMIN: (user) => user.id === 'user-admin',
  };
  const preferred = role && preferredByRole[role] ? users.find(preferredByRole[role]!) : undefined;
  return toResolved(preferred || users.find((user) => user.role === role && user.isActive !== false) || users.find((user) => user.role === role));
};

/** برچسب فارسی نقش‌ها برای UI تنظیمات. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'مدیر سیستم',
  CEO: 'مدیرعامل',
  SECRETARY: 'مسئول دفتر / دبیر جلسه',
  DEPT_MANAGER: 'مدیر واحد سازمانی',
  EXPERT_ASSIGNEE: 'کارشناس مسئول اجرا',
  AUDITOR: 'بازرس و ناظر سازمانی',
};

export const describeAssignment = (assignment: SignerAssignment, users: User[]): string => {
  if (assignment.mode === 'MEETING_SECRETARY') return 'دبیر جلسهِ همان جلسه';
  if (assignment.mode === 'USER') {
    const user = users.find((item) => item.id === assignment.userId);
    return user ? `${user.fullName} (${user.title})` : 'کاربر انتخاب‌شده یافت نشد';
  }
  return assignment.role ? USER_ROLE_LABELS[assignment.role] : '—';
};
