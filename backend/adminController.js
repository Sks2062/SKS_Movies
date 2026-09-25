const Movie = require('./Movie');
const User = require('./User');
const { getMuxClient } = require('./muxClient');

const isTeraBoxShareUrl = (value) => {
  try {
    const url = new URL(value);
    const hosts = new Set([
      'terabox.com', 'www.terabox.com', 'terabox.app', 'www.terabox.app',
      'dm.terabox.com',
      '1024terabox.com', 'www.1024terabox.com', 'freeterabox.com', 'www.freeterabox.com',
      'terasharelink.com', 'www.terasharelink.com'
    ]);
    return url.protocol === 'https:' && hosts.has(url.hostname.toLowerCase());
  } catch {
    return false;
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
  let movie;
  try {
    const videoProvider = req.body.videoProvider === 'terabox' ? 'terabox' : 'mux';
    const movieData = {
      title: req.body.title,
      description: req.body.description,
      genre: req.body.genre,
      releaseYear: req.body.releaseYear,
      duration: req.body.duration,
      cast: req.body.cast,
      posterUrl: req.body.posterUrl,
      videoProvider,
      videoUrl: videoProvider === 'terabox' ? req.body.videoUrl : '',
      downloadUrl: req.body.downloadUrl || '',
      allowStreaming: req.body.allowStreaming,
      allowDownload: req.body.allowDownload,
      muxStatus: videoProvider === 'terabox' ? 'ready' : 'pending_upload',
      uploadedBy: req.user._id
    };

    if (videoProvider === 'terabox') {
      if (!isTeraBoxShareUrl(req.body.videoUrl)) {
        return res.status(400).json({ message: 'Use an HTTPS TeraBox share URL' });
      }

      movie = await Movie.create(movieData);
      return res.status(201).json({ movie });
    }

    const mux = getMuxClient();
    movie = await Movie.create(movieData);
    const upload = await mux.video.uploads.create({
      cors_origin: req.get('origin') || process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || 'http://localhost:5173',
      timeout: 3600,
      new_asset_settings: {
        playback_policies: ['signed'],
        video_quality: 'basic',
        passthrough: movie._id.toString()
      }
    });

    movie.muxUploadId = upload.id;
    await movie.save();
    res.status(201).json({ movie, uploadUrl: upload.url });
  } catch (err) {
    if (movie && !movie.muxUploadId) await Movie.findByIdAndDelete(movie._id);
    if (err.message.includes('Mux is not configured')) {
      return res.status(503).json({ message: err.message });
    }
    res.status(500).json({ message: err.message });
  }
};

// @route PUT /api/admin/movies/:id
const updateMovie = async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.videoProvider === 'terabox' || updates.videoUrl) {
      if (!isTeraBoxShareUrl(updates.videoUrl)) {
        return res.status(400).json({ message: 'Use an HTTPS TeraBox share URL' });
      }
      updates.videoProvider = 'terabox';
    }
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
    if (movie.muxAssetId) {
      await getMuxClient().video.assets.delete(movie.muxAssetId);
    }
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

module.exports = { listMovies, addMovie, updateMovie, deleteMovie, listUsers, getStats };
