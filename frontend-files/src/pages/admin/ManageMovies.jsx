import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';

export default function ManageMovies() {
  const [movies, setMovies] = useState([]);

  const load = () => api.get('/admin/movies').then((res) => setMovies(res.data));

  useEffect(() => {
    load();
    const refresh = setInterval(load, 15000);
    return () => clearInterval(refresh);
  }, []);

  const remove = async (id) => {
    if (!confirm('Delete this movie?')) return;
    await api.delete(`/admin/movies/${id}`);
    load();
  };

  const toggleFlag = async (movie, field) => {
    await api.put(`/admin/movies/${movie._id}`, { [field]: !movie[field] });
    load();
  };

  const saveDownloadUrl = async (movie, downloadUrl) => {
    await api.put(`/admin/movies/${movie._id}`, { downloadUrl });
    load();
  };

  const saveVideoLinks = async (movie, links) => {
    await api.put(`/admin/movies/${movie._id}`, links);
    load();
  };

  const refreshMixDropStatus = async (movie) => {
    try {
      await api.post(`/admin/movies/${movie._id}/mixdrop-status`);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not refresh MixDrop status.');
    }
  };

  const refreshStreamtapeStatus = async (movie) => {
    try {
      await api.post(`/admin/movies/${movie._id}/streamtape-status`);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not refresh Streamtape status.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-14">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">Manage movies</h1>
        <Link
          to="/admin/movies/new"
          className="bg-gold text-bg rounded-full px-5 py-2 text-sm font-medium hover:bg-goldDeep transition-colors"
        >
          + Add movie
        </Link>
      </div>

      <div className="mt-8 divide-y divide-line border-t border-b border-line">
        {movies.map((movie) => (
          <div key={movie._id} className="flex flex-col gap-3 py-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-lg">{movie.title}</p>
              <p className="text-muted text-sm">
                {movie.releaseYear} · {movie.views} views · {movie.downloads} downloads
              </p>
              <p className="mt-1 text-xs text-gold">
                {movie.videoProvider === 'streamtape'
                  ? `Streamtape ${movie.videoUrl ? 'player ready' : 'import'} · ${movie.streamtapeStatus || 'processing'}`
                  : movie.videoProvider === 'dailymotion'
                    ? 'Dailymotion player ready'
                    : `MixDrop ${movie.videoUrl ? 'embed created' : 'import'} · ${movie.mixdropStatus || 'queued'}`}
              </p>
              <VideoLinksEditor movie={movie} onSave={saveVideoLinks} />
            </div>

            <div className="flex flex-wrap items-center gap-4 text-sm">
              <label className="flex items-center gap-1.5 text-muted">
                <input
                  type="checkbox"
                  checked={movie.allowStreaming}
                  onChange={() => toggleFlag(movie, 'allowStreaming')}
                />
                Stream
              </label>
              <label className="flex items-center gap-1.5 text-muted">
                <input
                  type="checkbox"
                  checked={movie.allowDownload}
                  onChange={() => toggleFlag(movie, 'allowDownload')}
                />
                Download
              </label>
              <DownloadUrlEditor movie={movie} onSave={saveDownloadUrl} />
              {movie.mixdropFileRef && (
                <button onClick={() => refreshMixDropStatus(movie)} className="text-gold hover:underline">
                  Refresh MixDrop status
                </button>
              )}
              {movie.videoProvider === 'streamtape' && movie.streamtapeRemoteId && (
                <button onClick={() => refreshStreamtapeStatus(movie)} className="text-gold hover:underline">
                  Refresh Streamtape status
                </button>
              )}
              <button onClick={() => remove(movie._id)} className="text-red-400 hover:underline">
                Delete
              </button>
            </div>
          </div>
        ))}

        {movies.length === 0 && <p className="text-muted py-6">No movies yet.</p>}
      </div>
    </div>
  );
}

function DownloadUrlEditor({ movie, onSave }) {
  const [url, setUrl] = useState(movie.downloadUrl || '');

  useEffect(() => setUrl(movie.downloadUrl || ''), [movie.downloadUrl]);

  return (
    <form
      className="flex w-full gap-2 md:w-auto"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(movie, url);
      }}
    >
      <input
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="Download link"
        aria-label={`Download link for ${movie.title}`}
        className="min-w-0 flex-1 rounded-md border border-line bg-elevated px-3 py-1.5 text-xs md:w-52"
      />
      <button type="submit" className="text-gold hover:underline">Save link</button>
    </form>
  );
}

function VideoLinksEditor({ movie, onSave }) {
  const [dailymotionUrl, setDailymotionUrl] = useState(movie.videoProvider === 'dailymotion' ? movie.videoUrl : '');
  const [streamtapeDownloadUrl, setStreamtapeDownloadUrl] = useState(movie.streamtapeFileId ? `https://streamtape.com/v/${movie.streamtapeFileId}` : '');

  useEffect(() => {
    setDailymotionUrl(movie.videoProvider === 'dailymotion' ? movie.videoUrl : '');
    setStreamtapeDownloadUrl(movie.streamtapeFileId ? `https://streamtape.com/v/${movie.streamtapeFileId}` : '');
  }, [movie.videoProvider, movie.videoUrl, movie.streamtapeFileId]);

  return (
    <form
      className="grid w-full gap-2 md:max-w-xl md:grid-cols-[1fr_1fr_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        const links = { streamtapeDownloadUrl };
        if (dailymotionUrl.trim()) links.dailymotionUrl = dailymotionUrl;
        onSave(movie, links);
      }}
    >
      <input
        type="url"
        value={dailymotionUrl}
        onChange={(event) => setDailymotionUrl(event.target.value)}
        placeholder="Dailymotion URL to switch playback"
        aria-label={`Dailymotion playback URL for ${movie.title}`}
        className="min-w-0 rounded-md border border-line bg-elevated px-3 py-1.5 text-xs"
      />
      <input
        type="url"
        value={streamtapeDownloadUrl}
        onChange={(event) => setStreamtapeDownloadUrl(event.target.value)}
        placeholder="Streamtape download link"
        aria-label={`Streamtape download link for ${movie.title}`}
        className="min-w-0 rounded-md border border-line bg-elevated px-3 py-1.5 text-xs"
      />
      <button type="submit" className="text-gold hover:underline">Save video links</button>
    </form>
  );
}
