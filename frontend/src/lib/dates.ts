// Работа с календарными датами без часовых поясов (формат YYYY-MM-DD).

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/** Дата в формате YYYY-MM-DD по местному времени. */
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Прибавляет календарные месяцы. Если такого дня нет, берётся последний день месяца:
 * 30.11 + 3 мес → 28.02 (или 29.02). Так же договорились с бэкендом (BACKEND_PLAN.md).
 */
export function addMonths(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const targetMonthIndex = m - 1 + months;
  const year = y + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(year, month + 1, 0).getDate();
  return `${year}-${pad(month + 1)}-${pad(Math.min(d, lastDay))}`;
}
