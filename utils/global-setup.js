const path = require('path');
const fs = require('fs');

const REQUIRED_VARS = ['TEST_USER_EMAIL', 'TEST_USER_PASSWORD'];

module.exports = async function globalSetup() {
  const envPath = path.resolve(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) {
    throw new Error(
      `Missing .env file at ${envPath}\n` +
      `Copy .env.example → .env and fill in your credentials:\n` +
      `  cp .env.example .env`
    );
  }

  const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Make sure your .env file defines them (see .env.example).`
    );
  }
};
