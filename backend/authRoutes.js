const express = require('express');
const { login, getMe } = require('./authController');
const { protect } = require('./auth');

const router = express.Router();

router.post('/login', login);
router.get('/me', protect, getMe);

module.exports = router;
