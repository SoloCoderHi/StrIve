"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.confirmListImport = exports.analyzeListImport = exports.listsExport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const Papa = __importStar(require("papaparse"));
const busboy_1 = __importDefault(require("busboy"));
// Initialize the Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp();
}
// Firestore instance (used in some legacy paths, kept for compatibility)
// const db = admin.firestore();
// Helper function to escape CSV fields that might contain commas, quotes, or newlines
function escapeCsvField(field) {
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
async function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
    const f = globalThis.fetch;
    return await Promise.race([
        f(resource, options || {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
}
// Helper: modest concurrency limiter
function pLimit(concurrency) {
    let activeCount = 0;
    const queue = [];
    const next = () => {
        activeCount--;
        if (queue.length > 0)
            queue.shift()();
    };
    const run = async (fn) => {
        if (activeCount >= concurrency) {
            await new Promise(resolve => queue.push(resolve));
        }
        activeCount++;
        try {
            return await fn();
        }
        finally {
            next();
        }
    };
    return run;
}
// Helper to traverse mocked Firestore layers used in tests and real Firestore
function walkLayer(layer, segments) {
    let cur = layer;
    for (const seg of segments) {
        // Unwrap one level if cur is a function returning the next callable
        if (typeof cur === 'function')
            cur = cur();
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
    if (typeof cur === 'function')
        cur = cur();
    return cur;
}
async function fetchTmdbExternalIds(mediaType, tmdbId, apiKey) {
    if (!apiKey)
        return null;
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${apiKey}`;
    try {
        const res = await fetchWithTimeout(url, {}, 8000);
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (_a) {
        return null;
    }
}
async function fetchTmdbDetails(mediaType, tmdbId, apiKey) {
    if (!apiKey)
        return null;
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
    try {
        const res = await fetchWithTimeout(url, {}, 8000);
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (_a) {
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
function getImdbApiBaseUrl() {
    const baseUrl = process.env.IMDB_API_BASE_URL;
    if (!baseUrl) {
        const errorMsg = 'IMDB_API_BASE_URL environment variable is not configured. IMDb ratings will be unavailable.';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }
    return baseUrl.replace(/\/$/, ''); // Remove trailing slash
}
async function fetchImdbRatings(imdbId) {
    var _a, _b, _c, _d, _e;
    if (!imdbId)
        return null;
    try {
        const base = getImdbApiBaseUrl();
        const url = `${base}/titles/${imdbId}`;
        const res = await fetchWithTimeout(url, {}, 8000);
        if (!res.ok)
            return null;
        const data = await res.json();
        const rating = (_c = (_a = data === null || data === void 0 ? void 0 : data.rating) !== null && _a !== void 0 ? _a : (_b = data === null || data === void 0 ? void 0 : data.ratings) === null || _b === void 0 ? void 0 : _b.imdb) !== null && _c !== void 0 ? _c : data === null || data === void 0 ? void 0 : data.ratingAverage;
        const votes = (_e = (_d = data === null || data === void 0 ? void 0 : data.votes) !== null && _d !== void 0 ? _d : data === null || data === void 0 ? void 0 : data.ratingsCount) !== null && _e !== void 0 ? _e : data === null || data === void 0 ? void 0 : data.imdbVotes;
        return {
            rating: typeof rating === 'number' ? rating : (typeof rating === 'string' ? parseFloat(rating) : undefined),
            votes: typeof votes === 'number' ? votes : (typeof votes === 'string' ? parseInt(votes.replace(/[,]/g, ''), 10) : undefined)
        };
    }
    catch (err) {
        // If IMDB_API_BASE_URL not configured, log once and return null (graceful degradation)
        if (err instanceof Error && err.message.includes('IMDB_API_BASE_URL')) {
            console.warn('IMDb ratings unavailable - IMDB_API_BASE_URL not configured');
            return null;
        }
        console.error(`fetchImdbRatings error for ${imdbId}:`, err);
        return null;
    }
}
function deriveMediaType(item) {
    if ((item === null || item === void 0 ? void 0 : item.media_type) === 'tv')
        return 'tv';
    if ((item === null || item === void 0 ? void 0 : item.media_type) === 'movie')
        return 'movie';
    if (item === null || item === void 0 ? void 0 : item.first_air_date)
        return 'tv';
    return 'movie';
}
function deriveName(item, mediaType) {
    return mediaType === 'movie' ? ((item === null || item === void 0 ? void 0 : item.title) || (item === null || item === void 0 ? void 0 : item.name) || '') : ((item === null || item === void 0 ? void 0 : item.name) || (item === null || item === void 0 ? void 0 : item.title) || '');
}
function deriveYear(item, mediaType) {
    const dateStr = mediaType === 'movie' ? ((item === null || item === void 0 ? void 0 : item.release_date) || (item === null || item === void 0 ? void 0 : item.first_air_date)) : ((item === null || item === void 0 ? void 0 : item.first_air_date) || (item === null || item === void 0 ? void 0 : item.release_date));
    if (!dateStr)
        return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : String(d.getUTCFullYear());
}
async function enrichItem(item, tmdbApiKey) {
    var _a, _b;
    const tmdbId = (_b = (_a = item === null || item === void 0 ? void 0 : item.id) !== null && _a !== void 0 ? _a : item === null || item === void 0 ? void 0 : item.tmdbId) !== null && _b !== void 0 ? _b : item === null || item === void 0 ? void 0 : item.tmdb_id;
    const mediaType = deriveMediaType(item);
    const name = deriveName(item, mediaType);
    const year = deriveYear(item, mediaType);
    let imdbId = '';
    let tmdbRating = '';
    let tmdbVotes = '';
    let imdbRating = '';
    let imdbVotes = '';
    const [ext, details] = await Promise.all([
        fetchTmdbExternalIds(mediaType, tmdbId, tmdbApiKey),
        fetchTmdbDetails(mediaType, tmdbId, tmdbApiKey)
    ]);
    if (ext === null || ext === void 0 ? void 0 : ext.imdb_id)
        imdbId = ext.imdb_id;
    if (details) {
        const va = details.vote_average;
        const vc = details.vote_count;
        if (typeof va === 'number')
            tmdbRating = va.toFixed(1).replace(/\.0$/, '.0');
        if (typeof vc === 'number')
            tmdbVotes = String(vc);
    }
    // Fallback to fields present on the item if TMDB fetch not available
    if (!tmdbRating && typeof (item === null || item === void 0 ? void 0 : item.vote_average) === 'number') {
        tmdbRating = item.vote_average.toFixed(1).replace(/\.0$/, '.0');
    }
    if (!tmdbVotes && typeof (item === null || item === void 0 ? void 0 : item.vote_count) === 'number') {
        tmdbVotes = String(item.vote_count);
    }
    if (imdbId) {
        const imdb = await fetchImdbRatings(imdbId);
        if (imdb) {
            if (typeof imdb.rating === 'number')
                imdbRating = imdb.rating.toFixed(1).replace(/\.0$/, '.0');
            if (typeof imdb.votes === 'number')
                imdbVotes = String(imdb.votes);
        }
    }
    return { tmdbId, imdbId, name, year, mediaType, tmdbRating, imdbRating, tmdbVotes, imdbVotes };
}
// Unified export endpoint: GET /lists/{listId}/export, supports custom lists and 'watchlist'
exports.listsExport = functions.https.onRequest(async (req, res) => {
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
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
        return;
    }
    const token = String(authHeader).substring(7);
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    }
    catch (_a) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
        return;
    }
    const uid = decodedToken.uid;
    let itemsSnapshot = null;
    let listName = 'Watchlist';
    const dbi = admin.firestore();
    const users = dbi.collection ? dbi.collection('users') : dbi;
    if (listId === 'watchlist') {
        const wlColl = walkLayer(users, [uid, 'watchlist']);
        itemsSnapshot = await wlColl.get();
    }
    else {
        const listRef = walkLayer(users, [uid, 'custom_lists', listId]);
        const listDoc = await listRef.get();
        if (!listDoc.exists) {
            res.status(404).json({ error: 'List not found' });
            return;
        }
        const data = listDoc.data();
        if (!data || data.ownerId !== uid) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
            return;
        }
        listName = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : listId;
        const itemsColl = listRef.collection ? listRef.collection('items') : walkLayer(listRef, ['items']);
        itemsSnapshot = await itemsColl.get();
    }
    if (!itemsSnapshot || itemsSnapshot.empty) {
        res.set('Cache-Control', 'no-cache');
        res.status(204).end();
        return;
    }
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const limit = pLimit(8);
    const enriched = await Promise.all(itemsSnapshot.docs.map((d) => d.data()).map((item) => limit(() => enrichItem(item, tmdbApiKey))));
    // CSV header per contract
    const header = 'tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes';
    const rows = enriched.map(r => {
        var _a;
        return [
            escapeCsvField(String((_a = r.tmdbId) !== null && _a !== void 0 ? _a : '')),
            escapeCsvField(r.imdbId || ''),
            escapeCsvField(r.name || ''),
            escapeCsvField(r.year || ''),
            escapeCsvField(r.mediaType || ''),
            escapeCsvField(r.tmdbRating || ''),
            escapeCsvField(r.imdbRating || ''),
            escapeCsvField(r.tmdbVotes || ''),
            escapeCsvField(r.imdbVotes || '')
        ].join(',');
    });
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
/**
 * Analyzes a CSV file for import to a user's movie list
 * Route: POST /lists/{listId}/import/analyze
 * Enforces new CSV schema: tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes
 */
exports.analyzeListImport = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
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
        if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
            return;
        }
        const token = String(authHeader).substring(7);
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        }
        catch (_a) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }
        const uid = decodedToken.uid;
        let itemsCollectionRef;
        if (listId === 'watchlist') {
            itemsCollectionRef = admin.firestore().collection('users').doc(uid).collection('watchlist');
        }
        else {
            const listRef = admin.firestore().collection('users').doc(uid).collection('custom_lists').doc(listId);
            const listDoc = await listRef.get();
            if (!listDoc.exists) {
                res.status(404).json({ error: 'List not found' });
                return;
            }
            const listData = listDoc.data();
            if (!listData || listData.ownerId !== uid) {
                res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
                return;
            }
            itemsCollectionRef = listRef.collection('items');
        }
        const contentType = (req.headers['content-type'] || req.headers['Content-Type']);
        if (!contentType || !contentType.includes('multipart/form-data')) {
            res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
            return;
        }
        const EXPECTED_HEADERS = ['tmdbId', 'imdbId', 'name', 'year', 'mediaType', 'tmdbRating', 'imdbRating', 'tmdbVotes', 'imdbVotes'];
        const busboy = (0, busboy_1.default)({ headers: req.headers });
        let csvBuffer = null;
        let fileCount = 0;
        busboy.on('file', (_fieldname, file, info) => {
            const { filename, mimeType } = info;
            if (mimeType === 'text/csv' || (filename && filename.endsWith('.csv'))) {
                fileCount++;
                const buffers = [];
                file.on('data', (data) => buffers.push(data));
                file.on('end', () => { csvBuffer = Buffer.concat(buffers); });
            }
            else {
                file.resume();
            }
        });
        busboy.on('finish', async () => {
            var _a;
            if (!csvBuffer || fileCount !== 1) {
                res.status(400).json({ error: 'Exactly one CSV file is required' });
                return;
            }
            try {
                const csvString = csvBuffer.toString('utf8');
                const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
                const fields = ((_a = parsed === null || parsed === void 0 ? void 0 : parsed.meta) === null || _a === void 0 ? void 0 : _a.fields) || [];
                if (fields.length !== EXPECTED_HEADERS.length || !fields.every((f, i) => f === EXPECTED_HEADERS[i])) {
                    if (fields.includes('Letterboxd URI') || fields.includes('Name') || (fields.includes('Year') && !fields.includes('year'))) {
                        res.status(400).json({ error: 'Legacy CSV headers detected. Expected: ' + EXPECTED_HEADERS.join(',') });
                        return;
                    }
                    res.status(400).json({ error: 'Invalid CSV headers. Expected exact columns: ' + EXPECTED_HEADERS.join(',') });
                    return;
                }
                const existingSnapshot = await itemsCollectionRef.get();
                const existingById = new Map();
                const existingByNameYear = new Set();
                existingSnapshot.docs.forEach((d) => {
                    const it = d.data();
                    if (it === null || it === void 0 ? void 0 : it.id)
                        existingById.set(String(it.id), it);
                    const n = ((it === null || it === void 0 ? void 0 : it.title) || (it === null || it === void 0 ? void 0 : it.name) || '').trim();
                    const y = ((it === null || it === void 0 ? void 0 : it.release_date) || (it === null || it === void 0 ? void 0 : it.first_air_date) || '').slice(0, 4);
                    if (n && y)
                        existingByNameYear.add(`${n}::${y}`);
                });
                const tmdbApiKey = process.env.TMDB_API_KEY;
                const limit = pLimit(6);
                async function tmdbFindByImdb(imdbId, mt) {
                    if (!tmdbApiKey || !imdbId)
                        return null;
                    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${tmdbApiKey}&external_source=imdb_id`;
                    try {
                        const r = await fetchWithTimeout(url, {}, 8000);
                        if (!r.ok)
                            return null;
                        const j = await r.json();
                        const arr = mt === 'movie' ? j === null || j === void 0 ? void 0 : j.movie_results : j === null || j === void 0 ? void 0 : j.tv_results;
                        return Array.isArray(arr) && arr[0] ? arr[0] : null;
                    }
                    catch (_a) {
                        return null;
                    }
                }
                async function tmdbSearchByNameYear(name, year, mt) {
                    if (!tmdbApiKey || !name)
                        return null;
                    const base = `https://api.themoviedb.org/3/search/${mt}`;
                    const q = new URLSearchParams({ api_key: String(tmdbApiKey), query: name });
                    if (year)
                        q.set(mt === 'movie' ? 'year' : 'first_air_date_year', year);
                    const url = `${base}?${q.toString()}`;
                    try {
                        const r = await fetchWithTimeout(url, {}, 8000);
                        if (!r.ok)
                            return null;
                        const j = await r.json();
                        return Array.isArray(j === null || j === void 0 ? void 0 : j.results) && j.results[0] ? j.results[0] : null;
                    }
                    catch (_a) {
                        return null;
                    }
                }
                async function tmdbDetails(mt, id) {
                    if (!tmdbApiKey || !id)
                        return null;
                    const url = `https://api.themoviedb.org/3/${mt}/${id}?api_key=${tmdbApiKey}`;
                    try {
                        const r = await fetchWithTimeout(url, {}, 8000);
                        if (!r.ok)
                            return null;
                        return await r.json();
                    }
                    catch (_a) {
                        return null;
                    }
                }
                const rows = parsed.data;
                const result = { matched: [], unmatched: [], duplicates: [] };
                await Promise.all(rows.map((row) => limit(async () => {
                    const tmdbIdRaw = String(row.tmdbId || '').trim();
                    const imdbIdRaw = String(row.imdbId || '').trim();
                    const name = String(row.name || '').trim();
                    const year = String(row.year || '').trim();
                    const mt = (String(row.mediaType || '').trim() === 'tv') ? 'tv' : 'movie';
                    if (tmdbIdRaw && existingById.has(tmdbIdRaw)) {
                        const it = existingById.get(tmdbIdRaw);
                        result.duplicates.push({ movie: { id: it.id, title: it.title || it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row });
                        return;
                    }
                    if (!tmdbIdRaw && name && year && existingByNameYear.has(`${name}::${year}`)) {
                        const it = [...existingById.values()].find((v) => (v.title || v.name) === name && (v.release_date || v.first_air_date || '').startsWith(year));
                        if (it) {
                            result.duplicates.push({ movie: { id: it.id, title: it.title || it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row });
                            return;
                        }
                    }
                    let resolved = null;
                    if (tmdbIdRaw) {
                        resolved = await tmdbDetails(mt, tmdbIdRaw);
                    }
                    else if (imdbIdRaw) {
                        const found = await tmdbFindByImdb(imdbIdRaw, mt);
                        if (found === null || found === void 0 ? void 0 : found.id)
                            resolved = await tmdbDetails(mt, found.id);
                    }
                    else if (name) {
                        const found = await tmdbSearchByNameYear(name, year, mt);
                        if (found === null || found === void 0 ? void 0 : found.id)
                            resolved = await tmdbDetails(mt, found.id);
                    }
                    if (resolved === null || resolved === void 0 ? void 0 : resolved.id) {
                        result.matched.push({ movie: { id: resolved.id, title: resolved.title || resolved.name, release_date: resolved.release_date, first_air_date: resolved.first_air_date, media_type: mt, poster_path: resolved.poster_path }, originalRow: row });
                    }
                    else {
                        result.unmatched.push({ row, reason: 'Not found in TMDB' });
                    }
                })));
                res.status(200).json(result);
                return;
            }
            catch (parseError) {
                console.error('Error parsing CSV:', parseError);
                res.status(400).json({ error: 'Invalid CSV format' });
                return;
            }
        });
        req.pipe(busboy);
    }
    catch (error) {
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
exports.confirmListImport = functions.https.onRequest(async (req, res) => {
    var _a;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
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
        if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
            return;
        }
        const token = String(authHeader).substring(7);
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        }
        catch (_b) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }
        const uid = decodedToken.uid;
        let itemsCollectionRef;
        if (listId === 'watchlist') {
            itemsCollectionRef = admin.firestore().collection('users').doc(uid).collection('watchlist');
        }
        else {
            const listRef = admin.firestore().collection('users').doc(uid).collection('custom_lists').doc(listId);
            const listDoc = await listRef.get();
            if (!listDoc.exists) {
                res.status(404).json({ error: 'List not found' });
                return;
            }
            const data = listDoc.data();
            if (!data || data.ownerId !== uid) {
                res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
                return;
            }
            itemsCollectionRef = listRef.collection('items');
        }
        const { moviesToImport } = req.body || {};
        if (!Array.isArray(moviesToImport)) {
            res.status(400).json({ error: 'Request body must contain an array of moviesToImport' });
            return;
        }
        if (moviesToImport.length === 0) {
            res.status(201).json({ success: true, moviesAdded: 0, message: 'No movies to import' });
            return;
        }
        const existingSnapshot = await itemsCollectionRef.get();
        const existing = new Set(existingSnapshot.docs.map((d) => String((d.data() || {}).id)));
        const tmdbApiKey = process.env.TMDB_API_KEY;
        async function fetchDetailsTryBoth(id) {
            if (!tmdbApiKey)
                return { ok: false };
            const mUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`;
            const tUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`;
            try {
                const r = await fetchWithTimeout(mUrl, {}, 8000);
                if (r.ok) {
                    const j = await r.json();
                    return { ok: true, data: j, media_type: 'movie' };
                }
            }
            catch (_a) { }
            try {
                const r = await fetchWithTimeout(tUrl, {}, 8000);
                if (r.ok) {
                    const j = await r.json();
                    return { ok: true, data: j, media_type: 'tv' };
                }
            }
            catch (_b) { }
            return { ok: false };
        }
        const batch = admin.firestore().batch();
        let moviesAdded = 0;
        for (const rawId of moviesToImport) {
            const id = String(rawId);
            if (existing.has(id))
                continue;
            const det = await fetchDetailsTryBoth(id);
            if (!det.ok || !((_a = det.data) === null || _a === void 0 ? void 0 : _a.id))
                continue;
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
        if (moviesAdded > 0)
            await batch.commit();
        res.status(201).json({ success: true, moviesAdded, message: `${moviesAdded} items successfully added to the list` });
        return;
    }
    catch (error) {
        console.error('Error confirming list import:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});
// Export all functions for Firebase to recognize them
//# sourceMappingURL=index.js.map