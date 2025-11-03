import React, { useState } from 'react';
import MovieCard from './MovieCard';
import useSearch from '../hooks/useSearch';

const SearchPage = () => {
  const [searchTerm, setSearchTerm] = useState('');

  // Initialize from URL parameter only on first load
  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
      setSearchTerm(query);
    }
  }, []);

  const { results, loading, error } = useSearch(searchTerm);

  // Handle input changes
  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Handle clear search
  const handleClearSearch = () => {
    setSearchTerm('');
    // Update URL to remove query param
    window.history.replaceState({}, '', '/search');
  };

  // Handle form submission (when Enter is pressed)
  const handleSubmit = (e) => {
    e.preventDefault();
    // The search is handled by the useSearch hook automatically when searchTerm changes
  };

  return (
    <div className="bg-black min-h-screen">
      <div className="px-12 py-8">
        <div className="mb-12 text-center">
          <h1 className="text-5xl font-bold text-white mb-4">Search</h1>
          <p className="text-gray-400 text-xl">Find your next favorite movie or TV show</p>
        </div>

        {/* Search Input Section */}
        <div className="max-w-2xl mx-auto mb-16">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={handleInputChange}
              placeholder="Search for movies, TV shows, actors..."
              className="w-full px-6 py-4 bg-gray-900 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </form>
        </div>

        {/* Results Section - Only show if there's a search term */}
        {searchTerm && (
          <div className="mb-16">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-bold text-white">
                Search Results for "{searchTerm}"
              </h3>
              <p className="text-gray-400">
                {results.length} {results.length === 1 ? 'result' : 'results'} found
              </p>
            </div>

            {error && (
              <div className="text-center py-12">
                <p className="text-red-500 text-lg">Error: {error}</p>
              </div>
            )}

            {loading ? (
              // Loading state - skeleton grid
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {[...Array(12)].map((_, index) => (
                  <div key={index} className="bg-gray-800 rounded-lg overflow-hidden animate-pulse">
                    <div className="w-full h-64 bg-gray-700"></div>
                    <div className="p-4">
                      <div className="h-4 bg-gray-700 rounded mb-2"></div>
                      <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              // Results grid
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                {results.map((result) => {
                  // Map TMDB API fields to MovieCard expected fields
                  // Determine if this is a movie or TV show based on media_type
                  const mediaType = result.media_type;

                  // Use appropriate fields based on media type
                  const movie = {
                    id: result.id,
                    poster_path: result.poster_path, // TMDB field for poster
                    title: result.title, // Movie title
                    name: result.name, // TV show name
                    original_title: result.title || result.name, // Use title for movies, name for TV shows
                    release_date: result.release_date, // Movie release date
                    first_air_date: result.first_air_date, // TV show first air date
                    vote_average: result.vote_average, // TMDB rating
                    media_type: mediaType // Specify if it's a movie or tv show
                  };

                  return <MovieCard key={result.id} movie={movie} />;
                })}
              </div>
            ) : (
              // No results found
              <div className="text-center py-12">
                <p className="text-gray-400 text-lg">No results found for your query.</p>
              </div>
            )}
          </div>
        )}

        {/* Show suggestions when no search term is entered */}
        {!searchTerm && (
          <div className="text-center py-12">
            <p className="text-gray-400 text-xl">Enter a search term to find movies and TV shows</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;