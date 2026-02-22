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

// Recording
recordBtn.addEventListener('click', () => {
  if (!isRecording) {
    startRecording();
  } else {
    stopRecording();
  }
});

function startRecording() {
  // Check for iOS Safari
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus('Speech recognition not supported on this device/browser.', true);
    return;
  }

  // Create fresh instance
  try {
    recognition = new SpeechRecognition();
  } catch (e) {
    setStatus('Cannot create speech recognition. Check browser settings.', true);
    return;
  }

  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  // iOS specific settings
  if (isIOS) {
    recognition.continuous = true;
  }

  recognition.onresult = (event) => {
    const now = Date.now();
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + ' ';
        if (lastSpeechTime && (now - lastSpeechTime) > 2000 && currentTranscript) {
          currentTranscript += '\n';
        }
        lastSpeechTime = now;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      currentTranscript += finalTranscript.trim() + ' ';
      transcriptionBox.textContent = currentTranscript;
    }
    if (interimTranscript) {
      transcriptionBox.textContent = currentTranscript + interimTranscript;
    }
  };

  recognition.onerror = (event) => {
    console.log('Speech error:', event.error);
    if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      setStatus('Microphone not allowed. Go to Settings > Safari > Speech Recognition > Allow', true);
    } else if (event.error === 'network') {
      setStatus('Network error. Speech recognition requires internet.', true);
    } else if (event.error !== 'no-speech') {
      setStatus('Error: ' + event.error, true);
    }
  };

  recognition.onend = () => {
    // On iOS, if still should be recording, restart
    if (isRecording && recognition) {
      setTimeout(() => {
        if (isRecording && recognition) {
          try {
            recognition.start();
          } catch (e) {
            console.log('Restart failed:', e);
          }
        }
      }, 100);
    }
  };

  // Start recognition
  try {
    recognition.start();
    isRecording = true;
    recordBtn.classList.add('recording');
    recordLabel.textContent = 'Stop';
    startTimer();
    startVisualizer();
    setStatus('Listening...');

    if (!currentTranscript) {
      currentTranscript = '[' + new Date().toLocaleString() + ']\n\n';
      transcriptionBox.textContent = currentTranscript;
    }
  } catch (err) {
    console.log('Start failed:', err);
    isRecording = false;
    if (err.message && err.message.includes('already started')) {
      // Already started, try to stop first
      try { recognition.stop(); } catch(e) {}
      setTimeout(() => {
        try {
          recognition.start();
          isRecording = true;
          recordBtn.classList.add('recording');
          recordLabel.textContent = 'Stop';
          startTimer();
          startVisualizer();
          setStatus('Listening...');
        } catch(e2) {
          setStatus('Please refresh and try again.', true);
        }
      }, 500);
    } else {
      setStatus('Cannot start. Check microphone permissions.', true);
    }
  }
}

function stopRecording() {
  isRecording = false;
  recordBtn.classList.remove('recording');
  recordLabel.textContent = 'Start';
  stopTimer();
  stopVisualizer();

  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
    recognition = null;
  }

  if (currentTranscript) {
    setStatus('Recording complete.');
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

  savedNotes.unshift({ timestamp, transcript: currentTranscript });
  renderSavedNotes();

  if (navigator.share) {
    try {
      await navigator.share({ title: 'Voice Notes - ' + timestamp, text: noteContent });
      setStatus('Shared!');
      return;
    } catch (e) {}
  }

  try {
    await navigator.clipboard.writeText(noteContent);
    setStatus('Copied to clipboard!');
  } catch (e) {
    setStatus('Saved.');
  }
});

function renderSavedNotes() {
  if (!savedNotes.length) {
    savedNotesBox.innerHTML = '<p class="placeholder">No saved notes yet...</p>';
    return;
  }
  savedNotesBox.innerHTML = savedNotes.map(n => `
    <div class="note-item">
      <div class="timestamp">${n.timestamp}</div>
      <div class="note-content">${escapeHtml(n.transcript.substring(0, 300))}${n.transcript.length > 300 ? '...' : ''}</div>
    </div>
  `).join('');
}

function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

// Reset
resetBtn.addEventListener('click', () => {
  currentTranscript = '';
  transcriptionBox.innerHTML = '<p class="placeholder">Your transcribed text will appear here...</p>';
  stopTimer();
  timer.textContent = '00:00';
  clearCanvas();
  setStatus('Ready.');
});

// Timer
function startTimer() {
  seconds = 0;
  updateTimerDisplay();
  timerInterval = setInterval(() => { seconds++; updateTimerDisplay(); }, 1000);
}
function stopTimer() { clearInterval(timerInterval); }
function updateTimerDisplay() {
  timer.textContent = String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
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
    const barCount = 40, barWidth = visualizer.width / barCount - 2;
    phase += 0.1;
    for (let i = 0; i < barCount; i++) {
      const height = (Math.sin(i * 0.3 + phase) + 1) * 0.5 * visualizer.height * 0.6 + 10;
      ctx.fillStyle = `hsl(${200 + i * 3}, 70%, 55%)`;
      ctx.fillRect(i * (barWidth + 2), visualizer.height - height, barWidth, height);
    }
    visualizerInterval = requestAnimationFrame(draw);
  }
  draw();
}
function stopVisualizer() {
  if (visualizerInterval) { cancelAnimationFrame(visualizerInterval); visualizerInterval = null; }
  clearCanvas();
}
function clearCanvas() {
  const ctx = visualizer.getContext('2d');
  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, visualizer.width, visualizer.height);
}

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '');
}
