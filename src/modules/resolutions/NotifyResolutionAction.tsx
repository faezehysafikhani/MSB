import React, { useState } from 'react';
import { Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { resolutionService } from '../../services/resolutionService';
import { PersianDatePicker } from '../../components/common/PersianDatePicker';
import { toPersianDigits } from '../../utils/formatters';

interface NotifyResolutionActionProps {
  resolutionId: string;
  resolutionNumber: string;
  onNotified: () => void;
  compact?: boolean;
}

// Single shared ابلاغ action — used identically from the کارتابل ابلاغ
// inbox (NotificationInboxView) and from inside the resolution's own
// detail form (ResolutionDetailModal), both calling the same
// resolutionService.notifyResolution rather than two separate Business
// Logic paths.
export const NotifyResolutionAction: React.FC<NotifyResolutionActionProps> = ({ resolutionId, resolutionNumber, onNotified, compact = false }) => {
  const { currentUser, showToast } = useApp();
  const [dateJalali, setDateJalali] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNotify = async () => {
    if (!dateJalali.trim()) {
      showToast('خطا', 'لطفاً تاریخ ابلاغ را مشخص کنید.', 'error');
      return;
    }
    const confirmed = window.confirm(`آیا از ثبت ابلاغ مصوبه «${resolutionNumber}» در تاریخ ${toPersianDigits(dateJalali)} اطمینان دارید؟`);
    if (!confirmed) return;

    setIsSubmitting(true);
    try {
      await resolutionService.notifyResolution(resolutionId, dateJalali, currentUser);
      showToast('ابلاغ مصوبه', 'ابلاغ با موفقیت ثبت شد.', 'success');
      onNotified();
    } catch (error) {
      showToast('خطا', error instanceof Error ? error.message : 'ثبت ابلاغ انجام نشد.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={compact ? 'flex flex-wrap items-end gap-2' : 'p-3.5 bg-fuchsia-50/60 border border-fuchsia-200/80 rounded-2xl space-y-2.5'}>
      {!compact && (
        <div className="text-xs font-bold text-fuchsia-950">تعیین تاریخ ابلاغ و ثبت</div>
      )}
      <div className={compact ? 'w-40' : ''}>
        <PersianDatePicker value={dateJalali} onChange={setDateJalali} label={compact ? undefined : 'تاریخ ابلاغ'} />
      </div>
      <button
        type="button"
        onClick={handleNotify}
        disabled={isSubmitting}
        className="flex items-center gap-1.5 bg-fuchsia-700 hover:bg-fuchsia-800 text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Send className="w-3.5 h-3.5" />
        <span>{isSubmitting ? 'در حال ثبت...' : 'ابلاغ مصوبه'}</span>
      </button>
    </div>
  );
};
