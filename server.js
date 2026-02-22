require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/transcribe - for future API-based transcription
app.post('/api/transcribe', async (req, res) => {
  // Placeholder for API-based transcription
  // For now, transcription is done via Web Speech API in the browser
  res.status(501).json({ error: 'Transcription API not configured. Use the browser\'s built-in transcription.' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
