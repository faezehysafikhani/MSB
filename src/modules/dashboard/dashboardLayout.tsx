import React, { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, LayoutGrid, RotateCcw } from 'lucide-react';
import { loadLocalValue, saveLocalValue } from '../../services/localStore';

/** بخش‌های قابل شخصی‌سازی داشبورد. */
export const DASHBOARD_SECTIONS = [
  { id: 'brief', label: 'خلاصه امروز' },
  { id: 'pulse', label: 'شاخص‌ها و وضعیت مصوبات' },
  { id: 'todo', label: 'کارهای من' },
  { id: 'meetings', label: 'جلسات پیش‌رو' },
  { id: 'resolutions', label: 'مصوبات در جریان' },
  { id: 'role', label: 'کارت مخصوص نقش' },
  { id: 'activity', label: 'آخرین فعالیت‌ها' },
] as const;
export type DashboardSectionId = typeof DASHBOARD_SECTIONS[number]['id'];

interface Layout { order: DashboardSectionId[]; hidden: DashboardSectionId[] }
const DEFAULT: Layout = { order: DASHBOARD_SECTIONS.map((s) => s.id), hidden: [] };
const KEY = 'dashboardLayouts';

const load = (userId: string): Layout => {
  const saved = loadLocalValue<Record<string, Layout>>(KEY, {})[userId];
  if (!saved) return DEFAULT;
  const order = [...saved.order.filter((id) => DEFAULT.order.includes(id)), ...DEFAULT.order.filter((id) => !saved.order.includes(id))];
  return { order, hidden: saved.hidden.filter((id) => DEFAULT.order.includes(id)) };
};

/** چیدمان شخصی هر کاربر (ترتیب و نمایش بخش‌ها) — در مرورگر ذخیره می‌شود. */
export const useDashboardLayout = (userId: string) => {
  const [layout, setLayout] = useState<Layout>(() => load(userId));
  const [loadedFor, setLoadedFor] = useState(userId);
  if (loadedFor !== userId) { setLoadedFor(userId); setLayout(load(userId)); }
  const persist = (next: Layout) => {
    setLayout(next);
    saveLocalValue(KEY, { ...loadLocalValue<Record<string, Layout>>(KEY, {}), [userId]: next });
  };
  return {
    layout,
    isVisible: (id: DashboardSectionId) => !layout.hidden.includes(id),
    /** مقدار CSS order — بخش‌ها با flex/grid order مرتب می‌شوند. */
    orderOf: (id: DashboardSectionId) => layout.order.indexOf(id) + 1,
    toggle: (id: DashboardSectionId) => persist({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] }),
    move: (id: DashboardSectionId, delta: number) => {
      const order = [...layout.order];
      const i = order.indexOf(id); const j = i + delta;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      persist({ ...layout, order });
    },
    reset: () => persist(DEFAULT),
  };
};

export const DashboardCustomizer: React.FC<{ api: ReturnType<typeof useDashboardLayout> }> = ({ api }) => (
  <details className="relative z-20" onKeyDown={(event) => {
    if (event.key === 'Escape') {
      event.currentTarget.open = false;
      event.currentTarget.querySelector('summary')?.focus();
    }
  }}>
    <summary className="app-btn-secondary cursor-pointer list-none [&::-webkit-details-marker]:hidden">
      <LayoutGrid className="h-4 w-4" />چیدمان<ChevronDown className="h-4 w-4" />
    </summary>
    <div className="absolute left-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] max-h-[65vh] overflow-auto space-y-2 rounded-xl border border-slate-200 p-3 shadow-xl bg-white dark:bg-slate-900 dark:border-slate-700">
      <ul className="space-y-1.5">
        {api.layout.order.map((id, index) => {
          const section = DASHBOARD_SECTIONS.find((s) => s.id === id)!;
          const visible = api.isVisible(id);
          return (
            <li key={id} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${visible ? 'border-slate-200' : 'border-dashed border-slate-200 opacity-70'}`}>
              <label className="flex flex-1 cursor-pointer items-center gap-2 text-[13px] font-bold text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={visible} onChange={() => api.toggle(id)} className="h-4 w-4 accent-[var(--app-primary)]" />
                {section.label}
              </label>
              <button onClick={() => api.move(id, -1)} disabled={index === 0} aria-label="بالا" className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
              <button onClick={() => api.move(id, 1)} disabled={index === api.layout.order.length - 1} aria-label="پایین" className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
            </li>
          );
        })}
      </ul>
      <button onClick={api.reset} className="flex items-center gap-1 text-[12px] font-bold text-slate-500 hover:text-slate-800"><RotateCcw className="w-3.5 h-3.5" />بازگشت به چیدمان پیش‌فرض</button>
    </div>
  </details>
);
