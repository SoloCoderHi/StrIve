# Import Implementation Checklist

## Backend (Phase A) ✅
- [x] Strict CSV header validation (exact schema match)
- [x] Reject legacy headers (Letterboxd URI, Name/Year with capitals)
- [x] Matching pipeline: tmdbId → imdbId → name+year
- [x] mediaType awareness (movie vs tv)
- [x] Duplicate detection against target list only
- [x] Response shape compatible with UI (matched, unmatched, duplicates)
- [x] Real TMDB fetches in confirm with proper Firestore writes
- [x] Auth and ownership checks (401/403/404)
- [x] Support for watchlist and custom lists
- [x] Idempotent confirm (skip existing items)
- [x] Remove legacy Letterboxd/OMDb references

## Hosting & Config (Phase B) ✅
- [x] Firebase hosting rewrites for /lists/*/import/analyze and /lists/*/import/confirm
- [x] Documentation: docs/ImportRouting.md with schema, routes, auth, examples
- [x] TMDB_API_KEY configuration documented
- [x] Local emulator instructions

## Frontend (Phase C) - TODO
- [ ] Update ImportPage: canonical routes (/lists/{listId}/import/analyze)
- [ ] Add Authorization: Bearer header with getIdToken()
- [ ] List selection: add "Watchlist" option
- [ ] Schema guidance: show exact required headers
- [ ] Client-side header validation (optional)
- [ ] Update ImportReview: canonical routes (/lists/{listId}/import/confirm)
- [ ] Error handling for 400/401/403/404
- [ ] Success redirect to target list with "X items added" message
- [ ] Remove /api/ references
- [ ] Remove legacy Letterboxd/OMDb UI copy

## Testing - TODO
- [ ] Unit tests for analyzeListImport (strict schema validation)
- [ ] Unit tests for confirmListImport (TMDB fetches, Firestore writes)
- [ ] Integration tests with emulators
- [ ] Manual QA: watchlist and custom list import flows
- [ ] Verify auth error paths (401/403/404)
- [ ] Test with large CSV files
- [ ] Cross-browser testing

## Deployment - TODO
- [ ] Deploy functions and hosting
- [ ] Smoke test: analyze + confirm to watchlist
- [ ] Smoke test: analyze + confirm to custom list
- [ ] Verify no CORS errors
- [ ] Verify correct error codes
- [ ] Monitor logs for issues
