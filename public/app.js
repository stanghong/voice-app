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

// Initialize speech recognition
function initRecognition() {
  try {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Speech recognition not available on this device.', true);
      return null;
    }

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
      console.log('Speech error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('Please allow microphone in Settings > Safari > Microphone', true);
      } else if (event.error === 'no-speech') {
        // Ignore no-speech errors
      } else {
        setStatus('Error: ' + event.error, true);
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

    return recognition;
  } catch (e) {
    console.log('Init error:', e);
    setStatus('Speech recognition not available.', true);
    return null;
  }
}

// Try to init on load
recognition = initRecognition();

// Recording
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

function startRecording() {
  if (!recognition) {
    recognition = initRecognition();
  }

  if (!recognition) {
    setStatus('Speech recognition not available. Try Chrome or Safari.', true);
    return;
  }

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
      addAutoInfo().catch(e => console.log('Auto info error:', e));
    }
  } catch (err) {
    console.log('Start error:', err);
    setStatus('Error starting. Please try again.', true);
  }
}

function stopRecording() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      console.log('Stop error:', e);
    }
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
  try {
    const infoParts = [];

    // Get date
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    infoParts.push(today);

    // Get weather (fire and forget)
    fetch('https://wttr.in/?format=j1')
      .then(res => res.json())
      .then(data => {
        if (data && data.current_condition && data.nearest_area) {
          const current = data.current_condition[0];
          const area = data.nearest_area[0];
          const location = area?.areaName?.[0]?.value || area?.region?.[0]?.value || 'Unknown';
          const weather = `${location}: ${current.temp_F}°F, ${current.weatherDesc[0].value}`;

          if (currentTranscript.startsWith('[')) {
            // Insert weather before the blank line
            const lines = currentTranscript.split('\n\n');
            if (lines.length > 0) {
              lines.splice(1, 0, weather);
              currentTranscript = lines.join('\n\n');
              transcriptionBox.textContent = currentTranscript;
            }
          }
        }
      })
      .catch(e => console.log('Weather skipped:', e.message));

    // Get location (fire and forget)
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`)
            .then(res => res.json())
            .then(data => {
              if (data && data.address) {
                const city = data.address.city || data.address.town || data.address.village || '';
                const state = data.address.state || '';
                const country = data.address.country || '';
                const locationStr = [city, state, country].filter(Boolean).join(', ');

                if (currentTranscript.startsWith('[')) {
                  const lines = currentTranscript.split('\n\n');
                  if (lines.length > 0) {
                    lines.splice(1, 0, locationStr);
                    currentTranscript = lines.join('\n\n');
                    transcriptionBox.textContent = currentTranscript;
                  }
                }
              }
            })
            .catch(e => console.log('Geocode skipped:', e.message));
        },
        (err) => console.log('Location skipped:', err.message),
        { timeout: 5000 }
      );
    }

    currentTranscript = '[Recording started]\n\n';
    transcriptionBox.textContent = currentTranscript;
  } catch (e) {
    console.log('Auto info error:', e);
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
    setStatus('Notes saved.');
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
  setStatus('Ready.');
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
function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '');
}
