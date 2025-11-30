import React from "react";
import { useSelector } from "react-redux";
import Header from "./Header";
import MovieCard from "./MovieCard";
import usePopularMovies from "../hooks/usePopularMovies";
import useTopRatedMovies from "../hooks/useTopRatedMovies";
import useUpcomingMovies from "../hooks/useUpcomingMovies";

const MoviesPage = () => {
  const movies = useSelector((store) => store.movies);

  usePopularMovies();
  useTopRatedMovies();
  useUpcomingMovies();

  const MovieList = ({ title, movies, icon }) => {
    if (!movies || movies.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
          {movies.map((movie) => (
            <MovieCard
              key={movie.id}
              movie={movie}
            />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen premium-page pt-20">
      <Header />
      
      <div className="pt-4 pb-12 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <div className="glass-effect p-6 rounded-full">
              <span className="material-symbols-outlined text-7xl gradient-accent">
                movie
              </span>
            </div>
          </div>
          <h1 className="font-display text-6xl lg:text-7xl font-bold gradient-text mb-6">
            Movies
          </h1>
          <p className="text-xl text-white/60 font-secondary max-w-2xl mx-auto">
            Discover amazing movies from around the world. Watch your favorites
            anytime, anywhere.
          </p>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pb-20">
        <MovieList
          title="Popular Movies"
          movies={movies.popularMovies}
          icon="trending_up"
        />
        <MovieList
          title="Top Rated"
          movies={movies.topRatedMovies}
          icon="star"
        />
        <MovieList
          title="Upcoming"
          movies={movies.upcomingMovies}
          icon="event"
        />
      </div>
    </div>
  );
};

export default MoviesPage;