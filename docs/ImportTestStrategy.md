# Import Test Strategy & Checklist

## D1 — Unit Tests: analyzeListImport ✅

### Schema Validation
- [x] Rejects legacy headers (Letterboxd URI, Name, Year) with 400
- [x] Rejects invalid headers (wrong column names) with 400
- [x] Accepts valid headers (exact match) with 200
- [x] Returns correct structure: { matched, unmatched, duplicates }

### Auth & Ownership
- [x] 401 when no Authorization header
- [x] 401 when invalid token
- [x] 404 when custom list does not exist
- [x] 403 when user does not own custom list
- [x] Supports watchlist (listId='watchlist')

### Duplicate Detection
- [x] Detects duplicates by tmdbId in target list
- [ ] Detects duplicates by name+year when tmdbId missing
- [ ] Duplicates excluded from matched, included in duplicates array

### Matching Pipeline (requires TMDB API key)
- [ ] Row with tmdbId only → matched (movie)
- [ ] Row with tmdbId only → matched (tv)
- [ ] Row with imdbId only → resolve via TMDB /find → matched
- [ ] Row with name+year only → search by mediaType → matched
- [ ] Invalid tmdbId → unmatched with reason
- [ ] Failed name+year search → unmatched with reason

### CSV Robustness
- [ ] UTF-8 with BOM
- [ ] CRLF vs LF line endings
- [ ] Quoted fields with commas
- [ ] Quoted fields with quotes (escaped)
- [ ] Quoted fields with newlines
- [ ] Empty optional IMDb fields (imdbId, imdbRating, imdbVotes)

### Content-Type
- [x] 400 when Content-Type is not multipart/form-data

---

## D2 — Unit Tests: confirmListImport

### Happy Path
- [ ] moviesToImport with valid tmdbIds → fetch TMDB → write to Firestore
- [ ] Writes correct payload: id, title, poster_path, release_date, vote_average, media_type, dateAdded
- [ ] Returns 201 with { success: true, moviesAdded: N, message }

### Idempotency
- [ ] tmdbId already in target list → skipped, not re-added
- [ ] moviesAdded count reflects only new items

### Targets
- [ ] Writes to users/{uid}/watchlist/{tmdbId} when listId='watchlist'
- [ ] Writes to users/{uid}/custom_lists/{listId}/items/{tmdbId} for custom lists

### Auth & Ownership
- [ ] 401 when no/invalid token
- [ ] 403 when user does not own custom list
- [ ] 404 when custom list does not exist
- [ ] 400 when moviesToImport is not an array

### Edge Cases
- [ ] Empty moviesToImport array → 201 with moviesAdded: 0
- [ ] Invalid tmdbId (not found in TMDB) → skipped, no error
- [ ] Mix of movie and tv tmdbIds → both resolved and written

---

## D3 — Integration Tests: Emulators

### Setup
- [ ] Start emulators: firebase emulators:start --only hosting,functions,firestore
- [ ] Seed Firestore: User A with watchlist and custom list
- [ ] Obtain valid ID token

### Analyze Flow
- [ ] POST /lists/{listId}/import/analyze via Hosting rewrite
- [ ] Multipart/form-data with valid CSV
- [ ] Returns matched/unmatched/duplicates accurately
- [ ] 401/403/404 handled correctly

### Confirm Flow
- [ ] POST /lists/{listId}/import/confirm via Hosting rewrite
- [ ] application/json with { moviesToImport: [...] }
- [ ] Writes expected documents to Firestore
- [ ] Returns 201 with accurate count

### No CORS Issues
- [ ] Same-origin requests work without CORS headers

---

## D4 — Manual QA: UI Flow

### ImportPage
- [ ] Watchlist option appears and is selectable
- [ ] Upload valid CSV → proceed to review
- [ ] Upload invalid headers → client error before submission
- [ ] Upload legacy CSV → server error with clear message
- [ ] Schema guidance box displays exact required headers
- [ ] Client-side header validation shows ✓ or ✗
- [ ] 401/403/404 errors display correct messages

### ImportReview
- [ ] Matched items render with posters, titles, years
- [ ] Unmatched items show row.name, row.year, row.mediaType
- [ ] Manual search modal resolves and moves to matched
- [ ] Ignore button removes from unmatched
- [ ] Duplicates labeled "Already in list", non-selectable
- [ ] Confirm button disabled until all unmatched resolved

### Confirm & Redirect
- [ ] Watchlist import → redirects to /my-list
- [ ] Custom list import → redirects to /my-lists/{listId}
- [ ] Success message displays: "X items successfully imported"
- [ ] Imported items appear immediately in target list

