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
        
        console.log('🎬 [IMDb Hook] Starting fetch for TMDB ID:', tmdbId, 'Type:', mediaType);

        // Create an instance of IMDbService (will throw if env not configured)
        let imdbService;
        try {
          imdbService = new IMDbService();
          console.log('✅ [IMDb Hook] Service created successfully');
        } catch (serviceError) {
          // IMDb service not configured, gracefully disable
          console.error('❌ [IMDb Hook] Service creation failed:', serviceError.message);
          setData(null);
          setError(serviceError.message);
          setLoading(false);
          return;
        }

        // First get the IMDb ID using the TMDB ID
        console.log('🔍 [IMDb Hook] Getting IMDb ID from TMDB...');
        const imdbId = await getImdbId(tmdbId, mediaType);
        console.log('🔗 [IMDb Hook] IMDb ID:', imdbId || 'NOT FOUND');

        if (!imdbId) {
          // No IMDb ID found for this TMDB ID
          console.warn('⚠️ [IMDb Hook] No IMDb ID found for this content');
          setData(null);
          setLoading(false);
          return;
        }

        // Fetch the title data
        console.log('📡 [IMDb Hook] Fetching data from IMDb API...');
        const titleData = await imdbService.getTitleById(imdbId);
        console.log('✅ [IMDb Hook] Data received:', titleData);
        console.log('📊 [IMDb Hook] Rating:', titleData?.rating);

        setData(titleData);
      } catch (err) {
        setError(err.message);
        console.error('❌ [IMDb Hook] Error:', err);
      } finally {
        setLoading(false);
        console.log('🏁 [IMDb Hook] Fetch complete');
      }
    };

    if (tmdbId) {
      fetchImdbTitle();
    }
  }, [tmdbId, mediaType]);

  return { data, loading, error };
};

export default useImdbTitle;