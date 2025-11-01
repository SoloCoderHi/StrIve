# Import Standardization — QA & Release Checklist

## ✅ Implementation Status

### Phase A — Backend ✅
- [x] Strict CSV schema validation (exact headers)
- [x] Reject legacy/Letterboxd headers with 400
- [x] Matching pipeline: tmdbId → imdbId → name+year
- [x] mediaType awareness (movie vs tv)
- [x] Duplicate detection against target list
- [x] Real TMDB fetches in confirm
- [x] Auth & ownership checks (401/403/404)
- [x] Watchlist + custom list support
- [x] Idempotent confirm step

### Phase B — Hosting ✅
- [x] Canonical routes: /lists/{listId}/import/analyze|confirm
- [x] Firebase hosting rewrites configured
- [x] Documentation complete
- [x] Emulator instructions

### Phase C — Frontend ✅
- [x] Canonical routes in ImportPage and ImportReview
- [x] Fresh token handling (getIdToken(true))
- [x] Watchlist option in dropdown
- [x] Schema guidance UI
- [x] Client-side header validation
- [x] Enhanced error handling (401/403/404)
- [x] Success message banners
- [x] Smart navigation (watchlist → /my-list, custom → /my-lists/{id})

### Phase D — QA & Tests ⚠️ Partial
- [x] Export tests passing (8/8)
- [x] Test strategy documented
- [x] Sample CSVs provided
- [ ] Import unit tests need completion (helper functions scoped incorrectly)
- [ ] Integration tests with emulators (manual testing recommended)
- [ ] Performance & robustness testing

---

## Manual QA Checklist (Pre-Deploy)

### Backend Validation

#### Schema & Headers
- [ ] Valid CSV (exact headers) → 200 with matched/unmatched/duplicates
- [ ] Legacy CSV (Letterboxd URI, Name, Year) → 400 with "Legacy CSV headers detected"
- [ ] Invalid headers → 400 with "Invalid CSV headers"
- [ ] Empty optional fields (imdbId, imdbRating, imdbVotes) → accepted

#### Auth & Ownership
- [ ] No Authorization header → 401
- [ ] Invalid/expired token → 401
- [ ] Non-owner tries custom list → 403
- [ ] Non-existent custom list → 404
- [ ] Watchlist (listId='watchlist') → works for authenticated user

#### Matching Pipeline (requires TMDB_API_KEY)
- [ ] Row with tmdbId only → matched (movie)
- [ ] Row with tmdbId only → matched (tv)
- [ ] Row with imdbId only → resolves via TMDB /find → matched
- [ ] Row with name+year → searches by mediaType → matched
- [ ] Invalid tmdbId → unmatched with reason
- [ ] Name+year not found → unmatched with reason

#### Duplicate Detection
- [ ] Existing tmdbId in target → duplicate
- [ ] Existing name+year (when tmdbId empty) → duplicate
- [ ] Duplicates excluded from matched
- [ ] Duplicates included in duplicates array

#### Confirm Import
- [ ] moviesToImport with valid IDs → 201, writes to Firestore
- [ ] Idempotent: existing IDs skipped
- [ ] Watchlist writes to users/{uid}/watchlist/{tmdbId}
- [ ] Custom writes to users/{uid}/custom_lists/{listId}/items/{tmdbId}
- [ ] Empty moviesToImport → 201 with moviesAdded: 0
- [ ] Returns correct count (only new items)

---

### Frontend Validation

#### ImportPage
- [ ] Watchlist option visible and selectable in dropdown
- [ ] Schema guidance box displays correct headers
- [ ] Upload CSV → reads file and validates headers
- [ ] Valid headers → shows ✓ green checkmark
- [ ] Invalid headers → shows ✗ red X and blocks submit
- [ ] Legacy CSV → server error "Legacy CSV headers detected"
- [ ] 401 error → "Authentication failed. Please log in again."
- [ ] 403 error → "You do not have permission to access this list."
- [ ] 404 error → "List not found."
- [ ] All duplicates → "No items found to import. All items are duplicates or the CSV is empty."
- [ ] Loading state during analyze (button disabled, spinner)

#### ImportReview
- [ ] Matched items render with posters, titles, years, mediaType
- [ ] Unmatched items show row.name, row.year, row.mediaType
- [ ] Manual search opens modal
- [ ] Manual search result moves item to matched
- [ ] Ignore button removes from unmatched
- [ ] Duplicates labeled "Already in list", non-selectable
- [ ] Confirm button disabled until all unmatched resolved
- [ ] Confirm shows loading state

#### Confirm & Navigation
- [ ] Watchlist import → redirects to /my-list
- [ ] Custom list import → redirects to /my-lists/{listId}
- [ ] Success banner displays: "X items successfully imported"
- [ ] Banner auto-dismisses after 5 seconds
- [ ] Imported items visible immediately in target list

#### Error Handling
- [ ] Network failure → clear error, allows retry
- [ ] Token expiry → clear error, prompts re-auth
- [ ] Empty moviesToImport → error, no API call

#### Accessibility
- [ ] Keyboard navigation (tab, enter) works
- [ ] aria-busy on loading buttons
- [ ] Focus states visible
- [ ] Screen reader announces messages

#### Mobile/Responsive
- [ ] No horizontal overflow
- [ ] File upload accessible on touch
- [ ] Buttons tappable, not too small
- [ ] Success banner readable on small screens
- [ ] Dropdowns and modals usable

---

## Performance & Robustness

### Large CSV Testing
- [ ] 1,000 rows: analyze completes in < 30s
- [ ] 2,000 rows: analyze completes in < 60s
- [ ] 5,000 rows: analyze completes without timeout (may take 2-3 min)
- [ ] Memory stable (no leaks)

