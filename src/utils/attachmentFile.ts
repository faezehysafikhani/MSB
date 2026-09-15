import { Attachment } from '../types';

/** سقف اندازه فایل قابل پیوست (همان ۱۰ مگابایتی که در UI اعلام می‌شود). */
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

/**
 * سقف نگهداری محتوای فایل به‌صورت Data URL داخل Storage مرورگر.
 * معماری فعلی پیوست‌ها را در localStorage نگه می‌دارد و Quota آن حدود
 * ۵ مگابایت برای کل سامانه است؛ پس محتوای فایل‌های بزرگ‌تر از این سقف
 * ذخیره نمی‌شود و فقط Metadata می‌ماند. با آمدن Backend واقعی، این سقف
 * برداشته و downloadUrl به آدرس سرور تبدیل می‌شود.
 */
export const ATTACHMENT_INLINE_MAX_BYTES = 2 * 1024 * 1024;

/** پیوست‌های Seed/قدیمی فقط Metadata دارند و محتوای واقعی ندارند. */
export const hasDownloadableContent = (attachment: Attachment): boolean =>
  typeof attachment.downloadUrl === 'string' &&
  attachment.downloadUrl.length > 1 &&
  attachment.downloadUrl !== '#';

const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('خواندن فایل انجام نشد.'));
    reader.readAsDataURL(file);
  });

export interface BuiltAttachment {
  attachment: Attachment;
  /** محتوای واقعی ذخیره شد یا فقط Metadata ماند (فایل بزرگ‌تر از سقف). */
  contentStored: boolean;
}

/**
 * ساخت Attachment از روی File واقعی کاربر — محتوای فایل به‌صورت Data URL
 * روی downloadUrl می‌نشیند تا دانلود بعدی، فایل واقعی با همان نام و
 * پسوند را تحویل دهد (نه Blob خالی).
 */
export const buildAttachmentFromFile = async (
  file: File,
  uploadedBy: string,
  uploadDate: string
): Promise<BuiltAttachment> => {
  const attachment: Attachment = {
    id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fileName: file.name,
    fileSizeBytes: file.size,
    fileExtension: file.name.includes('.') ? file.name.split('.').pop()! : '',
    uploadDate,
    uploadedBy,
    downloadUrl: '#',
  };

  if (file.size > ATTACHMENT_INLINE_MAX_BYTES) {
    return { attachment, contentStored: false };
  }

  try {
    attachment.downloadUrl = await readFileAsDataUrl(file);
    return { attachment, contentStored: true };
  } catch {
    return { attachment, contentStored: false };
  }
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [header, payload] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'application/octet-stream';
  if (!header.includes('base64')) {
    return new Blob([decodeURIComponent(payload)], { type: mime });
  }
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

/**
 * دانلود واقعی پیوست. از Data URL یک Blob می‌سازد و با یک <a download>
 * موقت، فایل را با نام و پسوند درست تحویل مرورگر می‌دهد.
 * اگر پیوست محتوا نداشته باشد، false برمی‌گرداند تا صدا‌زننده پیام
 * موفقیت دروغین نشان ندهد.
 */
export const downloadAttachment = (attachment: Attachment): boolean => {
  if (!hasDownloadableContent(attachment)) return false;

  try {
    const blob = attachment.downloadUrl.startsWith('data:')
      ? dataUrlToBlob(attachment.downloadUrl)
      : null;
    const href = blob ? URL.createObjectURL(blob) : attachment.downloadUrl;

    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = attachment.fileName;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);

    if (blob) setTimeout(() => URL.revokeObjectURL(href), 10_000);
    return true;
  } catch {
    return false;
  }
};
