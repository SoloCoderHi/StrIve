# Import Routing and Implementation

## Canonical Endpoints (no /api prefix)
- POST /lists/{listId}/import/analyze (multipart/form-data, CSV)
- POST /lists/{listId}/import/confirm (application/json: { moviesToImport: string[] })

## listId Values
- `watchlist` (special case: users/{uid}/watchlist)
- Custom list IDs under users/{uid}/custom_lists/{listId}

## CSV Schema (Strict Validation)
Required header (exact order and casing):
```
tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes
```

- Legacy headers (Letterboxd URI, Name, Year with capital letters) are rejected with 400
- Empty values allowed for: imdbId, imdbRating, imdbVotes
- mediaType must be: "movie" or "tv" (lowercase)

## Matching Pipeline (Analyze)
For each CSV row:
1. **tmdbId provided**: Use directly to fetch TMDB details
2. **Else imdbId provided**: Resolve via TMDB Find API (/find/{imdb_id}?external_source=imdb_id) for specified mediaType
3. **Else name+year**: Search TMDB (/search/movie or /search/tv) based on mediaType

## Duplicate Detection
Against target list only (watchlist or custom):
- By tmdbId match, OR
- By name+year match when tmdbId missing
- Duplicates excluded from matched; listed separately

## Response Shape (Analyze)
```json
{
  "matched": [{ "movie": {...}, "originalRow": {...} }],
  "unmatched": [{ "row": {...}, "reason": "..." }],
  "duplicates": [{ "movie": {...}, "originalRow": {...} }]
}
```

Movie object includes: id, title/name, release_date/first_air_date, media_type, poster_path

## Confirm Import
- Input: `{ moviesToImport: string[] }` of tmdbIds
- Fetches TMDB details for each (tries movie, then tv)
- Writes to Firestore with: id, title, poster_path, release_date, vote_average, media_type, dateAdded
- Skips existing items (idempotent)
- Returns 201 with: `{ success: true, moviesAdded: N, message: "..." }`

## Auth
- Authorization: Bearer <Firebase ID token> required by functions
- 401 for missing/invalid token
- 403 when list not owned by user
- 404 when custom list not found
- Hosting layer is transparent; same-origin requests

## Firebase Hosting Rewrites (firebase.json)
```json
"rewrites": [
  { "source": "/lists/*/import/analyze", "function": "analyzeListImport" },
  { "source": "/lists/*/import/confirm", "function": "confirmListImport" },
  { "source": "/lists/**", "function": "listsExport" }
]
```

## Local Emulator Testing
Start emulators:
```bash
firebase emulators:start --only hosting,functions,firestore
```

Obtain token in browser console:
```javascript
await firebase.auth().currentUser.getIdToken(true)
```

Test analyze (multipart/form-data):
```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  -F file=@export.csv \
  http://localhost:5000/lists/{listId}/import/analyze
```

Test confirm (application/json):
```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"moviesToImport":["123","456"]}' \
  http://localhost:5000/lists/{listId}/import/confirm
```

## Security Notes
- No cookies; no CORS required (same-origin)
- Functions control headers; Hosting should not add cache headers for API routes
- No CSV contents or tokens logged; minimal context only

## Known Limitations
- imdbId/imdbRating/imdbVotes may be empty when:
  - imdbId not provided in CSV
  - IMDb API fails or unavailable
- TMDB API key required; missing key returns 500 (though analyze/confirm may degrade)
