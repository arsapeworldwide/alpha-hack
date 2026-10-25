// Оформление ленты: у каждого раздела свой мягкий цвет, у каждой темы — своя иконка.
// Так разделы различаются с первого взгляда, а не только текстом.

import {
  BarChart3, BookOpen, CalendarDays, Factory, Landmark, Newspaper, PiggyBank, Receipt,
  ShoppingBag, Timer, TrendingUp, Truck, Users, Wrench, type LucideIcon,
} from 'lucide-react';
import type { FeedSegment } from '../../api/types';

export interface Palette {
  /** фон главной статьи и плашек иконок */
  bg: string;
  /** цвет иконок и тега */
  fg: string;
}

export const SEGMENT_PALETTE: Record<FeedSegment, Palette> = {
  retail: { bg: '#FFF1E8', fg: '#C2410C' },
  services: { bg: '#EBF2FF', fg: '#1D5FC7' },
  production: { bg: '#E7F5EC', fg: '#13792A' },
  general: { bg: '#FDECEA', fg: '#D4291D' },
};

/** После отказа советы выделены жёлтым — как предупреждение, а не как реклама. */
export const REJECTED_PALETTE: Palette = { bg: '#FFF4DA', fg: '#8A5800' };

const TAG_ICONS: Record<string, LucideIcon> = {
  'Оборотные средства': ShoppingBag,
  Аналитика: BarChart3,
  Планирование: CalendarDays,
  Кредиты: Landmark,
  Закупки: Truck,
  'Кассовый разрыв': Timer,
  Расчёты: Receipt,
  Управление: Users,
  Финансы: PiggyBank,
  Оборудование: Factory,
  Операции: Wrench,
  Словарь: BookOpen,
  'Повысить шансы': TrendingUp,
};

export function iconForTag(tag: string): LucideIcon {
  return TAG_ICONS[tag] ?? Newspaper;
}
