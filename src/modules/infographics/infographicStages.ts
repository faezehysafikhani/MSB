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
  { id: 1, icon: 'proposal', route: 'proposals', title: 'پیشنهاد مصوبه', description: 'کاربر پیشنهاد خود را همراه با شرح و مستندات ثبت می‌کند.' },
  { id: 2, icon: 'review', route: 'proposals', title: 'بررسی و تصمیم', description: 'مسئولان پیشنهاد را بررسی می‌کنند و درباره طرح آن در جلسه تصمیم می‌گیرند.' },
  { id: 3, icon: 'meeting', route: 'meetings', title: 'برنامه‌ریزی جلسه', description: 'دبیر، زمان، مکان، اعضا و دستور جلسه را مشخص می‌کند.' },
  { id: 4, icon: 'resolution', route: 'resolutions', title: 'ثبت مصوبه', description: 'متن نهایی مصوبه و مسئول اجرای آن در سامانه ثبت می‌شود.' },
  { id: 5, icon: 'sign', route: 'resolutions', title: 'امضا', description: 'مصوبه طبق گردش تعریف‌شده برای امضاکنندگان ارسال می‌شود.' },
  { id: 6, icon: 'notice', route: 'notification-inbox', title: 'ابلاغ', description: 'مصوبه امضاشده به افراد و واحدهای مسئول ابلاغ می‌شود.' },
  { id: 7, icon: 'execute', route: 'tasks', title: 'اقدام مجری', description: 'مجری اقدامات انجام‌شده و مستندات پیشرفت را ثبت می‌کند.' },
  { id: 8, icon: 'followup', route: 'follow-up', title: 'پیگیری', description: 'مسئول پیگیری، مهلت‌ها و میزان پیشرفت اجرا را بررسی می‌کند.' },
  { id: 9, icon: 'verify', route: 'approvals', title: 'صحه‌گذاری و خاتمه', description: 'نتیجه اجرا بررسی و پس از تأیید، پرونده مختومه می‌شود.' },
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
