import React, { useState } from 'react';
import { X, Lightbulb, Send } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { proposalService } from '../../services/proposalService';

interface CreateProposalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateProposalModal: React.FC<CreateProposalModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, availableUsers, showToast, triggerRefresh } = useApp();
  // Office manager / CEO / Admin submit proposals on behalf of others, so
  // they pick the presenter; anyone else submitting their own proposal IS
  // the presenter — fixed to themselves, not a free choice.
  const canChoosePresenter = ['ADMIN', 'CEO', 'SECRETARY'].includes(currentUser.role);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [rationale, setRationale] = useState('');
  // «شماره نامه» پیشنهاد — همان Field ای که Excel Import هم پر می‌کند
  // (sourceLetterNumber)، نه یک Field موازی.
  const [letterNumber, setLetterNumber] = useState('');
  const [presenterUserId, setPresenterUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const presenter = canChoosePresenter ? availableUsers.find((user) => user.id === presenterUserId) : currentUser;
    if (!title.trim() || !description.trim() || !presenter) {
      showToast('خطا', 'عنوان، توضیحات و ارائه‌دهنده الزامی است.', 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      await proposalService.createProposal({
        title: title.trim(),
        description: description.trim(),
        rationale: rationale.trim(),
        proposerName: currentUser.fullName,
        proposerUserId: currentUser.id,
        proposerDepartmentId: currentUser.departmentId,
        proposerDepartmentName: currentUser.departmentName,
        presenterUserId: presenter.id,
        presenterName: presenter.fullName,
        sourceLetterNumber: letterNumber.trim() || undefined,
      });
      showToast(
        'ثبت مصوبه پیشنهادی',
        'برای بررسی مستقیماً به کارتابل مدیرعامل ارسال شد.',
        'success'
      );
      setTitle('');
      setDescription('');
      setRationale('');
      setLetterNumber('');
      setPresenterUserId('');
      triggerRefresh();
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden">
        <div className="app-modal-header text-white p-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-800 text-teal-200">
              <Lightbulb className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">ثبت مصوبه پیشنهادی جدید</h3>
              <p className="text-[11px] text-teal-200">
                برای بررسی و تصمیم مستقیماً به کارتابل مدیرعامل ارسال می‌شود
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-teal-200 hover:text-white p-1 rounded-lg hover:bg-teal-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">ارائه‌دهنده *</label>
            {canChoosePresenter ? (
              <select value={presenterUserId} onChange={(e) => setPresenterUserId(e.target.value)} required className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none">
                <option value="">انتخاب ارائه‌دهنده...</option>
                {availableUsers.map((user) => <option key={user.id} value={user.id}>{user.fullName} ({user.title})</option>)}
              </select>
            ) : (
              <div className="w-full text-xs p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-700">
                {currentUser.fullName} ({currentUser.title})
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">عنوان *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              placeholder="مثال: برگزاری دوره آموزشی امنیت سایبری"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">توضیحات *</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              placeholder="این موضوع چرا باید در جلسه مطرح و درباره آن تصمیم‌گیری شود؟"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">شماره نامه</label>
            <input
              type="text"
              value={letterNumber}
              onChange={(e) => setLetterNumber(e.target.value)}
              className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none"
              placeholder="مثال: ۱۴۰۵/۱۲۳۴۵"
            />
            <p className="text-[10px] text-slate-400 mt-1">هنگام تبدیل این پیشنهاد به مصوبه، این شماره به‌صورت خودکار در فرم مصوبه درج می‌شود.</p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">دلایل و ضرورت طرح</label>
            <textarea rows={2} value={rationale} onChange={(e) => setRationale(e.target.value)} className="w-full text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none" placeholder="دلایل اداری، مالی یا راهبردی طرح موضوع در هیأت‌مدیره" />
          </div>
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold cursor-pointer">
              انصراف
            </button>
            <button type="submit" disabled={isSubmitting} className="px-5 py-2.5 rounded-xl bg-teal-800 hover:bg-teal-700 text-white text-xs font-bold shadow-md flex items-center gap-2 cursor-pointer">
              <Send className="w-4 h-4" />
              <span>{isSubmitting ? 'در حال ارسال...' : 'ارسال به کارتابل مدیرعامل'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
