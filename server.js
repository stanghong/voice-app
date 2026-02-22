require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/translate — translate text to Chinese via MyMemory (free)
app.post('/api/translate', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    const translation = await translateText(text);
    res.json({ translation });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

async function translateText(text) {
  // MyMemory API has a limit, so we translate in chunks
  const chunkSize = 450; // Leave room for encoding overhead
  const chunks = [];
  let remaining = text;

  while (remaining.length > chunkSize) {
    // Find the last sentence boundary within chunkSize
    let splitIdx = remaining.lastIndexOf('. ', chunkSize);
    if (splitIdx === -1) splitIdx = remaining.lastIndexOf(', ', chunkSize);
    if (splitIdx === -1) splitIdx = chunkSize;

    chunks.push(remaining.substring(0, splitIdx + 1));
    remaining = remaining.substring(splitIdx + 1).trim();
  }
  if (remaining) chunks.push(remaining);

  // Translate each chunk and combine
  const translatedChunks = [];
  for (const chunk of chunks) {
    const encodedText = encodeURIComponent(chunk);
    const url = `https://api.mymemory.translated.net/get?q=${encodedText}&langpair=en|zh-CN`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.responseStatus !== 200) {
      throw new Error(data.responseDetails || 'Translation failed');
    }
    translatedChunks.push(data.responseData.translatedText);
  }

  return translatedChunks.join(' ');
}

// GET /api/info — get date and weather
app.get('/api/info', async (req, res) => {
  try {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Get weather from wttr.in
    let weather = 'Weather unavailable';
    try {
      const wttrRes = await fetch('https://wttr.in/?format=j1');
      if (wttrRes.ok) {
        const wttrData = await wttrRes.json();
        const current = wttrData.current_condition[0];
        const area = wttrData.nearest_area[0];
        const location = area?.areaName?.[0]?.value || area?.region?.[0]?.value || 'Unknown';
        weather = `${location}: ${current.temp_F}°F, ${current.weatherDesc[0].value}`;
      }
    } catch (e) {
      console.log('Weather fetch error:', e.message);
    }

    res.json({ date: today, weather: weather });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
