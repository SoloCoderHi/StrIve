# Frontend Import Changes Summary

## ImportPage.jsx ✅

### Route Changes
- **Old**: `/api/lists/${listId}/import/analyze`
- **New**: `/lists/${listId}/import/analyze`

### Token Handling
- **Old**: `await user.getIdToken()`
- **New**: `await getAuth().currentUser.getIdToken(true)` (force refresh)

### Schema Guidance Added
- Displays exact required headers with code block
- Shows tip about exporting to get correct format
- Notes which fields can be empty

### Watchlist Support
- Added "Watchlist" option to list dropdown (value: 'watchlist')
- Appears before custom lists

### Client-Side Header Validation
- Reads CSV file on selection
- Validates headers match: `tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes`
- Shows ✓/✗ indicator
- Detects legacy formats (Letterboxd URI, Name/Year with capitals)
- Blocks submission if headers invalid

### Error Handling
- 401: "Authentication failed. Please log in again."
- 403: "You do not have permission to access this list."
- 404: "List not found."
- Empty result: "No items found to import. All items are duplicates or the CSV is empty."
- Network/parse errors: Shows server message or generic error

### FormData Field Name
- Changed from 'csvFile' to 'file' (matches backend expectation)

---

## ImportReview.jsx ✅

### Route Changes
- **Old**: `/api/lists/${listId}/import/confirm`
- **New**: `/lists/${listId}/import/confirm`

### Token Handling
- **Old**: `await user.getIdToken()`
- **New**: `await getAuth().currentUser.getIdToken(true)`

### Movie ID Extraction
- **Old**: `item.movie.tmdbId.toString()`
- **New**: `String(item.movie.id || item.movie.tmdbId)` (backend returns `id`)

### Success Navigation
- **Watchlist**: Navigate to `/my-list`
- **Custom list**: Navigate to `/my-lists/${listId}`
- Passes `importSuccess` (count) and `message` in location.state

### Error Handling
- 401: "Authentication failed. Please log in again."
- 403: "You do not have permission to access this list."
- 404: "List not found."
- Empty moviesToImport: Shows error, returns early
- Network/parse errors: Shows server message or generic error

### Unmatched Items Display
- Now reads `item.row.name` (lowercase) in addition to `item.row.Name` (fallback)
- Shows `item.row.year` and `item.row.mediaType` in subtitle

### Manual Search Modal
- Updated to read both `name`/`Name` and `year`/`Year` (schema transition compatibility)

---

## MyListPage.jsx ✅

### Success Message Display
- Reads `location.state.importSuccess` (count) and `location.state.message`
- Shows green banner with message for 5 seconds
- Auto-dismisses via timer

### Import Additions
- Added `useLocation` from react-router-dom

---

## ListDetailsPage.jsx ✅

### Success Message Display
- Reads `location.state.importSuccess` and `location.state.message`
- Shows green banner for 5 seconds
- Auto-dismisses

### Import Additions
- Added `useLocation` from react-router-dom

---

## Removed Legacy References
- No `/api/` routes remain in import flows
- No Letterboxd/OMDb UI copy
- Clean error messages focused on TMDB/app workflow

---

## Testing Checklist
- [ ] ImportPage: Watchlist option appears and is selectable
- [ ] ImportPage: Invalid CSV headers trigger client error
- [ ] ImportPage: Valid headers show ✓ and enable submit
- [ ] ImportPage: 401/403/404 errors display correct messages
- [ ] ImportReview: Matched/unmatched/duplicates render correctly
- [ ] ImportReview: Manual search moves items to matched
- [ ] ImportReview: Confirm navigates to correct destination (watchlist vs custom)
- [ ] MyListPage: Success message displays after import
- [ ] ListDetailsPage: Success message displays after import
- [ ] No console errors on import flow
- [ ] Mobile layout: Import forms and buttons accessible
