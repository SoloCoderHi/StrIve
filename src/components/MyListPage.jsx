import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchWatchlist, removeItemFromWatchlist } from "../util/listsSlice";
import Header from "./Header";
import MovieCard from "./MovieCard";
import FilterControls from "./FilterControls";
import ConfirmationModal from "./ConfirmationModal";
import React from 'react';

const WatchlistExportButton = () => {
  const [loading, setLoading] = React.useState(false);
  const onClick = async () => {
    try {
      setLoading(true);
      const { exportListCsv } = await import('../util/exportDownload');
      await exportListCsv('watchlist', 'Watchlist');
    } finally {
      setLoading(false);
    }
  };
  return (
    <button
      onClick={onClick}
      disabled={loading}
      aria-busy={loading}
      aria-label="Export watchlist as CSV"
      className={`px-4 py-2 ${loading ? 'bg-blue-800 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-lg text-sm font-semibold flex items-center gap-2`}
    >
      Export as CSV
    </button>
  );
};

const MyListPage = () => {
  const dispatch = useDispatch();
  const user = useSelector((store) => store.user.user);
  const { items: watchlistItems, status: watchlistStatus, error: watchlistError } = useSelector((store) => store.lists.watchlist);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState(null);
  const [shouldSkipConfirm, setShouldSkipConfirm] = useState(() => 
    localStorage.getItem("skipRemoveConfirmation") === "true"
  );

  useEffect(() => {
    if (user) {
      dispatch(fetchWatchlist(user.uid));
    }
  }, [dispatch, user]);

  const handleRemoveClick = (item) => {
    if (shouldSkipConfirm) {
      dispatch(removeItemFromWatchlist({ userId: user.uid, mediaId: item.id }));
    } else {
      setItemToRemove(item);
      setIsModalOpen(true);
    }
  };

  const handleConfirmRemove = () => {
    if (itemToRemove) {
      dispatch(removeItemFromWatchlist({ userId: user.uid, mediaId: itemToRemove.id }));
      setIsModalOpen(false);
      setItemToRemove(null);
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setItemToRemove(null);
  };

  const handleSkipConfirmChange = (e) => {
    const isChecked = e.target.checked;
    setShouldSkipConfirm(isChecked);
    localStorage.setItem("skipRemoveConfirmation", isChecked);
  };

  if (watchlistStatus === "loading") {
    return <div className="flex items-center justify-center h-screen bg-black text-white">Loading...</div>;
  }

  if (watchlistStatus === "failed") {
    return <div className="flex items-center justify-center h-screen bg-black text-white">Error: {watchlistError}</div>;
  }

  return (
    <div className="bg-black min-h-screen text-white">
      <Header />
      <div className="pt-24 px-4 md:px-8 lg:px-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">My List</h1>
          <WatchlistExportButton />
        </div>
        {watchlistStatus === "succeeded" && watchlistItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-lg">Your list is empty. Add some movies and shows to get started!</p>
          </div>
        ) : (
          <FilterControls items={watchlistItems}>
            {(filteredItems) => (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {filteredItems.map((item) => (
                  <MovieCard key={item.id} movie={item} onRemove={() => handleRemoveClick(item)} />
                ))}
              </div>
            )}
          </FilterControls>
        )}
      </div>

      <ConfirmationModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onConfirm={handleConfirmRemove}
        title="Confirm Removal"
        message={`Are you sure you want to remove ${itemToRemove?.title || itemToRemove?.name} from your list?`}
        skipChecked={shouldSkipConfirm}
        onSkipChange={handleSkipConfirmChange}
      />
    </div>
  );
};

export default MyListPage;