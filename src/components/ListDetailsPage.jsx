import React, { useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useParams } from 'react-router-dom';
import useRequireAuth from '../hooks/useRequireAuth';
import { fetchActiveList, removeItem } from '../util/listsSlice';
import MovieCard from './MovieCard';
import FilterControls from './FilterControls';
import Header from './Header';
import Footer from './Footer';
import { exportListCsv } from '../util/exportDownload';

const ListDetailsPage = () => {
  const dispatch = useDispatch();
  const user = useRequireAuth();
  const { listId } = useParams();
  const { details, items, status, error } = useSelector((state) => state.lists.activeList);

  useEffect(() => {
    if (user && listId) {
      dispatch(fetchActiveList({ userId: user.uid, listId }));
    }
  }, [dispatch, user, listId]);

  const handleRemoveItem = async (item) => {
    if (user && listId) {
      try {
        await dispatch(removeItem({ userId: user.uid, listId, mediaId: item.id })).unwrap();
      } catch (err) {
        console.error('Failed to remove item:', err);
      }
    }
  };

  const [exporting, setExporting] = React.useState(false);
  const handleExport = useCallback(async () => {
    if (!user || !listId) return;
    try {
      setExporting(true);
      await exportListCsv(listId, details?.name);
    } finally {
      setExporting(false);
    }
  }, [user, listId, details]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 pt-16">
        {status === 'loading' && <div className="text-center">Loading list details...</div>}
        
        {error && <div className="text-center text-red-500">Error: {error}</div>}
        
        {status !== 'loading' && !error && details && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-3xl font-bold">{details.name}</h1>
              <button
                onClick={handleExport}
                disabled={exporting}
                aria-busy={exporting}
                className={`px-4 py-2 ${exporting ? 'bg-green-800 cursor-not-allowed' : 'bg-green-600 hover:bg-green-700'} text-white rounded-lg text-sm font-semibold flex items-center gap-2`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="feather feather-download">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                Export as CSV
              </button>
            </div>
            
            {items && items.length > 0 ? (
              <FilterControls items={items}>
                {(filteredAndSortedItems) => (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {filteredAndSortedItems.map((item) => (
                      <MovieCard
                        key={item.id}
                        movie={item}
                        onRemove={() => handleRemoveItem(item)}
                      />
                    ))}
                  </div>
                )}
              </FilterControls>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-600">This list is empty. Add some titles to get started!</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default ListDetailsPage;