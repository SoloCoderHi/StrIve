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
import MyListsPage from "./MyListsPage"; // Import MyListsPage
import ListDetailsPage from "./ListDetailsPage"; // Import ListDetailsPage
import ImportPage from "./ImportPage"; // Import ImportPage
import ImportReviewPage from "./ImportReviewPage"; // Import ImportReviewPage
import { SimklPage, SimklCallback } from "./Simkl";
import { useSimklBackgroundSync } from "../hooks/useSimkl";
import { RouterProvider } from "react-router-dom";
import Footer from "./Footer";

const Body = () => {
  useSimklBackgroundSync(); // Enable background sync globally

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
      path: "/my-lists", // User's collections page
      element: (
        <ProtectedRoute>
          <MyListsPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/my-lists/:listId", // Individual list details
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
      path: "/simkl",
      element: (
        <ProtectedRoute>
          <SimklPage />
        </ProtectedRoute>
      ),
    },
    {
      path: "/simkl/callback",
      element: <SimklCallback />,
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
