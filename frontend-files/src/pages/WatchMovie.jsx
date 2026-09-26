import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function WatchMovie() {
  const { id } = useParams();
  const [playback, setPlayback] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api.get(`/movies/${id}/stream`)
      .then(({ data }) => {
        if (!cancelled) setPlayback(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || 'Unable to load this video.');
      });
    return () => { cancelled = true; };
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <Link to={`/movies/${id}`} className="text-sm text-muted hover:text-ink">
        ← Back to details
      </Link>

      <div className="mt-6 aspect-video bg-elevated border border-line rounded-sm flex items-center justify-center">
        {playback?.embedUrl && (
          <iframe
            title="MixDrop video player"
            src={playback.embedUrl}
            className="w-full h-full border-0"
            allow="autoplay; fullscreen; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        )}
        {error && <p className="px-6 text-center text-red-400 text-sm">{error}</p>}
        {!playback && !error && <p className="text-muted text-sm">Loading MixDrop player…</p>}
      </div>
    </div>
  );
}
