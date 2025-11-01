import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as Papa from 'papaparse';
import Busboy from 'busboy';

// Initialize the Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

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

async function fetchImdbRatings(imdbId: string): Promise<{ rating?: number; votes?: number } | null> {
  if (!imdbId) return null;
  const base = (process.env.IMDB_API_BASE_URL || 'https://api.imdbapi.dev').replace(/\/$/, '');
  const url = `${base}/titles/${imdbId}`;
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const data: any = await res.json();
    const rating = data?.rating ?? data?.ratings?.imdb ?? data?.ratingAverage;
    const votes = data?.votes ?? data?.ratingsCount ?? data?.imdbVotes;
    return {
      rating: typeof rating === 'number' ? rating : (typeof rating === 'string' ? parseFloat(rating) : undefined),
      votes: typeof votes === 'number' ? votes : (typeof votes === 'string' ? parseInt(votes.replace(/[,]/g, ''), 10) : undefined)
    };
  } catch {
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

// Interface for movie data
interface MovieData {
  id: number;
  title: string;
  release_date: string;
  tmdbId: number;
}

// Interface for CSV row
interface CsvRow {
  tmdbId: string;
  Name: string;
  Year: string;
  'Letterboxd URI'?: string;
}

// Interface for analysis result
interface AnalysisResult {
  matched: Array<{
    movie: MovieData;
    originalRow: CsvRow;
  }>;
  unmatched: Array<{
    row: CsvRow;
    reason: string;
  }>;
  duplicates: Array<{
    movie: MovieData;
    originalRow: CsvRow;
  }>;
}

// Mock TMDB API service - in a real implementation, this would call the actual TMDB API
async function findMovieByTmdbId(tmdbId: string): Promise<MovieData | null> {
  // This is a mock implementation that returns a dummy movie if tmdbId is provided
  // In a real implementation, this would make a call to the TMDB API
  if (!tmdbId || isNaN(Number(tmdbId))) {
    return null;
  }
  
  // Return a mock movie object
  return {
    id: parseInt(tmdbId),
    title: `Mock Movie ${tmdbId}`,
    release_date: `2020-01-01`,
    tmdbId: parseInt(tmdbId)
  };
}

async function findMovieByNameAndYear(name: string, year: string): Promise<MovieData | null> {
  // This is a mock implementation for searching by name and year
  // In a real implementation, this would make a call to the TMDB API
  if (!name || !year) {
    return null;
  }
  
  // Return a mock movie object
  return {
    id: 999999, // mock ID
    title: name,
    release_date: `${year}-01-01`,
    tmdbId: 999999
  };
}

/**
 * Analyzes a CSV file for import to a user's movie list
 * Route: POST /api/lists/{listId}/import/analyze
 */
export const analyzeListImport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const pathParts = req.path.split('/');
    const listsIndex = pathParts.indexOf('lists');
    if (listsIndex === -1 || listsIndex + 1 >= pathParts.length) {
      res.status(400).json({ error: 'List ID is required in URL' });
      return;
    }
    const listId = pathParts[listsIndex + 1];
    const importIndex = pathParts.indexOf('import');
    const analyzeIndex = pathParts.indexOf('analyze');
    if (importIndex === -1 || analyzeIndex === -1 || analyzeIndex !== importIndex + 1) {
      res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/import/analyze' });
      return;
    }
    if (!listId) {
      res.status(400).json({ error: 'List ID is required' });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
      return;
    }
    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }
    const userId = decodedToken.uid;
    const listRef = db.collection('users').doc(userId).collection('custom_lists').doc(listId);
    const listDoc = await listRef.get();
    if (!listDoc.exists) {
      res.status(404).json({ error: 'List not found' });
      return;
    }
    const listData = listDoc.data();
    if (!listData || listData.ownerId !== userId) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
      return;
    }
    const contentType = (req.headers['content-type'] || req.headers['Content-Type']) as string | undefined;
    if (!contentType || !contentType.includes('multipart/form-data')) {
      res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
      return;
    }
    const busboy = Busboy({ headers: req.headers });
    let csvBuffer: Buffer | null = null;
    let csvFieldFound = false;
    busboy.on('file', (fieldname: string, file: any, info: any) => {
      const { filename, mimeType } = info;
      if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
        const buffers: Buffer[] = [];
        file.on('data', (data: Buffer) => { buffers.push(data); });
        file.on('end', () => { csvBuffer = Buffer.concat(buffers); csvFieldFound = true; });
      } else {
        file.resume();
      }
    });
    busboy.on('finish', async () => {
      if (!csvFieldFound || !csvBuffer) {
        res.status(400).json({ error: 'CSV file is required in the request' });
        return;
      }
      try {
        const csvString = csvBuffer.toString('utf8');
        const csvData = Papa.parse(csvString, { header: true, skipEmptyLines: true }).data as any[];
        if (!Array.isArray(csvData) || csvData.length === 0) {
          res.status(400).json({ error: 'CSV file is empty or invalid' });
          return;
        }
        const itemsCollectionRef = db.collection('users').doc(userId).collection('custom_lists').doc(listId).collection('items');
        const itemsSnapshot = await itemsCollectionRef.get();
        const existingItems: { [key: string]: any } = {};
        itemsSnapshot.docs.forEach((doc: any) => { const item = doc.data(); existingItems[item.id] = item; });
        const result: AnalysisResult = { matched: [], unmatched: [], duplicates: [] };
        for (const row of csvData) {
          const csvRow: CsvRow = {
            tmdbId: row.tmdbId || row['tmdbId'] || '',
            Name: row.Name || row['Name'] || '',
            Year: row.Year || row['Year'] || '',
            'Letterboxd URI': row['Letterboxd URI'] || row['Letterboxd URI'] || ''
          } as any;
          const isDuplicate = existingItems[csvRow.tmdbId] || Object.values(existingItems).some((item: any) => item.title === csvRow.Name && item.release_date && new Date(item.release_date).getFullYear().toString() === csvRow.Year);
          if (isDuplicate) {
            const duplicateMovie: any = existingItems[csvRow.tmdbId] || Object.values(existingItems).find((item: any) => item.title === csvRow.Name && item.release_date && new Date(item.release_date).getFullYear().toString() === csvRow.Year);
            result.duplicates.push({ movie: { id: duplicateMovie.id, title: duplicateMovie.title, release_date: duplicateMovie.release_date, tmdbId: duplicateMovie.id }, originalRow: csvRow });
            continue;
          }
          let matchedMovie: MovieData | null = null;
          if (csvRow.tmdbId && !isNaN(Number(csvRow.tmdbId))) matchedMovie = await findMovieByTmdbId(csvRow.tmdbId);
          if (!matchedMovie && csvRow.Name && csvRow.Year) matchedMovie = await findMovieByNameAndYear(csvRow.Name, csvRow.Year);
          if (matchedMovie) result.matched.push({ movie: matchedMovie, originalRow: csvRow });
          else result.unmatched.push({ row: csvRow, reason: 'Movie not found in TMDB' });
        }
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
 * Route: POST /api/lists/{listId}/import/confirm
 */
export const confirmListImport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  try {
    const pathParts = req.path.split('/');
    const listsIndex = pathParts.indexOf('lists');
    if (listsIndex === -1 || listsIndex + 1 >= pathParts.length) {
      res.status(400).json({ error: 'List ID is required in URL' });
      return;
    }
    const listId = pathParts[listsIndex + 1];
    const importIndex = pathParts.indexOf('import');
    const confirmIndex = pathParts.indexOf('confirm');
    if (importIndex === -1 || confirmIndex === -1 || confirmIndex !== importIndex + 1) {
      res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/import/confirm' });
      return;
    }
    if (!listId) {
      res.status(400).json({ error: 'List ID is required' });
      return;
    }
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
      return;
    }
    const token = authHeader.substring(7);
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(token);
    } catch (error) {
      res.status(401).json({ error: 'Unauthorized: Invalid token' });
      return;
    }
    const userId = decodedToken.uid;
    const listRef = db.collection('users').doc(userId).collection('custom_lists').doc(listId);
    const listDoc = await listRef.get();
    if (!listDoc.exists) {
      res.status(404).json({ error: 'List not found' });
      return;
    }
    const listData = listDoc.data();
    if (!listData || listData.ownerId !== userId) {
      res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
      return;
    }
    const { moviesToImport } = req.body;
    if (!moviesToImport || !Array.isArray(moviesToImport)) {
      res.status(400).json({ error: 'Request body must contain an array of moviesToImport' });
      return;
    }
    if (moviesToImport.length === 0) {
      res.status(201).json({ success: true, moviesAdded: 0, message: 'No movies to import, but request was processed successfully' });
      return;
    }
    const itemsCollectionRef = db.collection('users').doc(userId).collection('custom_lists').doc(listId).collection('items');
    const itemsSnapshot = await itemsCollectionRef.get();
    const existingItemIds = new Set<string>();
    itemsSnapshot.docs.forEach((doc: any) => { const item = doc.data(); existingItemIds.add(item.id?.toString()); });
    const moviesToActuallyImport = moviesToImport.filter((tmdbId: string) => !existingItemIds.has(tmdbId.toString()));
    let moviesAddedCount = 0;
    const batch = db.batch();
    for (const tmdbId of moviesToActuallyImport) {
      const newItemRef = itemsCollectionRef.doc(tmdbId.toString());
      const movieDetails = await findMovieByTmdbId(tmdbId.toString());
      if (movieDetails) {
        const movieData = {
          id: movieDetails.tmdbId,
          title: movieDetails.title,
          release_date: movieDetails.release_date,
          dateAdded: admin.firestore.FieldValue.serverTimestamp(),
          media_type: 'movie',
        };
        batch.set(newItemRef, movieData);
        moviesAddedCount++;
      }
    }
    if (moviesAddedCount > 0) {
      await batch.commit();
    }
    res.status(201).json({ success: true, moviesAdded: moviesAddedCount, message: `${moviesAddedCount} movies successfully added to the list` });
    return;
  } catch (error) {
    console.error('Error confirming list import:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});
// Export all functions for Firebase to recognize them
