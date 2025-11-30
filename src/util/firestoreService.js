import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  getDoc,
  query,
  addDoc,
  limit,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { getImdbId } from "./imdbResolver";
import IMDbService from "./imdbService";

/**
 * Fetches IMDB rating and votes for a media item
 * @param {string} tmdbId - The TMDB ID
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Promise<Object>} Object with imdbRating, imdbVotes, and imdbId
 */
const fetchImdbData = async (tmdbId, mediaType) => {
  try {
    const imdbService = new IMDbService();
    const imdbId = await getImdbId(tmdbId, mediaType);

    if (!imdbId) {
      return { imdbId: "", imdbRating: "", imdbVotes: "" };
    }

    const titleData = await imdbService.getTitleById(imdbId);

    return {
      imdbId: imdbId,
      imdbRating: titleData?.rating?.star || "",
      imdbVotes: titleData?.rating?.count || "",
    };
  } catch (error) {
    console.warn(`Failed to fetch IMDB data: ${error.message}`);
    return { imdbId: "", imdbRating: "", imdbVotes: "" };
  }
};

/**
 * Adds or updates a media item in a user's specific list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listName - The name of the collection (e.g., "watchlist", "watched").
 * @param {object} mediaItem - The movie or TV show object to save.
 */
export const addToList = async (userId, listName, mediaItem) => {
  try {
    const mediaType =
      mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

    // Fetch IMDB data
    const imdbData = await fetchImdbData(mediaItem.id, mediaType);

    const itemToSave = {
      id: mediaItem.id,
      title: mediaItem.title || mediaItem.name,
      poster_path: mediaItem.poster_path,
      release_date: mediaItem.release_date || mediaItem.first_air_date,
      vote_average: mediaItem.vote_average,
      vote_count: mediaItem.vote_count,
      media_type: mediaType,
      dateAdded: new Date().toISOString(),
      imdbId: imdbData.imdbId,
      imdbRating: imdbData.imdbRating,
      imdbVotes: imdbData.imdbVotes,
    };
    const itemRef = doc(db, "users", userId, listName, String(mediaItem.id));
    await setDoc(itemRef, itemToSave);
    console.log(`Successfully added ${itemToSave.title} to ${listName}`);
  } catch (error) {
    console.error("Error adding document: ", error);
    throw error;
  }
};

/**
 * Fetches all items from a user's specific list in Firestore.
 * @param {string} userId - The UID of the user.
 * @param {string} listName - The name of the list (e.g., "watchlist").
 * @returns {Promise<Array>} - A promise that resolves to an array of media items.
 */
export const getList = async (userId, listName) => {
  try {
    const listCollectionRef = collection(
      db,
      "users",
      String(userId),
      String(listName)
    );
    const querySnapshot = await getDocs(listCollectionRef);
    try {
      const list = querySnapshot.docs.map((doc) => doc.data());
      return list;
    } catch (error) {
      console.error("Error parsing documents: ", error);
      return []; // Return empty list if parsing fails
    }
  } catch (error) {
    console.error("Error fetching list: ", error);
    throw error;
  }
};

/**
 * Removes a media item from a user's specific list in Firestore.
 * @param {string} userId - The UID of the user.
 * @param {string} listName - The name of the list (e.g., "watchlist").
 * @param {string|number} mediaId - The ID of the media item to remove.
 */
export const removeFromList = async (userId, listName, mediaId) => {
  try {
    const itemRef = doc(db, "users", userId, listName, String(mediaId));
    await deleteDoc(itemRef);
    console.log(`Successfully removed item ${mediaId} from ${listName}`);
  } catch (error) {
    console.error("Error removing document: ", error);
    throw error;
  }
};

/**
 * Creates a new custom list for a user in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {Object} listData - The data for the new list (e.g., { name: 'Test List' }).
 * @returns {Promise<string>} - A promise that resolves to the ID of the created list.
 */