### Error Paths
- [ ] Token expiry → clear error, allows retry
- [ ] Network failure → actionable error message
- [ ] Empty result (all duplicates) → clear feedback

### Accessibility
- [ ] Keyboard navigation works (tab, enter)
- [ ] aria-busy on loading buttons
- [ ] Screen reader announces success/error messages

### Mobile
- [ ] Layout responsive (no horizontal overflow)
- [ ] Buttons and file upload accessible on touch
- [ ] Success banner readable on small screens

---

## D5 — Performance & Robustness

### Large CSV
- [ ] 2,000 rows: analyze completes without timeout
- [ ] 5,000 rows: analyze completes, memory stable
- [ ] Confirm handles hundreds of IDs without timeout

### External API Resilience
- [ ] TMDB API slow/fails → graceful degradation, marks unmatched
- [ ] IMDb API unavailable → IMDb fields empty, export still succeeds
- [ ] Rate limit: modest concurrency (6-10 parallel) prevents throttling

### Concurrency Tuning
- [ ] pLimit set appropriately (default: 6)
- [ ] No 429 errors from TMDB under normal load

---

## D6 — Security & Access Control

### Token Enforcement
- [ ] No cookies relied upon; only Authorization header
- [ ] 401 for missing token
- [ ] 401 for invalid/expired token

### Ownership Enforcement
- [ ] 403 when non-owner tries to import to custom list
- [ ] 404 when custom list does not exist
- [ ] Watchlist always scoped to current user

### Logging Hygiene
- [ ] No CSV row contents in logs
- [ ] No tokens in logs
- [ ] Minimal context: uid (hashed?), listId, row count

---

## D7 — Cross-Platform CSV Compatibility

### Tools
- [ ] Excel (Windows): CRLF, possible BOM
- [ ] Google Sheets: LF
- [ ] LibreOffice: LF
- [ ] Numbers (macOS): LF

### Edge Cases
- [ ] UTF-8 with BOM: parser strips and reads correctly
- [ ] Quoted fields with commas: parsed correctly
- [ ] Quoted fields with internal quotes: escaped correctly
- [ ] Empty IMDb fields: allowed, no errors

---

## D8 — Documentation & Runbooks

### Docs Updated
- [x] docs/ImportRouting.md: schema, endpoints, auth, matching, confirm
- [x] docs/ImportChecklist.md: progress tracker
- [x] docs/FrontendImportChanges.md: UI changes summary
- [x] docs/ImportTestStrategy.md (this file)

### Sample CSVs
- [ ] Provide valid-sample.csv in docs/samples/
- [ ] Provide legacy-sample.csv for testing rejection
- [ ] Provide large-sample.csv (1000+ rows) for perf testing

### Emulator How-To
- [x] Start command documented
- [x] Token acquisition documented
- [x] curl examples provided

### Known Limitations
- [x] Documented: IMDb fields may be empty
- [x] Documented: Large files take longer
- [x] Documented: TMDB API key required

---

## D9 — Release Sign-Off Checklist

Pre-deployment validation (all must pass):

### Analyze & Confirm
- [ ] Watchlist import (happy path)
- [ ] Custom list import (happy path)
- [ ] Legacy CSV → rejected with clear error
- [ ] Invalid headers → rejected with clear error

### Auth & Ownership
- [ ] 401 for missing/invalid token
- [ ] 403 for non-owner custom list
- [ ] 404 for non-existent custom list

### Duplicates & Unmatched
- [ ] Duplicates detected and excluded from matched
- [ ] Unmatched items can be manually resolved
- [ ] Manual search moves items to matched

### CSV Compatibility
- [ ] BOM handled correctly
- [ ] CRLF and LF both work
- [ ] Quoted fields parsed correctly

### Performance
- [ ] 2,000-row CSV completes in reasonable time
- [ ] No function timeouts
- [ ] No rate limit errors

### UI Flow
- [ ] Success message displays after confirm
- [ ] Redirect to correct destination (watchlist vs custom)
- [ ] Imported items appear immediately

### Approvals
- [ ] Dev lead: _______________  Date: _______
- [ ] QA lead: _______________   Date: _______

---

## Continuous Monitoring Post-Deploy

- [ ] Monitor function execution times (95th percentile)
- [ ] Monitor 401/403/404 rates (should be low)
- [ ] Monitor 400 rates (schema validation; expect some user error)
- [ ] Monitor 500 rates (should be near-zero)
- [ ] Check logs for unexpected errors or patterns
