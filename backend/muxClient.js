const Mux = require('@mux/mux-node');

const requiredApiSettings = ['MUX_TOKEN_ID', 'MUX_TOKEN_SECRET'];

const isMuxApiConfigured = () => requiredApiSettings.every((key) => process.env[key]);

const getMuxClient = () => {
  if (!isMuxApiConfigured()) {
    throw new Error('Mux is not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET.');
  }

  return new Mux({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
    webhookSecret: process.env.MUX_WEBHOOK_SECRET,
    jwtSigningKey: process.env.MUX_SIGNING_KEY,
    jwtPrivateKey: process.env.MUX_PRIVATE_KEY?.replace(/\\n/g, '\n')
  });
};

module.exports = { getMuxClient, isMuxApiConfigured };
