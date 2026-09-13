import React, { useEffect, useState } from 'react';
import { Send, Inbox } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { resolutionService } from '../../services/resolutionService';
import { Resolution } from '../../types';
import { toPersianDigits } from '../../utils/formatters';
import { NotifyResolutionAction } from './NotifyResolutionAction';

// کارتابل ابلاغ: only resolutions whose three main signatures are already
// complete and are sitting in WAITING_NOTIFICATION — i.e. the same real
// status the rest of the app already uses for «در انتظار ابلاغ». Reuses
// the app's existing simple table/list pattern rather than a new Inbox
// component.
export const NotificationInboxView: React.FC = () => {
  const { triggerRefresh, refreshTrigger } = useApp();
  const [items, setItems] = useState<Resolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchItems();
  }, [refreshTrigger]);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const res = await resolutionService.getResolutions({ executionStatus: 'WAITING_NOTIFICATION', pageSize: 200 });
      if (res.isSuccess) setItems(res.data.items);
    } finally {
      setLoading(false);
    }
  };

  const handleNotified = () => {
    setExpandedId(null);
    triggerRefresh();
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-fuchsia-50 text-fuchsia-700">
          <Send className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-800">کارتابل ابلاغ</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">مصوباتی که سه امضای اصلی آن‌ها تکمیل شده و در انتظار ثبت ابلاغ رسمی هستند</p>
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-xs text-xs text-slate-400">در حال بارگذاری...</div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-100 shadow-xs">
          <Inbox className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-400">موردی در انتظار ابلاغ نیست.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-xs border border-slate-100 overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-100 text-[11px]">
                <th className="py-2.5 px-3 font-semibold">شماره مصوبه</th>
                <th className="py-2.5 px-3 font-semibold">جلسه</th>
                <th className="py-2.5 px-3 font-semibold">موضوع مصوبه</th>
                <th className="py-2.5 px-3 font-semibold">واحد مربوطه</th>
                <th className="py-2.5 px-3 font-semibold">وضعیت</th>
                <th className="py-2.5 px-3 font-semibold">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((resolution) => (
                <React.Fragment key={resolution.id}>
                  <tr className="hover:bg-slate-50/70 align-top">
                    <td className="py-3 px-3 font-bold text-teal-700">{toPersianDigits(resolution.resolutionNumber)}</td>
                    <td className="py-3 px-3">{resolution.meetingNumber} — {resolution.meetingTitle}</td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-800">{resolution.topicTitle}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">تاریخ مصوبه: {toPersianDigits(resolution.assignedDateJalali || resolution.createdAt.slice(0, 10))}</div>
                    </td>
                    <td className="py-3 px-3">{resolution.responsibleDepartmentName || '—'}</td>
                    <td className="py-3 px-3">
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-fuchsia-50 text-fuchsia-700 border border-fuchsia-200">در انتظار ابلاغ</span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        onClick={() => setExpandedId((prev) => (prev === resolution.id ? null : resolution.id))}
                        className="flex items-center gap-1.5 bg-fuchsia-700 hover:bg-fuchsia-800 text-white text-[11px] font-bold py-1.5 px-3 rounded-full cursor-pointer"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>ابلاغ</span>
                      </button>
                    </td>
                  </tr>
                  {expandedId === resolution.id && (
                    <tr>
                      <td colSpan={6} className="p-3 bg-fuchsia-50/40">
                        <NotifyResolutionAction resolutionId={resolution.id} resolutionNumber={resolution.resolutionNumber} onNotified={handleNotified} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
