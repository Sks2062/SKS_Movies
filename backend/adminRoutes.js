const express = require('express');
const {
  addMovie,
  listMovies,
  updateMovie,
  deleteMovie,
  listUsers,
  getStats
} = require('./adminController');
const { protect } = require('./auth');
const { adminOnly } = require('./admin');

const router = express.Router();

router.use(protect, adminOnly);

router.get('/movies', listMovies);
router.post('/movies', addMovie);
router.put('/movies/:id', updateMovie);
router.delete('/movies/:id', deleteMovie);
router.get('/users', listUsers);
router.get('/stats', getStats);

module.exports = router;
