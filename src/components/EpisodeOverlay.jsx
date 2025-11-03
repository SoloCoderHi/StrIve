import React, { useEffect, useRef, useState } from "react";
import { X, Plus, Check, Play } from "lucide-react";
import { useSelector } from "react-redux";
import { addToList } from "../util/firestoreService";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const EpisodeOverlay = ({ episode, showDetails, onClose }) => {
  const overlayRef = useRef(null);
  const closeButtonRef = useRef(null);
  const user = useSelector((store) => store.user?.user);
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    closeButtonRef.current?.focus();

    const handleEscape = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    const handleClickOutside = (e) => {
      if (overlayRef.current === e.target) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "auto";
    };
  }, [onClose]);

  const handleAddToWatchlist = async () => {
    if (!user) {
      alert("Please log in to add to your watchlist.");
      return;
    }

    try {
      setAdding(true);
      const mediaItem = {
        id: showDetails.id,
        title: showDetails.name,
        poster_path: showDetails.posterPath,
        overview: showDetails.overview,
        first_air_date: showDetails.firstAirDate,
        vote_average: showDetails.voteAverage,
        type: "tv",
      };

      await addToList(user.uid, "watchlist", mediaItem);
      setIsInWatchlist(true);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      alert("Failed to add to watchlist.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)' }}
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="episode-title"
    >
      <div
        className="relative max-w-4xl w-full rounded-lg overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--color-bg-primary)' }}
      >
        {/* Close Button */}
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-full focus-accent transition-all"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          aria-label="Close episode details"
        >
          <X className="w-6 h-6" style={{ color: 'var(--color-text-primary)' }} />
        </button>

        {/* Episode Still */}
        {episode.stillPath && (
          <div className="relative w-full" style={{ aspectRatio: '16/9' }}>
            <img
              src={`${IMG_CDN_URL}/w780${episode.stillPath}`}
              alt={episode.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent"></div>
          </div>
        )}

        {/* Content */}
        <div className="p-8">
          <div className="mb-4">
            <span className="text-sm font-semibold"
              style={{ color: 'var(--color-accent-primary)' }}>
              Season {episode.seasonNumber} • Episode {episode.episodeNumber}
            </span>
          </div>

          <h2
            id="episode-title"
            className="text-3xl font-bold mb-4"
            style={{ color: 'var(--color-text-primary)' }}
          >
            {episode.name}
          </h2>

          {episode.overview && (
            <p className="text-lg leading-relaxed mb-6"
              style={{ color: 'var(--color-text-secondary)' }}>
              {episode.overview}
            </p>
          )}

          {/* Metadata */}
          <div className="flex flex-wrap items-center gap-4 mb-6 text-sm"
            style={{ color: 'var(--color-text-tertiary)' }}>
            {episode.airDate && (
              <span>
                Aired: {new Date(episode.airDate).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </span>
            )}
            {episode.runtime && <span>{episode.runtime} minutes</span>}
            {episode.voteAverage > 0 && (
              <span className="font-medium"
                style={{ color: 'var(--color-text-secondary)' }}>
                ⭐ {episode.voteAverage.toFixed(1)}/10
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-4">
            <button
              className="flex items-center gap-2 px-6 py-3 rounded font-semibold transition-all focus-accent"
              style={{ backgroundColor: 'var(--color-text-primary)', color: '#000' }}
            >
              <Play className="w-5 h-5" />
              Watch Episode
            </button>

            <button
              onClick={handleAddToWatchlist}
              disabled={adding || isInWatchlist}
              className="flex items-center gap-2 px-6 py-3 rounded font-semibold transition-all focus-accent disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
            >
              {isInWatchlist ? <Check className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
              {isInWatchlist ? 'In Watchlist' : 'Watch Later'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EpisodeOverlay;
