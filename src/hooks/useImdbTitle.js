import { useState, useEffect } from 'react';
import IMDbService from '../util/imdbService';
import { getImdbId } from '../util/imdbResolver';

/**
 * Custom hook to fetch IMDb title information by TMDB ID
 * @param {string} tmdbId - The TMDB ID to lookup
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Object} Object containing data, loading, and error states
 */
const useImdbTitle = (tmdbId, mediaType = 'movie') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchImdbTitle = async () => {
      try {
        setLoading(true);
        setError(null);

        // Create an instance of IMDbService (will throw if env not configured)
        let imdbService;
        try {
          imdbService = new IMDbService();
        } catch (serviceError) {
          // IMDb service not configured, gracefully disable
          setData(null);
          setError(serviceError.message);
          setLoading(false);
          return;
        }

        // First get the IMDb ID using the TMDB ID
        const imdbId = await getImdbId(tmdbId, mediaType);

        if (!imdbId) {
          // No IMDb ID found for this TMDB ID
          setData(null);
          setLoading(false);
          return;
        }

        // Fetch the title data
        const titleData = await imdbService.getTitleById(imdbId);

        setData(titleData);
      } catch (err) {
        setError(err.message);
        console.error('Error in useImdbTitle hook:', err);
      } finally {
        setLoading(false);
      }
    };

    if (tmdbId) {
      fetchImdbTitle();
    }
  }, [tmdbId, mediaType]);

  return { data, loading, error };
};

export default useImdbTitle;