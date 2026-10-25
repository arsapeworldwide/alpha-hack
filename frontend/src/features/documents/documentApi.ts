import { baseUrl, sessionToken } from '../../api/sessionApi';
import { ApiError } from '../../api/types';

export async function downloadDocument(applicationId: string, documentId: number, bank = false) {
  const response = await fetch(`${baseUrl}/${bank ? 'bank/' : ''}applications/${applicationId}/documents/${documentId}`, { headers: { Authorization: `Bearer ${sessionToken()}` } });
  if (!response.ok) throw new Error('Документ недоступен. Проверьте права доступа.');
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = `document-${documentId}`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function uploadDocument(applicationId: string, kind: string, file: File, consent: boolean) {
  if (file.size > 10 * 1024 * 1024) throw new Error('Размер документа не более 10 МБ.');
  const body = new FormData();
  body.append('kind', kind); body.append('file', file); body.append('consent', String(consent));
  const response = await fetch(`${baseUrl}/applications/${applicationId}/documents`, { method: 'POST', body, headers: { Authorization: `Bearer ${sessionToken()}` }, signal: AbortSignal.timeout(30000) });
  const data = await response.json().catch(() => ({ code: 'NETWORK_ERROR', message: 'Документ не загружен. Проверьте размер и доступность сервера.', details: {} }));
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
