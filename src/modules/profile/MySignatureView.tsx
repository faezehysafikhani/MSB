import React, { useRef, useState } from 'react';
import { PenTool, Upload, Trash2, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  SAMPLE_SIGNATURE_DATA_URL,
  SIGNATURE_IMAGE_ACCEPT,
  isSampleSignature,
  resolveSignatureImageUrl,
  validateSignatureImageFile,
} from '../../utils/signatureImage';

/**
 * «امضای من» — every user manages their OWN signature image here and only
 * their own: the save below always writes to currentUser.id. Managing someone
 * else's signature stays where it already lived, behind MANAGE_USERS in the
 * user-management form.
 */
export const MySignatureView: React.FC = () => {
  const { currentUser, updateUser, showToast } = useApp();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const storedSignature = currentUser.signatureUrl;
  const shownSignature = preview || resolveSignatureImageUrl(storedSignature);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validation = validateSignatureImageFile(file);
    if (!validation.isValid) {
      showToast('فایل نامعتبر', validation.message || 'فایل انتخاب‌شده مجاز نیست.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPreview(String(reader.result));
    reader.readAsDataURL(file);
  };

  const persist = async (signatureUrl: string | undefined, successMessage: string) => {
    setIsSaving(true);
    try {
      const { id, ...rest } = currentUser;
      await updateUser(id, { ...rest, signatureUrl });
      setPreview(null);
      showToast('امضای من', successMessage, 'success');
    } catch (error) {
      showToast('خطا', error instanceof Error ? error.message : 'ذخیره امضا انجام نشد.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700">
          <PenTool className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-800">امضای من</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">
            تصویر امضای خود را بارگذاری کنید تا روی دعوت‌نامه‌ها، ابلاغیه‌ها و اسناد مصوبات شما درج شود.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-5 shadow-xs border border-slate-100 space-y-5">
        <div className="flex flex-wrap items-start gap-5">
          <div className="space-y-2">
            <div className="text-xs font-bold text-slate-700">پیش‌نمایش امضا</div>
            <div className="w-64 h-32 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/70 flex items-center justify-center overflow-hidden">
              <img src={shownSignature} alt="امضای کاربر" className="max-w-full max-h-full object-contain" />
            </div>
            {preview ? (
              <div className="text-[10px] font-bold text-amber-700">پیش‌نمایش تصویر جدید — هنوز ذخیره نشده است.</div>
            ) : isSampleSignature(storedSignature) ? (
              <div className="text-[10px] text-amber-700">
                هنوز امضایی بارگذاری نکرده‌اید؛ فعلاً «نمونه امضا» روی اسناد شما درج می‌شود.
              </div>
            ) : (
              <div className="text-[10px] text-emerald-700 font-bold">امضای اختصاصی شما ثبت شده است.</div>
            )}
          </div>

          <div className="flex-1 min-w-[220px] space-y-3">
            <div className="text-[11px] text-slate-600 leading-6">
              فرمت‌های مجاز: PNG، JPG، JPEG و WEBP (حداکثر ۲ مگابایت). ترجیحاً تصویری با پس‌زمینه شفاف یا سفید انتخاب کنید.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>{storedSignature ? 'انتخاب امضای جدید' : 'انتخاب تصویر امضا'}</span>
              </button>
              <input ref={fileInputRef} type="file" accept={SIGNATURE_IMAGE_ACCEPT} className="hidden" onChange={handleFile} />

              {preview && (
                <>
                  <button
                    type="button"
                    onClick={() => persist(preview, 'امضای شما ذخیره شد و از این پس روی اسناد جدید درج می‌شود.')}
                    disabled={isSaving}
                    className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2 px-4 rounded-xl cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? 'در حال ذخیره...' : 'ذخیره امضا'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold py-2 px-4 rounded-xl cursor-pointer"
                  >
                    انصراف
                  </button>
                </>
              )}

              {!preview && storedSignature && (
                <button
                  type="button"
                  onClick={() => persist(undefined, 'امضای شما حذف شد؛ تا بارگذاری مجدد، نمونه امضا استفاده می‌شود.')}
                  disabled={isSaving}
                  className="flex items-center gap-1.5 border border-rose-200 text-rose-600 hover:bg-rose-50 text-xs font-bold py-2 px-4 rounded-xl cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>حذف امضا</span>
                </button>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex gap-2">
              <ShieldCheck className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
              <span>
                اسنادی که پیش از این امضا شده‌اند، تصویر امضای همان لحظه را نگه می‌دارند و با تغییر امضای شما بازنویسی نمی‌شوند.
              </span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs font-bold text-slate-700 mb-2">نمونه امضای پیش‌فرض سامانه</div>
          <div className="w-40 h-20 rounded-xl border border-slate-200 bg-white flex items-center justify-center overflow-hidden">
            <img src={SAMPLE_SIGNATURE_DATA_URL} alt="نمونه امضا" className="max-w-full max-h-full object-contain" />
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5">
            این تصویر تنها تا زمان بارگذاری امضای واقعی کاربر استفاده می‌شود.
          </div>
        </div>
      </div>
    </div>
  );
};
