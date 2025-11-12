import React from "react";
import { useNavigate } from "react-router-dom";
import { IMG_CDN_URL } from "../util/constants";
import useImdbTitle from "../hooks/useImdbTitle";

const TVShowCard = ({ tvShow }) => {
  const navigate = useNavigate();
  const { data: imdbData, loading: imdbLoading } = useImdbTitle(tvShow.id, "tv");

  if (!tvShow.poster_path) return null;

  const handleClick = () => {
    navigate(`/shows/${tvShow.id}`);
  };
  
  // Determine which rating to display
  const displayRating = (!imdbLoading && imdbData?.rating?.aggregateRating) 
    ? imdbData.rating.aggregateRating 
    : tvShow.vote_average?.toFixed(1);
  
  const ratingSource = (!imdbLoading && imdbData?.rating?.aggregateRating) ? "IMDb" : "TMDB";

  return (
    <div
      className="flex-none w-52 cursor-pointer group transition-all duration-300"
      onClick={handleClick}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <img
          src={`${IMG_CDN_URL}${tvShow.poster_path}`}
          alt={tvShow.name}
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
                  {displayRating}
                </span>
                <span className="text-white/60 text-xs font-secondary">
                  {ratingSource}
                </span>
              </div>
              <div className="glass-effect px-3 py-1.5 rounded-full flex items-center gap-1">
                <span className="material-symbols-outlined text-white text-sm">
                  tv
                </span>
                <span className="text-white text-xs font-bold font-secondary tracking-wide">
                  SERIES
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute top-3 left-3 opacity-100 group-hover:opacity-0 transition-opacity duration-300">
          <div className="glass-effect px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
            <span className="material-symbols-outlined text-yellow-400 text-sm">
              star
            </span>
            <span className="text-white font-semibold text-sm font-secondary">
              {displayRating}
            </span>
            <span className="text-white/60 text-xs font-secondary">
              {ratingSource}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-3 px-1">
        <h3 className="text-white text-sm font-semibold font-secondary truncate group-hover:text-red-400 transition-colors">
          {tvShow.name}
        </h3>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-white/60 text-xs font-medium">
            {tvShow.first_air_date?.split("-")[0]}
          </p>
          <span className="text-white/40">•</span>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-white/60 text-xs">
              tv
            </span>
            <p className="text-white/60 text-xs font-medium">
              Series
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVShowCard;