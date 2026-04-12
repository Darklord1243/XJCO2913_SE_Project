const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const bookingsRouter = require('./routes/bookings');
const scootersRouter = require('./routes/scooters');

function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api', scootersRouter);
  app.use('/api', bookingsRouter);

  return app;
}

module.exports = {
  createApp,
};
