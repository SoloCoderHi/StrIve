import React from "react";
import { useSelector } from "react-redux";
import Header from "./Header";
import TVShowCard from "./TVShowCard";
import usePopularTVShows from "../hooks/usePopularTVShows";
import useTopRatedTVShows from "../hooks/useTopRatedTVShows";
import useOnTheAirTVShows from "../hooks/useOnTheAirTVShows";

const TVShows = () => {
  const tvShows = useSelector((store) => store.tvShows);

  usePopularTVShows();
  useTopRatedTVShows();
  useOnTheAirTVShows();

  const TVShowList = ({ title, shows, icon }) => {
    if (!shows || shows.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
          {shows.map((tvShow) => (
            <TVShowCard
              key={tvShow.id}
              tvShow={tvShow}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen premium-page">
      <Header />

      <div className="pt-24 pb-12 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="glass-effect p-6 rounded-full">
              <span className="material-symbols-outlined text-7xl gradient-accent">
                tv
              </span>
            </div>
          </div>
          <h1 className="font-display text-6xl lg:text-7xl font-bold gradient-text mb-6">
            TV Shows
          </h1>
          <p className="text-xl text-white/60 font-secondary max-w-2xl mx-auto">
            Discover amazing TV series from around the world. Binge-watch your
            favorite shows anytime, anywhere.
          </p>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pb-20">
        <TVShowList
          title="On The Air"
          shows={tvShows.onTheAirTVShows}
          icon="live_tv"
        />
        <TVShowList
          title="Popular TV Shows"
          shows={tvShows.popularTVShows}
          icon="trending_up"
        />
        <TVShowList
          title="Top Rated"
          shows={tvShows.topRatedTVShows}
          icon="star"
        />
      </div>
    </div>
  );
};

export default TVShows;
