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

  const saveVideoUrl = async (movie, videoUrl) => {
    await api.put(`/admin/movies/${movie._id}`, { videoUrl, videoProvider: 'terabox' });
    load();
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
              {movie.muxStatus && movie.muxStatus !== 'ready' && (
                <p className="mt-1 text-xs text-gold">
                  {movie.muxStatus === 'pending_upload' ? 'Waiting for video upload' :
                    movie.muxStatus === 'processing' ? 'Mux is processing video' : 'Mux video processing failed'}
                </p>
              )}
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
              {movie.videoProvider === 'terabox' && <TeraBoxUrlEditor movie={movie} onSave={saveVideoUrl} />}
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

function TeraBoxUrlEditor({ movie, onSave }) {
  const [url, setUrl] = useState(movie.videoUrl || '');

  useEffect(() => setUrl(movie.videoUrl || ''), [movie.videoUrl]);

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
        required
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="TeraBox video link"
        aria-label={`TeraBox video link for ${movie.title}`}
        className="min-w-0 flex-1 rounded-md border border-line bg-elevated px-3 py-1.5 text-xs md:w-52"
      />
      <button type="submit" className="text-gold hover:underline">Save video</button>
    </form>
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
