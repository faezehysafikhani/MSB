import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ClipboardCheck, FileCheck2, Lightbulb, PenTool, RefreshCcw, Scale, Send, ShieldCheck, UserCog } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { toPersianDigits } from '../../utils/formatters';
import { getInfographicStages, InfographicStage } from './infographicStages';

const ICONS: Record<InfographicStage['icon'], React.ElementType> = {
  proposal: Lightbulb,
  review: Scale,
  meeting: CalendarDays,
  resolution: FileCheck2,
  sign: PenTool,
  notice: Send,
  execute: UserCog,
  followup: ClipboardCheck,
  verify: ShieldCheck,
};

/**
 * اینفوگراف «مسیر مصوبه از پیشنهاد تا خاتمه»:
 * - دایره مرکزی «چرخه مدیریت مصوبات» که ۹ مرحله روی حلقه اطرافش قرار دارند؛
 * - کارت‌های مرتب مراحل در مسیر راست‌به‌چپ (سه ردیف سه‌تایی) با شماره، آیکون،
 *   عنوان و توضیح کوتاه؛ در موبایل همین ترتیب به‌صورت عمودی.
 * داده مراحل از getInfographicStages (آرایه مستقل) خوانده می‌شود.
 */
export const InfographicsView: React.FC = () => {
  const { navigateTo } = useApp();
  const stages = useMemo(getInfographicStages, []);
  const [hovered, setHovered] = useState<number | null>(null);

  return (
    <div className="icy">
      <header className="icy-head">
        <h2>مسیر مصوبه از پیشنهاد تا خاتمه</h2>
        <p>از ثبت پیشنهاد تا صحه‌گذاری نهایی؛ هر مصوبه این ۹ مرحله را به ترتیب طی می‌کند.</p>
      </header>

      <div className="icy-body">
        {/* المان مرکزی: چرخه مدیریت مصوبات */}
        <div className="icy-hub-wrap" aria-hidden="true">
          <div className="icy-orbit">
            {stages.map((stage, i) => {
              const Icon = ICONS[stage.icon];
              // مرحله ۱ بالای حلقه و ادامه مراحل پادساعتگرد (راست‌به‌چپ).
              const angle = -90 - (360 / stages.length) * i;
              return (
                <span
                  key={stage.id}
                  className={`icy-orbit-dot ${hovered === stage.id ? 'icy-orbit-dot-on' : ''}`}
                  style={{ ['--a' as string]: `${angle}deg` }}
                >
                  <span className="icy-orbit-inner"><Icon className="h-3.5 w-3.5" /></span>
                </span>
              );
            })}
            <div className="icy-hub">
              <RefreshCcw className="h-7 w-7 opacity-90" />
              <strong>چرخه مدیریت مصوبات</strong>
              <span>{toPersianDigits(stages.length)} مرحله</span>
            </div>
          </div>
        </div>

        {/* مراحل: مسیر راست‌به‌چپ */}
        <ol className="icy-steps">
          {stages.map((stage, i) => {
            const Icon = ICONS[stage.icon];
            const endOfRow = (i + 1) % 3 === 0;
            return (
              <li key={stage.id} className="icy-step-cell">
                <button
                  type="button"
                  onClick={() => navigateTo(stage.route)}
                  onMouseEnter={() => setHovered(stage.id)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(stage.id)}
                  onBlur={() => setHovered(null)}
                  className="icy-card"
                  title={`رفتن به بخش «${stage.title}»`}
                >
                  <span className="icy-card-icon"><Icon className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1 text-right">
                    <span className="flex items-center gap-1.5">
                      <span className="icy-num">{toPersianDigits(stage.id)}</span>
                      <b className="icy-title">{stage.title}</b>
                    </span>
                    <span className="icy-desc">{stage.description}</span>
                  </span>
                </button>
                {i < stages.length - 1 && (
                  <span className={`icy-arrow ${endOfRow ? 'icy-arrow-down' : ''}`} aria-hidden="true"><ChevronLeft className="h-4 w-4" /></span>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
};
