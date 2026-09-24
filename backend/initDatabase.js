require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./User');
const Movie = require('./Movie');

async function initializeDatabase() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required.');

  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User.init(), Movie.init()]);

  console.log(`MongoDB initialized: ${mongoose.connection.name}`);
  console.log('Collections ready: users, movies');
}

initializeDatabase()
  .catch((error) => {
    console.error(`Database initialization failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
