import {
  getPendingItemsInList,
  updateItemEnrichment,
  fetchUserLists,
} from "../util/firestoreService";
import tmdbApiService from "./tmdbApiService";
import imdbApiService from "./imdbApiService";

/**
 * Enrichment Service
 * Orchestrates the fetching of missing data for items in the background.
 */
class EnrichmentService {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
  }

  /**
   * Start the enrichment process for a user
   * @param {string} userId
   */
  async startEnrichment(userId) {
    if (this.isProcessing || !userId) return;
    this.isProcessing = true;
    console.log("Starting background enrichment...");

    try {
      // 1. Get all user lists
      const lists = await fetchUserLists(userId);

      // 2. Iterate through lists to find pending items
      for (const list of lists) {
        if (!this.isProcessing) break; // Stop if requested

        // Get a batch of pending items
        const pendingItems = await getPendingItemsInList(userId, list.id, 5);

        if (pendingItems.length > 0) {
          console.log(
            `Found ${pendingItems.length} pending items in list ${list.name}`
          );

          // Process each item
          for (const item of pendingItems) {
            if (!this.isProcessing) break;
            await this.enrichItem(userId, list.id, item);

            // Throttle: Wait 2 seconds between items
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
    } catch (error) {
      console.error("Enrichment process failed:", error);
    } finally {
      this.isProcessing = false;
      console.log("Enrichment process finished/stopped.");
    }
  }

  stop() {
    this.isProcessing = false;
  }

  /**
   * Enrich a single item
   */
  async enrichItem(userId, listId, item) {
    try {
      console.log(`Enriching item: ${item.title} (ID: ${item.id})`);

      // Skip if already enriched
      if (item.enrichmentStatus === "enriched") {
        console.log(`${item.title} already enriched, skipping`);
        return;
      }

      let updates = {};
      let hasTmdbData = false;
      let hasImdbData = false;

      const tmdbId = item.tmdbId;
      const imdbId = item.imdbId;

      // 1. Fetch TMDB Data (ratings, genres, cast, crew, overview, backdrop)
      if (tmdbId) {
        console.log(`Fetching TMDB data for ${item.title} (TMDB: ${tmdbId})`);
        
        const tmdbData = await tmdbApiService.getDetails(
          item.media_type || "movie",
          tmdbId
        );
        
        if (tmdbData) {
          hasTmdbData = true;
          
          // Extract ratings
          updates.tmdb_rating = tmdbData.vote_average || null;
          updates.tmdb_vote_count = tmdbData.vote_count || null;
          updates.vote_average = tmdbData.vote_average || 0;
          updates.vote_count = tmdbData.vote_count || 0;
          
          // Extract metadata
          updates.overview = tmdbData.overview || null;
          updates.backdrop_path = tmdbData.backdrop_path || null;
          updates.genres = tmdbData.genres || null;
          updates.status = tmdbData.status || null;
          updates.tagline = tmdbData.tagline || null;
          
          // Extract cast (top 10)
          if (tmdbData.credits?.cast) {
            updates.cast = tmdbData.credits.cast.slice(0, 10).map((c) => ({
              id: c.id,
              name: c.name,
              character: c.character,
              profile_path: c.profile_path,
            }));
          }
          
          // Extract crew (top 5)
          if (tmdbData.credits?.crew) {
            updates.crew = tmdbData.credits.crew.slice(0, 5).map((c) => ({
              id: c.id,
              name: c.name,
              job: c.job,
              profile_path: c.profile_path,
            }));
          }
          
          console.log(`✓ TMDB data fetched for ${item.title}`);
        }
      }

      // 2. Fetch IMDb Data (ratings - prioritize over TMDB)
      if (imdbId) {
        console.log(`Fetching IMDb data for ${item.title} (IMDb: ${imdbId})`);
        
        const imdbData = await imdbApiService.getTitle(imdbId);
        const enrichedImdb = imdbApiService.extractEnrichmentData(imdbData);
        
        if (enrichedImdb && enrichedImdb.imdb_rating) {
          hasImdbData = true;
          
          updates.imdb_rating = enrichedImdb.imdb_rating;
          updates.imdb_vote_count = enrichedImdb.imdb_vote_count;
          
          // Prioritize IMDb rating for display
          updates.vote_average = enrichedImdb.imdb_rating;
          updates.vote_count = enrichedImdb.imdb_vote_count;
          
          console.log(`✓ IMDb data fetched for ${item.title}`);
        }
      }

      // 3. Only mark as enriched if we got data from at least one source
      if (hasTmdbData || hasImdbData) {
        updates.enrichmentStatus = "enriched";
        updates.lastEnriched = new Date().toISOString();
        
        await updateItemEnrichment(userId, listId, item.id, updates);
        console.log(
          `✓ Enriched ${item.title} successfully. Rating: ${updates.vote_average}`
        );
      } else {
        // Mark as failed enrichment
        await updateItemEnrichment(userId, listId, item.id, {
          enrichmentStatus: "failed",
          lastEnriched: new Date().toISOString(),
        });
        console.log(`✗ No data found for ${item.title}, marked as failed`);
      }
    } catch (error) {
      console.error(`Error enriching item ${item.id}:`, error);
      
      // Mark as failed
      try {
        await updateItemEnrichment(userId, listId, item.id, {
          enrichmentStatus: "failed",
          lastEnriched: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error(`Failed to mark item as failed:`, updateError);
      }
    }
  }
}

export default new EnrichmentService();
