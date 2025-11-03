import React, { useRef } from 'react';
import RatingLegend from './RatingLegend';
import EpisodeRatingBox from './EpisodeRatingBox';
import useHorizontalScroll from '../../hooks/useHorizontalScroll';

const EpisodeMatrixView = ({ seasonsData, baseSeasonInfo, onEpisodeClick }) => {
  const scrollContainerRef = useRef(null);
  
  // Enable horizontal scroll with mouse wheel
  useHorizontalScroll(scrollContainerRef);

  if (!seasonsData || seasonsData.length === 0) {
    return (
      <div className="text-center py-12">
        <p style={{ color: 'var(--color-text-secondary)' }}>
          No season data available
        </p>
      </div>
    );
  }

  // Create a map for quick lookup: Map<season_number, Map<episode_number, episode_data>>
  const seasonEpisodeMap = new Map();
  seasonsData.forEach((season) => {
    if (season && season.episodes) {
      const episodeMap = new Map();
      season.episodes.forEach((episode) => {
        // Handle both API formats
        const episodeNum = episode.episode_number || episode.episodeNumber;
        episodeMap.set(episodeNum, episode);
      });
      const seasonNum = season.season_number || season.seasonNumber;
      seasonEpisodeMap.set(seasonNum, episodeMap);
    }
  });

  // Find the maximum number of episodes across all seasons
  const maxEpisodes = Math.max(
    ...seasonsData.map((season) => 
      season?.episodes?.length || 0
    ),
    0
  );

  // Get valid seasons (exclude season 0/specials)
  const validSeasons = baseSeasonInfo.filter(
    (season) => season.season_number > 0
  );

  return (
    <div>
      {/* Rating Legend */}
      <RatingLegend />

      {/* Matrix Table Container */}
      <div 
        ref={scrollContainerRef}
        className="overflow-x-auto scrollbar-hide" 
        style={{ backgroundColor: 'var(--color-bg-base)' }}
      >
        <table 
          className="border-collapse"
          style={{ width: 'auto' }}
          aria-label="Episode ratings by season"
        >
          <caption className="sr-only">Episode ratings matrix showing all seasons and episodes</caption>
          
          {/* Table Header - Season Numbers */}
          <thead>
            <tr>
              <th 
                scope="col"
                className="sticky left-0 z-20 p-3 text-left font-bold text-sm w-20"
                style={{ 
                  backgroundColor: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-primary)',
                  width: '5rem'
                }}
              >
                Episode
              </th>
              {validSeasons.map((season) => (
                <th 
                  key={season.id}
                  scope="col"
                  className="p-3 text-center font-bold text-sm w-20"
                  style={{ 
                    backgroundColor: 'var(--color-bg-elevated)',
                    color: 'var(--color-accent-primary)',
                    width: '5rem'
                  }}
                >
                  S{season.season_number}
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body - Episode Rows */}
          <tbody>
            {Array.from({ length: maxEpisodes }, (_, episodeIndex) => {
              const episodeNumber = episodeIndex + 1;
              
              // Check if ANY season has this episode number
              const hasAnyEpisode = validSeasons.some((season) => {
                const seasonNumber = season.season_number;
                const episodeMap = seasonEpisodeMap.get(seasonNumber);
                return episodeMap?.has(episodeNumber);
              });
              
              // Skip this row if no season has this episode
              if (!hasAnyEpisode) return null;
              
              return (
                <tr key={episodeNumber}>
                  {/* Episode Number Column (Sticky) */}
                  <th 
                    scope="row"
                    className="sticky left-0 z-10 p-3 text-left font-bold text-sm w-20"
                    style={{ 
                      backgroundColor: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-primary)',
                      width: '5rem'
                    }}
                  >
                    E{episodeNumber}
                  </th>
                  
                  {/* Rating Boxes for Each Season */}
                  {validSeasons.map((season) => {
                    const seasonNumber = season.season_number;
                    const episodeMap = seasonEpisodeMap.get(seasonNumber);
                    const episode = episodeMap?.get(episodeNumber);
                    const rating = episode?.vote_average || episode?.voteAverage || null;

                    return (
                      <td 
                        key={`${seasonNumber}-${episodeNumber}`}
                        className="p-2 w-20 h-20"
                        style={{ 
                          backgroundColor: 'var(--color-bg-base)',
                          width: '5rem',
                          height: '5rem'
                        }}
                      >
                        {episode ? (
                          <EpisodeRatingBox 
                            rating={rating}
                            episodeNumber={episodeNumber}
                            seasonNumber={seasonNumber}
                            onClick={() => {
                              if (onEpisodeClick) {
                                onEpisodeClick(episode, seasonNumber);
                              }
                            }}
                          />
                        ) : (
                          // Empty cell - no episode exists
                          <div className="w-full h-full"></div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EpisodeMatrixView;
