const Movie = require('./Movie');
const User = require('./User');
const { queueRemoteUpload, getRemoteStatus, getFileInfo } = require('./mixdropClient');

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
  try {
    if (!isHttpsUrl(req.body.sourceUrl)) {
      return res.status(400).json({ message: 'Use an HTTPS direct-download URL for the video file.' });
    }

    const remoteUpload = await queueRemoteUpload(req.body.sourceUrl, req.body.title);
    if (!remoteUpload?.id) {
      return res.status(502).json({ message: 'MixDrop did not return an import ID.' });
    }
    const embedUrl = getMixDropEmbedUrl(remoteUpload.embedurl);
    const movie = await Movie.create({
      title: req.body.title,
      description: req.body.description,
      genre: req.body.genre,
      releaseYear: req.body.releaseYear,
      duration: req.body.duration,
      cast: req.body.cast,
      posterUrl: req.body.posterUrl,
      videoProvider: 'mixdrop',
      videoUrl: embedUrl,
      mixdropRemoteId: String(remoteUpload.id),
      mixdropFileRef: remoteUpload.fileref || '',
      mixdropStatus: remoteUpload.fileref ? 'processing' : 'queued',
      downloadUrl: req.body.downloadUrl || '',
      allowStreaming: req.body.allowStreaming,
      allowDownload: req.body.allowDownload,
      uploadedBy: req.user._id
    });
    res.status(201).json({ movie });
  } catch (err) {
    res.status(err.status || 500).json({ message: err.message });
  }
};

// @route POST /api/admin/movies/:id/mixdrop-status
const refreshMixDropStatus = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    if (!movie.mixdropRemoteId) return res.status(400).json({ message: 'This movie has no MixDrop import to check.' });

    const result = await getRemoteStatus(movie.mixdropRemoteId);
    movie.mixdropStatus = result.status || movie.mixdropStatus;
    if (result.fileref) movie.mixdropFileRef = result.fileref;
    if (!getMixDropEmbedUrl(movie.videoUrl) && movie.mixdropFileRef) {
      const fileInfo = await getFileInfo(movie.mixdropFileRef);
      movie.videoUrl = getMixDropEmbedUrl(result.embedurl || fileInfo?.embedurl);
    }
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
