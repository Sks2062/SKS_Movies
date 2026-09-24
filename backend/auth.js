const jwt = require('jsonwebtoken');
const User = require('./User');

const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
    const allowedAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
    if (!req.user || req.user.role !== 'admin' || req.user.email !== allowedAdminEmail) {
      return res.status(401).json({ message: 'Not authorized for this account' });
    }
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token invalid' });
  }
};

module.exports = { protect };
