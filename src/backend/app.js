const express = require('express');
const cors = require('cors');
const authRouter = require('./routes/auth');
const scootersRouter = require('./routes/scooters');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api', scootersRouter);

module.exports = app;
