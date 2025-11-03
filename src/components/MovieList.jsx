import React, { useRef } from "react";
import MovieCard from "./MovieCard";
import useHorizontalScroll from "../hooks/useHorizontalScroll";

const MovieList = ({ title, movies }) => {
  const scrollRef = useRef(null);
  useHorizontalScroll(scrollRef);

  return (
    <div className="px-6">
      <h1 className="text-3xl py-4 text-white">{title}</h1>
      <div ref={scrollRef} className="flex overflow-x-scroll">
        <div className="flex">
          {/* We loop through the 'movies' array to create a MovieCard for each one. */}
          {movies?.map((movie) => (
            // THE FIX: We add the unique 'key' prop using movie.id.
            <MovieCard 
              key={movie.id} 
              posterPath={movie.poster_path} 
              movieId={movie.id} 
              voteAverage={movie.vote_average}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MovieList;
