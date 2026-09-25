import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';

const MuxPlayer = lazy(() => import('@mux/mux-player-react'));

export default function WatchMovie() {
  const { id } = useParams();
  const videoRef = useRef(null);
  const [playback, setPlayback] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const startPlayback = async () => {
      try {
        const response = await api.get(`/movies/${id}/stream`);
        if (response.data.provider === 'terabox') {
          setPlayback({ ...response.data, provider: 'terabox-loading' });
          const playlistEndpoint = `/movies/${id}/terabox/playlist`;
          await api.get(playlistEndpoint, { responseType: 'text' });
          if (!cancelled) {
            setPlayback({
              ...response.data,
              provider: 'terabox-hls',
              playlistUrl: api.getUri({ url: playlistEndpoint })
            });
          }
        } else if (!cancelled) {
          setPlayback(response.data);
        }
      } catch (err) {
        if (!cancelled) {
          setPlayback((current) => current?.streamUrl ? { ...current, provider: 'terabox-unavailable' } : current);
          setError(err.response?.data?.message || 'Unable to start playback');
        }
      }
    };
    startPlayback();
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    if (playback?.provider !== 'terabox-hls') return undefined;
    let hls;
    let disposed = false;

    const attachPlayer = async () => {
      const { default: Hls } = await import('hls.js');
      if (disposed) return;
      if (!Hls.isSupported()) {
        setError('This browser does not support the TeraBox HLS stream.');
        return;
      }

      hls = new Hls({
        xhrSetup(xhr, url) {
          const requestUrl = new URL(url, window.location.href);
          const apiOrigin = new URL(api.getUri(), window.location.href).origin;
          const token = localStorage.getItem('token');
          if (requestUrl.origin === apiOrigin && token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          }
        }
      });
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) setError('The TeraBox stream could not be played. Check its access token and file permissions.');
      });
      hls.loadSource(playback.playlistUrl);
      hls.attachMedia(videoRef.current);
    };

    attachPlayer().catch(() => setError('Unable to initialize the TeraBox video player.'));
    return () => {
      disposed = true;
      hls?.destroy();
    };
  }, [playback?.provider, playback?.playlistUrl]);

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
        {playback?.provider === 'terabox-hls' && (
          <video ref={videoRef} controls autoPlay className="w-full h-full">
            Your browser does not support video playback.
          </video>
        )}
        {playback?.provider === 'terabox-unavailable' && (
            <div className="w-full h-full flex flex-col items-center justify-center gap-4 px-6 text-center">
              <p className="text-red-400 text-sm">{error}</p>
              {playback.streamUrl && <a href={playback.streamUrl} target="_blank" rel="noreferrer" className="text-gold hover:underline">Open video on TeraBox</a>}
            </div>
        )}
        {playback?.provider === 'terabox-loading' && !error && (
          <p className="text-muted text-sm">Preparing TeraBox stream…</p>
        )}
        {playback?.streamUrl && !['terabox-hls', 'terabox-loading', 'terabox-unavailable'].includes(playback.provider) && (
          <video controls autoPlay className="w-full h-full" src={playback.streamUrl}>
            Your browser does not support video playback.
          </video>
        )}
        {!playback && !error && <p className="text-muted text-sm">Preparing playback…</p>}
      </div>
    </div>
  );
}
