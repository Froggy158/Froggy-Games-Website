'use strict';
// ═══════════════════════════════════════════
//  FROG MEMORY  –  script.js
//  4 lily pads with emojis. Watch the frog
//  hop on them in sequence, then repeat it!
// ═══════════════════════════════════════════

// ── DOM ───────────────────────────────────
const roundEl    = document.getElementById('round-el');
const bestEl     = document.getElementById('best-el');
const statusText = document.getElementById('status-text');
const frogEmoji  = document.getElementById('frog-emoji');
const frogMsg    = document.getElementById('frog-msg');
const dotsEl     = document.getElementById('progress-dots');
const overlay    = document.getElementById('overlay');
const ovEmoji    = document.getElementById('ov-emoji');
const ovTitle    = document.getElementById('ov-title');
const ovSub      = document.getElementById('ov-sub');
const resultBx   = document.getElementById('result-box');
const resRound   = document.getElementById('res-round');
const resBest    = document.getElementById('res-best');
const playBtn    = document.getElementById('play-btn');

const pads = [0,1,2,3].map(i => document.getElementById(`pad-${i}`));

// ── Pad config ────────────────────────────
// Each pad has an emoji and a colour theme
const PAD_CONFIG = [
  { emoji: '🍄', label: 'Mushroom' },
  { emoji: '⭐', label: 'Star'     },
  { emoji: '🌸', label: 'Flower'   },
  { emoji: '🦋', label: 'Butterfly'},
];

// Initialise emoji labels on pads
PAD_CONFIG.forEach((cfg, i) => {
  document.getElementById(`emoji-${i}`).textContent = cfg.emoji;
});

// ── Constants ─────────────────────────────
const SHOW_SPEED_BASE  = 700;   // ms each step is shown at start
const SHOW_SPEED_MIN   = 280;   // fastest it gets
const SHOW_LIT_MS      = 520;   // how long a pad stays lit per step
const PAUSE_BETWEEN    = 200;   // gap between lit steps
const CORRECT_LIT_MS   = 300;   // brief flash on correct tap
const WRONG_LIT_MS     = 500;   // red flash on wrong tap

// Frog reaction messages
const CORRECT_MSGS = ['Nice!', 'Ribbit!', 'Yes!', '🎉', 'Hoppin\'!', 'Croaksome!'];
const WRONG_MSGS   = ['Oops!', 'Splat!', 'Ribbit?', 'Wrong pad!'];
const ROUND_MSGS   = ['Watch closely...', 'Pay attention!', 'Here we go!', 'Remember this!', 'Getting tricky...'];

// ── Game state ────────────────────────────
let sequence    = [];    // the full sequence so far
let playerPos   = 0;    // how far through the sequence the player has input
let round       = 0;
let best        = parseInt(localStorage.getItem('frogMemoryBest') || '0');
let gameState   = 'idle';  // 'idle' | 'showing' | 'player' | 'dead'
let isAnimating = false;

bestEl.textContent = best;

// ── Helpers ───────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setStatus(text, color = '#b7e4c7') {
  statusText.textContent = text;
  statusText.style.color = color;
}

function setFrog(emoji, msg = '', hop = false, wobble = false) {
  frogEmoji.textContent = emoji;
  frogMsg.textContent   = msg;
  frogEmoji.classList.toggle('hop',    hop);
  frogEmoji.classList.toggle('wobble', wobble);
}

function getRoundSpeed() {
  // Gets faster each round
  return Math.max(SHOW_SPEED_MIN, SHOW_SPEED_BASE - (round - 1) * 30);
}

// ── Progress dots ─────────────────────────
function buildDots() {
  dotsEl.innerHTML = '';
  for (let i = 0; i < sequence.length; i++) {
    const dot = document.createElement('div');
    dot.className = 'dot';
    if (i < playerPos)  dot.classList.add('done');
    if (i === playerPos && gameState === 'player') dot.classList.add('active');
    dotsEl.appendChild(dot);
  }
}

// ── Light up a pad ────────────────────────
async function lightPad(index, durationMs, className) {
  const pad = pads[index];
  const cls = className || `lit-${index}`;
  pad.classList.add(cls);
  const emojiEl = document.getElementById(`emoji-${index}`);
  emojiEl.style.transform = 'scale(1.15)';
  await sleep(durationMs);
  pad.classList.remove(cls);
  emojiEl.style.transform = '';
}

