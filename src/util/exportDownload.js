import { getAuth } from 'firebase/auth';
import { notifyInfo, notifyError } from './notify';

function parseFilenameFromContentDisposition(header) {
  if (!header) return null;
  try {
    // e.g., attachment; filename="Name-YYYYMMDD.csv"
    const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(header);
    const value = decodeURIComponent(match?.[1] || match?.[2] || '').trim();
    return value || null;
  } catch {
    return null;
  }
}

function utcDateYYYYMMDD() {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function buildFallbackFilename(listId, listName) {
  const base = listId === 'watchlist' ? 'Watchlist' : (listName || 'List');
  return `${base}-${utcDateYYYYMMDD()}.csv`;
}

export async function exportListCsv(listId, listName) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) {
    notifyError('Please sign in to export.');
    return { ok: false, status: 401 };
  }
  const token = await user.getIdToken(/* forceRefresh */ true);

  const resp = await fetch(`/lists/${encodeURIComponent(listId)}/export`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (resp.status === 204) {
    notifyInfo('No items to export');
    return { ok: false, status: 204 };
  }
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    notifyError(`Export failed (${resp.status}). ${text || 'Try again.'}`);
    return { ok: false, status: resp.status };
  }

  const blob = await resp.blob();
  const cd = resp.headers.get('Content-Disposition');
  const headerName = parseFilenameFromContentDisposition(cd);
  const filename = headerName || buildFallbackFilename(listId, listName);

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);

  return { ok: true, status: 200, filename };
}
