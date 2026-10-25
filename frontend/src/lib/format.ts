// Форматирование чисел и дат для интерфейса (русская локаль).

const NBSP = ' ';

/** 10000000 → «10 000 000» (неразрывные пробелы, чтобы число не переносилось). */
export function formatNumber(value: number): string {
  const sign = value < 0 ? '−' : '';
  const digits = Math.abs(Math.round(value)).toString();
  return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}

/** 10000000 → «10 000 000 ₽». */
export function formatRub(value: number): string {
  return `${formatNumber(value)}${NBSP}₽`;
}

/** 10000000 → «10 млн ₽», 2500000 → «2,5 млн ₽», 750000 → «750 тыс. ₽». */
export function formatRubShort(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    const millions = Math.round((value / 1_000_000) * 10) / 10;
    return `${millions.toString().replace('.', ',')}${NBSP}млн${NBSP}₽`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${formatNumber(value / 1_000)}${NBSP}тыс.${NBSP}₽`;
  }
  return formatRub(value);
}

/** 19 → «19%», 21.5 → «21,5%». */
export function formatPercent(value: number): string {
  return `${value.toString().replace('.', ',')}%`;
}

/** Склонение: plural(3, ['месяц', 'месяца', 'месяцев']) → «месяца». */
export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

/** 36 → «36 месяцев». */
export function formatMonths(n: number): string {
  return `${n}${NBSP}${plural(n, ['месяц', 'месяца', 'месяцев'])}`;
}

/** «2027-01-24» → «24 января 2027». */
export function formatDate(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  return `${d} ${months[m - 1]} ${y}`;
}

/** Инициалы для аватара: «ООО «Альфа Ритейл»» → «АР», «ИП Иванов» → «ИИ». */
export function initials(name: string): string {
  const words = name.replace(/[«»"]/g, '').split(/\s+/).filter((w) => w && !['ООО', 'АО', 'ПАО', 'ЗАО'].includes(w));
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—';
}

/** Убирает всё, кроме цифр (для полей ИНН и сумм). */
export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}
