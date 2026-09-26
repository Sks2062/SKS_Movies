const express = require('express');
const os = require('os');
const multer = require('multer');
const {
  addMovie,
  listMovies,
  listMixDropFolders,
  refreshMixDropStatus,
  updateMovie,
  deleteMovie,
  listUsers,
  getStats
} = require('./adminController');
const { protect } = require('./auth');
const { adminOnly } = require('./admin');

const router = express.Router();
const maxUploadBytes = Number(process.env.MIXDROP_MAX_UPLOAD_BYTES) || 5 * 1024 ** 3;
const uploadMovieFile = multer({
  dest: os.tmpdir(),
  limits: { fileSize: maxUploadBytes }
}).single('file');

const handleUpload = (req, res, next) => {
  uploadMovieFile(req, res, (error) => {
    if (!error) return next();
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    res.status(tooLarge ? 413 : 400).json({
      message: tooLarge
        ? `The video exceeds the upload limit of ${Math.floor(maxUploadBytes / 1024 ** 3)} GB.`
        : 'Could not read the uploaded video file.'
    });
  });
};

router.use(protect, adminOnly);

router.get('/movies', listMovies);
router.get('/mixdrop/folders', listMixDropFolders);
router.post('/movies', handleUpload, addMovie);
router.post('/movies/:id/mixdrop-status', refreshMixDropStatus);
router.put('/movies/:id', updateMovie);
router.delete('/movies/:id', deleteMovie);
router.get('/users', listUsers);
router.get('/stats', getStats);

module.exports = router;
