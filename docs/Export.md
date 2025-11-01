# Export Endpoint and Hosting (Unified)

Route
- GET /lists/{listId}/export
  - Special listId "watchlist" exports users/{uid}/watchlist
  - Custom lists export users/{uid}/custom_lists/{listId}/items (ownerId must equal uid)

Auth
- Required: Authorization: Bearer <Firebase ID token>
- 401 for missing/invalid token; 403 when list not owned; 404 when list not found

CSV schema and formatting
- Header (exact order): tmdbId, imdbId, name, year, mediaType, tmdbRating, imdbRating, tmdbVotes, imdbVotes
- Ratings as decimals (e.g., 7.3); votes as integers
- Empty lists return 204 No Content (no body)

Filename and headers
- Content-Type: text/csv
- Content-Disposition: attachment; filename="<listName|Watchlist>-YYYYMMDD.csv" (UTC date)
- Cache-Control: no-cache

Hosting rewrite
- firebase.json maps /lists/** to the Cloud Function listsExport
- Canonical UI path is /lists/{listId}/export (no /api/...)

Configuration
- TMDB_API_KEY (secret): Read access token used by the function
- IMDB_API_BASE_URL (env, optional): default https://api.imdbapi.dev
- No OMDb configuration is used

Setting config
- Local emulators (recommended): create functions/.env.local with:
  TMDB_API_KEY=Bearer <TMDB_READ_TOKEN>
  IMDB_API_BASE_URL=https://api.imdbapi.dev
- Production/staging: set secret and env via Firebase CLI
  firebase functions:secrets:set TMDB_API_KEY
  firebase deploy --only functions,hosting

Behavior on missing config
- If TMDB_API_KEY is missing in non-test environments, the function logs an actionable error and returns HTTP 500

Local development (emulators)
- Start emulators: firebase emulators:start --only hosting,functions
- Sign in via the app locally, then in browser console run:
  await firebase.auth().currentUser.getIdToken(true)
  Copy the token and test via Hosting emulator (same-origin):
  curl -i -H "Authorization: Bearer <ID_TOKEN>" http://localhost:5000/lists/watchlist/export

Smoke tests after deploy
- Watchlist non-empty: returns CSV with the exact header and proper filename
- Custom list owned by user: returns CSV
- Empty list: returns 204
- Unauthorized: 401; wrong owner: 403; nonexistent: 404

Rollback plan
- A backup of firebase.json is stored at docs/firebase.json.backup.md for quick reference.

Troubleshooting
- 401: Ensure Authorization header has a fresh ID token from Firebase Auth
- 500: Check Cloud Functions logs for TMDB_API_KEY missing/misconfigured
- CSV empty: Verify list has items; ensure media items have valid tmdb ids
