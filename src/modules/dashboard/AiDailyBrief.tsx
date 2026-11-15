import React, { useEffect, useState } from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';
import { User } from '../../types';
import { useApp } from '../../context/AppContext';
import { toPersianDigits } from '../../utils/formatters';
import { useAiFeature } from '../../components/ai/AiKit';
import { dashboardBrief, DailyBrief } from '../../services/ai/aiService';
import type { AiResult } from '../../services/ai/aiClient';
import type { DashboardModel } from './dashboardData';

// درخواست‌های هم‌زمان با یک کلید (StrictMode / رندر مجدد) فقط یک بار ارسال می‌شوند.
const inFlight = new Map<string, Promise<AiResult<DailyBrief>>>();

const cacheKey = (user: User, model: DashboardModel) => `msb-ai-brief:${user.id}:${model.today}`;
const signature = (model: DashboardModel) => `${model.actionItems.length}:${model.counts.overdue}`;
/** با تغییر کارتابل، خلاصه حداکثر هر ۲ ساعت یک بار خودکار به‌روز می‌شود (صرفه‌جویی در سهمیه رایگان). */
const AUTO_REFRESH_MS = 2 * 60 * 60 * 1000;
interface CachedBrief { res: AiResult<DailyBrief>; sig: string; at: number }

/**
 * «خلاصه امروز» — روزی یک بار برای هر کاربر تولید و در مرورگر Cache می‌شود؛
 * تغییرات کارتابل حداکثر هر ۲ ساعت یک درخواست جدید می‌سازند. دکمه تازه‌سازی همیشه فوری است.
 */
export const AiDailyBrief: React.FC<{ user: User; model: DashboardModel }> = ({ user, model }) => {
  const { navigateTo } = useApp();
  const enabled = useAiFeature('dashboardBrief');
  const [result, setResult] = useState<AiResult<DailyBrief> | null>(null);
  const [loading, setLoading] = useState(false);

  const generate = async (force = false) => {
    const key = cacheKey(user, model);
    if (!force) {
      try {
        const raw = localStorage.getItem(key);
        const cached = raw ? JSON.parse(raw) as CachedBrief : null;
        if (cached?.res && (cached.sig === signature(model) || Date.now() - cached.at < AUTO_REFRESH_MS)) { setResult(cached.res); return; }
      } catch { /* ignore */ }
    }
    setLoading(true);
    try {
      let pending = inFlight.get(key);
      if (!pending || force) {
        pending = dashboardBrief(user, model, user.id).then((res) => {
          try { localStorage.setItem(key, JSON.stringify({ res, sig: signature(model), at: Date.now() } satisfies CachedBrief)); } catch { /* ignore */ }
          return res;
        }).finally(() => inFlight.delete(key));
        inFlight.set(key, pending);
      }
      setResult(await pending);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (enabled && model.hasAnyData) generate(); }, [enabled, user.id, model.today, model.actionItems.length, model.counts.overdue]);

  if (!enabled || !model.hasAnyData) return null;
  return (
    <section className="db-card">
      <header className="db-card-head">
        <h2>خلاصه امروز</h2>
        <button onClick={() => generate(true)} disabled={loading} title="به‌روزرسانی خلاصه" aria-label="به‌روزرسانی خلاصه" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </header>
      {loading && !result ? <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" /> : <p className="text-sm font-bold leading-7 text-slate-800">{result?.data.headline}</p>}
      <ul className="mt-1 grid gap-1 text-[13px] leading-5 text-slate-700 dark:text-slate-200">
        {model.actionItems.slice(0, 1).map((item) => (
          <li key={item.id}>
            <button className="db-brief-link" onClick={() => navigateTo(item.route, item.params)}>
              <ArrowLeft aria-hidden="true" />{item.kind} · {item.title}
            </button>
          </li>
        ))}
        {model.upcomingMeetings.slice(0, 1).map((meeting) => (
          <li key={meeting.id}>
            <button className="db-brief-link" onClick={() => navigateTo('meeting-details', { meetingId: meeting.id })}>
              <ArrowLeft aria-hidden="true" />جلسه بعدی · {meeting.title} · {toPersianDigits(meeting.startTime)}
            </button>
          </li>
        ))}
        {[
          { label: 'مصوبه معوق', records: model.overdue },
          { label: 'در گردش امضا', records: model.awaitingSignature },
        ].flatMap(({ label, records }) => records.map((resolution) => (
          <li key={resolution.id}>
            <button className="db-brief-link" onClick={() => navigateTo('resolutions', { resolutionId: resolution.id })}>
              <ArrowLeft aria-hidden="true" />{label} · {resolution.topicTitle}
            </button>
          </li>
        )))}
      </ul>
    </section>
  );
};
