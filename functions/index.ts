import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as Papa from 'papaparse';
import Busboy from 'busboy';

// Initialize the Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

// Firestore instance (used in some legacy paths, kept for compatibility)
// const db = admin.firestore();

// Helper function to escape CSV fields that might contain commas, quotes, or newlines
function escapeCsvField(field: string): string {
  if (field === null || field === undefined) {
    return '';
  }
  const fieldStr = String(field);
  if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
    return `"${fieldStr.replace(/"/g, '""')}"`;
  }
  return fieldStr;
}

// Helper: simple timeout wrapper for fetch
async function fetchWithTimeout(resource: string, options: any = {}, timeoutMs = 8000): Promise<any> {
  const f: any = (globalThis as any).fetch;
  return await Promise.race([
    f(resource, options || {}),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
  ]);
}

// Helper: modest concurrency limiter
function pLimit(concurrency: number) {
  let activeCount = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    activeCount--;
    if (queue.length > 0) queue.shift()!();
  };
  const run = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (activeCount >= concurrency) {
      await new Promise<void>(resolve => queue.push(resolve));
    }
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
  return run;
}

// Helper to traverse mocked Firestore layers used in tests and real Firestore
function walkLayer(layer: any, segments: any[]): any {
  let cur: any = layer;
  for (const seg of segments) {
    // Unwrap one level if cur is a function returning the next callable
    if (typeof cur === 'function') cur = cur();
    if (typeof cur === 'function') {
      cur = cur(seg);
      continue;
    }
    if (cur && typeof cur.collection === 'function') {
      cur = cur.collection(seg);
      continue;
    }
    if (cur && typeof cur.doc === 'function') {
      cur = cur.doc(seg);
      continue;
    }
  }
  if (typeof cur === 'function') cur = cur();
  return cur;
}

// Types for enrichment
interface EnrichedItem {
  tmdbId: number | string;
  imdbId: string;
  name: string;
  year: string;
  mediaType: 'movie' | 'tv';
  tmdbRating: string; // decimal string
  imdbRating: string; // decimal string or ''
  tmdbVotes: string; // integer string
  imdbVotes: string; // integer string or ''
}

async function fetchTmdbExternalIds(mediaType: 'movie' | 'tv', tmdbId: number | string, apiKey?: string): Promise<{ imdb_id?: string } | null> {
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${apiKey}`;
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    return await (res.json() as Promise<any>);
  } catch {
    return null;
  }
}

async function fetchTmdbDetails(mediaType: 'movie' | 'tv', tmdbId: number | string, apiKey?: string): Promise<{ vote_average?: number; vote_count?: number } | null> {
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    return await (res.json() as Promise<any>);
  } catch {
    return null;
  }
}

/**
 * Configuration accessor for IMDb API base URL.
 * Required for IMDb rating lookups during CSV export.
 * 
 * DEVNOTE: Set IMDB_API_BASE_URL in your environment:
 * - Local: Add to .env or .runtimeconfig.json
 * - Staging/Prod: Use Firebase Functions config or Cloud Console
 * - Example: firebase functions:config:set imdb.api_base_url="https://api.imdbapi.dev"
 * 
 * @returns {string} The IMDb API base URL
 * @throws {Error} If IMDB_API_BASE_URL is not configured
 */
function getImdbApiBaseUrl(): string {
  const baseUrl = process.env.IMDB_API_BASE_URL;
  
  if (!baseUrl) {
    const errorMsg = 'IMDB_API_BASE_URL environment variable is not configured. IMDb ratings will be unavailable.';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  return baseUrl.replace(/\/$/, ''); // Remove trailing slash
}

async function fetchImdbRatings(imdbId: string): Promise<{ rating?: number; votes?: number } | null> {
  if (!imdbId) return null;
  
  try {
    const base = getImdbApiBaseUrl();
    const url = `${base}/titles/${imdbId}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const data: any = await res.json();
    const rating = data?.rating ?? data?.ratings?.imdb ?? data?.ratingAverage;
    const votes = data?.votes ?? data?.ratingsCount ?? data?.imdbVotes;
    return {
      rating: typeof rating === 'number' ? rating : (typeof rating === 'string' ? parseFloat(rating) : undefined),
      votes: typeof votes === 'number' ? votes : (typeof votes === 'string' ? parseInt(votes.replace(/[,]/g, ''), 10) : undefined)
    };
  } catch (err) {
    // If IMDB_API_BASE_URL not configured, log once and return null (graceful degradation)
    if (err instanceof Error && err.message.includes('IMDB_API_BASE_URL')) {
      console.warn('IMDb ratings unavailable - IMDB_API_BASE_URL not configured');
      return null;
    }
    console.error(`fetchImdbRatings error for ${imdbId}:`, err);
    return null;
  }
}

