import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function MovieDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [movie, setMovie] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.get(`/movies/${id}`).then((res) => setMovie(res.data));
  }, [id]);

  const handleDownload = async () => {
    if (!user) return navigate('/login');
    try {
      const res = await api.get(`/movies/${id}/download`);
      window.open(res.data.downloadUrl, '_blank');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Download unavailable');
    }
  };

  if (!movie) return <div className="max-w-5xl mx-auto px-6 py-14 text-muted">Loading…</div>;

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="grid md:grid-cols-[280px_1fr] gap-10">
        <div className="aspect-[2/3] bg-elevated border border-line rounded-sm overflow-hidden">
          {movie.posterUrl ? (
            <img src={movie.posterUrl} alt={movie.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-sm">No poster</div>
          )}
        </div>

        <div>
          <h1 className="font-display text-4xl">{movie.title}</h1>
          <p className="text-muted mt-2">
            {movie.genre?.join(', ')} · {movie.releaseYear}
            {movie.duration ? ` · ${movie.duration} min` : ''}
          </p>

          <p className="mt-6 leading-relaxed max-w-xl">{movie.description}</p>

          <div className="flex gap-3 mt-8">
            {movie.allowStreaming && (
              <Link
                to={`/watch/${movie._id}`}
                className="bg-gold text-bg rounded-full px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors"
              >
                ▶ Watch now
              </Link>
            )}
            {movie.allowDownload && (
              <button
                onClick={handleDownload}
                className="border border-line rounded-full px-6 py-2.5 text-sm font-medium hover:border-gold transition-colors"
              >
                ↓ Download
              </button>
            )}
          </div>

          {message && <p className="text-sm text-red-400 mt-3">{message}</p>}
        </div>
      </div>
    </div>
  );
}
