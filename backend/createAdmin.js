require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./User');

async function createOrUpdateAdmin() {
  const name = (process.env.ADMIN_NAME || '').trim();
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD || '';

  if (!name || !email || password.length < 12) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL, and an ADMIN_PASSWORD of at least 12 characters.');
  }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI must be set.');

  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email }) || new User({ email });
  user.name = name;
  user.email = email;
  user.password = password;
  user.role = 'admin';
  await user.save();
  console.log(`Admin account is ready for ${email}.`);
}

createOrUpdateAdmin()
  .catch((error) => {
    console.error(`Admin setup failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
