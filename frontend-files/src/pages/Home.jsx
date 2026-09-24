import { useEffect, useState } from 'react';
import api from '../services/api';
import MovieCard from '../components/MovieCard';

export default function Home() {
  const [movies, setMovies] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchMovies = async (query = '') => {
    setLoading(true);
    try {
      const res = await api.get('/movies', { params: query ? { search: query } : {} });
      setMovies(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMovies();
  }, []);

  const onSubmit = (e) => {
    e.preventDefault();
    fetchMovies(search);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="max-w-xl">
        <h1 className="font-display text-5xl leading-[1.05]">
          Something worth watching, every time.
        </h1>
        <p className="text-muted mt-4">
          Browse the collection, or search by title, genre, or description.
        </p>

        <form onSubmit={onSubmit} className="mt-8 flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search movies…"
            className="flex-1 bg-elevated border border-line rounded-full px-5 py-2.5 text-sm outline-none focus:border-gold"
          />
          <button
            type="submit"
            className="bg-gold text-bg rounded-full px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors"
          >
            Search
          </button>
        </form>
      </div>

      <div className="mt-14">
        {loading ? (
          <p className="text-muted">Loading…</p>
        ) : movies.length === 0 ? (
          <p className="text-muted">No movies found.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-6 gap-y-10">
            {movies.map((movie) => (
              <MovieCard key={movie._id} movie={movie} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
