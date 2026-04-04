'use strict';

// ── ELEMENTS ──────────────────────────────────────────────
const pads       = Array.from(document.querySelectorAll('.pad'));
const scoreEl    = document.getElementById('score');
const timerEl    = document.getElementById('timer');
const timerBar   = document.getElementById('timerBar');
const toastEl    = document.getElementById('toast');
const hudBest    = document.getElementById('hudBest');
const startBest  = document.getElementById('startBest');
const overScore  = document.getElementById('overScore');
const overBest   = document.getElementById('overBest');
const overFrog   = document.getElementById('overFrog');
const overTitle  = document.getElementById('overTitle');
const newBestEl  = document.getElementById('newBest');
const logoCanvas = document.getElementById('logoCanvas');
const startScreen = document.getElementById('startScreen');
const gameScreen  = document.getElementById('gameScreen');
const overScreen  = document.getElementById('overScreen');

document.getElementById('playBtn').addEventListener('click',    () => startGame());
document.getElementById('retryBtn').addEventListener('click',   () => startGame());
document.getElementById('newGameBtn').addEventListener('click', () => startGame());

// ── PERSISTENT BEST ───────────────────────────────────────
let bestScore = parseInt(localStorage.getItem('catchFrogBest') || '0');
startBest.innerHTML = `🏆 Best: <strong>${bestScore}</strong>`;
hudBest.textContent = bestScore;

// ── FIREFLIES ─────────────────────────────────────────────
(function() {
  const c = document.getElementById('fireflies');
  for (let i = 0; i < 22; i++) {
    const f = document.createElement('div');
    f.className = 'firefly';
    f.style.cssText = `left:${Math.random()*100}%;top:${Math.random()*100}%;
      --tx:${Math.random()*160-80}px;--ty:${-(Math.random()*160+20)}px;
      --dur:${3+Math.random()*5}s;--delay:-${Math.random()*6}s;`;
    c.appendChild(f);
  }
})();

