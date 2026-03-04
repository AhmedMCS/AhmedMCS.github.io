// ─── State ──────────────────────────────────────────────────────────────
const CIRC = 2 * Math.PI * 100; // 628.32
let state = loadState();
let timerInterval = null;
let remaining = 0;
let totalSeconds = 0;
let running = false;
let currentSession = 'focus'; // focus | short | long
let audioCtx = null;
let ambientPlaying = false;
let ambientOsc = null;
let ambientGain = null;
let greetingFirstRun = true;
let lastDigits = '25:00';

function defaultState() {
  return {
    sessionsInCycle: 0,
    todayDate: new Date().toISOString().slice(0,10),
    todayCount: 0,
    record: 0,
    tasks: [],   // [{text, done, id}]
    settings: { focus:25, short:5, long:15, sound:true, particles:true },
    theme: 'dark' // always dark
  };
}

function loadState() {
  try {
    const s = JSON.parse(localStorage.getItem('maya_pomo'));
    if (s) return { ...defaultState(), ...s };
  } catch(e) {}
  return defaultState();
}

function save() { localStorage.setItem('maya_pomo', JSON.stringify(state)); }

// ─── Quotes ─────────────────────────────────────────────────────────────
const focusQuotes = [
  "Do it for bean",
  "Computa activate focus mode",
  "Domain Expansion: Infinite Kind Bar's",
  "Do it for Bron",
  "I fw you twin, 'keep moving forward' - Eren",
  "Focus up or ur chopped",
  "Lock in... Soul sista (smirked typing this one)",
  "Warming up a salad is normal actually",
  "Distractions? Maya doesn't know her.",
  "'What the dog doin' - Plato"
];
const breakQuotes = [
  "Warm salad loading...",
  "This website was made without gluten",
  "Drink some water, ur a sweat",
  "You earned this break, have a kind bar!",
  "Bean is proud of you right now... I think",
  "italy? wheres the fricken ahuhh gabego...Spageti and meataball!",
];

function randomQuote() {
  const arr = currentSession === 'focus' ? focusQuotes : breakQuotes;
  const el = document.getElementById('quote');
  el.classList.add('fading');
  setTimeout(() => {
    el.textContent = arr[Math.floor(Math.random() * arr.length)];
    el.classList.remove('fading');
  }, 250);
}

// ─── Greeting ───────────────────────────────────────────────────────────
function updateGreeting() {
  const h = new Date().getHours();
  let g;
  if (h < 6) g = "Bruh go to sleep \u{1F319}";
  else if (h < 12) g = "Good morning, Maya! \u2600\uFE0F Let's goooo!";
  else if (h < 17) g = "Afternoon grind... tuff \u{1F4AA}";
  else if (h < 21) g = "Bro is so locked \u{1F525}";
  else g = "I'm in your walls, Maya! \u{1F440} lock in jit!";
  const el = document.getElementById('greeting');
  if (greetingFirstRun) {
    greetingFirstRun = false;
    el.textContent = '';
    el.classList.add('greeting-cursor');
    let i = 0;
    const typeInterval = setInterval(() => {
      el.textContent = g.slice(0, ++i);
      if (i >= g.length) {
        clearInterval(typeInterval);
        setTimeout(() => el.classList.remove('greeting-cursor'), 600);
      }
    }, 40);
  } else {
    el.textContent = g;
  }
}

// ─── Timer ──────────────────────────────────────────────────────────────
function getDuration() {
  const s = state.settings;
  if (currentSession === 'focus') return s.focus * 60;
  if (currentSession === 'short') return s.short * 60;
  return s.long * 60;
}

function formatTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, '0');
  const s = (sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function updateDisplay() {
  const timeStr = formatTime(remaining);
  const display = document.getElementById('timerDisplay');
  // Build digit spans, animate only changed digits
  let html = '';
  for (let i = 0; i < timeStr.length; i++) {
    const ch = timeStr[i];
    if (ch === ':') { html += ':'; continue; }
    const changed = lastDigits[i] !== ch;
    html += `<span class="digit${changed ? ' roll' : ''}">${ch}</span>`;
  }
  display.innerHTML = html;
  lastDigits = timeStr;
  // Remove roll class after animation
  display.querySelectorAll('.digit.roll').forEach(d => {
    d.addEventListener('animationend', () => d.classList.remove('roll'), { once: true });
  });
  const frac = 1 - remaining / totalSeconds;
  document.getElementById('progress').setAttribute('stroke-dashoffset', CIRC * (1 - frac));
  document.title = `${formatTime(remaining)} \u2014 Maya's Pomodoro`;
}

function switchSession(type) {
  if (running) toggleTimer();
  currentSession = type;
  document.querySelectorAll('.session-tabs button').forEach((b, i) => {
    b.classList.toggle('active', ['focus','short','long'][i] === type);
  });
  document.getElementById('timerLabel').textContent =
    type === 'focus' ? 'Focus Time' : type === 'short' ? 'Short Break' : 'Long Break';
  document.body.classList.toggle('break-mode', type !== 'focus');
  totalSeconds = getDuration();
  remaining = totalSeconds;
  updateDisplay();
  randomQuote();
}

function toggleTimer() {
  const progress = document.getElementById('progress');
  if (running) {
    clearInterval(timerInterval);
    running = false;
    document.getElementById('startBtn').innerHTML = '\u25B6 Start';
    progress.classList.remove('breathing');
  } else {
    if (remaining <= 0) {
      totalSeconds = getDuration();
      remaining = totalSeconds;
    }
    running = true;
    document.getElementById('startBtn').innerHTML = '\u23F8 Pause';
    progress.classList.add('breathing');
    timerInterval = setInterval(tick, 1000);
  }
}

function tick() {
  remaining--;
  updateDisplay();
  if (remaining <= 0) {
    clearInterval(timerInterval);
    running = false;
    document.getElementById('startBtn').innerHTML = '\u25B6 Start';
    onSessionComplete();
  }
}

function resetTimer() {
  if (running) { clearInterval(timerInterval); running = false; }
  document.getElementById('startBtn').innerHTML = '\u25B6 Start';
  document.getElementById('progress').classList.remove('breathing');
  totalSeconds = getDuration();
  remaining = totalSeconds;
  updateDisplay();
}

function onSessionComplete() {
  document.getElementById('progress').classList.remove('breathing');
  if (state.settings.sound) playNotification();
  sessionCelebration();
  if (currentSession === 'focus') {
    state.sessionsInCycle++;
    incrementToday();
    updateDots();
    updateStats();
    save();
    // auto-switch to break
    if (state.sessionsInCycle % 4 === 0) {
      switchSession('long');
    } else {
      switchSession('short');
    }
  } else {
    switchSession('focus');
  }
  randomQuote();
}

function incrementToday() {
  const today = new Date().toISOString().slice(0,10);
  if (state.todayDate !== today) {
    state.todayDate = today;
    state.todayCount = 0;
  }
  state.todayCount++;
  if (state.todayCount > state.record) {
    state.record = state.todayCount;
  }
}

function updateDots() {
  const dots = document.querySelectorAll('.session-dots .dot');
  const filled = state.sessionsInCycle % 4;
  dots.forEach((d, i) => d.classList.toggle('filled', i < (filled === 0 && state.sessionsInCycle > 0 ? 4 : filled)));
}

// ─── Audio ──────────────────────────────────────────────────────────────
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playNotification() {
  try {
    const ctx = getAudioCtx();
    // gentle chime: two ascending tones
    [0, .15, .3].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = [523.25, 659.25, 783.99][i]; // C5, E5, G5
      gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + .6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(ctx.currentTime + delay);
      osc.stop(ctx.currentTime + delay + .7);
    });
  } catch(e) {}
}

function toggleAmbient() {
  const btn = document.querySelector('.ambient-btn');
  if (ambientPlaying) {
    stopAmbient();
    btn.classList.remove('playing');
  } else {
    startAmbient();
    btn.classList.add('playing');
  }
  ambientPlaying = !ambientPlaying;
}

