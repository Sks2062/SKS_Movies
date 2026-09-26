const fs = require('fs/promises');
const Movie = require('./Movie');
const User = require('./User');
const { uploadVideoFile, getFileInfo } = require('./mixdropClient');

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

// @route POST /api/admin/movies
const addMovie = async (req, res) => {
  let tempFile;
  try {
    tempFile = req.file?.path;
    if (!isVideoFile(req.file)) {
      return res.status(400).json({ message: 'Choose a supported video file to upload.' });
    }
    if (!req.body.title?.trim() || !req.body.description?.trim()) {
      return res.status(400).json({ message: 'Movie title and description are required.' });
    }
    const uploadedFile = await uploadVideoFile(req.file);
    const embedUrl = getMixDropEmbedUrl(uploadedFile?.embedurl);
    if (!uploadedFile?.fileref || !embedUrl) {
      return res.status(502).json({ message: 'MixDrop uploaded the file but did not return a valid player link.' });
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
      mixdropFileRef: String(uploadedFile.fileref),
      mixdropStatus: 'Uploaded',
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
    if (!movie.mixdropFileRef) return res.status(400).json({ message: 'This movie has no MixDrop file reference to check.' });

    const fileInfo = await getFileInfo(movie.mixdropFileRef);
    if (!fileInfo) return res.status(404).json({ message: 'MixDrop could not find this uploaded file.' });
    movie.mixdropStatus = fileInfo.status || movie.mixdropStatus;
    movie.videoUrl = getMixDropEmbedUrl(fileInfo.embedurl) || movie.videoUrl;
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

module.exports = { listMovies, addMovie, refreshMixDropStatus, updateMovie, deleteMovie, listUsers, getStats };
