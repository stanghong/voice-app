# Voice Notes

A simple voice recording app for transcribing and saving notes.

## Features

- 🎙️ Voice recording with auto date, weather, and location
- 📝 Speech-to-text transcription (English)
- 🔄 2-second gap detection adds new lines automatically
- 💾 Save notes to iPhone Notes app or clipboard

## How to Use

1. **Start Recording** - Click the green button to start
2. **Speak** - Your voice is transcribed in real-time
3. **Save** - Click Save to share to Notes or copy to clipboard

## Setup

```bash
# Install dependencies
npm install

# Start server
npm start
```

Then open http://localhost:3000 in your browser.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- APIs: Web Speech API, wttr.in Weather, OpenStreetMap

## Note

No API keys required - uses free browser APIs and public services.