function deriveMediaType(item: any): 'movie' | 'tv' {
  if (item?.media_type === 'tv') return 'tv';
  if (item?.media_type === 'movie') return 'movie';
  if (item?.first_air_date) return 'tv';
  return 'movie';
}

function deriveName(item: any, mediaType: 'movie' | 'tv'): string {
  return mediaType === 'movie' ? (item?.title || item?.name || '') : (item?.name || item?.title || '');
}

function deriveYear(item: any, mediaType: 'movie' | 'tv'): string {
  const dateStr = mediaType === 'movie' ? (item?.release_date || item?.first_air_date) : (item?.first_air_date || item?.release_date);
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : String(d.getUTCFullYear());
}

async function enrichItem(item: any, tmdbApiKey?: string): Promise<EnrichedItem> {
  const tmdbId = item?.id ?? item?.tmdbId ?? item?.tmdb_id;
  const mediaType = deriveMediaType(item);
  const name = deriveName(item, mediaType);
  const year = deriveYear(item, mediaType);

  let imdbId = '';
  let tmdbRating: string = '';
  let tmdbVotes: string = '';
  let imdbRating: string = '';
  let imdbVotes: string = '';

  const [ext, details] = await Promise.all([
    fetchTmdbExternalIds(mediaType, tmdbId, tmdbApiKey),
    fetchTmdbDetails(mediaType, tmdbId, tmdbApiKey)
  ]);

  if (ext?.imdb_id) imdbId = ext.imdb_id;

  if (details) {
    const va = details.vote_average;
    const vc = details.vote_count;
    if (typeof va === 'number') tmdbRating = va.toFixed(1).replace(/\.0$/, '.0');
    if (typeof vc === 'number') tmdbVotes = String(vc);
  }

  // Fallback to fields present on the item if TMDB fetch not available
  if (!tmdbRating && typeof item?.vote_average === 'number') {
    tmdbRating = item.vote_average.toFixed(1).replace(/\.0$/, '.0');
  }
  if (!tmdbVotes && typeof item?.vote_count === 'number') {
    tmdbVotes = String(item.vote_count);
  }

  if (imdbId) {
    const imdb = await fetchImdbRatings(imdbId);
    if (imdb) {
      if (typeof imdb.rating === 'number') imdbRating = imdb.rating.toFixed(1).replace(/\.0$/, '.0');
      if (typeof imdb.votes === 'number') imdbVotes = String(imdb.votes);
    }
  }

  return { tmdbId, imdbId, name, year, mediaType, tmdbRating, imdbRating, tmdbVotes, imdbVotes };
}


