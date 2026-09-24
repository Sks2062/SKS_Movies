const Movie = require('./Movie');
const User = require('./User');
const { getMuxClient } = require('./muxClient');

// @route GET /api/movies?search=&genre=
const listMovies = async (req, res) => {
  try {
    const { search, genre } = req.query;
    const query = {};

    if (search) query.$text = { $search: search };
    if (genre) query.genre = genre;

    const movies = await Movie.find(query).select('-videoUrl -downloadUrl').sort({ createdAt: -1 });
    res.json(movies);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/movies/:id
const getMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id).select('-videoUrl -downloadUrl');
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    res.json(movie);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/movies/:id/stream
// Verifies access, then would return a signed/temporary URL from
// your storage provider (e.g. S3 presigned URL) instead of a raw file path.
const streamMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    if (!movie.allowStreaming) {
      return res.status(403).json({ message: 'Streaming is not enabled for this title' });
    }
    if (movie.muxPlaybackId && movie.muxStatus !== 'ready') {
      return res.status(409).json({ message: 'This video is still processing' });
    }
    if (!movie.muxPlaybackId && !movie.videoUrl) {
      return res.status(409).json({ message: 'This video is not ready for streaming' });
    }

    let muxTokens;
    if (movie.muxPlaybackId) {
      if (!process.env.MUX_SIGNING_KEY || !process.env.MUX_PRIVATE_KEY) {
        return res.status(503).json({ message: 'Mux signed playback is not configured' });
      }
      const client = getMuxClient();
      muxTokens = await client.jwt.signPlaybackId(movie.muxPlaybackId, {
        type: ['playback', 'thumbnail', 'storyboard'],
        expiration: '2h'
      });
    }

    movie.views += 1;
    await movie.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { watchHistory: { movie: movie._id, watchedAt: new Date() } }
    });

    if (movie.muxPlaybackId) {
      return res.json({ playbackId: movie.muxPlaybackId, tokens: muxTokens, expiresInSeconds: 7200 });
    }

    // Keep previously added direct video URLs playable during migration.
    res.json({ streamUrl: movie.videoUrl, expiresInSeconds: 3600 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route GET /api/movies/:id/download
const downloadMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    if (!movie.allowDownload) {
      return res.status(403).json({ message: 'Downloads are not enabled for this title' });
    }
    if (!movie.downloadUrl) {
      return res.status(404).json({ message: 'No download link is configured for this title' });
    }

    movie.downloads += 1;
    await movie.save();

    // This may be a direct file URL or a provider share page such as TeraBox.
    res.json({ downloadUrl: movie.downloadUrl, expiresInSeconds: 900 });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @route POST /api/movies/:id/watchlist
const toggleWatchlist = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    const idx = user.watchlist.findIndex((m) => m.toString() === req.params.id);

    if (idx === -1) {
      user.watchlist.push(req.params.id);
    } else {
      user.watchlist.splice(idx, 1);
    }

    await user.save();
    res.json({ watchlist: user.watchlist });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { listMovies, getMovie, streamMovie, downloadMovie, toggleWatchlist };
