import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { 
  getList, 
  removeFromList, 
  createCustomList, 
  deleteCustomList, 
  addItemToCustomList, 
  removeItemFromCustomList, 
  fetchListWithItems,
  fetchUserListsWithPreviews
} from "./firestoreService";

// Async thunks for watchlist (existing functionality)
export const fetchWatchlist = createAsyncThunk(
  "lists/fetchWatchlist",
  async (userId, { rejectWithValue }) => {
    try {
      const watchlist = await getList(userId, "watchlist");
      // Return the watchlist with limited items for preview (first 10)
      
      // Convert Firestore Timestamps to serializable format before returning
      const processedWatchlist = (watchlist.slice(0, 10) || []).map(item => {
        // Create a copy of the item to avoid mutating the original
        const processedItem = { ...item };
        
        // Convert dateAdded Timestamp to ISO string if it exists
        if (processedItem.dateAdded && typeof processedItem.dateAdded.toDate === 'function') {
          processedItem.dateAdded = processedItem.dateAdded.toDate().toISOString();
        }
        
        // Convert release_date Timestamp to ISO string if it exists (though this is typically already a string)
        if (processedItem.release_date && typeof processedItem.release_date.toDate === 'function') {
          processedItem.release_date = processedItem.release_date.toDate().toISOString();
        }
        
        // Convert any other Timestamp fields if they exist
        if (processedItem.createdAt && typeof processedItem.createdAt.toDate === 'function') {
          processedItem.createdAt = processedItem.createdAt.toDate().toISOString();
        }
        
        return processedItem;
      });
      
      return processedWatchlist;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const removeItemFromWatchlist = createAsyncThunk(
  "lists/removeItemFromWatchlist",
  async ({ userId, mediaId }, { rejectWithValue }) => {
    try {
      await removeFromList(userId, "watchlist", mediaId);
      return mediaId; // Return the ID of the removed item
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

// Async thunks for custom lists
export const fetchLists = createAsyncThunk(
  "lists/fetchLists",
  async (userId, { rejectWithValue }) => {
    try {
      const lists = await fetchUserListsWithPreviews(userId);
      
      // Convert Firestore Timestamps to serializable format before returning
      return lists.map(list => {
        // Process the list details
        const processedList = { ...list };
        
        // If the list has a createdAt Timestamp, convert it to ISO string
        if (processedList.createdAt && typeof processedList.createdAt.toDate === 'function') {
          processedList.createdAt = processedList.createdAt.toDate().toISOString();
        }
        
        // Process items in the list if they exist
        if (processedList.items && Array.isArray(processedList.items)) {
          processedList.items = processedList.items.map(item => {
            // Create a copy of the item to avoid mutating the original
            const processedItem = { ...item };
            
            // Convert dateAdded Timestamp to ISO string if it exists
            if (processedItem.dateAdded && typeof processedItem.dateAdded.toDate === 'function') {
              processedItem.dateAdded = processedItem.dateAdded.toDate().toISOString();
            }
            
            // Convert release_date Timestamp to ISO string if it exists (though this is typically already a string)
            if (processedItem.release_date && typeof processedItem.release_date.toDate === 'function') {
              processedItem.release_date = processedItem.release_date.toDate().toISOString();
            }
            
            // Convert any other Timestamp fields if they exist
            if (processedItem.createdAt && typeof processedItem.createdAt.toDate === 'function') {
              processedItem.createdAt = processedItem.createdAt.toDate().toISOString();
            }
            
            return processedItem;
          });
        }
        
        return processedList;
      });
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const createList = createAsyncThunk(
  "lists/createList",
  async ({ userId, listData }, { rejectWithValue }) => {
    try {
      const newListId = await createCustomList(userId, listData);
      // Return both the new list ID and the original listData to construct the full list object
      return { id: newListId, ...listData, ownerId: userId, createdAt: new Date() };
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const deleteList = createAsyncThunk(
  "lists/deleteList",
  async ({ userId, listId }, { rejectWithValue }) => {
    try {
      await deleteCustomList(userId, listId);
      return listId; // Return the ID of the deleted list
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const addItem = createAsyncThunk(
  "lists/addItem",
  async ({ userId, listId, mediaItem }, { rejectWithValue }) => {
    try {
      await addItemToCustomList(userId, listId, mediaItem);
      return { listId, item: { ...mediaItem, dateAdded: new Date() } }; // Return list ID and the item added
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const removeItem = createAsyncThunk(
  "lists/removeItem",
  async ({ userId, listId, mediaId }, { rejectWithValue }) => {
    try {
      await removeItemFromCustomList(userId, listId, mediaId);
      return { listId, mediaId }; // Return list ID and media ID of the removed item
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const fetchActiveList = createAsyncThunk(
  "lists/fetchActiveList",
  async ({ userId, listId }, { rejectWithValue }) => {
    try {
      const listData = await fetchListWithItems(userId, listId);
      
      // Convert Firestore Timestamps to serializable format before returning
      if (listData && listData.items && Array.isArray(listData.items)) {
        listData.items = listData.items.map(item => {
          // Create a copy of the item to avoid mutating the original
          const processedItem = { ...item };
          
          // Convert dateAdded Timestamp to ISO string if it exists
          if (processedItem.dateAdded && typeof processedItem.dateAdded.toDate === 'function') {
            processedItem.dateAdded = processedItem.dateAdded.toDate().toISOString();
          }
          
          // Convert release_date Timestamp to ISO string if it exists (though this is typically already a string)
          if (processedItem.release_date && typeof processedItem.release_date.toDate === 'function') {
            processedItem.release_date = processedItem.release_date.toDate().toISOString();
          }
          
          // Convert any other Timestamp fields if they exist
          if (processedItem.createdAt && typeof processedItem.createdAt.toDate === 'function') {
            processedItem.createdAt = processedItem.createdAt.toDate().toISOString();
          }
          
          return processedItem;
        });
      }
      
      // Also convert list-level Timestamps
      if (listData && listData.createdAt && typeof listData.createdAt.toDate === 'function') {
        listData.createdAt = listData.createdAt.toDate().toISOString();
      }
      
      return listData;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

const listsSlice = createSlice({
  name: "lists",
  initialState: {
    watchlist: { items: [], status: "idle", error: null },
    customLists: { lists: [], status: "idle", error: null }, // To hold all of the user's lists
    activeList: { details: null, items: [], status: "idle", error: null } // For the currently viewed list
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Watchlist
      .addCase(fetchWatchlist.pending, (state) => {
        state.watchlist.status = "loading";
      })
      .addCase(fetchWatchlist.fulfilled, (state, action) => {
        state.watchlist.status = "succeeded";
        // Convert any Timestamps in the items to serializable format
        state.watchlist.items = (action.payload || []).map(item => {
          // Create a copy of the item to avoid mutating the original
          const processedItem = { ...item };
          
          // Convert dateAdded Timestamp to ISO string if it exists
          if (processedItem.dateAdded && typeof processedItem.dateAdded.toDate === 'function') {
            processedItem.dateAdded = processedItem.dateAdded.toDate().toISOString();
          }
          
          // Convert release_date Timestamp to ISO string if it exists (though this is typically already a string)
          if (processedItem.release_date && typeof processedItem.release_date.toDate === 'function') {
            processedItem.release_date = processedItem.release_date.toDate().toISOString();
          }
          
          // Convert any other Timestamp fields if they exist
          if (processedItem.createdAt && typeof processedItem.createdAt.toDate === 'function') {
            processedItem.createdAt = processedItem.createdAt.toDate().toISOString();
          }
          
          return processedItem;
        });
      })
      .addCase(fetchWatchlist.rejected, (state, action) => {
        state.watchlist.status = "failed";
        state.watchlist.error = action.payload;
      })
      // Remove Item from Watchlist
      .addCase(removeItemFromWatchlist.pending, (state) => {
        state.watchlist.status = "loading";
      })
      .addCase(removeItemFromWatchlist.fulfilled, (state, action) => {
        state.watchlist.status = "succeeded";
        state.watchlist.items = state.watchlist.items.filter(
          (item) => item.id !== action.payload
        );
      })
      .addCase(removeItemFromWatchlist.rejected, (state, action) => {
        state.watchlist.status = "failed";
        state.watchlist.error = action.payload;
      })
      // Fetch Lists
      .addCase(fetchLists.pending, (state) => {
        state.customLists.status = "loading";
      })
      .addCase(fetchLists.fulfilled, (state, action) => {
        state.customLists.status = "succeeded";
        // Convert Firestore Timestamps to serializable format
        state.customLists.lists = action.payload.map(list => {
          // Process the list details
          const processedList = { ...list };
          
          // If the list has a createdAt Timestamp, convert it to ISO string
          if (processedList.createdAt && typeof processedList.createdAt.toDate === 'function') {
            processedList.createdAt = processedList.createdAt.toDate().toISOString();
          }
          
          // Process items in the list if they exist
          if (processedList.items && Array.isArray(processedList.items)) {
            processedList.items = processedList.items.map(item => {
              // Create a copy of the item to avoid mutating the original
              const processedItem = { ...item };
              
              // Convert dateAdded Timestamp to ISO string if it exists
              if (processedItem.dateAdded && typeof processedItem.dateAdded.toDate === 'function') {
                processedItem.dateAdded = processedItem.dateAdded.toDate().toISOString();
              }
              
              // Convert release_date Timestamp to ISO string if it exists (though this is typically already a string)
              if (processedItem.release_date && typeof processedItem.release_date.toDate === 'function') {
                processedItem.release_date = processedItem.release_date.toDate().toISOString();
              }
              
              // Convert any other Timestamp fields if they exist
              if (processedItem.createdAt && typeof processedItem.createdAt.toDate === 'function') {
                processedItem.createdAt = processedItem.createdAt.toDate().toISOString();
              }
              
              return processedItem;
            });
          }
          
          return processedList;
        });
      })
      .addCase(fetchLists.rejected, (state, action) => {
        state.customLists.status = "failed";
        state.customLists.error = action.payload;
      })
      // Create List
      .addCase(createList.pending, (state) => {
        state.customLists.status = "loading";
      })
      .addCase(createList.fulfilled, (state, action) => {
        state.customLists.status = "succeeded";
        state.customLists.lists.push(action.payload);
      })
      .addCase(createList.rejected, (state, action) => {
        state.customLists.status = "failed";
        state.customLists.error = action.payload;
      })
      // Delete List
      .addCase(deleteList.pending, (state) => {
        state.customLists.status = "loading";
      })
      .addCase(deleteList.fulfilled, (state, action) => {
        state.customLists.status = "succeeded";
        state.customLists.lists = state.customLists.lists.filter(
          (list) => list.id !== action.payload
        );
      })
      .addCase(deleteList.rejected, (state, action) => {
        state.customLists.status = "failed";
        state.customLists.error = action.payload;
      })
      // Add Item
      .addCase(addItem.pending, (state) => {
        state.activeList.status = "loading";
      })
      .addCase(addItem.fulfilled, (state, action) => {
        state.activeList.status = "succeeded";
        // Only update the active list if it's the same list
        if (state.activeList.details && state.activeList.details.id === action.payload.listId) {
          state.activeList.items.push(action.payload.item);
        }
      })
      .addCase(addItem.rejected, (state, action) => {
        state.activeList.status = "failed";
        state.activeList.error = action.payload;
      })
      // Remove Item
      .addCase(removeItem.pending, (state) => {
        state.activeList.status = "loading";
      })
      .addCase(removeItem.fulfilled, (state, action) => {
        state.activeList.status = "succeeded";
        // Only update the active list if it's the same list
        if (state.activeList.details && state.activeList.details.id === action.payload.listId) {
          state.activeList.items = state.activeList.items.filter(
            (item) => item.id !== action.payload.mediaId
          );
        }
      })
      .addCase(removeItem.rejected, (state, action) => {
        state.activeList.status = "failed";
        state.activeList.error = action.payload;
      })
      // Fetch Active List
      .addCase(fetchActiveList.pending, (state) => {
        state.activeList.status = "loading";
      })
      .addCase(fetchActiveList.fulfilled, (state, action) => {
        state.activeList.status = "succeeded";
        // Convert any Timestamps in the list details to serializable format
        const listDetails = action.payload;
        if (listDetails.createdAt && typeof listDetails.createdAt.toDate === 'function') {
          listDetails.createdAt = listDetails.createdAt.toDate().toISOString();
        }
        
        state.activeList.details = listDetails;
        // Convert any Timestamps in the items to serializable format
        state.activeList.items = (action.payload.items || []).map(item => {
          // Create a copy of the item to avoid mutating the original
          const processedItem = { ...item };
          
          // Convert dateAdded Timestamp to ISO string if it exists
          if (processedItem.dateAdded && typeof processedItem.dateAdded.toDate === 'function') {
            processedItem.dateAdded = processedItem.dateAdded.toDate().toISOString();
          }
          
          // Convert release_date Timestamp to ISO string if it exists (though this is typically already a string)
          if (processedItem.release_date && typeof processedItem.release_date.toDate === 'function') {
            processedItem.release_date = processedItem.release_date.toDate().toISOString();
          }
          
          // Convert any other Timestamp fields if they exist
          if (processedItem.createdAt && typeof processedItem.createdAt.toDate === 'function') {
            processedItem.createdAt = processedItem.createdAt.toDate().toISOString();
          }
          
          return processedItem;
        });
        state.activeList.error = null;
      })
      .addCase(fetchActiveList.rejected, (state, action) => {
        state.activeList.status = "failed";
        state.activeList.error = action.payload;
      });
  },
});

export default listsSlice.reducer;