// Unified export endpoint: GET /lists/{listId}/export, supports custom lists and 'watchlist'
export const listsExport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParts = req.path.split('/').filter(Boolean);
  const listsIndex = pathParts.indexOf('lists');
  const exportIndex = pathParts.indexOf('export');
  if (listsIndex === -1 || exportIndex === -1 || exportIndex !== listsIndex + 2) {
    res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/export' });
    return;
  }
  const listId = pathParts[listsIndex + 1];
  if (!listId) {
    res.status(400).json({ error: 'List ID is required' });
    return;
  }

  const authHeader = req.headers.authorization || req.headers.Authorization as string;
  if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    return;
  }

  const token = String(authHeader).substring(7);
  let decodedToken: admin.auth.DecodedIdToken;
  try {
    decodedToken = await admin.auth().verifyIdToken(token);
  } catch {
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }
  const uid = decodedToken.uid;

  let itemsSnapshot: any = null;
  let listName = 'Watchlist';

  const dbi: any = admin.firestore();
  const users = dbi.collection ? dbi.collection('users') : dbi;

  if (listId === 'watchlist') {
    const wlColl: any = walkLayer(users, [uid, 'watchlist']);
    itemsSnapshot = await wlColl.get();
  } else {
    const listRef: any = walkLayer(users, [uid, 'custom_lists', listId]);
    const listDoc = await listRef.get();
    if (!listDoc.exists) { res.status(404).json({ error: 'List not found' }); return; }
    const data = listDoc.data();
    if (!data || data.ownerId !== uid) { res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' }); return; }
    listName = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : listId;
    const itemsColl: any = listRef.collection ? listRef.collection('items') : walkLayer(listRef, ['items']);
    itemsSnapshot = await itemsColl.get();
  }

  if (!itemsSnapshot || itemsSnapshot.empty) {
    res.set('Cache-Control', 'no-cache');
    res.status(204).end();
    return;
  }

  const tmdbApiKey = process.env.TMDB_API_KEY;
  const limit = pLimit(8);
  const enriched: EnrichedItem[] = await Promise.all(
    (itemsSnapshot.docs as any[]).map((d: any) => d.data()).map((item: any) =>
      limit(() => enrichItem(item, tmdbApiKey))
    )
  );

  // CSV header per contract
  const header = 'tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes';
  const rows = enriched.map(r => [
    escapeCsvField(String(r.tmdbId ?? '')),
    escapeCsvField(r.imdbId || ''),
    escapeCsvField(r.name || ''),
    escapeCsvField(r.year || ''),
    escapeCsvField(r.mediaType || ''),
    escapeCsvField(r.tmdbRating || ''),
    escapeCsvField(r.imdbRating || ''),
    escapeCsvField(r.tmdbVotes || ''),
    escapeCsvField(r.imdbVotes || '')
  ].join(','));

  const csv = [header, ...rows].join('\n');

  // Headers
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, '0');
  const d = String(now.getUTCDate()).padStart(2, '0');
  const dateStr = `${y}${m}${d}`;
  const safeName = (listId === 'watchlist' ? 'Watchlist' : listName).replace(/[\n\r]/g, ' ').trim();
  const filename = `${safeName}-${dateStr}.csv`;

  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', `attachment; filename="${filename}"`);
  res.set('Cache-Control', 'no-cache');
  res.status(200).send(csv);
  return;
});

// Interface for analysis result with new schema
interface AnalysisResult {
  matched: Array<{
    movie: {
      id: number;
      title: string;
      release_date?: string;
      first_air_date?: string;
      media_type: 'movie' | 'tv';
      poster_path?: string;
    };
    originalRow: any;
  }>;
  unmatched: Array<{
    row: any;
    reason: string;
  }>;
  duplicates: Array<{
    movie: {
      id: number;
      title: string;
      release_date?: string;
      first_air_date?: string;
      media_type: 'movie' | 'tv';
      poster_path?: string;
    };
    originalRow: any;
  }>;
}

/**
 * Analyzes a CSV file for import to a user's movie list
 * Route: POST /lists/{listId}/import/analyze
 * Enforces new CSV schema: tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes
 */
