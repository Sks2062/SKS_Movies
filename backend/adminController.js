const fs = require('fs/promises');
const Movie = require('./Movie');
const User = require('./User');
const {
  uploadVideoFile,
  remoteUploadVideo,
  getRemoteStatus,
  getFileInfo,
  listFolders: getMixDropFolders
} = require('./mixdropClient');

const isHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const getMixDropEmbedUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /^\/e\/[a-z0-9_-]+\/?$/i.test(url.pathname)
      ? url.href
      : '';
  } catch {
    return '';
  }
};

const isUserProvidedMixDropEmbed = (value) => {
  const embedUrl = getMixDropEmbedUrl(value);
  if (!embedUrl) return false;
  const hostname = new URL(embedUrl).hostname.toLowerCase().replace(/^www\./, '');
  return /^mixdrop\.[a-z]{2,}$/.test(hostname);
};

const toList = (value) => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return value.split(',').map((item) => item.trim()).filter(Boolean);
  }
};

const isVideoFile = (file) => {
  if (!file) return false;
  const videoExtensions = /\.(mp4|m4v|mkv|mov|avi|webm|mpeg|mpg|3gp)$/i;
  return file.mimetype?.startsWith('video/') || videoExtensions.test(file.originalname || '');
};

// @route GET /api/admin/movies
const listMovies = async (req, res) => {
  try {
    const movies = await Movie.find().sort({ createdAt: -1 });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/mixdrop/folders
const listMixDropFolders = async (req, res) => {
  try {
    const result = await getMixDropFolders();
    res.json((result?.folders || []).map(({ id, title }) => ({ id: String(id), title })));
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || 'Unable to load MixDrop folders.' });
  }
};

// @route POST /api/admin/movies
const addMovie = async (req, res) => {
  let tempFile;
  try {
    const importMode = req.body.importMode || 'file';
    const isRemoteImport = importMode === 'remote';
    const isExistingEmbed = importMode === 'embed';
    tempFile = req.file?.path;
    if (isRemoteImport && !isHttpsUrl(req.body.sourceUrl)) {
      return res.status(400).json({ message: 'Use a public HTTPS direct-download URL for MixDrop remote upload.' });
    }
    if (!isRemoteImport && !isVideoFile(req.file)) {
      if (!isExistingEmbed) return res.status(400).json({ message: 'Choose a supported video file to upload.' });
    }
    if (isExistingEmbed && !isUserProvidedMixDropEmbed(req.body.embedUrl)) {
      return res.status(400).json({ message: 'Paste a valid HTTPS MixDrop embed link, such as https://mixdrop.top/e/FILE_ID.' });
    }
    if (!req.body.title?.trim() || !req.body.description?.trim()) {
      return res.status(400).json({ message: 'Movie title and description are required.' });
    }
    const uploadedFile = isExistingEmbed
      ? { embedurl: req.body.embedUrl }
      : isRemoteImport
        ? await remoteUploadVideo(req.body.sourceUrl, req.body.title, req.body.folder)
        : await uploadVideoFile(req.file, req.body.folder);
    const embedUrl = isExistingEmbed
      ? getMixDropEmbedUrl(uploadedFile.embedurl)
      : getMixDropEmbedUrl(uploadedFile?.embedurl);
    if (isExistingEmbed ? !embedUrl : (isRemoteImport ? !uploadedFile?.id : (!uploadedFile?.fileref || !embedUrl))) {
      return res.status(502).json({ message: 'MixDrop did not return the expected upload reference.' });
    }

    const movie = await Movie.create({
      title: req.body.title,
      description: req.body.description,
      genre: toList(req.body.genre),
      releaseYear: Number(req.body.releaseYear),
      duration: req.body.duration ? Number(req.body.duration) : undefined,
      cast: toList(req.body.cast),
      posterUrl: req.body.posterUrl,
      videoProvider: 'mixdrop',
      videoUrl: embedUrl,
      mixdropRemoteId: isRemoteImport ? String(uploadedFile.id) : '',
      mixdropFileRef: !isExistingEmbed && uploadedFile.fileref ? String(uploadedFile.fileref) : '',
      mixdropStatus: isExistingEmbed ? 'Ready' : (isRemoteImport ? (uploadedFile.fileref ? 'Processing' : 'Queued') : 'Uploaded'),
      downloadUrl: req.body.downloadUrl || '',
      allowStreaming: req.body.allowStreaming !== 'false',
      allowDownload: req.body.allowDownload === 'true',
      uploadedBy: req.user._id
    });
    res.status(201).json({ movie });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  } finally {
    if (tempFile) await fs.rm(tempFile, { force: true }).catch(() => {});
  }
};

// @route POST /api/admin/movies/:id/mixdrop-status
const refreshMixDropStatus = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    let remoteInfo = null;
    if (movie.mixdropRemoteId) {
      remoteInfo = await getRemoteStatus(movie.mixdropRemoteId);
      if (remoteInfo?.fileref) movie.mixdropFileRef = remoteInfo.fileref;
    }
    const fileInfo = movie.mixdropFileRef ? await getFileInfo(movie.mixdropFileRef) : null;
    if (!remoteInfo && !fileInfo) return res.status(404).json({ message: 'MixDrop could not find this uploaded file.' });
    movie.mixdropStatus = fileInfo?.status || remoteInfo?.status || movie.mixdropStatus;
    movie.videoUrl = getMixDropEmbedUrl(fileInfo?.embedurl || remoteInfo?.embedurl) || movie.videoUrl;
    await movie.save();
    res.json({
      status: movie.mixdropStatus,
      ready: Boolean(movie.videoUrl),
      embedUrl: movie.videoUrl
    });
  } catch (err) {
    res.status(err.status || 502).json({ message: err.message || 'Unable to check MixDrop import status.' });
  }
};

// @route PUT /api/admin/movies/:id
const updateMovie = async (req, res) => {
  try {
    const updates = { ...req.body };
    delete updates.videoProvider;
    delete updates.videoUrl;
    const movie = await Movie.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true
    });
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route DELETE /api/admin/movies/:id
const deleteMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    await Movie.findByIdAndDelete(movie._id);
    res.json({ message: 'Movie deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/users
const listUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/admin/stats
const getStats = async (req, res) => {
  try {
    const [userCount, movieCount, totals] = await Promise.all([
      User.countDocuments(),
      Movie.countDocuments(),
      Movie.aggregate([
        { $group: { _id: null, totalViews: { $sum: '$views' }, totalDownloads: { $sum: '$downloads' } } }
      ])
    ]);

    res.json({
      userCount,
      movieCount,
      totalViews: totals[0]?.totalViews || 0,
      totalDownloads: totals[0]?.totalDownloads || 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listMovies, listMixDropFolders, addMovie, refreshMixDropStatus, updateMovie, deleteMovie, listUsers, getStats };
