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
recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    await startRecording();
  } else {
    stopRecording();
  }
});

async function startRecording() {
  // Create new recognition instance each time (fixes iOS issue)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    setStatus('Speech recognition not supported on this browser.', true);
    return;
  }

  try {
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
        currentTranscript = currentTranscript + finalTranscript.trim() + ' ';
        transcriptionBox.textContent = currentTranscript;
      }

      if (interimTranscript) {
        transcriptionBox.textContent = currentTranscript + interimTranscript;
      }
    };

    recognition.onerror = (event) => {
      console.log('Speech error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setStatus('Please allow microphone in iPhone Settings > Safari > Speech Recognition', true);
      } else if (event.error === 'no-speech') {
        // Ignore
      } else {
        setStatus('Error: ' + event.error, true);
      }
    };

    recognition.onend = () => {
      // Don't auto-restart on iOS - causes issues
    };

    await new Promise((resolve, reject) => {
      recognition.onstart = resolve;
      recognition.onerror = reject;
      recognition.start();
    });

    isRecording = true;
    recordBtn.classList.add('recording');
    recordLabel.textContent = 'Stop';
    startTimer();
    startVisualizer();
    setStatus('Listening...');

    if (!currentTranscript) {
      currentTranscript = '[Started]\n\n';
      transcriptionBox.textContent = currentTranscript;
    }

  } catch (err) {
    console.log('Start error:', err);
    if (err.message.includes('service not allowed') || err.message.includes('not-allowed')) {
      setStatus('Please allow microphone in iPhone Settings > Safari > Speech Recognition', true);
    } else {
      setStatus('Error starting. Try refreshing the page.', true);
    }
  }
}

function stopRecording() {
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {
      console.log('Stop error:', e);
    }
    recognition = null;
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

  try {
    await navigator.clipboard.writeText(noteContent);
    setStatus('Copied! Paste in Notes.');
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

function setStatus(msg, isError = false) {
  statusEl.textContent = msg;
  statusEl.className = 'status' + (isError ? ' error' : '');
}
