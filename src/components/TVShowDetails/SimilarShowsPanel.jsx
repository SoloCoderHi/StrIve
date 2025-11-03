import React from "react";
import useSimilarShows from "../../hooks/useSimilarShows";
import SimilarShowsCard from "./SimilarShowsCard";

const SimilarShowsPanel = ({ tvId }) => {
  const { data: similarShows, loading, error } = useSimilarShows(tvId);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2"
          style={{ borderColor: 'var(--color-accent-primary)' }}></div>
      </div>
    );
  }

  if (error || !similarShows || similarShows.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        No similar shows found
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
      {similarShows.map((show) => (
        <SimilarShowsCard key={show.id} show={show} />
      ))}
    </div>
  );
};

export default SimilarShowsPanel;
