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
  sourceUrl: '',
  downloadUrl: '',
  allowStreaming: true,
  allowDownload: false
};

export default function AddMovie() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
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
      await api.post('/admin/movies', {
        ...form,
        genre: form.genre.split(',').map((item) => item.trim()).filter(Boolean),
        cast: form.cast.split(',').map((item) => item.trim()).filter(Boolean),
        releaseYear: Number(form.releaseYear),
        duration: form.duration ? Number(form.duration) : undefined
      });
      navigate('/admin/movies');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to queue this video on MixDrop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl">Add a movie</h1>
      <p className="text-muted text-sm mt-2">MixDrop will import the video from a public, direct-download URL.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Direct video download URL">
          <input
            type="url"
            required
            value={form.sourceUrl}
            onChange={update('sourceUrl')}
            className={inputClass}
            placeholder="https://files.example.com/movie.mp4"
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

        <button type="submit" disabled={saving} className="bg-gold text-bg rounded-md px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors disabled:opacity-60">
          {saving ? 'Sending to MixDrop…' : 'Import video and save movie'}
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
