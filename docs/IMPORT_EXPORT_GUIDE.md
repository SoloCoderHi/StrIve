# Import/Export Guide

## User Guide

### Exporting Lists

**From the My Lists page (`/my-lists`):**
1. Click the **Export CSV** button next to any list (Watchlist or custom lists)
2. The CSV file will download automatically
3. Filename format: `<ListName>-YYYYMMDD.csv`

**From a List Detail page:**
1. Open any list (Watchlist or custom list)
2. Click the **Export CSV** button near the list title
3. The CSV file will download automatically

**Export Behavior:**
- ✅ Returns CSV with all list items
- ✅ Empty lists show info message: "No items to export"
- ✅ Errors show clear failure messages
- ✅ Filename includes date for versioning

---

### Importing Lists

**Step 1: Access Import**
- Go to **My Lists** page (`/my-lists`)
- Click the **Import CSV** button (top right)

**Step 2: Download Template (Optional but Recommended)**
- Click **Download Template** to get a sample CSV
- Template includes:
  - Exact header format
  - Example row (The Matrix)
  - Shows which fields are optional

**Step 3: Prepare Your CSV**
Your CSV must have these exact headers (case-sensitive):
```
tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes
```

**Field Notes:**
- `tmdbId`: Required (TMDB movie/show ID)
- `imdbId`: Optional (e.g., tt0133093)
- `name`: Required (movie/show title)
- `year`: Required (release year)
- `mediaType`: Required (movie or tv)
- `tmdbRating`: Optional (decimal, e.g., 8.2)
- `imdbRating`: Optional (decimal, e.g., 8.7)
- `tmdbVotes`: Optional (integer, e.g., 2000000)
- `imdbVotes`: Optional (integer, e.g., 1900000)

**Step 4: Select Target List**
- Choose **Watchlist** or any **custom list** from the dropdown
- You must select a list before uploading

**Step 5: Upload CSV**
- Click **Choose File** and select your CSV
- Client-side validation checks header format
- Invalid headers are blocked with clear error messages

**Step 6: Review and Select Items**
- **Matched Items:** Found in TMDB database
  - All items are checked by default
  - Uncheck items you don't want to import
  - Use **Select All** / **Deselect All** for bulk control
- **Unmatched Items:** Not found automatically
  - Click **Search** to manually find the correct movie/show
  - Click **Ignore** to skip the item
- **Duplicates:** Already in your list
  - These are shown but won't be imported

**Step 7: Confirm Import**
- Button shows: "Confirm Import (X items)"
- Only checked items will be imported
- All unmatched items must be resolved or ignored first

**Step 8: Success**
- You'll be redirected to the list
- Success message shows: "X items successfully imported"

---

## CSV Format Requirements

### Valid Example
```csv
tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes
603,tt0133093,The Matrix,1999,movie,8.2,8.7,2000000,1900000
550,,Fight Club,1999,movie,8.4,,,
```

### Invalid Examples

**Wrong headers (case mismatch):**
```csv
TmdbId,ImdbId,Name,Year,MediaType  ❌
```

**Wrong order:**
```csv
name,year,tmdbId,imdbId,mediaType  ❌
```

**Legacy Letterboxd format:**
```csv
tmdbId,Name,Year,Letterboxd URI  ❌
```

---

## Troubleshooting

### "Invalid CSV headers" Error
- **Cause:** Headers don't match exactly
- **Solution:** Use the template download or copy headers from docs

### "No items to export"
- **Cause:** List is empty
- **Solution:** Add items to the list before exporting

### "Legacy CSV format detected"
- **Cause:** Using old export format from external tools
- **Solution:** Export from this app to get correct format

### Import Button Disabled
- **Cause:** No file selected or headers invalid
- **Solution:** Select valid CSV file with correct headers

### Confirm Import Disabled
- **Cause:** No items selected or unmatched items remain
- **Solution:** Check at least one item and resolve/ignore unmatched items

### Large File Performance
- CSV parsing may take longer for files with 1000+ rows
- This is normal; wait for analysis to complete
- Consider splitting very large imports

---

## Developer Notes

### Import Flow URLs
- **Entry:** `/my-lists` → Import CSV button
- **Legacy redirect:** `/import` → redirects to `/my-lists`
- **Analysis:** `/import/review` (with state)
- **Target:** Returns to `/my-list` or `/my-lists/{listId}`

### Export Implementation
- **Utility:** `src/util/exportDownload.js`
- **Endpoint:** `/lists/{listId}/export`
- **Filename:** Server Content-Disposition or fallback
- **Fallback format:** `<ListName>-YYYYMMDD.csv`
- **Cleanup:** `URL.revokeObjectURL()` after download

### Template Generation
- **Utility:** `src/util/csvTemplate.js`
- **Filename:** `strive-import-template.csv`
- **Example data:** The Matrix (1999)

### State Management
- **Matched items:** Stored in `checkedItems` Set
- **Default:** All matched items checked
- **Auto-check:** Items moved from Unmatched to Matched
- **Confirm:** Only checked item IDs sent to backend

### Accessibility
- All buttons have `aria-label` attributes
- Checkboxes have descriptive labels
- Disabled states properly indicated with `aria-busy`
- Keyboard navigation fully supported

### Error Handling
- 204 No Content → "No items to export"
- 400 Bad Request → Server error message
- 401 Unauthorized → "Please sign in"
- 403 Forbidden → "No permission"
- 404 Not Found → "List not found"
- 500 Server Error → "Try again"

---

## Browser Compatibility

### Tested Browsers
- Chrome/Edge (Chromium) ✅
- Firefox ✅
- Safari ✅

### Download Behavior
- Content-Disposition honored in modern browsers
- Fallback filename works if header missing/ignored
- Object URLs properly cleaned up to prevent memory leaks

### CSV Parsing
- Client-side: PapaParse library
- Server-side: PapaParse (Node.js)
- Handles quoted fields, commas in values, newlines

---

## Change Log

### v1.0 (Current)
- ✅ Template CSV download
- ✅ Selective import with checkboxes
- ✅ Select All / Deselect All
- ✅ Export buttons on list rows
- ✅ /import redirect to /my-lists
- ✅ Enhanced error messages
- ✅ Accessibility improvements

### Future Enhancements
- Batch export (all lists to one CSV)
- Import preview with poster images
- Drag-and-drop CSV upload
- Import from URL