### External API Resilience
- [ ] TMDB API slow → analyze continues, may take longer
- [ ] TMDB API fails → marks items as unmatched
- [ ] IMDb API unavailable → IMDb fields empty (not used in import)
- [ ] Rate limits: pLimit(6) prevents 429 errors

### Concurrency
- [ ] Modest parallelism (6 concurrent TMDB calls)
- [ ] No rate limit errors under normal load
- [ ] Adjust pLimit if needed based on testing

---

## Security Validation

### Token Enforcement
- [ ] Only Authorization: Bearer header accepted
- [ ] No cookies relied upon
- [ ] Missing token → 401
- [ ] Invalid token → 401
- [ ] Expired token → 401 (user prompted to re-auth)

### Ownership Enforcement
- [ ] User A cannot import to User B's custom list → 403
- [ ] Watchlist always scoped to authenticated user
- [ ] Non-existent custom list → 404

### Logging Hygiene
- [ ] No CSV row contents in logs
- [ ] No tokens in logs
- [ ] Minimal context logged: uid (hashed?), listId, row count, status

---

## Cross-Platform CSV Compatibility

### Tools Tested
- [ ] Excel (Windows): CRLF, possible BOM
- [ ] Google Sheets: LF
- [ ] LibreOffice: LF
- [ ] Numbers (macOS): LF

### Edge Cases
- [ ] UTF-8 with BOM: parser handles correctly
- [ ] CRLF line endings: parsed correctly
- [ ] LF line endings: parsed correctly
- [ ] Quoted fields with commas: parsed correctly
- [ ] Quoted fields with internal quotes (escaped): parsed correctly
- [ ] Quoted fields with newlines: parsed correctly
- [ ] Empty IMDb fields: allowed, no errors

---

## Emulator Testing (Local)

### Setup
```bash
firebase emulators:start --only hosting,functions,firestore
```

### Seed Firestore
- Create user: test-user-id
- Add watchlist items (2-3 movies/TV)
- Add custom list owned by test-user-id (2-3 items)

### Obtain Token
```javascript
// In browser console after login
await firebase.auth().currentUser.getIdToken(true)
```

### Test Analyze
```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  -F file=@docs/samples/valid-sample.csv \
  http://localhost:5000/lists/watchlist/import/analyze
```

Expected: 200 with JSON { matched, unmatched, duplicates }

### Test Confirm
```bash
curl -i -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"moviesToImport":["550","13"]}' \
  http://localhost:5000/lists/watchlist/import/confirm
```

Expected: 201 with { success: true, moviesAdded: N, message }

### Verify in Firestore
- Check users/test-user-id/watchlist for new items
- Verify payload: id, title, poster_path, release_date, vote_average, media_type, dateAdded

---

## Deployment Checklist

### Pre-Deploy
- [ ] All critical QA checks above passing
- [ ] No console errors in dev/staging
- [ ] Sample CSVs tested locally
- [ ] Emulator tests passing

### Deploy
```bash
# Compile functions
cd functions && npm run build

# Deploy (staging first recommended)
firebase deploy --only functions,hosting --project staging

# Smoke test staging
# ... run critical paths ...

# Deploy production
firebase deploy --only functions,hosting --project production
```

### Post-Deploy Smoke Tests
- [ ] Import to watchlist (happy path)
- [ ] Import to custom list (happy path)
- [ ] Legacy CSV → 400 error
- [ ] Invalid token → 401 error
- [ ] Success message displays
- [ ] Items appear in target list

### Monitor (First 24h)
- [ ] Function execution times (95th percentile)
- [ ] Error rates: 401/403/404 (should be low)
- [ ] Error rates: 400 (schema validation; expect some)
- [ ] Error rates: 500 (should be near-zero)
- [ ] Check logs for unexpected patterns

---

## Known Limitations & Caveats

1. **TMDB API Key Required**: Analyze/confirm will fail without TMDB_API_KEY env var
2. **IMDb Fields Not Used**: Import only uses TMDB data; IMDb columns ignored
3. **Large Files**: 5,000+ rows may approach function timeout (adjust concurrency if needed)
4. **Rate Limits**: Very rapid imports may hit TMDB rate limits (add exponential backoff if needed)
5. **Schema Strict**: Any header deviation → 400 error (by design)

---

## Rollback Plan

If critical issues arise post-deploy:

1. **Quick Fix**: Revert hosting rewrites in firebase.json, redeploy hosting only
2. **Full Rollback**: Restore previous function code from git, redeploy functions + hosting
3. **Mitigation**: Disable import UI (feature flag or route guard) while fixing

---

## Sign-Off

### Dev Lead
- Name: _______________
- Date: _______________
- Signature: _______________

### QA Lead
- Name: _______________
- Date: _______________
- Signature: _______________

### Product Owner (if applicable)
- Name: _______________
- Date: _______________
- Signature: _______________

---

## Appendix: Test Sample CSVs

### Valid Sample
Location: `docs/samples/valid-sample.csv`
```csv
tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes
550,,Fight Club,1999,movie,8.4,8.8,2300000,2500000
13,,Forrest Gump,1994,movie,8.8,8.8,2100000,2200000
,tt0111161,The Shawshank Redemption,1994,movie,8.7,9.3,2800000,2900000
1396,,Breaking Bad,2008,tv,9.5,9.5,2000000,2100000
```

### Legacy Sample (Should Reject)
Location: `docs/samples/legacy-sample.csv`
```csv
tmdbId,Name,Year,Letterboxd URI
550,Fight Club,1999,https://letterboxd.com/film/fight-club/
```