// ── DRAW FROG ON CANVAS ───────────────────────────────────
function drawFrog(canvas, variant = 0, size) {
  const s = size || Math.min(canvas.width, canvas.height);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const cx = canvas.width  / 2;
  const cy = canvas.height / 2;
  const r  = s * 0.44;

  // Variant palettes
  const palettes = [
    { body: ['#78e878','#228b22'], belly: '#b5f0a0', iris: '#1a5e1a' },
    { body: ['#e8c878','#8b6522'], belly: '#f0e0a0', iris: '#5e3a1a' },
    { body: ['#78c8e8','#226a8b'], belly: '#a0d8f0', iris: '#1a3e5e' },
    { body: ['#e87878','#8b2222'], belly: '#f0a0a0', iris: '#5e1a1a' },
    { body: ['#c878e8','#6a228b'], belly: '#e0a0f0', iris: '#3e1a5e' },
    { body: ['#78e8c8','#228b6a'], belly: '#a0f0e0', iris: '#1a5e3e' },
  ];
  const p = palettes[variant % palettes.length];

  // Shadow
  ctx.fillStyle = 'rgba(0,40,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r*0.9, r*0.7, r*0.18, 0, 0, Math.PI*2);
  ctx.fill();

  // Hind legs
  ctx.fillStyle = p.body[1];
  ctx.beginPath(); ctx.ellipse(cx-r*0.72, cy+r*0.5, r*0.42, r*0.27, -0.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+r*0.72, cy+r*0.5, r*0.42, r*0.27,  0.5, 0, Math.PI*2); ctx.fill();

  // Body
  const bg = ctx.createRadialGradient(cx-r*0.2, cy-r*0.1, r*0.1, cx, cy, r);
  bg.addColorStop(0, p.body[0]);
  bg.addColorStop(1, p.body[1]);
  ctx.fillStyle = bg;
  ctx.beginPath(); ctx.ellipse(cx, cy+r*0.08, r*0.84, r*0.73, 0, 0, Math.PI*2); ctx.fill();

  // Belly
  ctx.fillStyle = p.belly;
  ctx.beginPath(); ctx.ellipse(cx, cy+r*0.22, r*0.48, r*0.46, 0, 0, Math.PI*2); ctx.fill();

  // Front feet
  ctx.fillStyle = p.body[1];
  ctx.beginPath(); ctx.ellipse(cx-r*0.76, cy+r*0.28, r*0.28, r*0.17, -0.3, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx+r*0.76, cy+r*0.28, r*0.28, r*0.17,  0.3, 0, Math.PI*2); ctx.fill();

  // Eye bumps
  ctx.fillStyle = p.body[1];
  ctx.beginPath(); ctx.arc(cx-r*0.37, cy-r*0.6, r*0.3,  0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.37, cy-r*0.6, r*0.3,  0, Math.PI*2); ctx.fill();

  // Eye whites
  ctx.fillStyle = '#e8ffe0';
  ctx.beginPath(); ctx.arc(cx-r*0.37, cy-r*0.63, r*0.26, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.37, cy-r*0.63, r*0.26, 0, Math.PI*2); ctx.fill();

  // Iris
  ctx.fillStyle = p.iris;
  ctx.beginPath(); ctx.arc(cx-r*0.35, cy-r*0.62, r*0.17, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.39, cy-r*0.62, r*0.17, 0, Math.PI*2); ctx.fill();

  // Pupil
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(cx-r*0.34, cy-r*0.61, r*0.095, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.40, cy-r*0.61, r*0.095, 0, Math.PI*2); ctx.fill();

  // Highlight
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(cx-r*0.3,  cy-r*0.66, r*0.05, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.44, cy-r*0.66, r*0.05, 0, Math.PI*2); ctx.fill();

  // Smile
  ctx.strokeStyle = p.iris;
  ctx.lineWidth = r*0.07; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(cx+r*0.05, cy+r*0.06, r*0.26, 0.25, Math.PI-0.25); ctx.stroke();

  // Nostrils
  ctx.fillStyle = p.iris;
  ctx.beginPath(); ctx.arc(cx-r*0.07, cy-r*0.1, r*0.052, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(cx+r*0.19, cy-r*0.1, r*0.052, 0, Math.PI*2); ctx.fill();
}

// Draw logo frog
drawFrog(logoCanvas, 0, 80);

// ── GAME STATE ────────────────────────────────────────────
let score, timeLeft, gameActive;
let activeFregs = [];   // { padIndex, canvas, timeoutId, variant }
let spawnTimeoutId = null;
let timerIntervalId = null;
let comboCount = 0;
let lastComboCount = 0;
const BASE_TIME = 60;
const FROG_APPEAR_BASE = 1100; // ms a frog stays

// ── START GAME ────────────────────────────────────────────
function startGame() {
  showScreen(gameScreen);

  score     = 0;
  timeLeft  = BASE_TIME;
  gameActive = true;
  comboCount = 0;
  lastComboCount = 0;
  activeFregs = [];

  scoreEl.textContent = '0';
  timerEl.textContent = BASE_TIME;
  timerBar.style.width = '100%';
  timerBar.className = 'timer-bar';
  toastEl.textContent = '';
  hudBest.textContent = bestScore;

  // Clear any leftover canvases
  pads.forEach(p => {
    const old = p.querySelector('.frog-canvas');
    if (old) old.remove();
    p.classList.remove('miss');
  });

  clearTimeout(spawnTimeoutId);
  clearInterval(timerIntervalId);

  scheduleSpawn();
  startTimer();
}

// ── SPAWN LOGIC ───────────────────────────────────────────
function getFrogAppearTime() {
  const levels = Math.floor(score / 50);
  return Math.max(380, FROG_APPEAR_BASE * Math.pow(0.88, levels));
}

function getFrogCount() {
  if (score < 50)  return 1;
  if (score < 120) return Math.random() < 0.4 ? 2 : 1;
  if (score < 220) return Math.random() < 0.6 ? 2 : 1;
  return Math.random() < 0.55 ? 2 : (Math.random() < 0.4 ? 3 : 1);
}

function scheduleSpawn() {
  if (!gameActive) return;
  const delay = getFrogAppearTime() * 0.35;
  spawnTimeoutId = setTimeout(spawnWave, delay);
}

function spawnWave() {
  if (!gameActive) return;

  const count = getFrogCount();
  const available = pads
    .map((_, i) => i)
    .filter(i => !activeFregs.some(f => f.padIndex === i));

  // Shuffle available
  for (let i = available.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }

  const toPlace = Math.min(count, available.length);
  for (let i = 0; i < toPlace; i++) {
    spawnFrogAt(available[i]);
  }

  scheduleSpawn();
}

function spawnFrogAt(padIndex) {
  const pad = pads[padIndex];
  const variant = Math.floor(Math.random() * 6);
  const appearTime = getFrogAppearTime();

  // Create canvas element
  const c = document.createElement('canvas');
  const padSize = pad.offsetWidth || 80;
  c.width  = padSize;
  c.height = padSize;
  c.className = 'frog-canvas hop-in';
  drawFrog(c, variant, padSize * 0.88);
  pad.appendChild(c);

  const entry = { padIndex, canvas: c, variant };

  // Auto-remove after appearTime (frog escapes)
  entry.timeoutId = setTimeout(() => {
    removeFrogEntry(entry, false);
  }, appearTime);

  activeFregs.push(entry);
}

function removeFrogEntry(entry, wasCaught) {
  // Clear auto-remove timeout
  clearTimeout(entry.timeoutId);

  // Remove from active list
  activeFregs = activeFregs.filter(f => f !== entry);

  const c = entry.canvas;
  if (!c.parentNode) return;

  c.classList.remove('hop-in');
  c.classList.add(wasCaught ? 'caught' : 'hop-out');
  setTimeout(() => c.remove(), 500);
}

// ── PAD CLICKS ────────────────────────────────────────────
pads.forEach(pad => {
  pad.addEventListener('click',    e => handlePadHit(pad));
  pad.addEventListener('touchend', e => { e.preventDefault(); handlePadHit(pad); }, { passive: false });
});

function handlePadHit(pad) {
  if (!gameActive) return;
  const index = parseInt(pad.getAttribute('data-index'));
  const entry = activeFregs.find(f => f.padIndex === index);

  if (entry) {
    // HIT
    score += 10;
    comboCount++;
    scoreEl.textContent = score;
    hudBest.textContent = Math.max(score, bestScore);

    removeFrogEntry(entry, true);
    spawnScorePop(pad, '+10', '#7ed957');
    spawnParticles(pad, '#7ed957');
    playSound('hit');

    if (comboCount >= 3 && comboCount !== lastComboCount) {
      lastComboCount = comboCount;
      showComboBanner(`${comboCount}x COMBO! 🔥`);
    }

    const remaining = activeFregs.length;
    setToast(remaining > 0 ? `+10! ${remaining} more!` : '+10! Nice!', '#7ed957');
  } else {
    // MISS
    score = Math.max(0, score - 5);
    comboCount = 0;
    lastComboCount = 0;
    scoreEl.textContent = score;

    pad.classList.add('miss');
    setTimeout(() => pad.classList.remove('miss'), 500);
    spawnScorePop(pad, '-5', '#e85535');
    playSound('miss');
    setToast('-5 Miss!', '#e85535');

    // Shake board
    const board = document.getElementById('board');
    board.classList.remove('shake');
    void board.offsetWidth;
    board.classList.add('shake');
  }
}

// ── TIMER ─────────────────────────────────────────────────
function startTimer() {
  timerIntervalId = setInterval(() => {
    if (!gameActive) return;
    timeLeft--;
    timerEl.textContent = timeLeft;
    const pct = timeLeft / BASE_TIME * 100;
    timerBar.style.width = pct + '%';
    timerBar.classList.toggle('warn',   pct <= 50 && pct > 25);
    timerBar.classList.toggle('danger', pct <= 25);
    if (timeLeft <= 0) endGame();
  }, 1000);
}

// ── END GAME ──────────────────────────────────────────────
function endGame() {
  gameActive = false;
  clearInterval(timerIntervalId);
  clearTimeout(spawnTimeoutId);

  // Remove all frogs
  [...activeFregs].forEach(f => removeFrogEntry(f, false));

  const isNewBest = score > bestScore;
  if (isNewBest) {
    bestScore = score;
    localStorage.setItem('catchFrogBest', bestScore);
  }

  overScore.textContent = score;
  overBest.textContent  = bestScore;
  startBest.innerHTML   = `🏆 Best: <strong>${bestScore}</strong>`;
  newBestEl.classList.toggle('hidden', !isNewBest);
  overFrog.textContent  = score >= 200 ? '🏆' : score >= 100 ? '🐸' : '😵';
  overTitle.textContent = score >= 200 ? 'LEGENDARY!' : score >= 100 ? 'WELL DONE!' : "TIME'S UP!";

  setTimeout(() => showScreen(overScreen), 400);
}

// ── SCORE POP ─────────────────────────────────────────────
function spawnScorePop(pad, text, color) {
  const rect = pad.getBoundingClientRect();
  const el   = document.createElement('div');
  el.className   = 'score-pop';
  el.textContent = text;
  el.style.cssText = `left:${rect.left + rect.width/2 - 20}px;top:${rect.top - 10}px;color:${color};`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

// ── PARTICLES ─────────────────────────────────────────────
function spawnParticles(pad, color) {
  const rect = pad.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;
  for (let i = 0; i < 10; i++) {
    const el  = document.createElement('div');
    el.className = 'particle';
    const angle = Math.PI * 2 * i / 10 + Math.random() * 0.4;
    const dist  = 30 + Math.random() * 50;
    const sz    = 5 + Math.random() * 6;
    el.style.cssText = `
      left:${cx}px;top:${cy}px;
      width:${sz}px;height:${sz}px;background:${color};
      --tx:${Math.cos(angle)*dist}px;--ty:${Math.sin(angle)*dist-25}px;
      --dur:${0.45 + Math.random()*0.35}s;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 850);
  }
}

// ── COMBO BANNER ──────────────────────────────────────────
function showComboBanner(text) {
  const el = document.createElement('div');
  el.className   = 'combo-banner';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1050);
}

// ── TOAST ─────────────────────────────────────────────────
let toastTimeout;
function setToast(text, color = '#f0fff4') {
  toastEl.textContent  = text;
  toastEl.style.color  = color;
  toastEl.style.opacity = '1';
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toastEl.style.opacity = '0'; }, 900);
}

// ── SOUND ─────────────────────────────────────────────────
function playSound(type) {
  const el = document.getElementById(type === 'hit' ? 'hitSound' : 'missSound');
  if (!el) return;
  el.currentTime = 0;
  el.play().catch(() => {});
}

// ── SCREEN HELPER ─────────────────────────────────────────
function showScreen(screen) {
  [startScreen, gameScreen, overScreen].forEach(s => s.classList.remove('active'));
  screen.classList.add('active');
}