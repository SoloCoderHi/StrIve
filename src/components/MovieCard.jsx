import React from "react";
import { useNavigate } from "react-router-dom";

const MovieCard = ({ movie, onRemove }) => {
  const navigate = useNavigate();

  if (!movie.poster_path || movie.poster_path.trim() === "") return null;

  const handleCardClick = () => {
    const isTVShow = movie.media_type === "tv" || movie.first_air_date;
    if (isTVShow) {
      navigate(`/shows/${movie.id}`);
    } else {
      navigate(`/movie/${movie.id}`);
    }
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(movie);
    }
  };

  return (
    <div
      className="flex-none w-52 cursor-pointer group transition-all duration-300"
      onClick={handleCardClick}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <img
          src={
            movie.poster_path.startsWith("http")
              ? movie.poster_path
              : `https://image.tmdb.org/t/p/w500${movie.poster_path}`
          }
          alt={movie.title || movie.name}
          className="w-full h-[312px] object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="glass-effect rounded-full p-4 transform scale-90 group-hover:scale-100 transition-transform duration-300">
              <span className="material-symbols-outlined text-5xl text-white">
                play_circle
              </span>
            </div>
          </div>
          
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="glass-effect px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="material-symbols-outlined text-yellow-400 text-sm">
                  star
                </span>
                <span className="text-white font-semibold text-sm font-secondary">
                  {movie.vote_average?.toFixed(1)}
                </span>
              </div>
              <div className="glass-effect px-3 py-1.5 rounded-full">
                <span className="text-white text-xs font-bold font-secondary tracking-wide">
                  HD
                </span>
              </div>
            </div>
          </div>
        </div>

        {onRemove && (
          <button 
            className="absolute top-3 right-3 bg-red-600/90 backdrop-blur-sm p-2 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-700 hover:scale-110"
            onClick={handleRemoveClick}
            aria-label="Remove from list"
          >
            <span className="material-symbols-outlined text-white text-lg">
              delete
            </span>
          </button>
        )}

        <div className="absolute top-3 left-3 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
          <div className="glass-effect px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <span className="material-symbols-outlined text-yellow-400 text-sm">
              star
            </span>
            <span className="text-white font-semibold text-sm font-secondary">
              {movie.vote_average?.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 px-1">
        <h3 className="text-white text-sm font-semibold font-secondary truncate group-hover:text-red-400 transition-colors">
          {movie.title || movie.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-white/60 text-xs font-medium">
            {(movie.release_date || movie.first_air_date)?.split("-")[0]}
          </p>
          <span className="text-white/40">•</span>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-white/60 text-xs">
              {movie.media_type === 'tv' || movie.first_air_date ? 'tv' : 'movie'}
            </span>
            <p className="text-white/60 text-xs font-medium">
              {movie.media_type === 'tv' || movie.first_air_date ? 'Series' : 'Film'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MovieCard;