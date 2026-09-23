import React, { useMemo } from 'react';
import { CalendarDays, ClipboardCheck, FileCheck2, Lightbulb, PenTool, Scale, Send, ShieldCheck, UserCog, Workflow } from 'lucide-react';
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

// هندسه مسیر موج‌دار (واحد viewBox): ارتفاع ثابت تا مختصات عمودی با CSS یکی باشد.
const VIEW_W = 1000;
const VIEW_H = 340;
const Y_UP = 118;
const Y_DOWN = 222;

/**
 * اینفوگراف «مسیر مصوبه از پیشنهاد تا خاتمه»: یک مسیر پیوسته و موج‌دار از
 * راست به چپ؛ مراحل به‌تناوب بالا و پایین مسیر قرار می‌گیرند. در موبایل همین
 * مسیر به‌صورت عمودی نمایش داده می‌شود. متن‌ها از getInfographicStages می‌آیند.
 */
export const InfographicsView: React.FC = () => {
  const { navigateTo } = useApp();
  const stages = useMemo(getInfographicStages, []);
  const step = VIEW_W / stages.length;
  const points = stages.map((_, i) => ({ x: VIEW_W - (i + 0.5) * step, y: i % 2 === 0 ? Y_UP : Y_DOWN }));
  const path = points.reduce((d, p, i) => {
    if (i === 0) return `M ${VIEW_W} ${p.y} L ${p.x} ${p.y}`;
    const prev = points[i - 1];
    const mid = (prev.x + p.x) / 2;
    return `${d} C ${mid} ${prev.y}, ${mid} ${p.y}, ${p.x} ${p.y}`;
  }, '') + ` L 0 ${points[points.length - 1].y}`;

  return (
    <div className="igw">
      <header className="igw-head">
        <span className="igw-head-icon"><Workflow className="h-5 w-5" /></span>
        <div>
          <h2>مسیر مصوبه از پیشنهاد تا خاتمه</h2>
          <p>روی هر مرحله بزنید تا به همان بخش سامانه بروید.</p>
        </div>
      </header>

      {/* نمای دسکتاپ: مسیر موج‌دار افقی */}
      <div className="igw-track" style={{ ['--igw-h' as string]: `${VIEW_H}px` }}>
        <svg className="igw-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="igw-grad" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="50%" stopColor="#2563eb" />
              <stop offset="100%" stopColor="#0b2a5b" />
            </linearGradient>
          </defs>
          <path d={path} fill="none" stroke="#dbe8fb" strokeWidth="26" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={path} fill="none" stroke="url(#igw-grad)" strokeWidth="12" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <path d={path} fill="none" stroke="#ffffff" strokeWidth="2" strokeDasharray="6 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" opacity="0.85" />
        </svg>
        <ol className="igw-nodes">
          {stages.map((stage, i) => {
            const Icon = ICONS[stage.icon];
            const up = i % 2 === 0;
            return (
              <li key={stage.id} className={`igw-node ${up ? 'igw-up' : 'igw-down'}`} style={{ ['--igw-y' as string]: `${(up ? Y_UP : Y_DOWN)}px` }}>
                <button type="button" onClick={() => navigateTo(stage.route)} className="igw-btn" title={`رفتن به بخش «${stage.title}»`}>
                  <span className="igw-circle"><Icon className="h-6 w-6" /><span className="igw-num">{toPersianDigits(stage.id)}</span></span>
                </button>
                <div className="igw-text">
                  <h3>{stage.title}</h3>
                  <p>{stage.description}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      {/* نمای موبایل: همان مسیر به‌صورت عمودی */}
      <ol className="igw-mobile">
        {stages.map((stage) => {
          const Icon = ICONS[stage.icon];
          return (
            <li key={stage.id}>
              <button type="button" onClick={() => navigateTo(stage.route)} className="igw-circle igw-circle-sm" aria-label={stage.title}><Icon className="h-5 w-5" /><span className="igw-num">{toPersianDigits(stage.id)}</span></button>
              <div className="min-w-0">
                <h3>{stage.title}</h3>
                <p>{stage.description}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};
