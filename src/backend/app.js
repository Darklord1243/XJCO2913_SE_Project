const express = require('express');
const scootersRouter = require('./routes/scooters');

const app = express();

app.use(express.json());
app.use('/api', scootersRouter);

module.exports = app;
