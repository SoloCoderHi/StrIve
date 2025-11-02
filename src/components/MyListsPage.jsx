import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchLists, fetchWatchlist, deleteList } from '../util/listsSlice';
import useRequireAuth from '../hooks/useRequireAuth';
import ListShelf from './ListShelf';
import MovieCard from './MovieCard';
import Header from './Header';
import Footer from './Footer';
import CreateListModal from './CreateListModal';
import ConfirmationModal from './ConfirmationModal';
import { generateCsvBlob } from '../util/exportToCsv';
import { verifyExportDataStructure, selectCustomListsForExport } from '../util/exportSelectors';
import { exportListCsv } from '../util/exportDownload';
import { Upload, Download, ExternalLink } from 'lucide-react';

const MyListsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useRequireAuth();
  const { watchlist, customLists } = useSelector((state) => state.lists);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingListId, setExportingListId] = useState(null);

  useEffect(() => {
    if (user) {
      dispatch(fetchWatchlist(user.uid));
      dispatch(fetchLists(user.uid));
    }
  }, [dispatch, user]);

  // Log Redux state for debugging purposes
  useEffect(() => {
    console.log('=== Redux State Debug Info ===');
    console.log('Watchlist Status:', watchlist.status);
    console.log('Custom Lists Status:', customLists.status);
    console.log('Watchlist Items Count:', watchlist.items?.length || 0);
    console.log('Custom Lists Count:', customLists.lists?.length || 0);
    
    // Verify export data structure
    const state = { lists: { watchlist, customLists } };
    verifyExportDataStructure(state);
    
    // Use selector to get export data
    const exportData = selectCustomListsForExport(state);
    console.log('Export Data via Selector:', exportData.length, 'lists');
    
    if (customLists.lists && customLists.lists.length > 0) {
      console.log('Sample Custom List:', {
        id: customLists.lists[0].id,
        name: customLists.lists[0].name,
        itemsCount: customLists.lists[0].items?.length || 0,
        sampleItem: customLists.lists[0].items?.[0] ? {
          id: customLists.lists[0].items[0].id,
          title: customLists.lists[0].items[0].title || customLists.lists[0].items[0].name,
          release_date: customLists.lists[0].items[0].release_date,
          media_type: customLists.lists[0].items[0].media_type,
          vote_average: customLists.lists[0].items[0].vote_average
        } : null
      });
    }
  }, [watchlist, customLists]);

  // Export a single list
  const handleExportList = async (listId, listName) => {
    setExportingListId(listId);
    try {
      await exportListCsv(listId, listName);
    } finally {
      setExportingListId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (user && listToDelete) {
      try {
        await dispatch(deleteList({ 
          userId: user.uid, 
          listId: listToDelete.id 
        })).unwrap();
        setListToDelete(null);
      } catch (err) {
        console.error('Failed to delete list:', err);
      }
    }
  };

  const loading = watchlist.status === 'loading' || customLists.status === 'loading';
  const error = watchlist.error || customLists.error;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 pt-16">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Lists</h1>
          <div className="flex space-x-2">
            <button 
              onClick={() => navigate('/import/review')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition duration-200 flex items-center gap-2"
              aria-label="Import CSV to list"
            >
              <Upload size={16} />
              Import CSV
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition duration-200"
            >
              Create New List
            </button>
          </div>
        </div>

        {loading && <div className="text-center">Loading your lists...</div>}
        
        {error && <div className="text-center text-red-500">Error: {error}</div>}

        {!loading && !error && (
          <div>
            {/* Watchlist Shelf with Export and Open buttons */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">Watchlist</h2>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => handleExportList('watchlist', 'Watchlist')}
                    disabled={exportingListId === 'watchlist'}
                    className={`px-3 py-2 rounded-md text-sm flex items-center gap-2 transition duration-200 ${
                      exportingListId === 'watchlist'
                        ? 'bg-gray-600 cursor-not-allowed text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                    aria-label="Export Watchlist as CSV"
                  >
                    <Download size={14} />
                    Export CSV
                  </button>
                  <button 
                    onClick={() => navigate('/my-list')}
                    className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm flex items-center gap-2 transition duration-200"
                    aria-label="Open Watchlist"
                  >
                    <ExternalLink size={14} />
                    Open
                  </button>
                </div>
              </div>
              <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide">
                {watchlist.items && watchlist.items.map((item) => (
                  <div key={item.id} className="flex-shrink-0">
                    <MovieCard movie={item} />
                  </div>
                ))}
              </div>
            </div>

            {/* Custom Lists Section */}
            <div className="mb-6">
              <h2 className="text-2xl font-semibold mb-4">Custom Lists</h2>
            </div>

            {customLists.lists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">You don't have any custom lists yet.</p>
              </div>
            ) : (
              customLists.lists.map((list) => (
                <div key={list.id} className="mb-8">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-semibold">{list.name}</h2>
                    <div className="flex space-x-2">
                      <button 
                        onClick={() => handleExportList(list.id, list.name)}
                        disabled={exportingListId === list.id}
                        className={`px-3 py-2 rounded-md text-sm flex items-center gap-2 transition duration-200 ${
                          exportingListId === list.id
                            ? 'bg-gray-600 cursor-not-allowed text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-white'
                        }`}
                        aria-label={`Export ${list.name} as CSV`}
                      >
                        <Download size={14} />
                        Export CSV
                      </button>
                      <button 
                        onClick={() => navigate(`/my-lists/${list.id}`)}
                        className="px-3 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm flex items-center gap-2 transition duration-200"
                        aria-label={`Open ${list.name}`}
                      >
                        <ExternalLink size={14} />
                        Open
                      </button>
                      <button 
                        onClick={() => setListToDelete(list)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md text-sm transition duration-200"
                        aria-label={`Delete ${list.name}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide">
                    {list.items && list.items.map((item) => (
                      <div key={item.id} className="flex-shrink-0">
                        <MovieCard movie={item} />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
        <ConfirmationModal
          isOpen={!!listToDelete}
          onClose={() => setListToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Delete List"
          message={`Are you sure you want to permanently delete the list '${listToDelete?.name}'?`}
        />
        <CreateListModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          userId={user?.uid} 
        />
      </main>
    </div>
  );
};

export default MyListsPage;