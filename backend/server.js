require('dotenv').config();
const express = require('express');
const path = require('path');
const connectDB = require('./db');

const authRoutes = require('./authRoutes');
const movieRoutes = require('./movieRoutes');
const adminRoutes = require('./adminRoutes');

connectDB();

const app = express();

app.use(express.json());

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/auth', authRoutes);
app.use('/api/movies', movieRoutes);
app.use('/api/admin', adminRoutes);

const clientBuild = path.resolve(__dirname, '../frontend-files/dist');
app.use(express.static(clientBuild));
app.get('*', (req, res, next) => {
  if (req.path === '/api' || req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(clientBuild, 'index.html'), (err) => {
    if (err) next(err);
  });
});

// Fallback error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
