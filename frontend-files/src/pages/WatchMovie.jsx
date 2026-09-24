import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));

export default function WatchMovie() {
  const { id } = useParams();
  const [playback, setPlayback] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/movies/${id}/stream`)
      .then((res) => setPlayback(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Unable to start playback'));
  }, [id]);

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <Link to={`/movies/${id}`} className="text-sm text-muted hover:text-ink">
        ← Back to details
      </Link>

      <div className="mt-6 aspect-video bg-elevated border border-line rounded-sm flex items-center justify-center">
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {playback?.playbackId && (
          <Suspense fallback={<p className="text-muted text-sm">Loading video player…</p>}>
            <MuxPlayer
              playbackId={playback.playbackId}
              tokens={playback.tokens}
              autoPlay
              className="w-full h-full"
            />
          </Suspense>
        )}
        {playback?.streamUrl && (
          <video controls autoPlay className="w-full h-full" src={playback.streamUrl}>
            Your browser does not support video playback.
          </video>
        )}
        {!playback && !error && <p className="text-muted text-sm">Preparing playback…</p>}
      </div>
    </div>
  );
}
