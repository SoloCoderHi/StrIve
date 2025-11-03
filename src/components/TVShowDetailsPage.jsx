import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { ArrowLeft, Play, Plus, Star, ExternalLink, Check } from "lucide-react";
import Header from "./Header";
import useTvShowDetails from "../hooks/useTvShowDetails";
import useTvSeasonEpisodes from "../hooks/useTvSeasonEpisodes";
import useTvVideos from "../hooks/useTvVideos";
import useRequireAuth from "../hooks/useRequireAuth";
import { addToList } from "../util/firestoreService";
import { options } from "../util/constants";
import EpisodeOverlay from "./EpisodeOverlay";
import SeasonTabs from "./SeasonTabs";
import QuickInfoPanel from "./QuickInfoPanel";
import EpisodeViewToggle from "./TVShowDetails/EpisodeViewToggle";
import EpisodeListItem from "./TVShowDetails/EpisodeListItem";
import EpisodeCard from "./TVShowDetails/EpisodeCard";
import SimilarShowsPanel from "./TVShowDetails/SimilarShowsPanel";
import EpisodeMatrixView from "./TVShowDetails/EpisodeMatrixView";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const TVShowDetailsPage = () => {
  const { tvId } = useParams();
  const navigate = useNavigate();
  const user = useRequireAuth();

  const { data: showDetails, loading: detailsLoading, error: detailsError } = useTvShowDetails(tvId);
  const { data: videos } = useTvVideos(tvId);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [addingToWatchlist, setAddingToWatchlist] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [allSeasonsData, setAllSeasonsData] = useState(null);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);

  const { data: seasonData, loading: episodesLoading } = useTvSeasonEpisodes(
    tvId,
    selectedSeason
  );

  // Determine initial selected season
  useEffect(() => {
    if (showDetails && showDetails.numberOfSeasons) {
      setSelectedSeason(1);
    }
  }, [showDetails]);

  // Fetch all seasons data for matrix view
  const fetchAllSeasonDetails = async () => {
    if (!showDetails || !showDetails.numberOfSeasons) return;

    setIsLoadingMatrix(true);
    try {
      const validSeasons = Array.from(
        { length: showDetails.numberOfSeasons }, 
        (_, i) => i + 1
      );

      const seasonPromises = validSeasons.map((seasonNum) =>
        fetch(
          `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNum}?language=en-US`,
          options
        ).then(res => res.json())
      );

      const seasonsData = await Promise.all(seasonPromises);
      setAllSeasonsData(seasonsData);
    } catch (error) {
      console.error("Error fetching all seasons data:", error);
      setAllSeasonsData([]);
    } finally {
      setIsLoadingMatrix(false);
    }
  };

  // Load all seasons when matrix view is selected
  useEffect(() => {
    if (viewMode === 'matrix' && allSeasonsData === null && showDetails) {
      fetchAllSeasonDetails();
    }
  }, [viewMode, allSeasonsData, showDetails]);

  // Find trailer
  const trailer = videos?.find(
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
  ) || videos?.find((v) => v.site === "YouTube" && v.type === "Trailer");

  const handlePlayNow = () => {
    if (!seasonData?.episodes || seasonData.episodes.length === 0) return;
    setSelectedEpisode(seasonData.episodes[0]);
    setShowEpisodeOverlay(true);
  };

  const handleEpisodeClick = (episode) => {
    setSelectedEpisode(episode);
    setShowEpisodeOverlay(true);
  };

  const handleAddToWatchlist = async () => {
    if (!user) {
      alert("Please log in to add shows to your watchlist.");
      return;
    }

    try {
      setAddingToWatchlist(true);
      const mediaItem = {
        id: tvId,
        title: showDetails?.name || "TV Show",
        poster_path: showDetails?.posterPath,
        overview: showDetails?.overview,
        first_air_date: showDetails?.firstAirDate,
        vote_average: showDetails?.voteAverage,
        type: "tv",
      };

      await addToList(user.uid, "watchlist", mediaItem);
      setIsInWatchlist(true);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      alert("Failed to add to watchlist. Please try again.");
    } finally {
      setAddingToWatchlist(false);
    }
  };

  if (detailsLoading) {
    return (
      <div className="amoled-page flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto"
            style={{ borderColor: 'var(--color-accent-primary)' }}></div>
          <div className="mt-4 text-lg" style={{ color: 'var(--color-text-primary)' }}>
            Loading TV Show...
          </div>
        </div>
      </div>
    );
  }

  if (detailsError) {
    return (
      <div className="amoled-page flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-xl mb-4">Error loading TV show</div>
          <p style={{ color: 'var(--color-text-secondary)' }}>{detailsError}</p>
          <button
            onClick={() => navigate("/shows")}
            className="mt-6 px-6 py-3 rounded"
            style={{ backgroundColor: 'var(--color-accent-primary)', color: '#000' }}
          >
            Back to Shows
          </button>
        </div>
      </div>
    );
  }

  if (!showDetails) {
    return (
      <div className="amoled-page flex items-center justify-center">
        <div className="text-center">
          <div className="text-xl mb-4" style={{ color: 'var(--color-text-primary)' }}>
            Show not found
          </div>
          <button
            onClick={() => navigate("/shows")}
            className="mt-6 px-6 py-3 rounded"
            style={{ backgroundColor: 'var(--color-accent-primary)', color: '#000' }}
          >
            Back to Shows
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      <div className="amoled-page">
        {/* Hero Section with Backdrop */}
        <div className="relative h-[70vh] bg-cover bg-center"
          style={{
            backgroundImage: showDetails.backdropPath
              ? `url(${IMG_CDN_URL}/original${showDetails.backdropPath})`
              : 'none',
          }}
        >
          {/* Gradients */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent"></div>

          {/* Back Button */}
          <button
            onClick={() => navigate("/shows")}
            className="absolute top-6 left-6 z-20 p-3 rounded-full focus-accent transition-all cursor-pointer"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            aria-label="Back to shows"
          >
            <ArrowLeft className="w-6 h-6" style={{ color: 'var(--color-text-primary)' }} />
          </button>

          {/* Title and Meta Content */}
          <div className="absolute bottom-0 left-0 right-0 p-12 z-10">
            <div className="amoled-container">
              <div className="max-w-4xl">
                {/* Title Logo or Text */}
                {showDetails.logos && showDetails.logos.length > 0 ? (
                  <div className="mb-4">
                    <img
                      src={`${IMG_CDN_URL}/w500${showDetails.logos[0].filePath}`}
                      alt={`${showDetails.name} Logo`}
                      className="max-w-full h-auto max-h-32 object-contain"
                      style={{ maxWidth: '500px' }}
                    />
                  </div>
                ) : (
                  <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight"
                    style={{ color: 'var(--color-text-primary)' }}>
                    {showDetails.name}
                  </h1>
                )}

                {/* Meta Info Row */}
                <div className="flex flex-wrap items-center gap-4 mb-6 text-lg">
                  <span style={{ color: 'var(--color-accent-primary)' }} className="font-semibold">
                    {showDetails.firstAirDate?.split("-")[0]}
                  </span>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {showDetails.numberOfSeasons} Season{showDetails.numberOfSeasons !== 1 ? 's' : ''}
                  </span>
                  <span className="px-3 py-1 rounded text-sm font-medium"
                    style={{ backgroundColor: 'var(--color-accent-primary)', color: '#000' }}>
                    {showDetails.status}
                  </span>
                  {showDetails.voteAverage && (
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                      <span style={{ color: 'var(--color-text-primary)' }} className="font-medium">
                        {showDetails.voteAverage.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Overview */}
                <p className="text-lg leading-relaxed mb-6 max-w-3xl"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  {showDetails.overview}
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-4">
                  {seasonData?.episodes && seasonData.episodes.length > 0 && (
                    <button
                      onClick={handlePlayNow}
                      className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-lg transition-all hover:opacity-90 focus-accent cursor-pointer"
                      style={{ backgroundColor: 'var(--color-text-primary)', color: '#000' }}
                    >
                      <Play className="w-6 h-6" />
                      Play Now
                    </button>
                  )}

                  {trailer && (
                    <a
                      href={`https://www.youtube.com/watch?v=${trailer.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-lg transition-all focus-accent cursor-pointer"
                      style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
                    >
                      <Play className="w-6 h-6" />
                      Trailer
                    </a>
                  )}

                  <button
                    onClick={handleAddToWatchlist}
                    disabled={addingToWatchlist || isInWatchlist}
                    className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-lg transition-all focus-accent disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
                  >
                    {isInWatchlist ? <Check className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                    {isInWatchlist ? 'In Watchlist' : 'Watch Later'}
                  </button>
                </div>

                {/* Genres */}
                {showDetails.genres && showDetails.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {showDetails.genres.map((genre) => (
                      <span
                        key={genre.id}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-elevated)',
                          color: 'var(--color-text-secondary)'
                        }}
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="amoled-container py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left Column: Poster + Quick Info */}
            <div className="lg:col-span-3">
              {/* Poster */}
              {showDetails.posterPath && (
                <div className="mb-6 rounded-lg overflow-hidden shadow-2xl">
                  <img
                    src={`${IMG_CDN_URL}/w500${showDetails.posterPath}`}
                    alt={showDetails.name}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              )}

              {/* Quick Info Panel */}
              <QuickInfoPanel showDetails={showDetails} />
            </div>

            {/* Right Column: Episodes - Now with more space */}
            <div className="lg:col-span-9">
              {/* Episodes Heading with View Toggle */}
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Episodes
                </h2>
                <EpisodeViewToggle viewMode={viewMode} setViewMode={setViewMode} />
              </div>

              {/* Season Tabs - Only show for list/grid view */}
              {viewMode !== 'matrix' && (
                <SeasonTabs
                  totalSeasons={showDetails.numberOfSeasons}
                  selectedSeason={selectedSeason}
                  onSeasonChange={setSelectedSeason}
                />
              )}

              {/* Episodes Section with Region Role */}
              <div className="mt-6" role="region" aria-label="Episodes">
                {viewMode === 'matrix' ? (
                  // Matrix View - Show all seasons
                  isLoadingMatrix ? (
                    <div className="flex justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 mx-auto"
                          style={{ borderColor: 'var(--color-accent-primary)' }}></div>
                        <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>
                          Loading all season data...
                        </p>
                      </div>
                    </div>
                  ) : allSeasonsData ? (
                    <EpisodeMatrixView 
                      seasonsData={allSeasonsData}
                      baseSeasonInfo={showDetails.seasons || []}
                      onEpisodeClick={(episode, seasonNumber) => {
                        setSelectedSeason(seasonNumber);
                        handleEpisodeClick(episode);
                      }}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-red-500">Could not load matrix data.</p>
                    </div>
                  )
                ) : (
                  // List/Grid View - Show selected season
                  episodesLoading ? (
                    <div className="flex justify-center py-12">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-4"
                        style={{ borderColor: 'var(--color-accent-primary)' }}></div>
                    </div>
                  ) : seasonData?.episodes && seasonData.episodes.length > 0 ? (
                    viewMode === 'list' ? (
                      // List View - Vertical scrolling container with gradient fades
                      <div className="relative">
                        {/* Top gradient fade */}
                        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black to-transparent pointer-events-none z-10"></div>
                        
                        {/* Scrolling content */}
                        <div className="grid grid-cols-1 gap-4 max-h-[850px] overflow-y-auto scrollbar-hide">
                          {seasonData.episodes.map((episode) => (
                            <EpisodeListItem
                              key={episode.id}
                              episode={episode}
                              onClick={() => handleEpisodeClick(episode)}
                            />
                          ))}
                        </div>
                        
                        {/* Bottom gradient fade */}
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent pointer-events-none z-10"></div>
                      </div>
                    ) : (
                      // Grid View - Fixed at 3 episodes per row with gradient fades
                      <div className="relative">
                        {/* Top gradient fade */}
                        <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black to-transparent pointer-events-none z-10"></div>
                        
                        {/* Scrolling content */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[850px] overflow-y-auto scrollbar-hide">
                          {seasonData.episodes.map((episode) => (
                            <EpisodeCard
                              key={episode.id}
                              episode={episode}
                              onClick={() => handleEpisodeClick(episode)}
                            />
                          ))}
                        </div>
                        
                        {/* Bottom gradient fade */}
                        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent pointer-events-none z-10"></div>
                      </div>
                    )
                  ) : (
                    <div className="text-center py-12">
                      <p style={{ color: 'var(--color-text-secondary)' }}>
                        No episodes available for this season
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>

          {/* Similar Shows Section - Now Below Main Content */}
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
              You might also like
            </h2>
            <SimilarShowsPanel tvId={tvId} />
          </div>
        </div>
      </div>

      {/* Episode Overlay Modal */}
      {showEpisodeOverlay && selectedEpisode && (
        <EpisodeOverlay
          episode={selectedEpisode}
          showDetails={showDetails}
          onClose={() => {
            setShowEpisodeOverlay(false);
            setSelectedEpisode(null);
          }}
        />
      )}
    </>
  );
};

export default TVShowDetailsPage;
