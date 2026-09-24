import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

export default function WatchMovie() {
  const { id } = useParams();
  const [streamUrl, setStreamUrl] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/movies/${id}/stream`)
      .then((res) => setStreamUrl(res.data.streamUrl))
      .catch((err) => setError(err.response?.data?.message || 'Unable to start playback'));
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <Link to={`/movies/${id}`} className="text-sm text-muted hover:text-ink">
        ← Back to details
      </Link>

      <div className="mt-6 aspect-video bg-elevated border border-line rounded-sm flex items-center justify-center">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {streamUrl && (
          <video controls autoPlay className="w-full h-full" src={streamUrl}>
            Your browser does not support video playback.
          </video>
        )}
        {!streamUrl && !error && <p className="text-muted text-sm">Preparing playback…</p>}
      </div>
    </div>
  );
}
