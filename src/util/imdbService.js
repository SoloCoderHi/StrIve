/**
 * IMDb Service
 * Handles all API calls to IMDb data provider
 * Requires VITE_IMDB_BASE_URL environment variable
 */
class IMDbService {
  constructor() {
    const baseUrl = import.meta.env.VITE_IMDB_BASE_URL;
    
    if (!baseUrl) {
      const errorMsg = 'Missing VITE_IMDB_BASE_URL environment variable. IMDb features are disabled.';
      console.error(`❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }
    
    this.baseUrl = baseUrl;
  }

  /**
   * Fetches title information by IMDb ID
   * @param {string} imdbId - The IMDb ID to lookup
   * @returns {Promise<Object>} The title data from IMDb API
   */
  async getTitleById(imdbId) {
    try {
      const url = `${this.baseUrl}/titles/${imdbId}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error(`Error fetching data for IMDb ID ${imdbId}:`, error);
      throw error;
    }
  }

  /**
   * Searches for titles based on a query string
   * @param {string} query - The search query
   * @returns {Promise<Array>} The array of title data from IMDb API
   */
  async searchTitles(query, limit = 50) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const url = `${this.baseUrl}/search/titles?query=${encodedQuery}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data.titles || [];
    } catch (error) {
      console.error(`Error searching for titles with query "${query}":`, error);
      throw error;
    }
  }
}

export default IMDbService;