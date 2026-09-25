import { lazy, Suspense, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const MuxUploader = lazy(() => import('@mux/mux-uploader-react'));

const emptyForm = {
  title: '',
  description: '',
  genre: '',
  releaseYear: new Date().getFullYear(),
  duration: '',
  cast: '',
  posterUrl: '',
  videoProvider: 'mux',
  videoUrl: '',
  downloadUrl: '',
  allowStreaming: true,
  allowDownload: false
};

export default function AddMovie() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [uploadEndpoint, setUploadEndpoint] = useState('');
  const [uploadComplete, setUploadComplete] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  const update = (field) => (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await api.post('/admin/movies', {
        ...form,
        genre: form.genre.split(',').map((g) => g.trim()).filter(Boolean),
        cast: form.cast.split(',').map((c) => c.trim()).filter(Boolean),
        releaseYear: Number(form.releaseYear),
        duration: form.duration ? Number(form.duration) : undefined
      });
      if (res.data.uploadUrl) setUploadEndpoint(res.data.uploadUrl);
      else navigate('/admin/movies');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl">Add a movie</h1>
      <p className="text-muted text-sm mt-2">Add the movie details, then choose where its video is hosted.</p>

      {!uploadEndpoint ? <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Video source">
          <select value={form.videoProvider} onChange={update('videoProvider')} className={inputClass}>
            <option value="mux">Upload video to Mux</option>
            <option value="terabox">TeraBox share link</option>
          </select>
        </Field>

        {form.videoProvider === 'terabox' && (
          <Field label="TeraBox video or share URL">
            <input
              type="url"
              required
              value={form.videoUrl}
              onChange={update('videoUrl')}
              className={inputClass}
              placeholder="https://www.terabox.com/s/..."
            />
          </Field>
        )}

        <Field label="Title">
          <input required value={form.title} onChange={update('title')} className={inputClass} />
        </Field>

        <Field label="Description">
          <textarea
            required
            rows={4}
            value={form.description}
            onChange={update('description')}
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Genre (comma separated)">
            <input value={form.genre} onChange={update('genre')} className={inputClass} placeholder="Action, Drama" />
          </Field>
          <Field label="Release year">
            <input type="number" required value={form.releaseYear} onChange={update('releaseYear')} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Duration (minutes)">
            <input type="number" value={form.duration} onChange={update('duration')} className={inputClass} />
          </Field>
          <Field label="Cast (comma separated)">
            <input value={form.cast} onChange={update('cast')} className={inputClass} />
          </Field>
        </div>

        <Field label="Poster URL (optional)">
          <input value={form.posterUrl} onChange={update('posterUrl')} className={inputClass} placeholder="Leave blank if you don't have one" />
        </Field>

        <Field label="Download URL (optional)">
          <input
            type="url"
            value={form.downloadUrl}
            onChange={update('downloadUrl')}
            className={inputClass}
            placeholder="https://..."
          />
        </Field>

        <div className="flex gap-6 pt-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allowStreaming} onChange={update('allowStreaming')} />
            Allow streaming
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.allowDownload} onChange={update('allowDownload')} />
            Allow download
          </label>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="bg-gold text-bg rounded-md px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors"
        >
          {saving ? 'Saving…' : form.videoProvider === 'terabox' ? 'Save movie' : 'Save details and continue'}
        </button>
      </form> : (
        <div className="mt-8 space-y-5">
          <div>
            <h2 className="font-display text-xl">Upload video to Mux</h2>
            <p className="text-muted text-sm mt-1">The video uploads directly to Mux. It may take a few minutes to process before streaming is ready.</p>
          </div>
          <Suspense fallback={<p className="text-muted text-sm">Loading video uploader…</p>}>
            <MuxUploader
              endpoint={uploadEndpoint}
              onSuccess={() => setUploadComplete(true)}
              onUploadError={() => setError('The upload failed. Use the retry option or return to manage movies.')}
            />
          </Suspense>
          {error && <p className="text-sm text-red-400">{error}</p>}
          {uploadComplete && (
            <div className="space-y-3">
              <p className="text-sm text-muted">Upload complete. Mux is processing the video; its status will update in Manage movies.</p>
              <button
                type="button"
                onClick={() => navigate('/admin/movies')}
                className="bg-gold text-bg rounded-md px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors"
              >
                Go to manage movies
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const inputClass =
  'w-full bg-elevated border border-line rounded-md px-4 py-2.5 text-sm outline-none focus:border-gold';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm text-muted block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
