import type { AppRoute } from '../../context/AppContext';
import { loadLocalValue } from '../../services/localStore';

/** داده هر مرحله اینفوگراف؛ شماره، عنوان و توضیح از همین داده خوانده می‌شود. */
export interface InfographicStage {
  id: number;
  title: string;
  description: string;
  icon: 'proposal' | 'review' | 'meeting' | 'resolution' | 'sign' | 'notice' | 'execute' | 'followup' | 'verify';
  route: AppRoute;
}

export const DEFAULT_INFOGRAPHIC_STAGES: InfographicStage[] = [
  { id: 1, icon: 'proposal', route: 'proposals', title: 'پیشنهاد مصوبه', description: 'ثبت پیشنهاد همراه با شرح و مستندات' },
  { id: 2, icon: 'review', route: 'proposals', title: 'بررسی و تصمیم', description: 'بررسی پیشنهاد و تصمیم برای طرح در جلسه' },
  { id: 3, icon: 'meeting', route: 'meetings', title: 'برنامه‌ریزی جلسه', description: 'تعیین زمان، مکان، اعضا و دستور جلسه' },
  { id: 4, icon: 'resolution', route: 'resolutions', title: 'ثبت مصوبه', description: 'ثبت متن نهایی، مسئول اجرا و مهلت' },
  { id: 5, icon: 'sign', route: 'resolutions', title: 'امضا', description: 'ارسال مصوبه در گردش امضای تعریف‌شده' },
  { id: 6, icon: 'notice', route: 'notification-inbox', title: 'ابلاغ', description: 'اطلاع‌رسانی مصوبه به افراد و واحدهای مسئول' },
  { id: 7, icon: 'execute', route: 'tasks', title: 'اقدام مجری', description: 'ثبت اقدامات و مستندات پیشرفت اجرا' },
  { id: 8, icon: 'followup', route: 'follow-up', title: 'پیگیری', description: 'بررسی مهلت‌ها و وضعیت پیشرفت' },
  { id: 9, icon: 'verify', route: 'approvals', title: 'صحه‌گذاری و خاتمه', description: 'بررسی نتیجه و مختومه‌کردن پس از تأیید' },
];

const STORAGE_KEY = 'infographicStages';

/**
 * متن مراحل از تنظیمات محلی (کلید infographicStages) خوانده می‌شود تا بعداً از
 * تنظیمات سامانه قابل تغییر باشد؛ هر فیلدی که ذخیره نشده باشد از پیش‌فرض می‌آید.
 */
export const getInfographicStages = (): InfographicStage[] => {
  const saved = loadLocalValue<Partial<InfographicStage>[]>(STORAGE_KEY, []);
  return DEFAULT_INFOGRAPHIC_STAGES.map((stage) => {
    const override = Array.isArray(saved) ? saved.find((item) => item?.id === stage.id) : undefined;
    return { ...stage, ...(override?.title ? { title: override.title } : {}), ...(override?.description ? { description: override.description } : {}) };
  });
};
