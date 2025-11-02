# QA Test Checklist — Import/Export

## Phase D — Manual QA Scenarios

### Test Environment Setup
- [ ] Clear browser cache
- [ ] Sign in with test account
- [ ] Create at least 2 custom lists with items
- [ ] Add items to Watchlist
- [ ] Prepare test CSVs (valid, invalid, legacy, empty)

---

## Export Testing

### Export from /my-lists Page

**Watchlist Export:**
- [ ] Click "Export CSV" on Watchlist row
- [ ] Verify file downloads with name: `Watchlist-YYYYMMDD.csv`
- [ ] Open in Excel/Sheets - verify headers match spec
- [ ] Verify data: tmdbId, name, year, mediaType populated
- [ ] Check decimal dots preserved (tmdbRating, imdbRating)
- [ ] Check integer votes preserved (no scientific notation)

**Custom List Export:**
- [ ] Click "Export CSV" on custom list row
- [ ] Verify filename: `<ListName>-YYYYMMDD.csv`
- [ ] Verify all list items present
- [ ] Verify no duplicate entries

**Empty List Export:**
- [ ] Create empty custom list
- [ ] Click "Export CSV"
- [ ] Verify toast: "No items to export"
- [ ] Verify no file downloads

**Export Button States:**
- [ ] Button shows Download icon
- [ ] Button is tabbable (keyboard accessible)
- [ ] Button has aria-label
- [ ] Loading state prevents double-click
- [ ] Button disables while exporting

### Export from List Detail Pages

**Watchlist Detail (`/my-list`):**
- [ ] Navigate to Watchlist detail page
- [ ] Click "Export CSV" button near title
- [ ] Verify same behavior as row export
- [ ] Verify filename: `Watchlist-YYYYMMDD.csv`

**Custom List Detail (`/my-lists/{listId}`):**
- [ ] Navigate to custom list detail page
- [ ] Click "Export CSV" button
- [ ] Verify filename matches list name
- [ ] Verify all items exported

**Consistency Check:**
- [ ] Export same list from /my-lists and detail page
- [ ] Compare CSV files - should be identical
- [ ] Verify same filename format

---

## Import Testing

### Template Download

**Download Functionality:**
- [ ] Go to `/my-lists`, click "Import CSV"
- [ ] Click "Download Template" button
- [ ] Verify file downloads: `strive-import-template.csv`
- [ ] Open file - verify headers exactly match spec
- [ ] Verify example row: The Matrix, 1999, movie
- [ ] Verify IMDb fields populated (tt0133093, etc.)

### CSV Validation (Client-Side)

**Valid CSV:**
- [ ] Select valid CSV file
- [ ] Verify no error message
- [ ] "Analyze" button enabled
- [ ] File name displayed

**Invalid Headers (Case Mismatch):**
```csv
TmdbId,ImdbId,Name,Year,MediaType
```
- [ ] Upload file
- [ ] Verify error: "Invalid CSV headers"
- [ ] Verify "Analyze" button disabled
- [ ] Error shows expected headers

**Invalid Headers (Wrong Order):**
```csv
name,year,tmdbId,imdbId,mediaType
```
- [ ] Upload file
- [ ] Verify error message
- [ ] "Analyze" button disabled

**Legacy Format:**
```csv
tmdbId,Name,Year,Letterboxd URI
```
- [ ] Upload file
- [ ] Verify error: "Legacy CSV format detected"
- [ ] Message suggests using app export

**Empty File:**
- [ ] Upload empty CSV or only headers
- [ ] Verify appropriate error handling

### Target List Selection

**Watchlist:**
- [ ] Select "Watchlist" from dropdown
- [ ] Upload valid CSV
- [ ] Click "Analyze"
- [ ] Verify navigation to review page
- [ ] Verify state preserved (listId = 'watchlist')

**Custom List:**
- [ ] Select custom list from dropdown
- [ ] Upload valid CSV
- [ ] Analyze and verify correct listId

**No List Selected:**
- [ ] Leave dropdown at "Choose a list..."
- [ ] Attempt to upload
- [ ] Verify validation prevents submission

### Review Screen - Matched Items

**Checkbox Functionality:**
- [ ] All items checked by default
- [ ] Click checkbox - item unchecks
- [ ] Click again - item checks
- [ ] Verify visual feedback (checkmark visible/hidden)

**Select All / Deselect All:**
- [ ] All items checked - button shows "Deselect All"
- [ ] Click - all items uncheck
- [ ] Button changes to "Select All"
- [ ] Click - all items check
- [ ] Partial selection - button shows "Select All"

**Selected Count Display:**
- [ ] Verify count: "(X selected)" shown in header
- [ ] Check/uncheck items - count updates
- [ ] Count matches number of checked items

**Confirm Button:**
- [ ] Button text: "Confirm Import (X items)"
- [ ] Count matches checked items
- [ ] All unchecked - button disabled
- [ ] Check one item - button enabled

### Review Screen - Unmatched Items

**Search Functionality:**
- [ ] Click "Search" on unmatched item
- [ ] Modal opens with search
- [ ] Enter title - results appear
- [ ] Select movie - moves to Matched
- [ ] Newly matched item is auto-checked
- [ ] Selected count updates

**Ignore Functionality:**
- [ ] Click "Ignore" on unmatched item
- [ ] Item removed from Unmatched list
- [ ] Unmatched count decreases

**Confirm Button Disabled:**
- [ ] Leave unmatched items unresolved
- [ ] Confirm button disabled
- [ ] Error message: "Please resolve all unmatched items"

### Review Screen - Duplicates

**Display:**
- [ ] Duplicates section shows items already in list
- [ ] Count displayed
- [ ] Items shown but not selectable
- [ ] No checkboxes on duplicates

