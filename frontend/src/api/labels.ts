// Человекопонятные названия для кодов из API. Одно место — чтобы тексты не расходились по экранам.

import type { ApplicationStatus, FeedSegment, Goal, Segment, StageCode } from './types';

/** Цвет бейджа: зелёный / жёлтый / красный / серый / синий. */
export type Tone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';

export const STATUS_META: Record<ApplicationStatus, { label: string; tone: Tone; hint: string }> = {
  DRAFT: { label: 'Черновик', tone: 'neutral', hint: 'Заполните данные и отправьте заявку.' },
  SUBMITTED: { label: 'Заявка отправлена', tone: 'info', hint: 'Банк принял заявку и начинает проверки.' },
  CHECKING_EGRUL: { label: 'Проверка в ЕГРЮЛ', tone: 'info', hint: 'Сверяем реквизиты компании с госреестром.' },
  CHECKING_BKI: { label: 'Запрос в БКИ', tone: 'info', hint: 'Запрашиваем кредитную историю в бюро.' },
  SCORING: { label: 'Скоринг', tone: 'info', hint: 'Оцениваем риск и считаем условия.' },
  APPROVED: { label: 'Одобрено', tone: 'success', hint: 'Осталось подписать договор.' },
  COUNTER_OFFER: { label: 'Встречное предложение', tone: 'warning', hint: 'Банк предлагает другую сумму — примите условия, чтобы продолжить.' },
  REJECTED: { label: 'Отказ', tone: 'danger', hint: 'Посмотрите причину и советы, как повысить шансы.' },
  OFFER_ACCEPTED: { label: 'Условия приняты', tone: 'success', hint: 'Осталось подписать договор.' },
  SIGNED: { label: 'Договор подписан', tone: 'success', hint: 'Перечисляем деньги на расчётный счёт.' },
  DISBURSED: { label: 'Кредит выдан', tone: 'success', hint: 'Деньги на расчётном счёте.' },
  NEEDS_RECHECK: { label: 'Нужна повторная проверка', tone: 'warning', hint: 'Внешний сервис временно недоступен. Повторите проверку.' },
};

export const GOALS: Record<Goal, { label: string; product: string; description: string }> = {
  working_capital: {
    label: 'Пополнение оборотных средств',
    product: 'Кредит на оборот',
    description: 'Деньги на закупку товара, зарплаты и текущие расходы бизнеса.',
  },
  equipment: {
    label: 'Покупка оборудования',
    product: 'Кредит на оборудование',
    description: 'Покупка станков, техники или транспорта. Ставка ниже, потому что оборудование ценно для бизнеса.',
  },
  cash_gap: {
    label: 'Кассовый разрыв',
    product: 'Короткий кредит на кассовый разрыв',
    description: 'Покрыть временную нехватку денег, пока клиенты не оплатили счета. Срок — до 12 месяцев.',
  },
};

export const SEGMENT_LABELS: Record<FeedSegment, string> = {
  retail: 'Для ритейла',
  services: 'Для услуг',
  production: 'Для производства',
  general: 'Для всех',
};

/** Сегмент «как говорят люди» — для подписи «Почему вы это видите». */
export const SEGMENT_NAMES: Record<Segment, string> = {
  retail: 'розничная торговля',
  services: 'услуги',
  production: 'производство',
};

export const STAGE_TITLES: Record<StageCode, string> = {
  egrul: 'Проверка реквизитов в ЕГРЮЛ',
  bki: 'Запрос кредитной истории в БКИ',
  scoring: 'Финансовый скоринг риска',
};

export const CREDIT_HISTORY_LABELS = {
  excellent: 'Отличная',
  fair: 'Средняя',
  poor: 'Плохая',
} as const;
