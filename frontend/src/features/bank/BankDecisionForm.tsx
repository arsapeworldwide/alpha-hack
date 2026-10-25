import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { annuityPayment } from '../../lib/annuity';
import { formatRub } from '../../lib/format';
import type { BankApplication } from './bankTypes';

export interface BankAction { action: 'approve' | 'reject' | 'counter' | 'request_info'; comment: string; amount?: number; term_months?: number; checklist?: string[] }

export function BankDecisionForm({ app, onDecision, sending }: { app: BankApplication; onDecision: (data: BankAction) => void; sending: boolean }) {
  const [comment, setComment] = useState('');
  const [amount, setAmount] = useState(app.decision?.approved_amount ?? app.requested_amount);
  const [term, setTerm] = useState(app.decision?.term_months ?? app.term_months);
  const [checklist, setChecklist] = useState('Выписка по расчётному счёту');
  const recommendation = app.system_recommendation;
  const reviewable = ['APPROVED', 'COUNTER_OFFER', 'REJECTED', 'NEEDS_RECHECK', 'MANUAL_REVIEW'].includes(app.status);
  const canApprove = reviewable && recommendation !== null && recommendation.score >= 45;
  const rate = app.decision?.rate ?? recommendation?.rate ?? app.policy_rate;
  const capacity = recommendation?.capacity ?? 0;
  const excess = rate == null ? 0 : Math.max(0, Math.round(annuityPayment(app.requested_amount, rate, app.term_months)) - capacity);
  const counterExcess = rate == null ? 0 : Math.max(0, Math.round(annuityPayment(amount, rate, term)) - capacity);
  const maxTerm = app.goal === 'cash_gap' ? 12 : 36;
  const validCounter = Number.isInteger(amount) && amount >= 300000 && amount <= 15000000 && Number.isInteger(term) && term >= 3 && term <= maxTerm;
  const justified = comment.trim().length > 0;
  return <div className="mt-8 rounded-2xl border border-line p-6">
    <h3 className="text-xl font-bold">Решение сотрудника</h3>
    <label className="mt-4 block text-sm font-semibold">Комментарий клиенту<textarea maxLength={500} value={comment} onChange={e => setComment(e.target.value)} className="mt-2 block w-full rounded-xl bg-surface p-3 font-normal" /></label>
    {excess > 0 && <p role="status" className="mt-3 rounded-xl bg-[#fff1d6] p-3 text-sm">Исходная сумма превышает платёжную способность на {formatRub(excess)}/мес. Для одобрения обязательно обоснование.</p>}
    <div className="mt-4 flex flex-wrap gap-3"><Button disabled={!canApprove || sending || (excess > 0 && !justified)} onClick={() => onDecision({ action: 'approve', comment })}>Одобрить</Button><Button variant="secondary" disabled={!reviewable || sending} onClick={() => onDecision({ action: 'reject', comment })}>Отказать</Button></div>
    <p className="mt-3 text-sm text-muted">Оценка ниже 45 или незавершённый скоринг не позволяют одобрить кредит.</p>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Сумма предложения, ₽<input aria-label="Сумма предложения" type="number" min={300000} max={15000000} step={100000} value={amount} onChange={e => setAmount(Number(e.target.value))} className="mt-2 block w-full rounded-xl bg-surface p-3" /></label>
      <label className="text-sm">Срок предложения, мес.<input aria-label="Срок предложения" type="number" min={3} max={maxTerm} value={term} onChange={e => setTerm(Number(e.target.value))} className="mt-2 block w-full rounded-xl bg-surface p-3" /></label>
    </div>
    {counterExcess > 0 && <p className="mt-3 text-sm text-[#8a5800]">Другие условия превышают платёжную способность на {formatRub(counterExcess)}/мес. Нужно обоснование.</p>}
    <Button className="mt-4" variant="secondary" disabled={!canApprove || sending || !validCounter || (counterExcess > 0 && !justified)} onClick={() => onDecision({ action: 'counter', amount, term_months: term, comment })}>Предложить другие условия</Button>
    <label className="mt-6 block text-sm">Документы (по одному названию в строке)<textarea aria-label="Запрашиваемые документы" maxLength={2000} value={checklist} onChange={e => setChecklist(e.target.value)} className="mt-2 block w-full rounded-xl bg-surface p-3" /></label>
    <Button className="mt-3" variant="secondary" disabled={!reviewable || sending || !checklist.trim()} onClick={() => onDecision({ action: 'request_info', checklist: checklist.split('\n').map(s => s.trim()).filter(Boolean), comment })}>Запросить документы</Button>
  </div>;
}
