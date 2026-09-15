import React, { useState } from 'react';
import { PenLine, FileDown } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { resolutionService } from '../../services/resolutionService';
import { meetingService } from '../../services/meetingService';
import { boardSecretariatService } from '../../services/boardSecretariatService';
import { buildResolutionNotificationDocument, openGeneratedDocument } from '../../services/documentService';
import { Resolution } from '../../types';

interface SignNotificationLetterActionProps {
  resolution: Resolution;
  onSigned: () => void;
}

/**
 * امضای ابلاغیه توسط دبیر جلسه — مرحله بین «ابلاغ» و «شروع اجرا».
 * از همان Signature Infrastructure موجود استفاده می‌کند: تصویر امضا از
 * امضای مرکزی کاربر (مدیریت‌شده توسط Admin) خوانده می‌شود و رکورد امضا
 * روی خود ابلاغیه ثبت می‌گردد — نه به‌عنوان امضای چهارمِ سه امضای اصلی.
 */
export const SignNotificationLetterAction: React.FC<SignNotificationLetterActionProps> = ({ resolution, onSigned }) => {
  const { currentUser, showToast } = useApp();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePreview = async () => {
    const [meetingRes, noticesRes] = await Promise.all([
      meetingService.getMeetingById(resolution.meetingId, currentUser),
      boardSecretariatService.getNotices(undefined, resolution.id),
    ]);
    try {
      const doc = buildResolutionNotificationDocument(
        resolution,
        noticesRes.data[0],
        meetingRes.data || undefined,
        currentUser
      );
      openGeneratedDocument(doc);
    } catch (error) {
      showToast('خطا', error instanceof Error ? error.message : 'نمایش ابلاغیه انجام نشد.', 'error');
    }
  };

  const handleSign = async () => {
    const confirmed = window.confirm(
      `آیا ابلاغیه مصوبه «${resolution.resolutionNumber}» را امضا می‌کنید؟ پس از امضا، مصوبه وارد فاز اجرا می‌شود.`
    );
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await resolutionService.signNotificationLetter(resolution.id, currentUser);
      showToast('امضای ابلاغیه', 'ابلاغیه امضا شد و مصوبه وارد فاز اجرا گردید.', 'success');
      onSigned();
    } catch (error) {
      showToast('خطا', error instanceof Error ? error.message : 'امضای ابلاغیه انجام نشد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handlePreview}
        className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-[11px] font-bold py-2 px-3 rounded-xl cursor-pointer"
      >
        <FileDown className="w-3.5 h-3.5" />
        <span>مشاهده پیش‌نویس ابلاغیه</span>
      </button>
      <button
        type="button"
        onClick={handleSign}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <PenLine className="w-3.5 h-3.5" />
        <span>{isSubmitting ? 'در حال ثبت امضا...' : 'امضای ابلاغیه'}</span>
      </button>
    </div>
  );
};
