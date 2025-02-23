const serverless = require('serverless-http');
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Sample Route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Netlify Serverless Function!' });
});

// Export as a Serverless Function
module.exports.handler = serverless(app);
