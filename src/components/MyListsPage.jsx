import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { fetchLists, fetchWatchlist, deleteList } from '../util/listsSlice';
import useRequireAuth from '../hooks/useRequireAuth';
import MovieCard from './MovieCard';
import Header from './Header';
import Footer from './Footer';
import CreateListModal from './CreateListModal';
import ConfirmationModal from './ConfirmationModal';
import { exportListCsv } from '../util/exportDownload';

const MyListsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useRequireAuth();
  const { watchlist, customLists } = useSelector((state) => state.lists);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const [exportingListId, setExportingListId] = useState(null);

  useEffect(() => {
    if (user) {
      dispatch(fetchWatchlist(user.uid));
      dispatch(fetchLists(user.uid));
    }
  }, [dispatch, user]);

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
    <div className="min-h-screen premium-page flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <div className="pt-24 pb-12 px-6 lg:px-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="glass-effect p-4 rounded-full">
                  <span className="material-symbols-outlined text-5xl gradient-accent">
                    playlist_play
                  </span>
                </div>
                <h1 className="font-display text-5xl lg:text-6xl font-bold gradient-text">
                  My Lists
                </h1>
              </div>
              <p className="text-white/60 font-secondary text-lg">
                Manage your watchlists and custom collections
              </p>
            </div>
            
            <div className="flex flex-wrap gap-3">
              <button 
                onClick={() => navigate('/import')}
                className="btn-secondary flex items-center gap-2"
              >
                <span className="material-symbols-outlined">upload</span>
                <span>Import CSV</span>
              </button>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <span className="material-symbols-outlined">add</span>
                <span>Create New List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-grow w-full px-6 lg:px-12 pb-20">
        <div className="max-w-7xl mx-auto">
          {loading && (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-red-600 mx-auto mb-4"></div>
              <p className="text-white/60 font-secondary">Loading your lists...</p>
            </div>
          )}
          
          {error && (
            <div className="glass-effect rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-6xl text-red-400 mb-4">
                error
              </span>
              <p className="text-red-400 font-secondary">Error: {error}</p>
            </div>
          )}

          {!loading && !error && (
            <div className="space-y-12">
              {/* Watchlist Section */}
              <div>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-3xl font-bold font-display text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-red-600">
                      bookmark
                    </span>
                    Watchlist
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => handleExportList('watchlist', 'Watchlist')}
                      disabled={exportingListId === 'watchlist'}
                      className={`glass-effect px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${
                        exportingListId === 'watchlist'
                          ? 'opacity-50 cursor-not-allowed'
                          : 'hover:bg-white/20'
                      }`}
                    >
                      <span className="material-symbols-outlined text-lg">download</span>
                      <span className="text-white font-secondary">Export</span>
                    </button>
                    <button 
                      onClick={() => navigate('/my-list')}
                      className="glass-effect hover:bg-white/20 px-4 py-2 rounded-xl text-sm flex items-center gap-2 transition-all"
                    >
                      <span className="material-symbols-outlined text-lg">open_in_new</span>
                      <span className="text-white font-secondary">Open</span>
                    </button>
                  </div>
                </div>
                
                {watchlist.items && watchlist.items.length > 0 ? (
                  <div className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
                    {watchlist.items.map((item) => (
                      <MovieCard key={item.id} movie={item} />
                    ))}
                  </div>
                ) : (
                  <div className="glass-effect rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-7xl text-white/20 mb-4">
                      playlist_add
                    </span>
                    <p className="text-white/60 font-secondary">
                      Your watchlist is empty. Start adding movies and shows!
                    </p>
                  </div>
                )}
              </div>

              {/* Custom Lists Section */}
              <div>
                <h2 className="text-3xl font-bold font-display text-white mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined text-4xl text-red-600">
                    library_books
                  </span>
                  Custom Lists
                </h2>

                {customLists.lists.length === 0 ? (
                  <div className="glass-effect rounded-2xl p-12 text-center">
                    <span className="material-symbols-outlined text-7xl text-white/20 mb-4">
                      list_alt
                    </span>
                    <p className="text-white/60 font-secondary mb-4">
                      You don't have any custom lists yet.
                    </p>
                    <button
                      onClick={() => setIsModalOpen(true)}
                      className="btn-primary"
                    >
                      <span className="material-symbols-outlined">add</span>
                      <span>Create Your First List</span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {customLists.lists.map((list) => (
                      <div key={list.id} className="glass-effect rounded-2xl p-6">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                          <div>
                            <h3 className="text-2xl font-bold text-white font-secondary mb-1">
                              {list.name}
                            </h3>
                            <p className="text-white/60 text-sm">
                              {list.items?.length || 0} {list.items?.length === 1 ? 'item' : 'items'}
                            </p>
                          </div>
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => handleExportList(list.id, list.name)}
                              disabled={exportingListId === list.id}
                              className={`glass-effect px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all ${
                                exportingListId === list.id
                                  ? 'opacity-50 cursor-not-allowed'
                                  : 'hover:bg-white/20'
                              }`}
                            >
                              <span className="material-symbols-outlined text-base">download</span>
                              <span className="text-white font-secondary">Export</span>
                            </button>
                            <button 
                              onClick={() => navigate(`/my-lists/${list.id}`)}
                              className="glass-effect hover:bg-white/20 px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all"
                            >
                              <span className="material-symbols-outlined text-base">open_in_new</span>
                              <span className="text-white font-secondary">Open</span>
                            </button>
                            <button 
                              onClick={() => setListToDelete(list)}
                              className="bg-red-600/20 hover:bg-red-600/30 border border-red-600/50 px-3 py-2 rounded-xl text-sm flex items-center gap-2 transition-all"
                            >
                              <span className="material-symbols-outlined text-base text-red-400">delete</span>
                              <span className="text-red-400 font-secondary">Delete</span>
                            </button>
                          </div>
                        </div>
                        
                        {list.items && list.items.length > 0 ? (
                          <div className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
                            {list.items.map((item) => (
                              <MovieCard key={item.id} movie={item} />
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <span className="material-symbols-outlined text-5xl text-white/20 mb-2">
                              movie_off
                            </span>
                            <p className="text-white/40 text-sm font-secondary">
                              This list is empty
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

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
    </div>
  );
};

export default MyListsPage;