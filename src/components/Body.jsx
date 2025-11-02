import { createBrowserRouter, Navigate } from "react-router-dom";
import Browse from "./Browse";
import Login from "./Login";
import TVShows from "./TVShows";
import MoviesPage from "./MoviesPage";
import MovieDetails from "./MovieDetails";
import MoviePlayer from "./MoviePlayer";
import TVShowDetails from "./TVShowDetails";
import SearchPage from "./SearchPage";
import ProtectedRoute from "./ProtectedRoute";
import MyListPage from "./MyListPage"; // Import MyListPage
import MyListsPage from "./MyListsPage"; // Import MyListsPage
import ListDetailsPage from "./ListDetailsPage"; // Import ListDetailsPage
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
      path: "/import", // Redirect legacy /import to /my-lists
      element: <Navigate to="/my-lists" replace />,
    },
    {
      path: "/import/review", // Add new route for import review page
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
          <TVShowDetails />
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
