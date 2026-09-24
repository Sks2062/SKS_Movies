const adminOnly = (req, res, next) => {
  const allowedAdminEmail = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (req.user && req.user.role === 'admin' && req.user.email === allowedAdminEmail) {
    return next();
  }
  return res.status(403).json({ message: 'Admin access required' });
};

module.exports = { adminOnly };
