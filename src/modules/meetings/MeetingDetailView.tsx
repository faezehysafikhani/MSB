import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { meetingService, resolutionService, boardSecretariatService } from '../../services';
import { Meeting, Resolution, AgendaItem, BoardMinutes, ResolutionNotice, MeetingOutcomeLetter } from '../../types';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  FileText,
  ArrowRight,
  Printer,
  Plus,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building,
  UserCheck,
  Layers,
  ChevronLeft,
  FileCheck2,
  ExternalLink,
  FileDown,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Mail,
  UserPlus
} from 'lucide-react';
import { toPersianDigits, getMeetingTypeLabel, getMeetingStatusMeta, getResolutionExecutionMeta, getPriorityMeta } from '../../utils/formatters';
import { AttachmentList } from '../../components/common/AttachmentList';
import { TimelineView } from '../../components/common/TimelineView';
import { exportHtmlToPdf } from '../../utils/pdfExport';
import { AppendToMeetingModal } from './AppendToMeetingModal';

interface MeetingDetailViewProps {
  meetingId: string;
  onOpenCreateResolution?: () => void;
}

export const MeetingDetailView: React.FC<MeetingDetailViewProps> = ({ meetingId }) => {
  const { currentUser, navigateTo, showToast, refreshTrigger, triggerRefresh, openCreateResolutionModal, hasPermission } = useApp();

  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [resolutions, setResolutions] = useState<Resolution[]>([]);
  const [activeTab, setActiveTab] = useState<'AGENDAS' | 'RESOLUTIONS' | 'MEMBERS' | 'INVITATIONS' | 'ATTACHMENTS' | 'MINUTES_PRINT'>('AGENDAS');
  const [loading, setLoading] = useState(true);
  const [agendaReviewNotes, setAgendaReviewNotes] = useState('');
  const [outcomeStatuses, setOutcomeStatuses] = useState<Record<string, NonNullable<AgendaItem['outcomeStatus']>>>({});
  const [outcomeNotes, setOutcomeNotes] = useState<Record<string, string>>({});
  const [guestName, setGuestName] = useState('');
  const [guestTitle, setGuestTitle] = useState('');
  const [guestOrganization, setGuestOrganization] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAgendaId, setGuestAgendaId] = useState('');
  const [guestTime, setGuestTime] = useState('');
  const [boardMinutes, setBoardMinutes] = useState<BoardMinutes | null>(null);
  const [minutesContent, setMinutesContent] = useState('');
  const [notices, setNotices] = useState<ResolutionNotice[]>([]);
  const [isAppendModalOpen, setIsAppendModalOpen] = useState(false);
  const [outcomeLetters, setOutcomeLetters] = useState<MeetingOutcomeLetter[]>([]);
  const printableRef = useRef<HTMLDivElement>(null);
  const canCreateResolution = hasPermission('CREATE_RESOLUTION');

  useEffect(() => {
    loadMeetingDetails();
  }, [meetingId, refreshTrigger]);

  const loadMeetingDetails = async () => {
    setLoading(true);
    try {
      const [meetRes, resRes, minutesRes, noticesRes, lettersRes] = await Promise.all([
        meetingService.getMeetingById(meetingId),
        resolutionService.getResolutions({ meetingId, pageSize: 50 }),
        boardSecretariatService.getMinutes(meetingId),
        boardSecretariatService.getNotices(meetingId),
        meetingService.getOutcomeLetters(meetingId),
      ]);

      if (meetRes.isSuccess && meetRes.data) {
        setMeeting(meetRes.data);
        // Self-heal meetings left stuck in READY_FOR_INVITATION by the
        // earlier bug where auto-sending right after CEO approval rejected
        // the CEO as an unauthorized actor — now that sendInvitations also
        // accepts CEO, finish the send instead of leaving it stranded
        // forever with no manual button left to retry it.
        if (meetRes.data.status === 'READY_FOR_INVITATION' && ['SECRETARY', 'ADMIN', 'CEO'].includes(currentUser.role)) {
          try {
            const sent = await meetingService.sendInvitations(meetingId, currentUser);
            if (sent.isSuccess) setMeeting(sent.data);
          } catch {
            // leave as-is; a privileged viewer without meeting-specific rights may still fail here
          }
        }
      }
      if (resRes.isSuccess) {
        setResolutions(resRes.data.items);
      }
      if (minutesRes.isSuccess) { setBoardMinutes(minutesRes.data); if (minutesRes.data) setMinutesContent(minutesRes.data.content); }
      if (noticesRes.isSuccess) setNotices(noticesRes.data);
      if (lettersRes.isSuccess) setOutcomeLetters(lettersRes.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintMinutesPreview = () => {
    window.print();
  };

  const handleExportMinutesPdf = () => {
    const html = printableRef.current?.innerHTML || '';
    const opened = exportHtmlToPdf(`صورتجلسه ${meeting?.meetingNumber || ''}`, html);
    showToast(opened ? 'خروجی PDF' : 'خطای خروجی', opened ? 'نسخه PDF صورتجلسه در پنجره جدید باز شد.' : 'مرورگر اجازه باز شدن پنجره PDF را نداد.', opened ? 'success' : 'error');
  };

  const handleRegisterResolutionForAgenda = (agendaId: string, agendaTitle: string) => {
    openCreateResolutionModal({
      meetingId: meeting?.id,
      agendaItemId: agendaId,
      topicTitle: agendaTitle,
    });
  };

  const handleAgendaReview = async (decision: 'APPROVE' | 'RETURN') => {
    try {
      await meetingService.reviewAgenda(meetingId, decision, agendaReviewNotes, currentUser);
      if (decision === 'APPROVE') {
        // Invitations are no longer a separate manual step — they go out
        // automatically the moment the agenda is approved, right where the
        // meeting becomes READY_FOR_INVITATION.
        await meetingService.sendInvitations(meetingId, currentUser);
        showToast('بررسی دستورکار', 'دستورکار تأیید شد و دعوتنامه به‌صورت خودکار برای اعضا و مدعوین ارسال شد.', 'success');
      } else {
        showToast('بررسی دستورکار', 'دستورکار برای اصلاح به دبیرخانه بازگشت.', 'success');
      }
      triggerRefresh();
    } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'عملیات انجام نشد.', 'error'); }
  };

  const handleMoveAgenda = async (index: number, direction: -1 | 1) => {
    if (!meeting) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= meeting.agendaItems.length) return;
    const ids = meeting.agendaItems.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    try { await meetingService.reorderAgenda(meeting.id, ids, currentUser); triggerRefresh(); }
    catch (error) { showToast('خطا', error instanceof Error ? error.message : 'ترتیب ذخیره نشد.', 'error'); }
  };

  const handleRemoveAgendaByCeo = async (agenda: AgendaItem) => {
    const reason = window.prompt('دلیل حذف این موضوع از جلسه را وارد کنید:');
    if (!reason) return;
    try { await meetingService.removeAgendaItem(meetingId, agenda.id, reason, currentUser); showToast('اصلاح دستورکار', 'موضوع از دستورکار جاری خارج و سابقه آن حفظ شد.', 'success'); triggerRefresh(); }
    catch (error) { showToast('خطا', error instanceof Error ? error.message : 'موضوع حذف نشد.', 'error'); }
  };

  const handleRecordOutcome = async (agenda: AgendaItem) => {
    try {
      await meetingService.recordAgendaOutcome(meetingId, agenda.id, outcomeStatuses[agenda.id] || 'APPROVED', outcomeNotes[agenda.id] || '', currentUser);
      showToast('نتیجه جلسه', 'نتیجه این بند ثبت و در سوابق جلسه نگهداری شد.', 'success');
      triggerRefresh();
    } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'نتیجه ثبت نشد.', 'error'); }
  };

  const handleAddGuest = async () => {
    const agenda = meeting?.agendaItems.find((item) => item.id === guestAgendaId);
    try {
      await meetingService.addGuest(meetingId, { fullName: guestName, roleTitle: guestTitle, organizationName: guestOrganization, phone: guestPhone, agendaItemId: agenda?.id, agendaItemTitle: agenda?.title, requiredTime: guestTime }, currentUser);
      setGuestName(''); setGuestTitle(''); setGuestOrganization(''); setGuestPhone(''); setGuestAgendaId(''); setGuestTime('');
      showToast('ثبت مدعو', 'مدعو مستقل به جلسه افزوده شد.', 'success'); triggerRefresh();
    } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'مدعو ثبت نشد.', 'error'); }
  };

  const handleEndMeeting = async () => {
    if (!window.confirm('آیا از پایان این جلسه اطمینان دارید؟')) return;
    try { await meetingService.endMeeting(meetingId, currentUser); showToast('پایان جلسه', 'جلسه با موفقیت خاتمه یافت. مصوبات آن به‌طور مستقل به روند اجرای خود ادامه می‌دهند.', 'success'); triggerRefresh(); }
    catch (error) { showToast('خطا', error instanceof Error ? error.message : 'خاتمه جلسه انجام نشد.', 'error'); }
  };

  const handleInvitationViewed = async () => {
    try { await meetingService.markInvitationViewed(meetingId, currentUser.id, currentUser); showToast('دعوتنامه', 'مشاهده دعوتنامه ثبت شد.', 'success'); triggerRefresh(); }
    catch (error) { showToast('خطا', error instanceof Error ? error.message : 'ثبت مشاهده انجام نشد.', 'error'); }
  };

  const refreshGovernance = async () => {
    const [minutesRes, noticesRes] = await Promise.all([boardSecretariatService.getMinutes(meetingId), boardSecretariatService.getNotices(meetingId)]);
    setBoardMinutes(minutesRes.data); setNotices(noticesRes.data); if (minutesRes.data) setMinutesContent(minutesRes.data.content); triggerRefresh();
  };

  const handleCreateMinutes = async () => {
    if (!meeting) return;
    const defaultText = `جلسه ${meeting.meetingNumber} با عنوان «${meeting.title}» در تاریخ ${meeting.dateJalali} برگزار شد. موضوعات دستورکار بررسی و نتایج و مصوبات مطابق جداول این سند ثبت گردید.`;
    try { await boardSecretariatService.createMinutes(meeting, minutesContent || defaultText, currentUser); await refreshGovernance(); showToast('صورت‌جلسه تجمیعی', 'پیش‌نویس رسمی در سه نسخه ایجاد شد.', 'success'); } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'ایجاد صورت‌جلسه انجام نشد.', 'error'); }
  };
  const handleSaveMinutes = async () => { try { await boardSecretariatService.updateMinutes(meetingId, minutesContent, currentUser); await refreshGovernance(); showToast('ذخیره صورت‌جلسه', 'پیش‌نویس ذخیره شد.', 'success'); } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'ذخیره انجام نشد.', 'error'); } };
  const handleStartMinutesSignatures = async () => { try { await boardSecretariatService.startSignatures(meetingId, currentUser); await refreshGovernance(); showToast('ارسال برای امضا', 'صورت‌جلسه در کارتابل اعضای حاضر قرار گرفت.', 'success'); } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'ارسال انجام نشد.', 'error'); } };
  const handleSignMinutes = async () => { if (!window.confirm('آیا صورت‌جلسه تجمیعی را تأیید و امضا می‌کنید؟')) return; try { await boardSecretariatService.signMinutes(meetingId, currentUser); await refreshGovernance(); showToast('امضای صورت‌جلسه', 'امضای شما ثبت شد.', 'success'); } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'امضا ثبت نشد.', 'error'); } };
  const handleFinalizeMinutes = async () => { try { await boardSecretariatService.finalizeMinutes(meetingId, currentUser); await refreshGovernance(); showToast('نهایی‌سازی', 'صورت‌جلسه نهایی و مصوبات آماده ابلاغ شدند.', 'success'); } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'نهایی‌سازی انجام نشد.', 'error'); } };
  const handleIssueNotices = async () => { try { await boardSecretariatService.issueNotices(meetingId, currentUser); await refreshGovernance(); showToast('ابلاغ مصوبات', 'ابلاغیه‌ها صادر شدند و Workflow اجرای مصوبات آغاز شد.', 'success'); } catch (error) { showToast('خطا', error instanceof Error ? error.message : 'ابلاغ انجام نشد.', 'error'); } };

  if (loading || !meeting) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
        <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
        <p className="text-xs font-bold text-slate-600">در حال بارگذاری اطلاعات جلسه...</p>
      </div>
    );
  }

  const statusMeta = getMeetingStatusMeta(meeting.status);
  const isCeo = currentUser.role === 'CEO' || currentUser.role === 'ADMIN';
  const isSecretariat = currentUser.id === meeting.secretaryId || currentUser.role === 'SECRETARY' || currentUser.role === 'ADMIN';
  const canArrangeAgenda = (isCeo || isSecretariat) && ['WAITING_FOR_CEO_APPROVAL', 'AGENDA_RETURNED'].includes(meeting.status);
  // Append-only addition of new invitees/agenda items to an already-created
  // meeting — gated purely by the Permission System (never hardcoded to a
  // role) and only meaningful before the meeting has concluded.
  const canAppendToMeeting = hasPermission('APPEND_MEETING_CONTENT') && !['HELD', 'CANCELLED'].includes(meeting.status);

  return (
    <div className="space-y-5 pb-16">
      {/* Top Navigation & Actions Bar */}
      <div className="no-print bg-white rounded-2xl p-4 shadow-xs border border-slate-200/80 flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => navigateTo('meetings')}
          className="flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-teal-800 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-4 h-4" />
          <span>بازگشت به لیست جلسات</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {canAppendToMeeting && (
            <button
              onClick={() => setIsAppendModalOpen(true)}
              className="flex items-center gap-1.5 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>افزودن مدعو / دستور کار</span>
            </button>
          )}
          {isSecretariat && meeting.status === 'AGENDA_RETURNED' && <button onClick={async () => { await meetingService.submitAgenda(meeting.id, currentUser); triggerRefresh(); }} className="flex items-center gap-1.5 bg-orange-600 text-white font-bold text-xs py-2 px-4 rounded-xl"><RotateCcw className="w-4 h-4" />ارسال مجدد دستورکار</button>}
          {(isCeo || isSecretariat) && meeting.status === 'IN_PROGRESS' && (
            <button
              onClick={handleEndMeeting}
              className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>پایان جلسه</span>
            </button>
          )}
          {canCreateResolution && ['IN_PROGRESS', 'HELD'].includes(meeting.status) && (
            <button
              onClick={() => openCreateResolutionModal({ meetingId: meeting.id })}
              className="flex items-center gap-1.5 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>ثبت مصوبه جدید برای این جلسه</span>
            </button>
          )}
        </div>
      </div>

      {isCeo && meeting.status === 'WAITING_FOR_CEO_APPROVAL' && <div className="no-print bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3"><div className="font-extrabold text-amber-900">بررسی و تأیید دستورکار توسط مدیرعامل</div><textarea rows={2} value={agendaReviewNotes} onChange={(e) => setAgendaReviewNotes(e.target.value)} placeholder="توضیحات تأیید یا دلیل بازگشت" className="w-full text-xs p-3 bg-white border border-amber-200 rounded-xl" /><div className="flex gap-2"><button onClick={() => handleAgendaReview('APPROVE')} className="bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold">تأیید نهایی دستورکار</button><button onClick={() => handleAgendaReview('RETURN')} className="bg-orange-600 text-white px-4 py-2 rounded-xl text-xs font-bold">بازگشت به دبیرخانه</button></div></div>}

      {/* Main Meeting Banner Header */}
      <div className="no-print bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-black text-teal-800 bg-teal-50 px-3 py-1 rounded-xl border border-teal-200">
              {meeting.meetingNumber}
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
              {getMeetingTypeLabel(meeting.type)}
            </span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${statusMeta.bg}`}>
              <span className={`w-2 h-2 rounded-full ${statusMeta.dot}`}></span>
              <span>{statusMeta.label}</span>
            </span>
          </div>

          <div className="text-xs font-bold text-slate-400">
            شناسه سیستمی: <span className="font-mono">{meeting.id}</span>
          </div>
        </div>

        <h2 className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
          {meeting.title}
        </h2>

        {meeting.description && (
          <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-100">
            {meeting.description}
          </p>
        )}

        {/* Meeting Specs grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-teal-600" />
              <span>تاریخ برگزاری</span>
            </div>
            <div className="text-xs font-extrabold text-slate-800">{toPersianDigits(meeting.dateJalali)}</div>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-teal-600" />
              <span>ساعت برگزاری</span>
            </div>
            <div className="text-xs font-extrabold text-slate-800">
              {toPersianDigits(meeting.startTime)} الی {toPersianDigits(meeting.endTime)}
            </div>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-teal-600" />
              <span>مکان جلسه</span>
            </div>
            <div className="text-xs font-extrabold text-slate-800 truncate" title={meeting.location}>{meeting.location}</div>
          </div>

          <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-100">
            <div className="text-[10px] font-bold text-slate-400 mb-1 flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5 text-teal-600" />
              <span>دبیر جلسه</span>
            </div>
            <div className="text-xs font-extrabold text-slate-800">{meeting.secretaryName}</div>
          </div>
        </div>
      </div>

      {/* Tabs Menu - Tab 1 is "دستور جلسه و مذاکرات" */}
      <div className="no-print flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-xs gap-1.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('AGENDAS')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'AGENDAS'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>دستور جلسه و مذاکرات ({toPersianDigits(meeting.agendaItems.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('RESOLUTIONS')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'RESOLUTIONS'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>مصوبات جلسه ({toPersianDigits(resolutions.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('MEMBERS')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'MEMBERS'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>اعضا و امضاکنندگان ({toPersianDigits(meeting.members.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('ATTACHMENTS')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'ATTACHMENTS'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>پیوست‌ها ({toPersianDigits(meeting.attachments.length)})</span>
        </button>

        <button
          onClick={() => setActiveTab('INVITATIONS')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${activeTab === 'INVITATIONS' ? 'bg-teal-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          <Mail className="w-4 h-4" />
          <span>دعوتنامه‌ها و مدعوین ({toPersianDigits((meeting.invitations?.length || 0) + (meeting.guests?.length || 0))})</span>
        </button>

        <button
          onClick={() => setActiveTab('MINUTES_PRINT')}
          className={`flex items-center gap-2 py-2.5 px-4 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeTab === 'MINUTES_PRINT'
              ? 'bg-teal-800 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Printer className="w-4 h-4" />
          <span>پیش‌نمایش چاپ صورتجلسه</span>
        </button>
      </div>

      {/* Tab 1: Agendas & Discussions with "ثبت مصوبه" button per agenda item (Requirement 9) */}
      {activeTab === 'AGENDAS' && (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                بندهای دستور جلسه، شرح مذاکرات و صدور مستقیم مصوبه
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                شما می‌توانید در کنار هر بند دستور جلسه، اقدام به ثبت مصوبه متناظر با آن نمایید.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-bold">
              تعداد بندها: {toPersianDigits(meeting.agendaItems.length)}
            </span>
          </div>

          <div className="space-y-4">
            {meeting.agendaItems.map((ag, agendaIndex) => {
              const relatedResolutions = resolutions.filter(
                (r) => r.agendaItemId === ag.id || r.topicTitle.toLowerCase().includes(ag.title.toLowerCase())
              );
              const outcomeLetter = outcomeLetters.find((letter) => letter.agendaItemId === ag.id);

              return (
                <div
                  key={ag.id}
                  className={`p-5 rounded-2xl border space-y-3 transition-all ${ag.isRemoved ? 'bg-rose-50/50 border-rose-200 opacity-75' : 'bg-slate-50/90 border-slate-200/90 hover:border-teal-300'}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-teal-800 text-white font-black text-xs flex items-center justify-center shadow-xs">
                        {toPersianDigits(ag.rowNumber)}
                      </span>
                      <div>
                        <h4 className="text-sm font-extrabold text-slate-900">{ag.title}</h4>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          ارائه‌دهنده: <strong className="text-teal-900">{ag.presenterName || ag.presenter}</strong> | 
                          مدت زمان: {toPersianDigits(ag.allocatedMinutes)} دقیقه
                        </div>
                        {ag.relatedUsers && ag.relatedUsers.length > 0 && (
                          <div className="text-[10px] text-blue-700 mt-1">
                            افراد مرتبط با این موضوع: {ag.relatedUsers.map((user) => user.fullName).join('، ')}
                          </div>
                        )}
                        {ag.attachments && ag.attachments.length > 0 && (
                          <div className="mt-2 max-w-md">
                            <p className="text-[10px] font-bold text-slate-500 mb-1">پیوست‌های این دستور کار ({toPersianDigits(ag.attachments.length)}):</p>
                            <AttachmentList attachments={ag.attachments} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Prominent Button: ثبت مصوبه برای این بند (Requirement 9) */}
                    {canCreateResolution && !ag.isRemoved && ['APPROVED', 'CONDITIONAL'].includes(ag.outcomeStatus || '') && (
                      <button
                        onClick={() => handleRegisterResolutionForAgenda(ag.id, ag.title)}
                        className="flex items-center gap-1.5 bg-teal-800 hover:bg-teal-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl shadow-xs transition-all cursor-pointer"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        <span>ثبت مصوبه برای این بند</span>
                      </button>
                    )}
                    {canArrangeAgenda && <div className="flex gap-1"><button onClick={() => handleMoveAgenda(agendaIndex, -1)} disabled={agendaIndex === 0} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30" title="انتقال به بالا"><ArrowUp className="w-4 h-4" /></button><button onClick={() => handleMoveAgenda(agendaIndex, 1)} disabled={agendaIndex === meeting.agendaItems.length - 1} className="p-1.5 rounded-lg border border-slate-200 disabled:opacity-30" title="انتقال به پایین"><ArrowDown className="w-4 h-4" /></button></div>}
                    {isCeo && meeting.status === 'WAITING_FOR_CEO_APPROVAL' && !ag.isRemoved && <button onClick={() => handleRemoveAgendaByCeo(ag)} className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold">حذف از این جلسه</button>}
                  </div>

                  {ag.isRemoved && <div className="p-2.5 bg-white border border-rose-200 rounded-xl text-rose-700 text-[11px] font-bold">خارج‌شده از دستورکار جاری — دلیل: {ag.removalReason}</div>}

                  {ag.outcomeNotes && (
                    <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                      <span className="font-bold text-teal-900 block mb-1">شرح مذاکرات و نتایج بررسی:</span>
                      {ag.outcomeNotes}
                    </div>
                  )}

                  {outcomeLetter && <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900"><Mail className="inline w-4 h-4 ml-1" /><strong>{outcomeLetter.letterNumber}</strong> برای {outcomeLetter.recipientName} / {outcomeLetter.recipientDepartment} صادر شد و در سوابق پیشنهاد و جلسه قابل ردیابی است.</div>}

                  {isSecretariat && !ag.isRemoved && ['INVITATION_SENT', 'SCHEDULED', 'IN_PROGRESS', 'HELD'].includes(meeting.status) && (
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 p-3 bg-white rounded-xl border border-slate-200">
                      <select value={outcomeStatuses[ag.id] || ag.outcomeStatus || 'APPROVED'} onChange={(e) => setOutcomeStatuses((prev) => ({ ...prev, [ag.id]: e.target.value as NonNullable<AgendaItem['outcomeStatus']> }))} className="sm:col-span-3 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                        <option value="APPROVED">تصویب شد</option><option value="NOT_APPROVED">تصویب نشد</option><option value="NEEDS_REVISION">نیاز به اصلاح</option><option value="NEEDS_MORE_REVIEW">نیاز به بررسی بیشتر</option><option value="DEFERRED">موکول به جلسه بعد</option><option value="REFERRED">ارجاع به واحد مربوطه</option><option value="CONDITIONAL">تصویب مشروط</option><option value="CLOSED">مختومه</option>
                      </select>
                      <input value={outcomeNotes[ag.id] ?? ag.outcomeNotes ?? ''} onChange={(e) => setOutcomeNotes((prev) => ({ ...prev, [ag.id]: e.target.value }))} placeholder="شرح مذاکرات و نتیجه نهایی این بند" className="sm:col-span-7 text-xs p-2.5 bg-slate-50 border border-slate-200 rounded-xl" />
                      <button onClick={() => handleRecordOutcome(ag)} className="sm:col-span-2 bg-teal-800 text-white rounded-xl text-xs font-bold">ثبت نتیجه</button>
                    </div>
                  )}

                  {/* Linked Resolutions for this Agenda */}
                  {relatedResolutions.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/70">
                      <div className="text-[11px] font-bold text-teal-900 mb-1.5 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                        <span>مصوبات صادرشده برای این بند ({toPersianDigits(relatedResolutions.length)} مورد):</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {relatedResolutions.map((r) => (
                          <span
                            key={r.id}
                            onClick={() => {
                              setActiveTab('RESOLUTIONS');
                            }}
                            className="inline-flex items-center gap-1.5 bg-white border border-teal-300 text-teal-900 text-xs font-bold py-1 px-3 rounded-xl cursor-pointer hover:bg-teal-50 shadow-2xs"
                          >
                            <span>{r.resolutionNumber}</span>
                            <span className="text-[11px] text-slate-500 truncate max-w-xs">({r.topicTitle})</span>
                            <ExternalLink className="w-3 h-3 text-teal-600" />
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Resolutions */}
      {activeTab === 'RESOLUTIONS' && (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-teal-600"></span>
              مصوبات مصوب این جلسه
            </h3>
            <span className="text-xs text-slate-400 font-bold">
              مجموعاً {toPersianDigits(resolutions.length)} مصوبه ثبت شده است.
            </span>
          </div>

          {resolutions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs space-y-2">
              <p>هنوز هیچ مصوبه‌ای برای این جلسه ثبت نشده است.</p>
              {canCreateResolution && (
                <button
                  onClick={() => openCreateResolutionModal({ meetingId: meeting.id })}
                  className="inline-flex items-center gap-1.5 text-teal-800 font-bold text-xs hover:underline cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>اولین مصوبه را ثبت فرمایید</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {resolutions.map((res, index) => {
                const sMeta = getResolutionExecutionMeta(res.executionStatus);
                const pMeta = getPriorityMeta(res.priority);

                return (
                  <div
                    key={res.id}
                    onClick={() => navigateTo('resolutions', { resolutionId: res.id })}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 hover:bg-white hover:border-teal-400 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-teal-800 bg-teal-100/60 px-2.5 py-0.5 rounded-md">
                          بند {toPersianDigits(index + 1)}: {res.resolutionNumber}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${sMeta.bg}`}>
                          {sMeta.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${pMeta.bg} ${pMeta.text}`}>
                          اولویت: {pMeta.label}
                        </span>
                      </div>

                      <div className="text-xs font-bold text-teal-700 flex items-center gap-1 group-hover:translate-x-[-3px] transition-transform">
                        <span>مشاهده پرونده مصوبه</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </div>
                    </div>

                    <h4 className="text-sm font-bold text-slate-800 mb-1.5">{res.topicTitle}</h4>
                    <p className="text-xs text-slate-600 line-clamp-2 mb-2 leading-relaxed">
                      {res.executionDescription || res.requestDescription}
                    </p>

                    <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-2 border-t border-slate-200/60">
                      <div>
                        مسئول اصلی: <strong className="text-slate-700">{res.mainResponsibleName || 'نامشخص'}</strong> ({res.responsibleDepartmentName})
                      </div>
                      <div>
                        مهلت اجرا: <strong className="text-slate-700">{toPersianDigits(res.deadlineJalali || '—')}</strong>
                      </div>
                      {res.verificationConfig?.requiresVerification && (
                        <div className="text-teal-800 font-bold flex items-center gap-1 mr-auto bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>نیازمند صحه‌گذاری ({toPersianDigits(res.verificationConfig.steps.length)} مرحله)</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Members */}
      {activeTab === 'MEMBERS' && (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90 space-y-4">
          <h3 className="text-xs font-extrabold text-slate-800 border-b border-slate-100 pb-3">
            فهرست اعضای حاضر و ارکان جلسه
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {meeting.members.map((member) => (
              <div
                key={member.userId}
                className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3"
              >
                <div className="w-9 h-9 rounded-full bg-teal-800 text-white font-bold text-xs flex items-center justify-center">
                  {member.fullName[0]}
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">{member.fullName}</div>
                  <div className="text-[11px] text-slate-500">{member.organizationPosition}</div>
                  <div className="text-[10px] text-teal-800 font-medium">{member.departmentName}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'INVITATIONS' && (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90 space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div><h3 className="text-xs font-extrabold text-slate-800">دعوتنامه اعضا و مدعوین مستقل</h3><p className="text-[11px] text-slate-500 mt-1">دعوتنامه به‌صورت خودکار بلافاصله پس از تأیید نهایی دستورکار برای همه اعضا و مدعوین ارسال می‌شود.</p></div>
          </div>

          {isSecretariat && !['INVITATION_SENT', 'IN_PROGRESS', 'HELD'].includes(meeting.status) && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
              <div className="font-bold text-slate-800">ثبت مدعو خارج از اعضای اصلی</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="نام و نام خانوادگی *" className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl" />
                <input value={guestTitle} onChange={(e) => setGuestTitle(e.target.value)} placeholder="سمت *" className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl" />
                <input value={guestOrganization} onChange={(e) => setGuestOrganization(e.target.value)} placeholder="سازمان / واحد *" className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl" />
                <input value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} placeholder="شماره تماس *" className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl" />
                <select value={guestAgendaId} onChange={(e) => setGuestAgendaId(e.target.value)} className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl"><option value="">موضوع مرتبط...</option>{meeting.agendaItems.filter((item) => !item.isRemoved).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
                <input value={guestTime} onChange={(e) => setGuestTime(e.target.value)} placeholder="زمان حضور، مثال ۱۰:۳۰" className="text-xs p-2.5 bg-white border border-slate-200 rounded-xl" />
              </div>
              <button onClick={handleAddGuest} className="bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-bold">افزودن مدعو</button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {meeting.members.map((member) => {
              const invitation = meeting.invitations?.find((item) => item.recipientType === 'MEMBER' && item.recipientId === member.userId);
              return <div key={member.userId} className="p-3 border border-slate-200 rounded-2xl"><strong className="text-slate-800">{member.fullName}</strong><span className="block text-[10px] text-slate-500">{member.roleTitle} — عضو جلسه</span><span className={`inline-block mt-2 text-[10px] font-bold px-2 py-1 rounded-full ${invitation ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{invitation?.status === 'VIEWED' ? 'مشاهده شده' : invitation ? 'ارسال شده' : 'ارسال نشده'}</span>{invitation && <span className="text-[10px] text-slate-400 mr-2">{toPersianDigits(new Date(invitation.sentAt).toLocaleString('fa-IR'))}</span>}{member.userId === currentUser.id && invitation?.status === 'SENT' && <button onClick={handleInvitationViewed} className="block mt-2 bg-teal-800 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold">ثبت مشاهده دعوتنامه</button>}</div>;
            })}
            {(meeting.guests || []).map((guest) => <div key={guest.id} className="p-3 border border-blue-200 bg-blue-50/30 rounded-2xl"><strong className="text-slate-800">{guest.fullName}</strong><span className="block text-[10px] text-slate-500">{guest.roleTitle} — {guest.organizationName}</span><span className="block text-[10px] text-blue-700 mt-1">موضوع: {guest.agendaItemTitle || 'کل جلسه'} | زمان حضور: {toPersianDigits(guest.requiredTime || '—')}</span><span className="inline-block mt-2 text-[10px] font-bold px-2 py-1 rounded-full bg-white border border-blue-200">{guest.invitationStatus === 'SENT' ? 'دعوتنامه ارسال شده' : guest.invitationStatus === 'VIEWED' ? 'مشاهده شده' : 'ارسال نشده'}</span></div>)}
          </div>

          {(meeting.history?.length || 0) > 0 && <details className="text-[11px] text-slate-600"><summary className="cursor-pointer font-bold">تاریخچه اداری جلسه و دعوتنامه‌ها</summary><div className="mt-2 space-y-1">{meeting.history?.map((entry) => <div key={entry.id} className="p-2 bg-slate-50 rounded-lg">{entry.action} — {entry.actorName} — {toPersianDigits(entry.dateJalali)} {toPersianDigits(entry.timeString)}{entry.notes ? ` — ${entry.notes}` : ''}</div>)}</div></details>}
        </div>
      )}

      {/* Tab 4: Attachments */}
      {activeTab === 'ATTACHMENTS' && (
        <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90">
          <AttachmentList attachments={meeting.attachments} />
        </div>
      )}

      {/* Tab 5: Official Minutes Preview & Print */}
      {activeTab === 'MINUTES_PRINT' && (
        <div className="space-y-3">
          <div className="no-print bg-white border border-slate-200 rounded-3xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-extrabold text-slate-900">صورت‌جلسه تجمیعی هیأت‌مدیره</h3><p className="text-[11px] text-slate-500">پیش‌نویس، امضای اعضای حاضر، نهایی‌سازی سه نسخه و ابلاغ مصوبات</p></div>{boardMinutes && <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-700 border border-purple-200 text-[11px] font-bold">{boardMinutes.status === 'DRAFT' ? 'پیش‌نویس' : boardMinutes.status === 'WAITING_SIGNATURES' ? 'در انتظار امضا' : boardMinutes.status === 'PARTIALLY_SIGNED' ? 'بخشی امضا شده' : boardMinutes.status === 'SIGNED' ? 'تکمیل امضاها' : 'نهایی‌شده'}</span>}</div>
            {!boardMinutes && isSecretariat && <button onClick={handleCreateMinutes} className="bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-bold">ایجاد پیش‌نویس صورت‌جلسه</button>}
            {boardMinutes && <>
              <textarea rows={5} value={minutesContent} onChange={(event) => setMinutesContent(event.target.value)} disabled={boardMinutes.status !== 'DRAFT' || !isSecretariat} className="w-full text-xs leading-7 p-4 bg-slate-50 border border-slate-200 rounded-2xl disabled:opacity-80" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">{boardMinutes.signatures.map((signature) => <div key={signature.memberUserId} className={`p-3 rounded-2xl border ${signature.status === 'SIGNED' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}><strong className="text-slate-800">{signature.memberName}</strong><span className="block text-[10px] text-slate-500">{signature.memberTitle}</span><span className="block text-[10px] font-bold mt-2">{signature.status === 'SIGNED' ? `امضا شده — ${toPersianDigits(new Date(signature.signedAt!).toLocaleString('fa-IR'))}` : 'در انتظار امضا'}</span></div>)}</div>
              <div className="flex flex-wrap gap-2">{isSecretariat && boardMinutes.status === 'DRAFT' && <><button onClick={handleSaveMinutes} className="bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold">ذخیره پیش‌نویس</button><button onClick={handleStartMinutesSignatures} className="bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold">ارسال برای امضای اعضا</button></>}{['WAITING_SIGNATURES', 'PARTIALLY_SIGNED'].includes(boardMinutes.status) && boardMinutes.signatures.some((item) => item.memberUserId === currentUser.id && item.status === 'PENDING') && <button onClick={handleSignMinutes} className="bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold">امضای صورت‌جلسه</button>}{isSecretariat && boardMinutes.status === 'SIGNED' && <button onClick={handleFinalizeMinutes} className="bg-teal-800 text-white px-4 py-2 rounded-xl text-xs font-bold">نهایی‌سازی در سه نسخه</button>}{isSecretariat && boardMinutes.status === 'FINALIZED' && notices.length === 0 && <button onClick={handleIssueNotices} className="bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold">صدور و ارسال ابلاغیه مصوبات</button>}</div>
              <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"><summary className="cursor-pointer font-bold text-slate-700">ردپای تغییرات صورت‌جلسه ({toPersianDigits(boardMinutes.history.length)})</summary><div className="mt-3 space-y-2">{boardMinutes.history.map((entry) => <div key={entry.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-200 pb-2 last:border-0"><span><strong>{entry.action}</strong> — {entry.actorName}</span><span className="text-slate-500">{toPersianDigits(entry.dateJalali)}، {toPersianDigits(entry.timeString)}</span></div>)}</div></details>
              {notices.length > 0 && <div className="border-t border-slate-100 pt-3"><div className="font-extrabold text-slate-800 mb-2">ابلاغیه‌های صادرشده ({toPersianDigits(notices.length)})</div><div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{notices.map((notice) => <div key={notice.id} className="p-3 bg-blue-50/40 border border-blue-200 rounded-xl"><strong>{notice.noticeNumber} — {notice.resolutionNumber}</strong><span className="block text-[10px] text-slate-600">گیرنده: {notice.recipientName} ({notice.recipientDepartment})</span><span className="block text-[10px] text-blue-700 mt-1">{notice.status === 'RECEIVED' ? 'دریافت شده' : 'ارسال شده'} — مهلت: {toPersianDigits(notice.deadlineJalali || '—')}</span></div>)}</div></div>}
            </>}
          </div>
          <div className="no-print flex items-center justify-end gap-2">
            <button
              onClick={handlePrintMinutesPreview}
              title="چاپ صورتجلسه"
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>چاپ</span>
            </button>
            <button
              onClick={handleExportMinutesPdf}
              title="نمایش نسخه PDF"
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2 px-3.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
            >
              <FileDown className="w-4 h-4" />
              <span>PDF</span>
            </button>
          </div>

          <div ref={printableRef} className="bg-white rounded-3xl p-8 shadow-xs border border-slate-200/90 space-y-6 text-slate-900 printable-minutes">
          <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
            <h2 className="text-base font-black">صورتجلسه رسمی مصوبات سازمان</h2>
            <p className="text-xs font-bold">شماره جلسه: {meeting.meetingNumber} | تاریخ: {toPersianDigits(meeting.dateJalali)}</p>
          </div>

          <div className="text-xs space-y-2">
            <p><strong>عنوان جلسه:</strong> {meeting.title}</p>
            <p><strong>مکان جلسه:</strong> {meeting.location}</p>
            <p><strong>زمان برگزاری:</strong> از ساعت {toPersianDigits(meeting.startTime)} لغایت {toPersianDigits(meeting.endTime)}</p>
            <p><strong>دبیر جلسه:</strong> {meeting.secretaryName}</p>
          </div>

          <div className="space-y-3 pt-2">
            <h4 className="text-xs font-black border-b border-slate-300 pb-1">مصوبات و تصمیمات اتخاذ شده:</h4>
            {resolutions.map((res, i) => (
              <div key={res.id} className="text-xs p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold">بند {toPersianDigits(i + 1)}: {res.topicTitle} ({res.resolutionNumber})</div>
                <div className="text-slate-700">{res.executionDescription || res.requestDescription}</div>
                <div className="text-[11px] text-slate-500">
                  مسئول اجرا: {res.mainResponsibleName} ({res.responsibleDepartmentName}) | مهلت: {toPersianDigits(res.deadlineJalali || '—')}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-slate-200 flex justify-between items-center text-xs font-bold">
            <div>امضای رئیس جلسه</div>
            <div>امضای دبیر جلسه</div>
            <div>مهر و امضای اعضای حاضر</div>
          </div>
          </div>
        </div>
      )}

      {isAppendModalOpen && (
        <AppendToMeetingModal
          meeting={meeting}
          onClose={() => setIsAppendModalOpen(false)}
          onAppended={triggerRefresh}
        />
      )}
    </div>
  );
};