### Confirm Import

**Success Flow:**
- [ ] Check desired items
- [ ] Resolve all unmatched
- [ ] Click "Confirm Import"
- [ ] Loading spinner shows
- [ ] Button disabled during import
- [ ] Redirects to list page
- [ ] Success message: "X items successfully imported"
- [ ] Verify items appear in list

**No Items Selected:**
- [ ] Uncheck all items
- [ ] Click "Confirm Import"
- [ ] Verify error: "No items selected to import"
- [ ] No navigation occurs

**Network Error:**
- [ ] Simulate network failure (DevTools)
- [ ] Click "Confirm Import"
- [ ] Verify error message
- [ ] User can retry

---

## Cross-Browser Testing

### Chrome/Edge (Chromium)
- [ ] All import flows work
- [ ] All export flows work
- [ ] CSV downloads correctly
- [ ] Filename from Content-Disposition respected
- [ ] Object URLs cleaned up (no memory leak)

### Firefox
- [ ] All import flows work
- [ ] All export flows work
- [ ] CSV downloads correctly
- [ ] Filename handling works
- [ ] Checkboxes render correctly

### Safari (macOS/iOS)
- [ ] All import flows work
- [ ] All export flows work
- [ ] CSV downloads correctly (may auto-open)
- [ ] Filename handling works
- [ ] Mobile responsive layout works

---

## Accessibility Testing

### Keyboard Navigation

**My Lists Page:**
- [ ] Tab to "Import CSV" button - Enter works
- [ ] Tab to "Export CSV" buttons - Enter works
- [ ] Tab to "Open" buttons - Enter works
- [ ] Focus visible on all buttons

**Import Page:**
- [ ] Tab through form fields
- [ ] File input accessible
- [ ] Dropdown accessible
- [ ] "Download Template" button accessible
- [ ] "Analyze" button accessible

**Review Page:**
- [ ] Tab to checkboxes - Space toggles
- [ ] Tab to "Select All" button - Enter works
- [ ] Tab to Search/Ignore buttons - Enter works
- [ ] Tab to "Confirm Import" - Enter works

### Screen Reader

**Button Labels:**
- [ ] "Import CSV" announced clearly
- [ ] "Export CSV" announced with list name
- [ ] Checkboxes announce item titles
- [ ] Loading states announced (aria-busy)

**Error Messages:**
- [ ] Errors announced when shown
- [ ] Clear actionable messages

### Visual Indicators

- [ ] Disabled buttons visually distinct
- [ ] Loading states clear (spinner + text)
- [ ] Focus outlines visible
- [ ] Error messages in red
- [ ] Success messages in green

---

## Mobile/Responsive Testing

### Mobile Layout (< 768px)

**/my-lists Page:**
- [ ] Buttons don't overflow
- [ ] "Import CSV" button reachable
- [ ] Export/Open buttons accessible
- [ ] List cards stack vertically

**Import Page:**
- [ ] Form fits screen width
- [ ] "Download Template" button accessible
- [ ] File input works on mobile
- [ ] Dropdown accessible

**Review Page:**
- [ ] Checkboxes large enough to tap
- [ ] "Select All" button accessible
- [ ] Cards stack vertically (1 column on mobile)
- [ ] Confirm button full width

### Tablet Layout (768px - 1024px)

- [ ] 2-column grid for matched items
- [ ] Buttons properly sized
- [ ] All actions accessible

---

## Performance Testing

### Large CSV Files

**500 rows:**
- [ ] Upload completes
- [ ] Analysis returns in reasonable time (< 10s)
- [ ] Review page renders smoothly
- [ ] Select All works without lag
- [ ] Confirm import succeeds

**1000 rows:**
- [ ] Upload completes
- [ ] Analysis may take longer (note shown)
- [ ] Review page renders (may be slow)
- [ ] Confirm import succeeds

**Edge Case:**
- [ ] CSV with 5000+ rows
- [ ] System handles gracefully or shows limit

### Export Performance

- [ ] Export 500+ items
- [ ] Download completes
- [ ] No browser hang
- [ ] File size reasonable (< 1MB for 1000 items)

---

## Error Scenarios

### Authentication Errors

- [ ] Log out mid-import
- [ ] Verify 401 error: "Please sign in"
- [ ] Log out mid-export
- [ ] Verify 401 error

### Permission Errors

- [ ] Try to import to another user's list (if testable)
- [ ] Verify 403 error: "No permission"

### Network Errors

- [ ] Disconnect network
- [ ] Try import - verify error message
- [ ] Try export - verify error message
- [ ] Reconnect - actions work again

### Invalid Data

- [ ] CSV with invalid tmdbIds (non-existent)
- [ ] Verify shown in Unmatched
- [ ] CSV with malformed rows
- [ ] Verify handled gracefully

---

## Regression Testing

### Existing Features Still Work

- [ ] Create new list works
- [ ] Delete list works
- [ ] Add item to list works
- [ ] Remove item from list works
- [ ] Search functionality works
- [ ] Movie/show details page loads
- [ ] Watchlist page works

---

## Documentation Review

- [ ] IMPORT_EXPORT_GUIDE.md accurate
- [ ] All screenshots up-to-date (if any)
- [ ] Code comments clear
- [ ] README mentions import/export (if applicable)

---

## Sign-Off

### Test Summary
- Total tests: ___
- Passed: ___
- Failed: ___
- Blocked: ___

### Blocker Issues
1. _____
2. _____

### Non-Blocker Issues
1. _____
2. _____

### Browser Coverage
- [ ] Chrome/Edge
- [ ] Firefox
- [ ] Safari

### Device Coverage
- [ ] Desktop
- [ ] Tablet
- [ ] Mobile

### Tester: ____________
### Date: ____________
### Build: ____________
