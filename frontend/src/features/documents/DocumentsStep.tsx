import { useState } from 'react';
import type { Application } from '../../api/types';
import { Button } from '../../components/ui/Button';
import { StepHeading } from '../../components/ui/Panel';
import { useStore } from '../../state/context';
import { useAuth } from '../auth/context';
import { uploadDocument, downloadDocument } from './documentApi';

export function DocumentsStep({ app }: { app: Application }) {
  const { dispatch } = useStore();
  const { user } = useAuth();
  const documents = app.requested_documents ?? [];
  const [kind, setKind] = useState(documents.find(d => !d.uploaded)?.kind ?? documents[0]?.kind ?? '');
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return <div>
    <StepHeading title="Банк запросил документы" lead="Сейчас ваш ход. После загрузки полного списка повторим проверки." />
    <ul className="mt-6 space-y-3">{documents.map(item => <li key={item.kind} className="rounded-xl bg-surface p-4">
      {item.uploaded ? '✓' : '○'} {item.kind}
      {item.document_id !== null && <button className="ml-3 text-sm underline" onClick={() => void downloadDocument(app.id, item.document_id!).catch(e => setError(e.message))}>Скачать документ</button>}
    </li>)}</ul>
    {user.role === 'client_owner' ? <form className="mt-6 space-y-4" onSubmit={e => {
      e.preventDefault(); if (!file || !consent) return;
      setSending(true); setError(null);
      void uploadDocument(app.id, kind, file, consent).then(application => dispatch({ type: 'APPLICATION_RECEIVED', application }))
        .catch(e => setError(e instanceof Error ? e.message : 'Не удалось загрузить документ'))
        .finally(() => setSending(false));
    }}>
      <label className="block">Документ<select className="mt-2 block w-full rounded-xl border border-line p-3" value={kind} onChange={e => setKind(e.target.value)}>{documents.map(d => <option key={d.kind} value={d.kind}>{d.kind}</option>)}</select></label>
      <label className="block">Файл PDF, PNG или JPEG, до 10 МБ<input className="mt-2 block w-full" type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} />Даю согласие на повторный запрос БКИ после загрузки документов</label>
      <Button type="submit" loading={sending} disabled={!file || !consent}>Загрузить документ</Button>
      <p className="text-sm text-muted">Загружайте только синтетические документы. Их содержимое не заменяет проверку настоящей выписки.</p>
    </form> : <p className="mt-6">Загрузить документы может руководитель.</p>}
    {error && <p role="alert" className="mt-4 text-accent-dark">{error}</p>}
  </div>;
}
