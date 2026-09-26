import { useEffect, useState } from 'react';
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
  sourceMode: 'file',
  sourceUrl: '',
  embedUrl: '',
  downloadUrl: '',
  folder: '',
  allowStreaming: true,
  allowDownload: false
};

export default function AddMovie() {
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [folders, setFolders] = useState([]);
  const [folderError, setFolderError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    api.get('/admin/mixdrop/folders')
      .then(({ data }) => {
        setFolders(data);
        const movieFolder = data.find((folder) => folder.title.toLowerCase() === 'movie');
        if (movieFolder) setForm((current) => ({ ...current, folder: current.folder || movieFolder.id }));
      })
      .catch(() => setFolderError('Could not load MixDrop folders; uploads will use the default folder.'));
  }, []);

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((current) => ({ ...current, [field]: value }));
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const movieData = {
        title: form.title,
        description: form.description,
        genre: form.genre.split(',').map((item) => item.trim()).filter(Boolean),
        releaseYear: Number(form.releaseYear),
        duration: form.duration ? Number(form.duration) : undefined,
        cast: form.cast.split(',').map((item) => item.trim()).filter(Boolean),
        posterUrl: form.posterUrl,
        downloadUrl: form.downloadUrl,
        allowStreaming: form.allowStreaming,
        allowDownload: form.allowDownload,
        folder: form.folder,
        importMode: form.sourceMode
      };
      if (form.sourceMode === 'remote') {
        await api.post('/admin/movies', { ...movieData, sourceUrl: form.sourceUrl });
      } else if (form.sourceMode === 'embed') {
        await api.post('/admin/movies', { ...movieData, embedUrl: form.embedUrl });
      } else {
        const payload = new FormData();
        payload.append('file', videoFile);
        Object.entries(movieData).forEach(([key, value]) => {
          payload.append(key, Array.isArray(value) ? JSON.stringify(value) : String(value ?? ''));
        });
        await api.post('/admin/movies', payload);
      }
      navigate('/admin/movies');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send this video to MixDrop.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <h1 className="font-display text-3xl">Add a movie</h1>
      <p className="text-muted text-sm mt-2">Upload a file, import a direct URL, or add an existing MixDrop player link.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-4">
        <Field label="Video source">
          <select value={form.sourceMode} onChange={update('sourceMode')} className={inputClass}>
            <option value="file">Upload a video file</option>
            <option value="remote">Import from a direct URL</option>
            <option value="embed">Use an existing MixDrop embed link</option>
          </select>
        </Field>

        {form.sourceMode === 'file' ? (
          <Field label="Video file (maximum 5 GB)">
            <input
              type="file"
              required
              accept="video/*,.mkv,.avi,.mov,.webm,.mpeg,.mpg,.3gp"
              onChange={(event) => setVideoFile(event.target.files?.[0] || null)}
              className={inputClass}
            />
          </Field>
        ) : form.sourceMode === 'remote' ? (
          <Field label="Public direct-download URL">
            <input
              type="url"
              required
              value={form.sourceUrl}
              onChange={update('sourceUrl')}
              className={inputClass}
              placeholder="https://files.example.com/video.mp4"
            />
          </Field>
        ) : (
          <Field label="MixDrop embed link">
            <input
              type="url"
              required
              value={form.embedUrl}
              onChange={update('embedUrl')}
              className={inputClass}
              placeholder="https://mixdrop.top/e/FILE_ID"
            />
          </Field>
        )}

        {form.sourceMode !== 'embed' && <Field label="MixDrop destination folder">
          <select value={form.folder} onChange={update('folder')} className={inputClass}>
            <option value="">Default folder</option>
            {folders.map((folder) => <option key={folder.id} value={folder.id}>{folder.title}</option>)}
          </select>
        </Field>}
        {folderError && form.sourceMode !== 'embed' && <p className="text-xs text-muted">{folderError}</p>}

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

        <button type="submit" disabled={saving || (form.sourceMode === 'file' && !videoFile)} className="bg-gold text-bg rounded-md px-6 py-2.5 text-sm font-medium hover:bg-goldDeep transition-colors disabled:opacity-60">
          {saving
            ? form.sourceMode === 'file' ? 'Uploading to MixDrop…' : form.sourceMode === 'remote' ? 'Queueing MixDrop import…' : 'Saving movie…'
            : form.sourceMode === 'remote' ? 'Import video and save movie' : form.sourceMode === 'embed' ? 'Save movie with embed link' : 'Upload video and save movie'}
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
