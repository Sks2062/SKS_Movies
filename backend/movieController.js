const Movie = require('./Movie');
const User = require('./User');

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
const streamMovie = async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ message: 'Movie not found' });
    if (!movie.allowStreaming) {
      return res.status(403).json({ message: 'Streaming is not enabled for this title' });
    }
    if (!['mixdrop', 'streamtape'].includes(movie.videoProvider)) {
      return res.status(410).json({ message: 'This movie uses a retired video provider. Re-import it through a supported host.' });
    }
    if (!movie.videoUrl) {
      return res.status(409).json({ message: `${movie.videoProvider === 'streamtape' ? 'Streamtape' : 'MixDrop'} is still importing this video. Ask an admin to refresh its status.` });
    }

    movie.views += 1;
    await movie.save();

    await User.findByIdAndUpdate(req.user._id, {
      $push: { watchHistory: { movie: movie._id, watchedAt: new Date() } }
    });

    res.json({ provider: movie.videoProvider, embedUrl: movie.videoUrl });
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

module.exports = {
  listMovies,
  getMovie,
  streamMovie,
  downloadMovie,
  toggleWatchlist
};
