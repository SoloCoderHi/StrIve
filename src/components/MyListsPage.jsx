import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchLists, fetchWatchlist, deleteList } from '../util/listsSlice';
import useRequireAuth from '../hooks/useRequireAuth';
import ListShelf from './ListShelf';
import Header from './Header';
import Footer from './Footer';
import CreateListModal from './CreateListModal';
import ConfirmationModal from './ConfirmationModal';
import { generateCsvBlob } from '../util/exportToCsv';
import { verifyExportDataStructure, selectCustomListsForExport } from '../util/exportSelectors';

const MyListsPage = () => {
  const dispatch = useDispatch();
  const user = useRequireAuth();
  const { watchlist, customLists } = useSelector((state) => state.lists);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

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

  // Export all lists to CSV
  const handleExportAllLists = async () => {
    setIsExporting(true);
    try {
      // Validate that we have lists to export
      if (!customLists || !customLists.lists || customLists.lists.length === 0) {
        console.warn('No lists available for export');
        alert('No lists available for export. Please create some lists first.');
        return;
      }

      // Generate CSV blob from all lists
      const csvBlob = generateCsvBlob(customLists.lists);
      
      // Create a temporary link to trigger download
      const url = window.URL.createObjectURL(csvBlob);
      const link = document.createElement('a');
      link.href = url;
      
      // Construct filename with current date (matching acceptance criteria: my-lists-export-YYYYMMDD.csv)
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `my-lists-export-${dateStr}.csv`;
      
      link.setAttribute('download', fileName);
      
      // Append to document, click, and remove
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the object URL
      window.URL.revokeObjectURL(url);
      
      console.log('All lists exported successfully');
    } catch (error) {
      console.error('Failed to export lists:', error);
      alert(`Failed to export lists: ${error.message}`);
    } finally {
      setIsExporting(false);
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
        <h1 className="text-3xl font-bold mb-6">My Lists</h1>

        {loading && <div className="text-center">Loading your lists...</div>}
        
        {error && <div className="text-center text-red-500">Error: {error}</div>}

        {!loading && !error && (
          <div>
            {/* Watchlist Shelf */}
            <ListShelf 
              title="Watchlist" 
              items={watchlist.items} 
              mapsTo="/my-list" 
            />

            {/* Custom Lists Shelves */}
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-semibold">Custom Lists</h2>
              <div className="flex space-x-2">
                <button 
                  onClick={handleExportAllLists}
                  disabled={isExporting}
                  className={`px-4 py-2 rounded-md transition duration-200 flex items-center ${
                    isExporting 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {isExporting ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Exporting...
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                      Export All Lists
                    </>
                  )}
                </button>
                <button 
                  onClick={() => setIsModalOpen(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md transition duration-200"
                >
                  Create New List
                </button>
              </div>
            </div>

            {customLists.lists.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-600">You don't have any custom lists yet.</p>
              </div>
            ) : (
              customLists.lists.map((list) => (
                <ListShelf 
                  key={list.id} 
                  title={list.name} 
                  items={list.items || []} 
                  mapsTo={`/my-lists/${list.id}`} 
                  onDelete={() => setListToDelete(list)}
                />
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