// ── Show the sequence ─────────────────────
async function showSequence() {
  gameState   = 'showing';
  isAnimating = true;

  // Disable all pads
  pads.forEach(p => p.classList.add('disabled'));
  setStatus(ROUND_MSGS[Math.min(round - 1, ROUND_MSGS.length - 1)], '#ffd166');
  setFrog('🐸', 'Watch!', false, false);
  buildDots();

  await sleep(600);

  const stepMs = getRoundSpeed();

  for (let i = 0; i < sequence.length; i++) {
    const idx = sequence[i];
    setFrog('🐸', PAD_CONFIG[idx].emoji, true, false);
    await lightPad(idx, SHOW_LIT_MS);
    setFrog('🐸', '', false, false);
    await sleep(PAUSE_BETWEEN);
  }

  // Hand off to player
  gameState   = 'player';
  isAnimating = false;
  playerPos   = 0;
  pads.forEach(p => p.classList.remove('disabled'));
  setStatus('Your turn! Repeat the sequence.', '#74c69d');
  setFrog('🐸', 'Go!', false, false);
  buildDots();
}

// ── Player taps a pad ─────────────────────
async function onPadTap(index) {
  if (gameState !== 'player' || isAnimating) return;

  isAnimating = true;
  pads.forEach(p => p.classList.add('disabled'));

  const expected = sequence[playerPos];

  if (index === expected) {
    // ── Correct ──
    await lightPad(index, CORRECT_LIT_MS);
    const msg = CORRECT_MSGS[Math.floor(Math.random() * CORRECT_MSGS.length)];
    setFrog('🐸', msg, true, false);
    playerPos++;
    buildDots();

    await sleep(120);

    if (playerPos === sequence.length) {
      // Completed the round!
      await sleep(300);
      setFrog('🎉', 'Perfect!', false, false);
      setStatus('Ribbit! You got it! 🎉', '#ffd166');
      await sleep(800);
      await nextRound();
    } else {
      // More to go
      pads.forEach(p => p.classList.remove('disabled'));
      isAnimating = false;
      setStatus(`${playerPos} / ${sequence.length} — keep going!`, '#74c69d');
    }

  } else {
    // ── Wrong ──
    await lightPad(index, WRONG_LIT_MS, 'wrong');
    // Also flash the correct one so player sees what they should have pressed
    lightPad(expected, WRONG_LIT_MS);

    setFrog('😵', WRONG_MSGS[Math.floor(Math.random() * WRONG_MSGS.length)], false, true);
    setStatus('Wrong pad! Game over.', '#ef4444');
    await sleep(900);
    die();
  }
}

// ── Advance to next round ─────────────────
async function nextRound() {
  round++;
  roundEl.textContent = round;

  // Add one new random step to the sequence
  sequence.push(Math.floor(Math.random() * 4));
  playerPos = 0;

  await showSequence();
}

// ── Game over ─────────────────────────────
function die() {
  gameState = 'dead';
  const achieved = round - 1; // rounds completed

  if (achieved > best) {
    best = achieved;
    localStorage.setItem('frogMemoryBest', best);
    bestEl.textContent = best;
  }

  ovEmoji.textContent  = achieved >= 8 ? '🏆' : achieved >= 4 ? '🎖️' : '💀';
  ovTitle.textContent  = achieved >= 8 ? 'Memory Master!' : achieved >= 4 ? 'Nice Memory!' : 'Forgot!';
  ovSub.textContent    = `You remembered ${achieved} round${achieved !== 1 ? 's' : ''}!`;
  resRound.textContent = '🐸 ' + achieved + ' round' + (achieved !== 1 ? 's' : '') + ' completed';
  resBest.textContent  = 'Best: ' + best + ' rounds';
  resultBx.style.display = 'flex';
  playBtn.textContent  = '🐸 Play Again!';
  overlay.style.display = 'flex';
}

// ── Start game ────────────────────────────
async function startGame() {
  overlay.style.display = 'none';
  resultBx.style.display = 'none';
  sequence  = [];
  playerPos = 0;
  round     = 0;
  isAnimating = false;
  setFrog('🐸', '', false, false);
  setStatus('Get ready!', '#b7e4c7');
  dotsEl.innerHTML = '';
  pads.forEach(p => {
    p.className = 'pad'; // reset all classes
  });

  await sleep(400);
  await nextRound();
}

// ── Pad click handlers ────────────────────
pads.forEach((pad, i) => {
  pad.addEventListener('click', () => onPadTap(i));
  pad.addEventListener('touchstart', e => {
    e.preventDefault();
    onPadTap(i);
  }, { passive: false });
});

playBtn.addEventListener('click', startGame);

// ── Boot ──────────────────────────────────
function boot() {
  bestEl.textContent    = best;
  roundEl.textContent   = '1';
  ovEmoji.textContent   = '🐸';
  ovTitle.textContent   = 'Frog Memory';
  ovSub.textContent     = 'Watch the lily pads light up,\nthen repeat the sequence!';
  resultBx.style.display = 'none';
  playBtn.textContent   = '🐸 Start!';
  overlay.style.display = 'flex';
  setFrog('🐸', 'Ready?');
  setStatus('Press Start to play!', '#74c69d');
}

boot();