import { PermissionKey } from '../types';

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  VIEW_DASHBOARD: 'مشاهده داشبورد',
  VIEW_MEETINGS: 'مشاهده جلسات',
  CREATE_MEETING: 'ایجاد جلسه',
  EDIT_MEETING: 'ویرایش جلسه',
  DELETE_MEETING: 'حذف جلسه',
  CREATE_RESOLUTION: 'ثبت مصوبه',
  VIEW_RESOLUTIONS: 'مشاهده مصوبات',
  EDIT_RESOLUTION: 'ویرایش مصوبه',
  VIEW_TASKS: 'مشاهده وظایف',
  VIEW_APPROVALS: 'مشاهده کارتابل صحه‌گذاری',
  APPROVE_RESOLUTION: 'تایید صحه‌گذاری',
  REJECT_RESOLUTION: 'رد صحه‌گذاری',
  VIEW_REPORTS: 'مشاهده گزارشات',
  MANAGE_USERS: 'مدیریت کاربران',
  CREATE_USER: 'ایجاد کاربر',
  IMPORT_PROPOSALS_FROM_EXCEL: 'ورود پیشنهاد مصوبات از Excel',
  VIEW_ORGANIZATION_ARCHIVE: 'مشاهده بایگانی سازمانی',
  MANAGE_ARCHIVE_FOLDERS: 'ایجاد و مدیریت پوشه‌های بایگانی سازمانی',
  SIGN_RESOLUTION: 'امضای دیجیتال مصوبات',
  APPEND_MEETING_CONTENT: 'افزودن مدعو/دستور کار جدید به جلسه موجود',
};

export const getPermissionLabel = (key: string): string => PERMISSION_LABELS[key as PermissionKey] || key;