function startAmbient() {
  try {
    const ctx = getAudioCtx();
    // Warm ambient drone
    ambientGain = ctx.createGain();
    ambientGain.gain.value = 0.03;
    ambientGain.connect(ctx.destination);
    const freqs = [110, 165, 220, 330];
    ambientOsc = freqs.map(f => {
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      o.connect(ambientGain);
      o.start();
      return o;
    });
    // Subtle LFO
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.1;
    lfoGain.gain.value = 0.01;
    lfo.connect(lfoGain).connect(ambientGain.gain);
    lfo.start();
    ambientOsc.push(lfo);
  } catch(e) {}
}

function stopAmbient() {
  if (ambientOsc) { ambientOsc.forEach(o => { try{o.stop()}catch(e){} }); ambientOsc = null; }
  ambientGain = null;
}

// ─── Tasks ──────────────────────────────────────────────────────────────
function renderTasks() {
  const ul = document.getElementById('taskList');
  ul.innerHTML = '';
  state.tasks.forEach((t, i) => {
    const li = document.createElement('li');
    if (t.done) li.classList.add('done');
    li.innerHTML = `
      <div class="check" onclick="toggleTask(${i})">${t.done ? '\u2713' : ''}</div>
      <span class="text">${esc(t.text)}</span>
      <button class="del" onclick="deleteTask(${i})">\u00D7</button>`;
    ul.appendChild(li);
  });
  // Show current active task on timer
  const active = state.tasks.find(t => !t.done);
  const ct = document.getElementById('currentTask');
  if (active) {
    ct.querySelector('span').textContent = '\u{1F4CC} ' + active.text;
    ct.classList.add('show');
  } else {
    ct.classList.remove('show');
  }
}

function addTask() {
  const input = document.getElementById('taskInput');
  const text = input.value.trim();
  if (!text) return;
  state.tasks.push({ text, done: false, id: Date.now() });
  input.value = '';
  save();
  renderTasks();
}

function toggleTask(i) {
  const wasDone = state.tasks[i].done;
  state.tasks[i].done = !state.tasks[i].done;
  save();
  renderTasks();
  // Celebration when checking off (not unchecking)
  if (!wasDone) {
    const li = document.querySelectorAll('.task-list li')[i];
    if (li) {
      li.classList.add('just-done');
      const check = li.querySelector('.check');
      if (check) spawnMiniConfetti(check);
      if (state.settings.sound) playTinyClick();
      setTimeout(() => li.classList.remove('just-done'), 400);
    }
  }
}

function deleteTask(i) {
  state.tasks.splice(i, 1);
  save();
  renderTasks();
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

// ─── Stats ──────────────────────────────────────────────────────────────
function updateStats() {
  const today = new Date().toISOString().slice(0,10);
  if (state.todayDate !== today) {
    state.todayDate = today;
    state.todayCount = 0;
  }
  document.getElementById('statToday').textContent = state.todayCount;
  document.getElementById('statRecord').textContent = state.record;
}

// ─── Panels ─────────────────────────────────────────────────────────────
function showPanel(name) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  document.querySelectorAll('.nav button').forEach((b, i) => {
    b.classList.toggle('active', ['timer','tasks','stats','settings'][i] === name);
  });
  if (name === 'stats') updateStats();
}

// ─── Settings ───────────────────────────────────────────────────────────
function saveSetting() {
  state.settings.focus = Math.max(1, Math.min(90, +document.getElementById('setFocus').value || 25));
  state.settings.short = Math.max(1, Math.min(30, +document.getElementById('setShort').value || 5));
  state.settings.long = Math.max(1, Math.min(45, +document.getElementById('setLong').value || 15));
  state.settings.sound = document.getElementById('toggleSound').classList.contains('on');
  state.settings.particles = document.getElementById('toggleParticles').classList.contains('on');
  save();
  if (!running) { totalSeconds = getDuration(); remaining = totalSeconds; updateDisplay(); }
}

