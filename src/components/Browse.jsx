import useAddMovies from "../hooks/useAddMovies";
import usePopularMovies from "../hooks/usePopularMovies";
import useTopRatedMovies from "../hooks/useTopRatedMovies";
import useUpcomingMovies from "../hooks/useUpcomingMovies";
import usePopularTVShows from "../hooks/usePopularTVShows";
import useTopRatedTVShows from "../hooks/useTopRatedTVShows";
import useOnTheAirTVShows from "../hooks/useOnTheAirTVShows";
import Header from "./Header";
import MainContainer from "./MainContainer";
import MovieCard from "./MovieCard";
import { useSelector } from "react-redux";

const Browse = () => {
  useAddMovies();
  usePopularMovies();
  useTopRatedMovies();
  useUpcomingMovies();
  usePopularTVShows();
  useTopRatedTVShows();
  useOnTheAirTVShows();

  const movies = useSelector((store) => store.movies);
  const tvShows = useSelector((store) => store.tvShows);

  const MediaList = ({ title, items, icon, type }) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
          {items.map((item) => {
            const movie = {
              id: item.id,
              poster_path: item.poster_path,
              title: item.title,
              name: item.name,
              release_date: item.release_date,
              first_air_date: item.first_air_date,
              vote_average: item.vote_average,
              media_type: type
            };
            return <MovieCard key={item.id} movie={movie} />;
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen premium-page">
      <Header />
      <MainContainer />
      
      <div className="w-full px-6 lg:px-12 py-8">
        <MediaList
          title="Popular Movies"
          items={movies.popularMovies}
          icon="trending_up"
          type="movie"
        />
        
        <MediaList
          title="Top Rated Movies"
          items={movies.topRatedMovies}
          icon="star"
          type="movie"
        />
        
        <MediaList
          title="Upcoming Movies"
          items={movies.upcomingMovies}
          icon="event"
          type="movie"
        />
        
        <MediaList
          title="On The Air TV Shows"
          items={tvShows.onTheAirTVShows}
          icon="live_tv"
          type="tv"
        />
        
        <MediaList
          title="Popular TV Shows"
          items={tvShows.popularTVShows}
          icon="trending_up"
          type="tv"
        />
        
        <MediaList
          title="Top Rated TV Shows"
          items={tvShows.topRatedTVShows}
          icon="star"
          type="tv"
        />
      </div>
    </div>
  );
};

export default Browse;
