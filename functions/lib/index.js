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
const db = admin.firestore();
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
async function fetchImdbRatings(imdbId) {
    var _a, _b, _c, _d, _e;
    if (!imdbId)
        return null;
    const base = (process.env.IMDB_API_BASE_URL || 'https://api.imdbapi.dev').replace(/\/$/, '');
    const url = `${base}/titles/${imdbId}`;
    try {
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
    catch (_f) {
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
// Mock TMDB API service - in a real implementation, this would call the actual TMDB API
async function findMovieByTmdbId(tmdbId) {
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
async function findMovieByNameAndYear(name, year) {
    // This is a mock implementation for searching by name and year
    // In a real implementation, this would make a call to the TMDB API
    if (!name || !year) {
        return null;
    }
    // Return a mock movie object
    return {
        id: 999999,
        title: name,
        release_date: `${year}-01-01`,
        tmdbId: 999999
    };
}
/**
 * Analyzes a CSV file for import to a user's movie list
 * Route: POST /api/lists/{listId}/import/analyze
 */
exports.analyzeListImport = functions.https.onRequest(async (req, res) => {
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
        }
        catch (error) {
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
        const contentType = (req.headers['content-type'] || req.headers['Content-Type']);
        if (!contentType || !contentType.includes('multipart/form-data')) {
            res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
            return;
        }
        const busboy = (0, busboy_1.default)({ headers: req.headers });
        let csvBuffer = null;
        let csvFieldFound = false;
        busboy.on('file', (fieldname, file, info) => {
            const { filename, mimeType } = info;
            if (mimeType === 'text/csv' || filename.endsWith('.csv')) {
                const buffers = [];
                file.on('data', (data) => { buffers.push(data); });
                file.on('end', () => { csvBuffer = Buffer.concat(buffers); csvFieldFound = true; });
            }
            else {
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
                const csvData = Papa.parse(csvString, { header: true, skipEmptyLines: true }).data;
                if (!Array.isArray(csvData) || csvData.length === 0) {
                    res.status(400).json({ error: 'CSV file is empty or invalid' });
                    return;
                }
                const itemsCollectionRef = db.collection('users').doc(userId).collection('custom_lists').doc(listId).collection('items');
                const itemsSnapshot = await itemsCollectionRef.get();
                const existingItems = {};
                itemsSnapshot.docs.forEach((doc) => { const item = doc.data(); existingItems[item.id] = item; });
                const result = { matched: [], unmatched: [], duplicates: [] };
                for (const row of csvData) {
                    const csvRow = {
                        tmdbId: row.tmdbId || row['tmdbId'] || '',
                        Name: row.Name || row['Name'] || '',
                        Year: row.Year || row['Year'] || '',
                        'Letterboxd URI': row['Letterboxd URI'] || row['Letterboxd URI'] || ''
                    };
                    const isDuplicate = existingItems[csvRow.tmdbId] || Object.values(existingItems).some((item) => item.title === csvRow.Name && item.release_date && new Date(item.release_date).getFullYear().toString() === csvRow.Year);
                    if (isDuplicate) {
                        const duplicateMovie = existingItems[csvRow.tmdbId] || Object.values(existingItems).find((item) => item.title === csvRow.Name && item.release_date && new Date(item.release_date).getFullYear().toString() === csvRow.Year);
                        result.duplicates.push({ movie: { id: duplicateMovie.id, title: duplicateMovie.title, release_date: duplicateMovie.release_date, tmdbId: duplicateMovie.id }, originalRow: csvRow });
                        continue;
                    }
                    let matchedMovie = null;
                    if (csvRow.tmdbId && !isNaN(Number(csvRow.tmdbId)))
                        matchedMovie = await findMovieByTmdbId(csvRow.tmdbId);
                    if (!matchedMovie && csvRow.Name && csvRow.Year)
                        matchedMovie = await findMovieByNameAndYear(csvRow.Name, csvRow.Year);
                    if (matchedMovie)
                        result.matched.push({ movie: matchedMovie, originalRow: csvRow });
                    else
                        result.unmatched.push({ row: csvRow, reason: 'Movie not found in TMDB' });
                }
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
 * Route: POST /api/lists/{listId}/import/confirm
 */
exports.confirmListImport = functions.https.onRequest(async (req, res) => {
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
        }
        catch (error) {
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
        const existingItemIds = new Set();
        itemsSnapshot.docs.forEach((doc) => { var _a; const item = doc.data(); existingItemIds.add((_a = item.id) === null || _a === void 0 ? void 0 : _a.toString()); });
        const moviesToActuallyImport = moviesToImport.filter((tmdbId) => !existingItemIds.has(tmdbId.toString()));
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
    }
    catch (error) {
        console.error('Error confirming list import:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});
// Export all functions for Firebase to recognize them
//# sourceMappingURL=index.js.map