export const createCustomList = async (userId, listData) => {
  try {
    const customListsRef = collection(db, "users", userId, "custom_lists");
    const newListData = {
      ...listData,
      createdAt: new Date(),
      ownerId: userId,
    };
    const docRef = await addDoc(customListsRef, newListData);
    console.log(`Successfully created custom list with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating custom list: ", error);
    throw error;
  }
};

/**
 * Deletes a custom list and all its items from Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to delete.
 */
export const deleteCustomList = async (userId, listId) => {
  try {
    // First, delete all items in the list's items subcollection
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );
    const itemsSnapshot = await getDocs(itemsCollectionRef);

    const deletePromises = itemsSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Then, delete the list document itself
    const listRef = doc(db, "users", userId, "custom_lists", listId);
    await deleteDoc(listRef);
    console.log(`Successfully deleted custom list with ID: ${listId}`);
  } catch (error) {
    console.error("Error deleting custom list: ", error);
    throw error;
  }
};

/**
 * Adds an item to a custom list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to add the item to.
 * @param {Object} mediaItem - The media item to add to the list.
 */
export const addItemToCustomList = async (userId, listId, mediaItem) => {
  try {
    const mediaType =
      mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

    // Fetch IMDB data
    const imdbData = await fetchImdbData(mediaItem.id, mediaType);

    const itemToSave = {
      id: mediaItem.id,
      title: mediaItem.title || mediaItem.name,
      poster_path: mediaItem.poster_path,
      release_date: mediaItem.release_date || mediaItem.first_air_date,
      vote_average: mediaItem.vote_average,
      vote_count: mediaItem.vote_count,
      media_type: mediaType,
      dateAdded: new Date(),
      imdbId: imdbData.imdbId,
      imdbRating: imdbData.imdbRating,
      imdbVotes: imdbData.imdbVotes,
    };
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );
    const itemRef = doc(itemsCollectionRef, String(mediaItem.id));
    await setDoc(itemRef, itemToSave);
    console.log(
      `Successfully added ${itemToSave.title} to custom list ${listId}`
    );
  } catch (error) {
    console.error("Error adding item to custom list: ", error);
    throw error;
  }
};

/**
 * Adds multiple items to a custom list in Firestore using batch writes.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list.
 * @param {Array} items - Array of media items to add.
 */
export const addItemsToCustomListBatch = async (userId, listId, items) => {
  try {
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );

    // Process items in chunks of 500 (Firestore batch limit)
    const chunkSize = 450; // Safety margin
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const currentBatch = writeBatch(db);

      const promises = chunk.map(async (mediaItem) => {
        const mediaType =
          mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

        // Note: Fetching IMDB data for each item might be slow/rate-limited.
        // For batch operations, we might skip IMDB data or fetch it lazily later.
        // For now, we'll skip IMDB fetch to ensure speed and avoid timeouts.

        const itemToSave = {
          // === IDs ===
          id: String(mediaItem.id),
          tmdbId: mediaItem.tmdbId || null,
          simklId: mediaItem.simklId || null,
          imdbId: mediaItem.imdbId || null,
          tvdbId: mediaItem.tvdbId || null,
          malId: mediaItem.malId || null,
          anilistId: mediaItem.anilistId || null,
          anidbId: mediaItem.anidbId || null,
          
          // === Basic Info ===
          title: mediaItem.title || mediaItem.name || "",
          year: mediaItem.year || null,
          poster_path: mediaItem.poster_path || null,
          release_date: mediaItem.release_date || mediaItem.first_air_date || null,
          first_air_date: mediaItem.first_air_date || null,
          media_type: mediaType,
          runtime: mediaItem.runtime || null,
          
          // === User Data ===
          status: mediaItem.status || null,
          watchedAt: mediaItem.watchedAt || null,
          addedToWatchlistAt: mediaItem.addedToWatchlistAt || null,
          user_rating: mediaItem.user_rating || null,
          watchedEpisodesCount: mediaItem.watchedEpisodesCount || 0,
          totalEpisodesCount: mediaItem.totalEpisodesCount || 0,
          notAiredEpisodesCount: mediaItem.notAiredEpisodesCount || 0,
          nextToWatch: mediaItem.nextToWatch || null,
          lastWatched: mediaItem.lastWatched || null,
          animeType: mediaItem.animeType || null,
          
          // === Ratings (placeholders - filled by enrichment) ===
          vote_average: mediaItem.vote_average || 0,
          vote_count: mediaItem.vote_count || 0,
          tmdb_rating: mediaItem.tmdb_rating || null,
          tmdb_vote_count: mediaItem.tmdb_vote_count || null,
          imdb_rating: mediaItem.imdb_rating || null,
          imdb_vote_count: mediaItem.imdb_vote_count || null,
          
          // === Metadata (placeholders - filled by enrichment) ===
          overview: mediaItem.overview || null,
          genres: mediaItem.genres || null,
          cast: mediaItem.cast || null,
          crew: mediaItem.crew || null,
          backdrop_path: mediaItem.backdrop_path || null,
          
          // === Tracking ===
          dateAdded: new Date(),
          enrichmentStatus: mediaItem.enrichmentStatus || "pending",
          lastEnriched: mediaItem.lastEnriched || null,
        };

        // Remove undefined fields just in case
        Object.keys(itemToSave).forEach(
          (key) => itemToSave[key] === undefined && delete itemToSave[key]
        );

        const itemRef = doc(itemsCollectionRef, String(mediaItem.id));
        currentBatch.set(itemRef, itemToSave);
      });

      await Promise.all(promises);
      await currentBatch.commit();
      console.log(`Successfully committed batch of ${chunk.length} items`);
    }

    console.log(
      `Successfully added ${items.length} items to custom list ${listId}`
    );
  } catch (error) {
    console.error("Error batch adding items to custom list: ", error);
    throw error;
  }
};

/**
 * Removes an item from a custom list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to remove the item from.
 * @param {string|number} mediaId - The ID of the media item to remove.
 */
export const removeItemFromCustomList = async (userId, listId, mediaId) => {
  try {
    const itemRef = doc(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items",
      String(mediaId)
    );
    await deleteDoc(itemRef);
    console.log(
      `Successfully removed item ${mediaId} from custom list ${listId}`
    );
  } catch (error) {
    console.error("Error removing item from custom list: ", error);
    throw error;
  }
};

/**
 * Fetches all custom lists for a user from Firestore.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<Array>} - A promise that resolves to an array of custom list objects.
 */
export const fetchUserLists = async (userId) => {
  try {
    const customListsCollectionRef = collection(
      db,
      "users",
      String(userId),
      "custom_lists"
    );
    const querySnapshot = await getDocs(customListsCollectionRef);
    try {
      const lists = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return lists;
    } catch (error) {
      console.error("Error parsing custom lists: ", error);
      return []; // Return empty list if parsing fails
    }
  } catch (error) {
    console.error("Error fetching user's custom lists: ", error);
    throw error;
  }
};

/**
 * Fetches custom lists with item previews for a user from Firestore.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<Array>} - A promise that resolves to an array of custom lists with first 10 items.
 */
export const fetchUserListsWithPreviews = async (userId) => {
  try {
    const lists = await fetchUserLists(userId);
    const listsWithPreviews = await Promise.all(
      lists.map(async (list) => {
        // Fetch only the first 10 items for preview
        const itemsCollectionRef = collection(
          db,
          "users",
          userId,
          "custom_lists",
          list.id,
          "items"
        );
        const itemsQuery = query(itemsCollectionRef, limit(10));
        const itemsSnapshot = await getDocs(itemsQuery);

        const items = itemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        return {
          ...list,
          items: items,
        };
      })
    );
    return listsWithPreviews;
  } catch (error) {
    console.error("Error fetching user's custom lists with previews: ", error);
    throw error;
  }
};

/**
 * Fetches a custom list and all its items from Firestore.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to fetch.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the list data and items.
 */
export const fetchListWithItems = async (userId, listId) => {
  try {
    // Fetch the list document
    const listRef = doc(db, "users", userId, "custom_lists", listId);
    const listSnap = await getDoc(listRef);

    if (!listSnap.exists()) {
      throw new Error(
        `List with ID ${listId} does not exist for user ${userId}`
      );
    }

    const listData = {
      id: listSnap.id,
      ...listSnap.data(),
    };

    // Fetch all items in the list
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );
    const itemsSnapshot = await getDocs(itemsCollectionRef);

    const items = itemsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      ...listData,
      items: items,
    };
  } catch (error) {
    console.error("Error fetching list with items: ", error);
    throw error;
  }
};

/**
 * Pins a custom list for a user.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to pin.
 */
export const pinList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "custom_lists", listId);
    await setDoc(
      listRef,
      {
        isPinned: true,
        pinnedAt: new Date(),
      },
      { merge: true }
    );
    console.log(`Successfully pinned list ${listId}`);
  } catch (error) {
    console.error("Error pinning list: ", error);
    throw error;
  }
};

/**
 * Unpins a custom list for a user.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to unpin.
 */
export const unpinList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "custom_lists", listId);
    await setDoc(
      listRef,
      {
        isPinned: false,
        pinnedAt: null,
      },
      { merge: true }
    );
    console.log(`Successfully unpinned list ${listId}`);
  } catch (error) {
    console.error("Error unpinning list: ", error);
    throw error;
  }
};

/**
 * Creates a default "Watch Later" pinned list for new users.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<string>} - The ID of the created list.
 */
export const createDefaultWatchLaterList = async (userId) => {
  try {
    const customListsRef = collection(db, "users", userId, "custom_lists");
    const newListData = {
      name: "Watch Later",
      description: "Your default watch later list",
      createdAt: new Date(),
      ownerId: userId,
      isPinned: true,
      pinnedAt: new Date(),
    };
    const docRef = await addDoc(customListsRef, newListData);
    console.log(
      `Successfully created default Watch Later list with ID: ${docRef.id}`
    );
    return docRef.id;
  } catch (error) {
    console.error("Error creating default Watch Later list: ", error);
    throw error;
  }
};

/**
 * Updates an item with enriched data (ratings, posters, etc.)
 * @param {string} userId
 * @param {string} listId
 * @param {string} itemId
 * @param {Object} enrichedData
 */
export const updateItemEnrichment = async (
  userId,
  listId,
  itemId,
  enrichedData
) => {
  try {
    const itemRef = doc(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items",
      String(itemId)
    );
    await setDoc(
      itemRef,
      {
        ...enrichedData,
        enrichmentStatus: "complete",
        lastEnriched: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error(`Failed to enrich item ${itemId}:`, error);
    throw error;
  }
};

/**
 * Fetches items that need enrichment from a specific list
 * @param {string} userId
 * @param {string} listId
 * @param {number} limitCount
 */
export const getPendingItemsInList = async (userId, listId, limitCount = 5) => {
  try {
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );

    // Note: This query requires an index on enrichmentStatus.
    // If index is missing, it might fail. For now, we might just fetch latest added.
    // Ideally: where("enrichmentStatus", "==", "pending")

    const q = query(
      itemsCollectionRef,
      // where("enrichmentStatus", "==", "pending"), // Commented out to avoid index error for now
      limit(50) // Fetch 50, filter in memory if needed
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.enrichmentStatus === "pending")
      .slice(0, limitCount);
  } catch (error) {
    console.error("Error fetching pending items:", error);
    return [];
  }
};
