require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// POST /api/translate — translate with word-by-word only
app.post('/api/translate', async (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'No text provided' });
  }

  try {
    // Get word-by-word translation
    const wordByWord = await translateWordByWord(text);

    res.json({
      wordByWord: wordByWord
    });
  } catch (err) {
    console.error('Translation error:', err);
    res.status(500).json({ error: err.message || 'Translation failed' });
  }
});

async function translateWordByWord(text) {
  // Split text into words
  const words = text.split(/\s+/);
  const translated = [];

  // Translate each word (batch for efficiency)
  const batchSize = 20;
  for (let i = 0; i < words.length; i += batchSize) {
    const batch = words.slice(i, i + batchSize);
    const batchText = batch.join(' ');

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=zh&dt=t&q=${encodeURIComponent(batchText)}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data && data[0]) {
      data[0].forEach(item => {
        if (item[0]) translated.push(item[0]);
      });
    }
  }

  return translated.join(' ');
}

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
