import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

const emptyForm = {
  title: '',
  description: '',
  genre: '',
  releaseYear: new Date().getFullYear(),
  duration: '',
  cast: '',
  posterUrl: '',
  downloadUrl: '',
  allowStreaming: true,
  allowDownload: false
};

export default function AddMovie() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const navigate = useNavigate();

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append('file', videoFile);
      payload.append('title', form.title);
      payload.append('description', form.description);
      payload.append('genre', JSON.stringify(form.genre.split(',').map((item) => item.trim()).filter(Boolean)));
      payload.append('releaseYear', String(form.releaseYear));
      payload.append('duration', form.duration ? String(form.duration) : '');
      payload.append('cast', JSON.stringify(form.cast.split(',').map((item) => item.trim()).filter(Boolean)));
      payload.append('posterUrl', form.posterUrl);
      payload.append('downloadUrl', form.downloadUrl);
      payload.append('allowStreaming', String(form.allowStreaming));
      payload.append('allowDownload', String(form.allowDownload));
      await api.post('/admin/movies', payload);
      navigate('/admin/movies');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to upload this video to MixDrop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl">Add a movie</h1>
      <p className="text-muted text-sm mt-2">Choose a video file to upload directly to MixDrop.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Video file (maximum 5 GB)">
          <input
            type="file"
            required
            accept="video/*,.mkv,.avi,.mov,.webm,.mpeg,.mpg,.3gp"
            onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
            className={inputClass}
          />
        </Field>

        <Field label="Title">
          <input required value={form.title} onChange={update('title')} className={inputClass} />
        </Field>

        <Field label="Description">
          <textarea required rows={4} value={form.description} onChange={update('description')} className={inputClass} />
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
          <input type="url" value={form.downloadUrl} onChange={update('downloadUrl')} className={inputClass} placeholder="https://..." />
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

        <button type="submit" disabled={saving || !videoFile} className="bg-gold text-bg rounded-md px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors disabled:opacity-60">
          {saving ? 'Uploading to MixDrop…' : 'Upload video and save movie'}
        </button>
      </form>
    </div>
  );
}

const inputClass = 'w-full bg-elevated border border-line rounded-md px-4 py-2.5 text-sm outline-none focus:border-gold';

function Field({ label, children }) {
  return (
    <div>
      <label className="text-sm text-muted block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
