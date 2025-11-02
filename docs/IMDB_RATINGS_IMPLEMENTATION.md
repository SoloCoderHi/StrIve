# IMDB Ratings and Votes Implementation

## Overview
This document describes the implementation of IMDB ratings and vote counts storage and export functionality.

## Problem Statement
Previously, the CSV export functionality only included TMDB ratings and votes. While IMDB IDs were exported, the actual IMDB ratings and vote counts were missing from the exported CSV files.

## Solution
The solution involves two main components:

### 1. Storage: Fetch and Store IMDB Data When Adding Items to Lists

**Files Modified:**
- `src/util/firestoreService.js`

**Changes:**
- Added `fetchImdbData()` helper function that:
  - Uses the existing `imdbResolver` to get the IMDB ID from TMDB ID
  - Uses the existing `IMDbService` to fetch title data from IMDB API
  - Extracts `rating.star` (IMDB rating) and `rating.count` (IMDB votes)
  - Returns empty strings if data is unavailable (graceful fallback)

- Updated `addToList()` function to:
  - Fetch IMDB data before saving
  - Store `imdbId`, `imdbRating`, and `imdbVotes` along with existing fields
  - Also added `vote_count` (TMDB votes) which was missing

- Updated `addItemToCustomList()` function to:
  - Same changes as `addToList()` for custom lists

**Data Structure:**
```javascript
{
  id: mediaItem.id,
  title: mediaItem.title || mediaItem.name,
  poster_path: mediaItem.poster_path,
  release_date: mediaItem.release_date || mediaItem.first_air_date,
  vote_average: mediaItem.vote_average,          // TMDB rating
  vote_count: mediaItem.vote_count,              // TMDB votes (NEW)
  media_type: mediaType,
  dateAdded: new Date().toISOString(),
  imdbId: imdbData.imdbId,                       // IMDB ID (NEW)
  imdbRating: imdbData.imdbRating,               // IMDB rating (NEW)
  imdbVotes: imdbData.imdbVotes,                 // IMDB votes (NEW)
}
```

### 2. Export: Include Stored IMDB Data in CSV Export

**Files Modified:**
- `src/util/clientSideExport.js`
- `src/util/exportToCsv.js`
- `src/util/__tests__/exportToCsv.test.js`

**Changes in clientSideExport.js:**
- Updated to use stored `imdbRating` and `imdbVotes` from Firestore items
- Falls back to fetching IMDB ID if not stored (for backward compatibility)

**Changes in exportToCsv.js:**
- Updated CSV headers to:
  ```
  List Name, Title, Year, Type, TMDB Rating, IMDB Rating, TMDB Votes, IMDB Votes, Date Added, TMDB ID, IMDB ID
  ```
- Added columns for IMDB Rating, IMDB Votes, TMDB Votes, and IMDB ID
- Both `mapSingleListToCsv()` and `mapListsToCsv()` functions updated

**Changes in test file:**
- Updated all test expectations to match new CSV format
- Added mock IMDB data to test fixtures
- All tests passing ✓

## Benefits

1. **Complete Data Export**: Users now get both TMDB and IMDB ratings/votes in their CSV exports
2. **Faster Exports**: IMDB data is pre-fetched and stored, making exports faster
3. **Better Reliability**: Data is fetched once when adding items, reducing API call failures during export
4. **Backward Compatible**: Falls back gracefully if IMDB data is unavailable
5. **No Breaking Changes**: Existing functionality continues to work

## Data Flow

### When Adding Items to Lists:
```
User adds movie/show to list
    ↓
Fetch IMDB ID from TMDB (via imdbResolver)
    ↓
Fetch IMDB rating data (via IMDbService)
    ↓
Store in Firestore with TMDB + IMDB data
```

### When Exporting Lists:
```
User clicks export
    ↓
Fetch items from Firestore (includes IMDB data)
    ↓
Generate CSV with all ratings and votes
    ↓
Download CSV file
```

## Environment Requirements

The implementation uses existing environment variables:
- `VITE_TMDB_KEY`: For TMDB API access (already required)
- `VITE_IMDB_BASE_URL`: For IMDB API access (already required)

No new environment variables needed!

## Error Handling

The implementation includes robust error handling:
- If IMDB API is unavailable, empty strings are stored (non-blocking)
- If IMDB service is not configured, it logs a warning and continues
- Export works even if some items are missing IMDB data
- All errors are logged to console for debugging

## Testing

- ✅ Unit tests updated and passing
- ✅ Build successful
- ✅ No breaking changes to existing functionality
- ⚠️ **Note**: For existing list items, IMDB data will be empty until items are re-added

## Future Improvements

Potential enhancements for future iterations:
1. Add a "Refresh IMDB Data" button to update existing items
2. Batch update existing items with IMDB data via a migration script
3. Add IMDB ratings display in the UI (not just export)
4. Cache IMDB data with expiration for periodic updates

## Notes for Existing Data

- **New items**: Will have IMDB ratings/votes automatically stored
- **Existing items**: Will have empty IMDB fields in exports until re-added
- No data migration is performed to avoid unnecessary API calls
- Users can re-add items if they want IMDB data for existing entries
