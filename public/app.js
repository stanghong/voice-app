const recordBtn = document.getElementById('recordBtn');
const recordLabel = document.getElementById('recordLabel');
const timer = document.getElementById('timer');
const visualizer = document.getElementById('visualizer');
const transcriptionBox = document.getElementById('transcription');
const saveBtn = document.getElementById('saveBtn');
const resetBtn = document.getElementById('resetBtn');
const savedNotesBox = document.getElementById('savedNotes');
const statusEl = document.getElementById('status');

let recognition = null;
let isRecording = false;
let timerInterval = null;
let seconds = 0;
let currentTranscript = '';
let lastSpeechTime = null;
let savedNotes = [];

// Check browser support
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSupported = !!SpeechRecognition;

if (!isSupported) {
  setStatus('Speech recognition not supported. Use Safari or Chrome.', true);
  recordBtn.disabled = true;
}

// Initialize speech recognition
function initRecognition() {
  if (!SpeechRecognition) return;

  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    const now = Date.now();
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';

        // Check for gap > 2 seconds
        if (lastSpeechTime && (now - lastSpeechTime) > 2000 && currentTranscript) {
          currentTranscript += '\n';
        }
        lastSpeechTime = now;
      } else {
        interimTranscript += transcript;
      }
    }

    if (finalTranscript) {
      currentTranscript = currentTranscript ? currentTranscript + finalTranscript.trim() + ' ' : currentTranscript + finalTranscript.trim();
      transcriptionBox.textContent = currentTranscript;
    }

    if (interimTranscript) {
      transcriptionBox.textContent = currentTranscript + interimTranscript;
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setStatus('Microphone access denied. Please allow in Settings.', true);
      stopRecording();
      recordBtn.disabled = true;
    } else if (event.error !== 'no-speech') {
      setStatus(`Error: ${event.error}`, true);
    }
  };

  recognition.onend = () => {
    if (isRecording) {
      try {
        recognition.start();
      } catch (e) {
        console.log('Restart error:', e);
      }
    }
  };
}

// Recording
recordBtn.addEventListener('click', async () => {
  if (!isSupported) return;

  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

function startRecording() {
  if (!recognition) initRecognition();
  if (!recognition) return;

  if (!currentTranscript) {
    lastSpeechTime = Date.now();
  }

  try {
    recognition.start();
    isRecording = true;
    recordBtn.classList.add('recording');
    recordLabel.textContent = 'Stop';
    startTimer();
    startVisualizer();
    setStatus('Listening...');

    if (!currentTranscript || currentTranscript.trim() === '') {
      addAutoInfo();
    }
  } catch (err) {
    setStatus('Error: ' + err.message, true);
  }
}

function stopRecording() {
  if (recognition) {
    recognition.stop();
  }
  isRecording = false;
  recordBtn.classList.remove('recording');
  recordLabel.textContent = 'Start';
  stopTimer();
  stopVisualizer();

  if (currentTranscript) {
    setStatus('Recording complete.');
  }
}

async function addAutoInfo() {
  const infoParts = [];

  // Get date
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  infoParts.push(today);

  // Get weather (skip on iOS if fails)
  try {
    const weatherRes = await fetch('https://wttr.in/?format=j1');
    if (weatherRes.ok) {
      const weatherData = await weatherRes.json();
      const current = weatherData.current_condition[0];
      const area = weatherData.nearest_area[0];
      const location = area?.areaName?.[0]?.value || area?.region?.[0]?.value || 'Unknown';
      infoParts.push(`${location}: ${current.temp_F}°F, ${current.weatherDesc[0].value}`);
    }
  } catch (e) {
    console.log('Weather skipped:', e.message);
  }

  // Get location (skip on iOS if fails)
  if (navigator.geolocation) {
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
      });
      const { latitude, longitude } = position.coords;

      try {
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
        const geoData = await geoRes.json();
        if (geoData.address) {
          const city = geoData.address.city || geoData.address.town || geoData.address.village || '';
          const state = geoData.address.state || '';
          const country = geoData.address.country || '';
          infoParts.push([city, state, country].filter(Boolean).join(', '));
        }
      } catch {
        infoParts.push(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      }
    } catch (e) {
      console.log('Location skipped:', e.message);
    }
  }

  if (infoParts.length > 0) {
    currentTranscript = '[' + infoParts.join(']\n[') + ']\n\n';
    transcriptionBox.textContent = currentTranscript;
  }
}

// Save Notes
saveBtn.addEventListener('click', async () => {
  if (!currentTranscript) {
    setStatus('Nothing to save!', true);
    return;
  }

  const timestamp = new Date().toLocaleString();
  const noteContent = `Voice Notes - ${timestamp}\n${'='.repeat(30)}\n\n${currentTranscript}`;

  // Save to local display
  const note = {
    timestamp: timestamp,
    transcript: currentTranscript
  };

  savedNotes.unshift(note);
  renderSavedNotes();

  // Try iOS Share Sheet
  if (navigator.share) {
    try {
      await navigator.share({
        title: 'Voice Notes - ' + timestamp,
        text: noteContent
      });
      setStatus('Shared!');
      return;
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.log('Share failed:', e);
      }
    }
  }

  // Fallback: Copy to clipboard
  try {
    await navigator.clipboard.writeText(noteContent);
    setStatus('Copied! Paste in Notes app.');
  } catch (e) {
    setStatus('Notes saved locally.');
  }
});

function renderSavedNotes() {
  if (savedNotes.length === 0) {
    savedNotesBox.innerHTML = '<p class="placeholder">No saved notes yet...</p>';
    return;
  }

  savedNotesBox.innerHTML = savedNotes.map((note) => `
    <div class="note-item">
      <div class="timestamp">${note.timestamp}</div>
      <div class="note-content">${escapeHtml(note.transcript ? note.transcript.substring(0, 300) : '')}${note.transcript && note.transcript.length > 300 ? '...' : ''}</div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Reset
resetBtn.addEventListener('click', () => {
  currentTranscript = '';
  lastSpeechTime = null;

  transcriptionBox.innerHTML = '<p class="placeholder">Your transcribed text will appear here...</p>';
  stopTimer();
  timer.textContent = '00:00';
  seconds = 0;
  clearCanvas();
  setStatus('Cleared. Ready for new recording.');
});

// Timer
function startTimer() {
  seconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    seconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
}

function updateTimerDisplay() {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0');
  const s = String(seconds % 60).padStart(2, '0');
  timer.textContent = `${m}:${s}`;
}

// Visualizer
let visualizerInterval = null;

function startVisualizer() {
  const ctx = visualizer.getContext('2d');
  let phase = 0;

  function draw() {
    if (!isRecording) return;

    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, visualizer.width, visualizer.height);

    const barCount = 40;
    const barWidth = visualizer.width / barCount - 2;
    phase += 0.1;

    for (let i = 0; i < barCount; i++) {
      const height = (Math.sin(i * 0.3 + phase) + 1) * 0.5 * visualizer.height * 0.6 + 10;
      const hue = 200 + i * 3;
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.fillRect(i * (barWidth + 2), visualizer.height - height, barWidth, height);
    }

    visualizerInterval = requestAnimationFrame(draw);
  }
  draw();
}

function stopVisualizer() {
  if (visualizerInterval) {
    cancelAnimationFrame(visualizerInterval);
    visualizerInterval = null;
  }
  clearCanvas();
}

function clearCanvas() {
  const ctx = visualizer.getContext('2d');
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, visualizer.width, visualizer.height);
}

// Status
function setStatus(msg, isError = false, loading = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '') + (loading ? ' loading' : '');
}