function loadSettings() {
  document.getElementById('setFocus').value = state.settings.focus;
  document.getElementById('setShort').value = state.settings.short;
  document.getElementById('setLong').value = state.settings.long;
  if (!state.settings.sound) document.getElementById('toggleSound').classList.remove('on');
  if (!state.settings.particles) document.getElementById('toggleParticles').classList.remove('on');
}


// ─── Particles ──────────────────────────────────────────────────────────
let particleRAF;
function initParticles() {
  cancelAnimationFrame(particleRAF);
  const canvas = document.querySelector('#particles canvas');
  const ctx = canvas.getContext('2d');
  if (!state.settings.particles) { ctx.clearRect(0,0,canvas.width,canvas.height); return; }

  let w, h;
  function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);

  const particles = Array.from({length:70}, () => ({
    x: Math.random() * w, y: Math.random() * h,
    r: Math.random() * 4 + 1.5,
    dx: (Math.random() - .5) * .3,
    dy: (Math.random() - .5) * .3,
    o: Math.random() * .5 + .2
  }));

  function draw() {
    ctx.clearRect(0, 0, w, h);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const isBreak = document.body.classList.contains('break-mode');
    const color = isBreak ? (isDark ? '244,114,182' : '236,72,153') : (isDark ? '192,132,252' : '168,85,247');
    particles.forEach(p => {
      p.x += p.dx; p.y += p.dy;
      if (p.x < 0) p.x = w; if (p.x > w) p.x = 0;
      if (p.y < 0) p.y = h; if (p.y > h) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${color},${p.o})`;
      ctx.fill();
    });
    particleRAF = requestAnimationFrame(draw);
  }
  draw();
}

// ─── Keyboard Shortcuts
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); toggleTimer(); }
  if (e.key === 'r' || e.key === 'R') resetTimer();
  if (e.key === '1') switchSession('focus');
  if (e.key === '2') switchSession('short');
  if (e.key === '3') switchSession('long');
});

// ─── Micro-Interactions ──────────────────────────────────────────────────

function playTinyClick() {
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 1200;
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.connect(gain).connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.07);
  } catch(e) {}
}

function spawnMiniConfetti(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const colors = ['#a855f7','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#06b6d4'];
  for (let i = 0; i < 8; i++) {
    const dot = document.createElement('div');
    dot.className = 'mini-confetti';
    dot.style.left = cx + 'px';
    dot.style.top = cy + 'px';
    dot.style.background = colors[i];
    document.body.appendChild(dot);
    const angle = (i / 8) * Math.PI * 2;
    const dist = 25 + Math.random() * 20;
    requestAnimationFrame(() => {
      dot.classList.add('fly');
      dot.style.left = (cx + Math.cos(angle) * dist) + 'px';
      dot.style.top = (cy + Math.sin(angle) * dist) + 'px';
    });
    setTimeout(() => dot.remove(), 550);
  }
}

function sessionCelebration() {
  const emojis = ['🎉','✨','💜','🔥','⭐','🌟','💪','🎊','💐','🥳','🏆','✅','🌸','💫','🫶','🩷','🧡','💛'];
  for (let i = 0; i < 18; i++) {
    const el = document.createElement('div');
    el.className = 'emoji-rain';
    el.textContent = emojis[i];
    el.style.left = (Math.random() * 90 + 5) + 'vw';
    el.style.animationDelay = (Math.random() * 0.8) + 's';
    el.style.animationDuration = (1.8 + Math.random() * 0.8) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3200);
  }
}

// ─── Valentine ──────────────────────────────────────────────────────────

function initValentine() {
  if (localStorage.getItem('maya_valentine_seen')) return;

  const overlay = document.getElementById('valentineOverlay');
  const askPhase = document.getElementById('valentineAsk');
  const celebratePhase = document.getElementById('valentineCelebrate');
  const yesBtn = document.getElementById('valentineYes');
  const noBtn = document.getElementById('valentineNo');
  const closeBtn = document.getElementById('valentineClose');
  const heartsContainer = document.getElementById('valentineHearts');

  // Spawn floating hearts
  function spawnFloatingHearts() {
    const hearts = ['💜','💖','💕','💗','💝','🩷','💘'];
    for (let i = 0; i < 12; i++) {
      const h = document.createElement('div');
      h.className = 'floating-heart';
      h.textContent = hearts[Math.floor(Math.random() * hearts.length)];
      h.style.left = (Math.random() * 90 + 5) + '%';
      h.style.animationDelay = (Math.random() * 3) + 's';
      h.style.animationDuration = (3 + Math.random() * 2) + 's';
      heartsContainer.appendChild(h);
    }
  }

  // Show overlay after 800ms
  setTimeout(() => {
    overlay.style.display = 'flex';
    requestAnimationFrame(() => overlay.classList.add('show'));
    spawnFloatingHearts();
  }, 800);

  // No button dodge
  const dodgeTexts = ["Bro...", "Really?", "Bean is watching 🐶", "Try again lol", "Wrong answer!", "Think carefully...", "Nah fr?", "U sure?? 🥺"];
  let dodgeCount = 0;

  function dodgeNo(e) {
    e.preventDefault();
    const card = document.getElementById('valentineCard');
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const randX = (Math.random() - 0.5) * (vw * 0.6);
    const randY = (Math.random() - 0.5) * (vh * 0.5);
    card.style.transform = `translate(${randX}px, ${randY}px)`;
    noBtn.textContent = dodgeTexts[dodgeCount % dodgeTexts.length];
    dodgeCount++;
    const scale = Math.min(1 + dodgeCount * 0.06, 1.4);
    yesBtn.style.transform = `scale(${scale})`;
  }

  noBtn.addEventListener('mouseenter', dodgeNo);
  noBtn.addEventListener('touchstart', dodgeNo, { passive: false });

  // Yes clicked
  yesBtn.addEventListener('click', () => {
    askPhase.classList.add('valentine-hidden');
    celebratePhase.classList.remove('valentine-hidden');
    // Heart confetti burst
    for (let i = 0; i < 25; i++) {
      const h = document.createElement('div');
      h.className = 'heart-confetti';
      h.textContent = ['💜','💖','💕','🩷','💗'][Math.floor(Math.random() * 5)];
      h.style.left = (40 + Math.random() * 20) + 'vw';
      h.style.top = (30 + Math.random() * 20) + 'vh';
      const angle = Math.random() * Math.PI * 2;
      const dist = 80 + Math.random() * 150;
      h.style.setProperty('--tx', Math.cos(angle) * dist + 'px');
      h.style.setProperty('--ty', Math.sin(angle) * dist + 'px');
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 900);
    }
    // Ascending chime
    if (state.settings.sound) {
      try {
        const ctx = getAudioCtx();
        [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = freq;
          const t = ctx.currentTime + i * 0.12;
          gain.gain.setValueAtTime(0.12, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          osc.connect(gain).connect(ctx.destination);
          osc.start(t);
          osc.stop(t + 0.6);
        });
      } catch(e) {}
    }
  });

  // Close button
  closeBtn.addEventListener('click', () => {
    localStorage.setItem('maya_valentine_seen', '1');
    overlay.classList.add('fade-out');
    setTimeout(() => {
      overlay.classList.remove('show', 'fade-out');
      overlay.style.display = 'none';
    }, 500);
  });
}

// ─── Init ───────────────────────────────────────────────────────────────
function init() {
  document.documentElement.setAttribute('data-theme', 'dark');
  loadSettings();
  totalSeconds = getDuration();
  remaining = totalSeconds;
  updateDisplay();
  updateGreeting();
  updateDots();
  randomQuote();
  renderTasks();
  updateStats();
  initParticles();
  initValentine();
  setInterval(updateGreeting, 60000);
  setInterval(randomQuote, 45000);
}

init();
