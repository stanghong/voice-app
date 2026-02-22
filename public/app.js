const recordBtn = document.getElementById('recordBtn');
const recordLabel = document.getElementById('recordLabel');
const timer = document.getElementById('timer');
const visualizer = document.getElementById('visualizer');
const transcriptionBox = document.getElementById('transcription');
const saveBtn = document.getElementById('saveBtn');
const saveAudioBtn = document.getElementById('saveAudioBtn');
const resetBtn = document.getElementById('resetBtn');
const savedNotesBox = document.getElementById('savedNotes');
const statusEl = document.getElementById('status');

let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let timerInterval = null;
let seconds = 0;
let currentTranscript = '';
let savedNotes = [];
let audioBlob = null;
let audioContext = null;
let analyser = null;
let animationId = null;

// Recording
recordBtn.addEventListener('click', async () => {
  if (!isRecording) {
    await startRecording();
  } else {
    stopRecording();
  }
});

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    // Set up audio visualization
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    drawVisualizer();

    // Set up MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4';
    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach(t => t.stop());
      cancelAnimationFrame(animationId);
      if (audioContext) {
        await audioContext.close();
        audioContext = null;
      }
      clearCanvas();

      // Create audio blob
      audioBlob = new Blob(audioChunks, { type: mimeType });
      setStatus('Recording saved. Click "Save Audio" to download, or "Transcribe" to convert to text.');
    };

    mediaRecorder.start(1000); // Collect data every second
    isRecording = true;
    recordBtn.classList.add('recording');
    recordLabel.textContent = 'Stop';
    startTimer();
    setStatus('Recording... (long recording supported)');

  } catch (err) {
    console.error('Error:', err);
    setStatus('Microphone access denied. Please allow in Settings.', true);
  }
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording = false;
  recordBtn.classList.remove('recording');
  recordLabel.textContent = 'Record';
  stopTimer();
  setStatus('Recording stopped. Save audio or transcribe.');
}

// Save Audio
saveAudioBtn.addEventListener('click', async () => {
  if (!audioBlob) {
    setStatus('No recording to save!', true);
    return;
  }

  const timestamp = new Date().toLocaleString().replace(/[:.]/g, '-');
  const filename = `voice-note-${timestamp}.webm`;

  // Try iOS Share Sheet first
  if (navigator.share) {
    try {
      const file = new File([audioBlob], filename, { type: audioBlob.type });
      await navigator.share({
        title: 'Voice Recording',
        files: [file]
      });
      setStatus('Audio saved!');
      return;
    } catch (e) {
      console.log('Share failed:', e);
    }
  }

  // Fallback: download
  const url = URL.createObjectURL(audioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  setStatus('Audio downloaded!');
});

// Transcribe
saveBtn.addEventListener('click', async () => {
  if (!audioBlob) {
    setStatus('No recording to transcribe!', true);
    return;
  }

  setStatus('Transcribing...', false, true);
  saveBtn.disabled = true;

  try {
    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');

    const res = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Transcription failed');

    currentTranscript = data.text;
    transcriptionBox.textContent = currentTranscript;
    setStatus('Transcription complete!');
  } catch (err) {
    console.error('Transcribe error:', err);
    setStatus('Transcription failed. Using Web Speech API instead...', true);

    // Fallback to Web Speech API
    await transcribeWithWebSpeech();
  } finally {
    saveBtn.disabled = false;
  }
});

async function transcribeWithWebSpeech() {
  return new Promise((resolve) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setStatus('Transcription not available.', true);
      resolve();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    let finalTranscript = '';

    recognition.onresult = (event) => {
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        }
      }
    };

    recognition.onend = () => {
      if (finalTranscript) {
        currentTranscript = finalTranscript;
        transcriptionBox.textContent = currentTranscript;
        setStatus('Transcription complete!');
      } else {
        setStatus('Could not transcribe audio.', true);
      }
      resolve();
    };

    recognition.onerror = (e) => {
      console.log('Speech error:', e);
      setStatus('Transcription failed.', true);
      resolve();
    };

    // Start recognition (will use microphone)
    try {
      recognition.start();
      setStatus('Transcribing with microphone...');
    } catch (e) {
      setStatus('Could not start transcription.', true);
      resolve();
    }
  });
}

// Save Notes
saveBtn.addEventListener('click', async () => {
  // This is now the Transcribe button
});

resetBtn.addEventListener('click', () => {
  currentTranscript = '';
  audioBlob = null;
  audioChunks = [];

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
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    timer.textContent = `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  } else {
    timer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
}

// Visualizer
function drawVisualizer() {
  const ctx = visualizer.getContext('2d');
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function draw() {
    animationId = requestAnimationFrame(draw);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = '#16213e';
    ctx.fillRect(0, 0, visualizer.width, visualizer.height);

    const barWidth = (visualizer.width / bufferLength) * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * visualizer.height;
      ctx.fillStyle = `hsl(${220 + i * 0.5}, 80%, ${50 + dataArray[i] / 5}%)`;
      ctx.fillRect(x, visualizer.height - barHeight, barWidth, barHeight);
      x += barWidth + 1;
    }
  }
  draw();
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