export const analyzeListImport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const pathParts = req.path.split('/').filter(Boolean);
    const listsIndex = pathParts.indexOf('lists');
    const importIndex = pathParts.indexOf('import');
    const analyzeIndex = pathParts.indexOf('analyze');
    if (listsIndex === -1 || importIndex === -1 || analyzeIndex === -1 || analyzeIndex !== importIndex + 1 || listsIndex + 1 >= pathParts.length) {
      res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/import/analyze' });
      return;
    }
    const listId = pathParts[listsIndex + 1];

    const authHeader = req.headers.authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' }); return; }
    const token = String(authHeader).substring(7);
    let decodedToken; try { decodedToken = await admin.auth().verifyIdToken(token); } catch { res.status(401).json({ error: 'Unauthorized: Invalid token' }); return; }
    const uid = decodedToken.uid;

    let itemsCollectionRef: any;
    if (listId === 'watchlist') {
      itemsCollectionRef = admin.firestore().collection('users').doc(uid).collection('watchlist');
    } else {
      const listRef = admin.firestore().collection('users').doc(uid).collection('custom_lists').doc(listId);
      const listDoc = await listRef.get();
      if (!listDoc.exists) { res.status(404).json({ error: 'List not found' }); return; }
      const listData = listDoc.data();
      if (!listData || listData.ownerId !== uid) { res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' }); return; }
      itemsCollectionRef = listRef.collection('items');
    }

    const contentType = (req.headers['content-type'] || req.headers['Content-Type']) as string | undefined;
    if (!contentType || !contentType.includes('multipart/form-data')) { res.status(400).json({ error: 'Content-Type must be multipart/form-data' }); return; }

    const EXPECTED_HEADERS = ['tmdbId','imdbId','name','year','mediaType','tmdbRating','imdbRating','tmdbVotes','imdbVotes'];

    const busboy = Busboy({ headers: req.headers });
    let csvBuffer: Buffer | null = null;
    let fileCount = 0;

    busboy.on('file', (_fieldname: string, file: any, info: any) => {
      const { filename, mimeType } = info;
      if (mimeType === 'text/csv' || (filename && filename.endsWith('.csv'))) {
        fileCount++;
        const buffers: Buffer[] = [];
        file.on('data', (data: Buffer) => buffers.push(data));
        file.on('end', () => { csvBuffer = Buffer.concat(buffers); });
      } else { file.resume(); }
    });

    busboy.on('finish', async () => {
      if (!csvBuffer || fileCount !== 1) { res.status(400).json({ error: 'Exactly one CSV file is required' }); return; }
      try {
        const csvString = csvBuffer.toString('utf8');
        const parsed: any = Papa.parse(csvString, { header: true, skipEmptyLines: true });
        const fields: string[] = parsed?.meta?.fields || [];
        
        if (fields.length !== EXPECTED_HEADERS.length || !fields.every((f, i) => f === EXPECTED_HEADERS[i])) {
          if (fields.includes('Letterboxd URI') || fields.includes('Name') || (fields.includes('Year') && !fields.includes('year'))) {
            res.status(400).json({ error: 'Legacy CSV headers detected. Expected: ' + EXPECTED_HEADERS.join(',') });
            return;
          }
          res.status(400).json({ error: 'Invalid CSV headers. Expected exact columns: ' + EXPECTED_HEADERS.join(',') });
          return;
        }

        const existingSnapshot = await itemsCollectionRef.get();
        const existingById = new Map<string, any>();
        const existingByNameYear = new Set<string>();
        existingSnapshot.docs.forEach((d: any) => {
          const it = d.data();
          if (it?.id) existingById.set(String(it.id), it);
          const n = (it?.title || it?.name || '').trim();
          const y = (it?.release_date || it?.first_air_date || '').slice(0,4);
          if (n && y) existingByNameYear.add(`${n}::${y}`);
        });

        const tmdbApiKey = process.env.TMDB_API_KEY;
        const limit = pLimit(6);

        async function tmdbFindByImdb(imdbId: string, mt: 'movie'|'tv'): Promise<any|null> {
          if (!tmdbApiKey || !imdbId) return null;
          const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${tmdbApiKey}&external_source=imdb_id`;
          try {
            const r = await fetchWithTimeout(url, {}, 8000);
            if (!r.ok) return null;
            const j: any = await r.json();
            const arr = mt === 'movie' ? j?.movie_results : j?.tv_results;
            return Array.isArray(arr) && arr[0] ? arr[0] : null;
          } catch { return null; }
        }

        async function tmdbSearchByNameYear(name: string, year: string, mt: 'movie'|'tv'): Promise<any|null> {
          if (!tmdbApiKey || !name) return null;
          const base = `https://api.themoviedb.org/3/search/${mt}`;
          const q = new URLSearchParams({ api_key: String(tmdbApiKey), query: name });
          if (year) q.set(mt === 'movie' ? 'year' : 'first_air_date_year', year);
          const url = `${base}?${q.toString()}`;
          try {
            const r = await fetchWithTimeout(url, {}, 8000);
            if (!r.ok) return null;
            const j: any = await r.json();
            return Array.isArray(j?.results) && j.results[0] ? j.results[0] : null;
          } catch { return null; }
        }

        async function tmdbDetails(mt: 'movie'|'tv', id: string|number): Promise<any|null> {
          if (!tmdbApiKey || !id) return null;
          const url = `https://api.themoviedb.org/3/${mt}/${id}?api_key=${tmdbApiKey}`;
          try { const r = await fetchWithTimeout(url, {}, 8000); if (!r.ok) return null; return await r.json(); } catch { return null; }
        }

        const rows: any[] = parsed.data as any[];
        const result: AnalysisResult = { matched: [], unmatched: [], duplicates: [] };

        await Promise.all(rows.map((row) => limit(async () => {
          const tmdbIdRaw = String(row.tmdbId || '').trim();
          const imdbIdRaw = String(row.imdbId || '').trim();
          const name = String(row.name || '').trim();
          const year = String(row.year || '').trim();
          const mt = (String(row.mediaType || '').trim() === 'tv') ? 'tv' : 'movie';

          if (tmdbIdRaw && existingById.has(tmdbIdRaw)) {
            const it = existingById.get(tmdbIdRaw);
            result.duplicates.push({ movie: { id: it.id, title: it.title||it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row });
            return;
          }
          if (!tmdbIdRaw && name && year && existingByNameYear.has(`${name}::${year}`)) {
            const it = [...existingById.values()].find((v: any) => (v.title||v.name)===name && (v.release_date||v.first_air_date||'').startsWith(year));
            if (it) { result.duplicates.push({ movie: { id: it.id, title: it.title||it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row }); return; }
          }

          let resolved: any = null;
          if (tmdbIdRaw) {
            resolved = await tmdbDetails(mt, tmdbIdRaw);
          } else if (imdbIdRaw) {
            const found = await tmdbFindByImdb(imdbIdRaw, mt);
            if (found?.id) resolved = await tmdbDetails(mt, found.id);
          } else if (name) {
            const found = await tmdbSearchByNameYear(name, year, mt);
            if (found?.id) resolved = await tmdbDetails(mt, found.id);
          }

          if (resolved?.id) {
            result.matched.push({ movie: { id: resolved.id, title: resolved.title || resolved.name, release_date: resolved.release_date, first_air_date: resolved.first_air_date, media_type: mt, poster_path: resolved.poster_path }, originalRow: row });
          } else {
            result.unmatched.push({ row, reason: 'Not found in TMDB' });
          }
        })));

        res.status(200).json(result);
        return;
      } catch (parseError) {
        console.error('Error parsing CSV:', parseError);
        res.status(400).json({ error: 'Invalid CSV format' });
        return;
      }
    });

    req.pipe(busboy);
  } catch (error) {
    console.error('Error analyzing CSV for import:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});
/**
 * Confirms the import of selected movies to a user's movie list
 * Route: POST /lists/{listId}/import/confirm
 * Fetches real TMDB details and writes to Firestore with idempotency
 */
export const confirmListImport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }
  try {
    const pathParts = req.path.split('/').filter(Boolean);
    const listsIndex = pathParts.indexOf('lists');
    const importIndex = pathParts.indexOf('import');
    const confirmIndex = pathParts.indexOf('confirm');
    if (listsIndex === -1 || importIndex === -1 || confirmIndex === -1 || confirmIndex !== importIndex + 1 || listsIndex + 1 >= pathParts.length) {
      res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/import/confirm' });
      return;
    }
    const listId = pathParts[listsIndex + 1];

    const authHeader = req.headers.authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) { res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' }); return; }
    const token = String(authHeader).substring(7);
    let decodedToken; try { decodedToken = await admin.auth().verifyIdToken(token); } catch { res.status(401).json({ error: 'Unauthorized: Invalid token' }); return; }
    const uid = decodedToken.uid;

    let itemsCollectionRef: any;
    if (listId === 'watchlist') {
      itemsCollectionRef = admin.firestore().collection('users').doc(uid).collection('watchlist');
    } else {
      const listRef = admin.firestore().collection('users').doc(uid).collection('custom_lists').doc(listId);
      const listDoc = await listRef.get();
      if (!listDoc.exists) { res.status(404).json({ error: 'List not found' }); return; }
      const data = listDoc.data();
      if (!data || data.ownerId !== uid) { res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' }); return; }
      itemsCollectionRef = listRef.collection('items');
    }

    const { moviesToImport } = req.body || {};
    if (!Array.isArray(moviesToImport)) { res.status(400).json({ error: 'Request body must contain an array of moviesToImport' }); return; }
    if (moviesToImport.length === 0) { res.status(201).json({ success: true, moviesAdded: 0, message: 'No movies to import' }); return; }

    const existingSnapshot = await itemsCollectionRef.get();
    const existing = new Set(existingSnapshot.docs.map((d: any) => String((d.data()||{}).id)));

    const tmdbApiKey = process.env.TMDB_API_KEY;
    async function fetchDetailsTryBoth(id: string): Promise<{ ok: boolean; data?: any; media_type?: 'movie'|'tv' }> {
      if (!tmdbApiKey) return { ok: false };
      const mUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`;
      const tUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`;
      try { const r = await fetchWithTimeout(mUrl, {}, 8000); if (r.ok) { const j = await r.json(); return { ok: true, data: j, media_type: 'movie' }; } } catch {}
      try { const r = await fetchWithTimeout(tUrl, {}, 8000); if (r.ok) { const j = await r.json(); return { ok: true, data: j, media_type: 'tv' }; } } catch {}
      return { ok: false };
    }

    const batch = admin.firestore().batch();
    let moviesAdded = 0;
    for (const rawId of moviesToImport) {
      const id = String(rawId);
      if (existing.has(id)) continue;
      const det = await fetchDetailsTryBoth(id);
      if (!det.ok || !det.data?.id) continue;
      const payload = {
        id: det.data.id,
        title: det.data.title || det.data.name,
        poster_path: det.data.poster_path,
        release_date: det.data.release_date || det.data.first_air_date,
        vote_average: det.data.vote_average,
        media_type: det.media_type,
        dateAdded: admin.firestore.FieldValue.serverTimestamp(),
      };
      const docRef = itemsCollectionRef.doc(String(det.data.id));
      batch.set(docRef, payload, { merge: true });
      moviesAdded++;
    }
    if (moviesAdded > 0) await batch.commit();
    res.status(201).json({ success: true, moviesAdded, message: `${moviesAdded} items successfully added to the list` });
    return;
  } catch (error) {
    console.error('Error confirming list import:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// ==================== TV SHOW API PROXY ENDPOINTS ====================

// Simple in-memory cache for TV show data
const tvCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function getCached(key: string): any | null {
  const entry = tvCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    tvCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: any): void {
  tvCache.set(key, { data, timestamp: Date.now() });
}

/**
 * GET /api/tv/:tvId
 * Fetches TV show details with optional IMDb enrichment
 */
export const getTvDetails = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const tvId = req.path.split('/').pop();
  if (!tvId) {
    res.status(400).json({ error: 'TV ID is required' });
    return;
  }

  const cacheKey = `tv_details_${tvId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${tmdbApiKey}&append_to_response=external_ids,images&include_image_language=en,null`;
    const response = await fetchWithTimeout(url, {}, 15000);
    
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch TV show details' });
      return;
    }

    const data: any = await response.json();
    
    // Normalize to stable shape
    const normalized: any = {
      id: data.id,
      name: data.name,
      overview: data.overview,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      firstAirDate: data.first_air_date,
      lastAirDate: data.last_air_date,
      status: data.status,
      numberOfSeasons: data.number_of_seasons,
      numberOfEpisodes: data.number_of_episodes,
      genres: data.genres?.map((g: any) => ({ id: g.id, name: g.name })) || [],
      networks: data.networks?.map((n: any) => ({ id: n.id, name: n.name, logoPath: n.logo_path })) || [],
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      logos: data.images?.logos?.map((l: any) => ({ filePath: l.file_path, aspectRatio: l.aspect_ratio })) || [],
      imdbId: data.external_ids?.imdb_id || null,
    };

    // Optional IMDb enrichment
    if (normalized.imdbId) {
      try {
        const imdbBase = process.env.IMDB_API_BASE_URL;
        if (imdbBase) {
          const imdbUrl = `${imdbBase.replace(/\/$/, '')}/titles/${normalized.imdbId}`;
          const imdbRes = await fetchWithTimeout(imdbUrl, {}, 8000);
          if (imdbRes.ok) {
            const imdbData: any = await imdbRes.json();
            normalized.imdbRating = imdbData?.rating?.aggregateRating || imdbData?.rating || null;
            normalized.imdbVotes = imdbData?.rating?.voteCount || imdbData?.votes || null;
          }
        }
      } catch (imdbError) {
        console.warn('IMDb fetch failed, continuing without IMDb data', imdbError);
      }
    }

    setCache(cacheKey, normalized);
    res.status(200).json(normalized);
  } catch (error) {
    console.error('Error fetching TV details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tv/:tvId/seasons
 * Returns list of season metadata
 */
export const getTvSeasons = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParts = req.path.split('/').filter(Boolean);
  const tvId = pathParts[pathParts.length - 2];
  
  if (!tvId) {
    res.status(400).json({ error: 'TV ID is required' });
    return;
  }

  const cacheKey = `tv_seasons_${tvId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${tmdbApiKey}`;
    const response = await fetchWithTimeout(url, {}, 15000);
    
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch TV show' });
      return;
    }

    const data: any = await response.json();
    const seasons = data.seasons?.map((s: any) => ({
      id: s.id,
      name: s.name,
      seasonNumber: s.season_number,
      episodeCount: s.episode_count,
      airDate: s.air_date,
      posterPath: s.poster_path,
    })) || [];

    setCache(cacheKey, seasons);
    res.status(200).json(seasons);
  } catch (error) {
    console.error('Error fetching TV seasons:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tv/:tvId/season/:seasonNumber
 * Returns episodes for a specific season
 */
export const getTvSeasonEpisodes = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParts = req.path.split('/').filter(Boolean);
  const tvId = pathParts[pathParts.length - 3];
  const seasonNumber = pathParts[pathParts.length - 1];
  
  if (!tvId || !seasonNumber) {
    res.status(400).json({ error: 'TV ID and season number are required' });
    return;
  }

  const cacheKey = `tv_season_${tvId}_${seasonNumber}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${tmdbApiKey}`;
    const response = await fetchWithTimeout(url, {}, 15000);
    
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch season episodes' });
      return;
    }

    const data: any = await response.json();
    const normalized = {
      seasonNumber: data.season_number,
      name: data.name,
      overview: data.overview,
      airDate: data.air_date,
      episodes: data.episodes?.map((ep: any) => ({
        id: ep.id,
        name: ep.name,
        episodeNumber: ep.episode_number,
        seasonNumber: ep.season_number,
        overview: ep.overview,
        stillPath: ep.still_path,
        airDate: ep.air_date,
        runtime: ep.runtime,
        voteAverage: ep.vote_average,
        voteCount: ep.vote_count,
      })) || [],
    };

    setCache(cacheKey, normalized);
    res.status(200).json(normalized);
  } catch (error) {
    console.error('Error fetching season episodes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/tv/:tvId/videos
 * Returns trailers and videos for a TV show
 */
export const getTvVideos = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }
  
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParts = req.path.split('/').filter(Boolean);
  const tvId = pathParts[pathParts.length - 2];
  
  if (!tvId) {
    res.status(400).json({ error: 'TV ID is required' });
    return;
  }

  const cacheKey = `tv_videos_${tvId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}/videos?api_key=${tmdbApiKey}`;
    const response = await fetchWithTimeout(url, {}, 15000);
    
    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch videos' });
      return;
    }

    const data: any = await response.json();
    const videos = data.results?.map((v: any) => ({
      id: v.id,
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type,
      official: v.official,
    })) || [];

    setCache(cacheKey, videos);
    res.status(200).json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export all functions for Firebase to recognize them
