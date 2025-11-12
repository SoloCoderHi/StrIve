import { createBrowserRouter, Navigate } from "react-router-dom";
import Browse from "./Browse";
import Login from "./Login";
import TVShows from "./TVShows";
import MoviesPage from "./MoviesPage";
import MovieDetails from "./MovieDetails";
import MoviePlayer from "./MoviePlayer";
import TVShowDetails from "./TVShowDetails";
import TVShowDetailsPage from "./TVShowDetailsPage";
import SearchPage from "./SearchPage";
import ProtectedRoute from "./ProtectedRoute";
import MyListPage from "./MyListPage"; // Import MyListPage
import MyListsPage from "./MyListsPage"; // Import MyListsPage
import ListDetailsPage from "./ListDetailsPage"; // Import ListDetailsPage
import ImportPage from "./ImportPage"; // Import ImportPage
import ImportReviewPage from "./ImportReviewPage"; // Import ImportReviewPage
import { RouterProvider } from "react-router-dom";
import Footer from "./Footer";

const Body = () => {
  const appRouter = createBrowserRouter([
    {
      path: "/",
      element: <Browse />,
    },
    {
      path: "/login",
      element: <Login />,
    },
    {
      path: "/movies",
      element: (
        <ProtectedRoute>
          <MoviesPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/shows",
      element: (
        <ProtectedRoute>
          <TVShows />
        </ProtectedRoute>
      ),
    },
    {
      path: "/search",
      element: (
        <ProtectedRoute>
          <SearchPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/my-list", // Add new route for My List
      element: (
        <ProtectedRoute>
          <MyListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/my-lists", // Add new route for My Lists
      element: (
        <ProtectedRoute>
          <MyListsPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/my-lists/:listId", // Add new route for individual list details
      element: (
        <ProtectedRoute>
          <ListDetailsPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/import", // Import CSV page
      element: (
        <ProtectedRoute>
          <ImportPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/import/review", // Import review page
      element: (
        <ProtectedRoute>
          <ImportReviewPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/movie/:movieId",
      element: <MovieDetails />,
    },

    {
      path: "/shows/:tvId",
      element: (
        <ProtectedRoute>
          <TVShowDetailsPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/tv/:tvId/:season/:episode",
      element: (
        <ProtectedRoute>
          <TVShowDetails />
        </ProtectedRoute>
      ),
    },
  ]);

  return (
    <div>
      <RouterProvider router={appRouter} />
      <Footer />
    </div>
  );
};

export default Body;
