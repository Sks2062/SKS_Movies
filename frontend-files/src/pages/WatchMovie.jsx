import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));

export default function WatchMovie() {
  const { id } = useParams();
  const [playback, setPlayback] = useState(null);
  const [error, setError] = useState('');
  const isTeraBoxPlayerPage = playback?.provider === 'terabox' && playback.streamUrl?.includes('/play/video');

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
          isTeraBoxPlayerPage ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-muted text-sm max-w-lg">
                This is a TeraBox player page, which cannot be displayed inside this site. Open it on TeraBox to watch.
              </p>
              <a
                href={playback.streamUrl}
                target="_blank"
                rel="noreferrer"
                className="bg-gold text-bg rounded-full px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors"
              >
                ▶ Open video on TeraBox
              </a>
            </div>
          ) : playback.provider === 'terabox' ? (
            <iframe
              title="TeraBox video player"
              src={playback.streamUrl}
              allow="autoplay; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="w-full h-full border-0"
            />
          ) : (
            <video controls autoPlay className="w-full h-full" src={playback.streamUrl}>
              Your browser does not support video playback.
            </video>
          )
        )}
        {!playback && !error && <p className="text-muted text-sm">Preparing playback…</p>}
      </div>
      {playback?.provider === 'terabox' && !isTeraBoxPlayerPage && (
        <p className="mt-3 text-sm text-muted">
          If the player does not load, <a href={playback.streamUrl} target="_blank" rel="noreferrer" className="text-gold hover:underline">open this video on TeraBox</a>.
        </p>
      )}
    </div>
  );
}
