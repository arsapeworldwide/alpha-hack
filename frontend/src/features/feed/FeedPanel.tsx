import { useEffect, useState } from 'react';
import type { FeedItem, FeedResponse, FeedSegment } from '../../api/types';
import { useStore } from '../../state/context';
import { feedQuery } from '../../state/reducer';
import { FeedArticle } from './FeedArticle';
import { iconForTag, REJECTED_PALETTE, SEGMENT_PALETTE } from './feedStyle';

// «Для всех» — общие материалы, пока компания не выбрана; дальше лента сама переключается на сегмент компании
const TABS: FeedSegment[] = ['general', 'retail', 'services', 'production'];
const TAB_LABELS: Record<FeedSegment, string> = { general: 'Для всех', retail: 'Ритейл', services: 'Услуги', production: 'Производство' };

/**
 * «Умная лента» в журнальной вёрстке: одна главная статья и список остальных.
 * Сегмент берётся из компании, его можно переключить вручную; после отказа первыми идут советы.
 * Компонент монтируется с key = сегмент компании, поэтому ручной выбор сбрасывается при смене компании.
 */
export function FeedPanel() {
  const { api, state } = useStore();
  const auto = feedQuery(state);
  const [manual, setManual] = useState<FeedSegment | null>(null);
  const segment = manual ?? auto.segment;
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<FeedItem | null>(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    api
      .getFeed(segment, auto.context)
      .then((r) => !cancelled && setFeed(r))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [api, segment, auto.context]);

  const reason = manual && manual !== auto.segment ? `Раздел «${TAB_LABELS[manual]}»` : feed?.reason;
  const [lead, ...rest] = feed?.items ?? [];
  const palette = SEGMENT_PALETTE[feed?.segment ?? 'general'];
  const leadPalette = lead?.tag === 'Повысить шансы' ? REJECTED_PALETTE : palette;
  const LeadIcon = iconForTag(lead?.tag ?? '');

  return (
    <section aria-labelledby="feed-title">
      <div className="flex flex-col gap-4 border-b border-line md:flex-row md:items-end md:justify-between">
        <h2 id="feed-title" className="pb-4 text-[28px] font-bold leading-tight tracking-[-0.02em]">Полезное для бизнеса</h2>
        <div className="-mb-px flex gap-5 overflow-x-auto md:gap-6" role="group" aria-label="Раздел ленты">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              aria-pressed={segment === tab}
              onClick={() => setManual(tab)}
              className={`shrink-0 whitespace-nowrap border-b-2 pb-4 text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ink ${
                segment === tab ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          ))}
        </div>
      </div>
      {reason && <p className={`mt-4 text-sm ${auto.context === 'rejected' ? 'text-[#8a5800]' : 'text-muted'}`}>{reason}</p>}

      {error && <p className="mt-6 text-accent-dark">Лента не загрузилась: {error}</p>}
      {!feed && !error && <div className="mt-6 h-72 animate-pulse rounded-3xl bg-surface" aria-hidden />}

      {lead && (
        <div key={`${feed?.segment}-${auto.context}`} className="feed-in mt-6 grid gap-8 lg:grid-cols-[1.1fr_1fr]">
          <button
            type="button"
            onClick={() => setOpen(lead)}
            style={{ backgroundColor: leadPalette.bg }}
            className="relative flex flex-col overflow-hidden rounded-3xl p-8 text-left transition-[filter] hover:brightness-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            <LeadIcon size={132} strokeWidth={1.25} className="pointer-events-none absolute -right-4 -top-4 opacity-[0.14]" style={{ color: leadPalette.fg }} aria-hidden />
            <span className="relative text-sm font-medium" style={{ color: leadPalette.fg }}>{lead.tag}</span>
            <span className="relative mt-4 max-w-[26ch] text-[26px] font-bold leading-[1.15] tracking-[-0.02em]">{lead.title}</span>
            <span className="relative mt-4 text-[16px] leading-relaxed text-ink/70">{lead.summary}</span>
            <span className="relative mt-auto pt-8 text-[15px] font-semibold">Читать, {lead.read_minutes} мин</span>
          </button>

          <ul className="divide-y divide-line">
            {rest.map((item) => {
              const Icon = iconForTag(item.tag);
              const pal = item.tag === 'Повысить шансы' ? REJECTED_PALETTE : palette;
              return (
                <li key={item.id}>
                  <button type="button" onClick={() => setOpen(item)} className="group flex w-full items-start gap-4 py-5 text-left first:pt-0 focus-visible:outline-2 focus-visible:outline-ink">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: pal.bg, color: pal.fg }} aria-hidden>
                      <Icon size={20} />
                    </span>
                    <span className="min-w-0">
                      <span className="text-sm text-muted">{item.tag}, {item.read_minutes} мин</span>
                      <span className="mt-1 block text-[17px] font-semibold leading-snug group-hover:underline group-hover:underline-offset-4">{item.title}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-6 text-[13px] text-muted">Материалы синтетические и подготовлены для демо.</p>
      <FeedArticle item={open} onClose={() => setOpen(null)} />
    </section>
  );
}
