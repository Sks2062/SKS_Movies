const express = require('express');
const {
  listMovies,
  getMovie,
  streamMovie,
  downloadMovie,
  toggleWatchlist
} = require('./movieController');
const { protect } = require('./auth');

const router = express.Router();

router.get('/', listMovies);
router.get('/:id', getMovie);
router.get('/:id/stream', protect, streamMovie);
router.get('/:id/download', protect, downloadMovie);
router.post('/:id/watchlist', protect, toggleWatchlist);

module.exports = router;
