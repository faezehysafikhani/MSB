import React from 'react';
import { Attachment } from '../../types';
import { formatFileSize, toPersianDigits } from '../../utils/formatters';
import { FileText, Download, Trash2, Paperclip } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AttachmentListProps {
  attachments: Attachment[];
  onDelete?: (id: string) => void;
  canUpload?: boolean;
  onAddFiles?: (newFiles: Attachment[]) => void;
}

export const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  onDelete,
  canUpload = false,
  onAddFiles,
}) => {
  const { showToast } = useApp();

  const handleMockDownload = (fileName: string) => {
    showToast('دانلود فایل', `فایل "${fileName}" با موفقیت دانلود شد.`, 'info');
  };

  const handleMockUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const files: File[] = Array.from(e.target.files);
    const newAttachments: Attachment[] = files.map((file, index) => ({
      id: `att-${Date.now()}-${index}`,
      fileName: file.name,
      fileSizeBytes: file.size || 1024 * 500,
      fileExtension: file.name.split('.').pop() || 'pdf',
      uploadDate: '۱۴۰۳/۰۶/۲۸',
      uploadedBy: 'کاربر جاری',
      downloadUrl: '#',
    }));
    if (onAddFiles) {
      onAddFiles(newAttachments);
    }
    showToast(
      'بارگذاری پیوست',
      files.length === 1 ? `فایل "${files[0].name}" با موفقیت پیوست شد.` : `${files.length} فایل با موفقیت پیوست شدند.`,
      'success'
    );
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      {canUpload && (
        <div className="flex items-center justify-between border-dashed border-2 border-slate-200 hover:border-teal-400 rounded-2xl p-4 transition-colors bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-50 text-teal-700">
              <Paperclip className="w-5 h-5" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-700">افزودن مستندات یا فایل‌های پیوست</div>
              <div className="text-[10px] text-slate-400">فرمت‌های مجاز: PDF, DOCX, XLSX, JPG (حداکثر ۱۰ مگابایت)</div>
            </div>
          </div>
          <label className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold py-1.5 px-3.5 rounded-xl cursor-pointer transition-colors">
            انتخاب فایل
            <input type="file" multiple className="hidden" onChange={handleMockUpload} />
          </label>
        </div>
      )}

      {attachments.length === 0 ? (
        <div className="text-center py-4 text-xs text-slate-400">هیچ فایل پیوستی ثبت نشده است.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center justify-between p-2.5 bg-white border border-slate-200/90 rounded-xl hover:border-teal-300 transition-all shadow-xs"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="p-2 rounded-lg bg-teal-50 text-teal-700 shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate" title={att.fileName}>
                    {att.fileName}
                  </p>
                  <div className="text-[10px] text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>{formatFileSize(att.fileSizeBytes)}</span>
                    <span>•</span>
                    <span>{toPersianDigits(att.uploadDate)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleMockDownload(att.fileName)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-teal-50 hover:text-teal-700 transition-colors"
                  title="دانلود فایل"
                >
                  <Download className="w-3.5 h-3.5" />
                </button>
                {onDelete && (
                  <button
                    onClick={() => onDelete(att.id)}
                    className="p-1.5 rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors"
                    title="حذف فایل"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
