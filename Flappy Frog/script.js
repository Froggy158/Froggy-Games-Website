'use strict';

// ─────────────────────────────────────────
//  FLAPPY FROG  –  game.js
// ─────────────────────────────────────────

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score-display');
const bestVal      = document.getElementById('best-val');
const overlay      = document.getElementById('overlay');
const ovEmoji      = document.getElementById('ov-emoji');
const ovTitle      = document.getElementById('ov-title');
const ovSub        = document.getElementById('ov-sub');
const resultBox    = document.getElementById('result-box');
const resScore     = document.getElementById('res-score');
const resBest      = document.getElementById('res-best');
const playBtn      = document.getElementById('play-btn');
const jumpBtn      = document.getElementById('jump-btn');

// ── Dimensions ────────────────────────────
const W = 360;
const H = 580;
const GROUND_H = 68;
canvas.width  = W;
canvas.height = H;

// ── Physics ───────────────────────────────
const GRAVITY      = 1750;
const JUMP_VEL     = -470;
const PIPE_SPEED   = 155;
const PIPE_GAP     = 158;
const PIPE_W       = 62;
const PIPE_EVERY   = 1.65;  // seconds

// ── State ─────────────────────────────────
let frog, pipes, particles, score, best, gameState, rafId, lastTime, pipeTimer, cloudShift;
// gameState: 'idle' | 'playing' | 'dying' | 'dead'

function init() {
  frog = {
    x: 80, y: H / 2,
    vy: 0,
    rot: 0,
    alive: true,
    dyingTimer: 0,
  };
  pipes      = [];
  particles  = [];
  score      = 0;
  pipeTimer  = 0;
  gameState  = 'playing';
  scoreDisplay.textContent = '0';
}

// ── Input ─────────────────────────────────
function doJump() {
  if (gameState === 'dead')   { startGame(); return; }
  if (gameState === 'idle')   { startGame(); return; }
  if (gameState === 'dying')  return;
  if (!frog.alive)            return;
  frog.vy = JUMP_VEL;
  spawnJumpBubbles();
}

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); doJump(); }
});
canvas.addEventListener('pointerdown',  e => { e.preventDefault(); doJump(); });
jumpBtn.addEventListener('pointerdown', e => { e.preventDefault(); doJump(); });
playBtn.addEventListener('click', () => {
  if (gameState === 'dead' || gameState === 'idle') startGame();
});

// ── Particles ─────────────────────────────
function spawnJumpBubbles() {
  for (let i = 0; i < 6; i++) {
    particles.push({
      x: frog.x - 14, y: frog.y + 8,
      vx: -50 - Math.random() * 70,
      vy: -30 + Math.random() * 60,
      life: 0.35 + Math.random() * 0.2,
      maxLife: 0.5,
      r: 2.5 + Math.random() * 3,
      color: '#74c69d',
    });
  }
}

function spawnDeathBurst() {
  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * Math.PI * 2;
    const spd   = 90 + Math.random() * 150;
    particles.push({
      x: frog.x, y: frog.y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 80,
      life: 0.7 + Math.random() * 0.4,
      maxLife: 1.1,
      r: 4 + Math.random() * 6,
      color: ['#52b788','#74c69d','#d8f3dc','#ffd166','#2d6a4f'][Math.floor(Math.random()*5)],
    });
  }
}

function spawnScoreBurst(x, y) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      vx: -90 + Math.random() * 180,
      vy: -130 - Math.random() * 80,
      life: 0.55, maxLife: 0.55,
      r: 3 + Math.random() * 4,
      color: '#ffd166',
    });
  }
}

// ── Update ────────────────────────────────
function update(dt) {
  // Particles always update
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 380 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  if (gameState === 'idle') return;

  // ── Death animation ──
  if (gameState === 'dying') {
    frog.dyingTimer += dt;
    frog.vy += GRAVITY * dt;
    frog.y  += frog.vy * dt;
    frog.rot = Math.min(frog.rot + dt * 8, Math.PI / 2);
    if (frog.y + 20 >= H - GROUND_H) {
      frog.y = H - GROUND_H - 20;
      frog.vy = 0;
    }
    if (frog.dyingTimer > 1.3) {
      gameState = 'dead';
      showDeathOverlay();
    }
    return;
  }

  if (gameState !== 'playing') return;

  // ── Frog physics ──
  frog.vy += GRAVITY * dt;
  frog.y  += frog.vy * dt;

  // Tilt with velocity
  const targetRot = Math.max(-0.45, Math.min(1.3, frog.vy / 580));
  frog.rot += (targetRot - frog.rot) * 14 * dt;

  // Ceiling
  if (frog.y - 22 <= 0) { frog.y = 22; frog.vy = 80; }

  // Ground
  if (frog.y + 22 >= H - GROUND_H) {
    killFrog();
    return;
  }

  // ── Pipes ──
  pipeTimer += dt;
  if (pipeTimer >= PIPE_EVERY) {
    pipeTimer = 0;
    addPipe();
  }

  for (let i = pipes.length - 1; i >= 0; i--) {
    const p = pipes[i];
    p.x -= PIPE_SPEED * dt;

    // Score
    if (!p.scored && p.x + PIPE_W < frog.x) {
      p.scored = true;
      score++;
      scoreDisplay.textContent = score;
      if (score > best) {
        best = score;
        bestVal.textContent = best;
        localStorage.setItem('flappyFrogBest', best);
      }
      spawnScoreBurst(frog.x + 30, frog.y - 30);
    }

    // Collision
    if (hitPipe(p)) { killFrog(); return; }

    if (p.x + PIPE_W + 20 < 0) pipes.splice(i, 1);
  }
}

function addPipe() {
  const minTop = 72;
  const maxTop = H - GROUND_H - PIPE_GAP - 72;
  const gapTop = minTop + Math.random() * (maxTop - minTop);
  pipes.push({ x: W + 8, gapTop, gapBot: gapTop + PIPE_GAP, scored: false });
}

function hitPipe(p) {
  const r  = 16;
  const fx = frog.x, fy = frog.y;
  const nearX = Math.max(p.x, Math.min(fx, p.x + PIPE_W));
  // top pipe rect
  const nearTopY = Math.max(0, Math.min(fy, p.gapTop));
  if ((fx-nearX)**2 + (fy-nearTopY)**2 < r*r) return true;
  // bottom pipe rect
  const nearBotY = Math.max(p.gapBot, Math.min(fy, H));
  if ((fx-nearX)**2 + (fy-nearBotY)**2 < r*r) return true;
  return false;
}

function killFrog() {
  if (gameState !== 'playing') return;
  frog.vy = JUMP_VEL * 0.55;
  frog.alive = false;
  gameState = 'dying';
  frog.dyingTimer = 0;
  spawnDeathBurst();
}

function showDeathOverlay() {
  ovEmoji.textContent = '💀';
  ovTitle.textContent = score >= 10 ? 'Ribbit Legend!' : score >= 5 ? 'Nice Hops!' : 'Splat!';
  ovSub.textContent   = 'Try again?';
  resScore.textContent = '🏅 ' + score + ' pts';
  resBest.textContent  = 'Best: ' + best;
  resultBox.style.display = 'flex';
  playBtn.textContent = '🐸 Hop Again!';
  overlay.style.display = 'flex';
}

// ── Draw ──────────────────────────────────
// Pre-build sky gradient once
const skyGrad = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
skyGrad.addColorStop(0,    '#5bb8e8');
skyGrad.addColorStop(0.55, '#a8dfa0');
skyGrad.addColorStop(1,    '#78c47a');

const CLOUDS = [
  {x:30, y:55, s:1.0}, {x:130,y:38, s:0.75}, {x:210,y:70, s:0.85},
  {x:290,y:44, s:0.70}, {x:330,y:78, s:0.60},
];

function drawBg(dt) {
  cloudShift = ((cloudShift || 0) + 22 * dt) % W;
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, W, H - GROUND_H);

  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  for (const c of CLOUDS) {
    const cx = ((c.x - cloudShift + W * 2) % W);
    drawCloud(cx, c.y, 28 * c.s);
  }
}

function drawCloud(x, y, r) {
  ctx.beginPath();
  ctx.arc(x,       y,        r,        0, Math.PI*2);
  ctx.arc(x+r,     y-r*0.28, r*0.72,   0, Math.PI*2);
  ctx.arc(x-r,     y-r*0.18, r*0.62,   0, Math.PI*2);
  ctx.arc(x+r*1.6, y,        r*0.52,   0, Math.PI*2);
  ctx.fill();
}

function drawGround() {
  // Soil
  ctx.fillStyle = '#5c3d11';
  ctx.fillRect(0, H - GROUND_H, W, GROUND_H);
  // Grass band
  ctx.fillStyle = '#52b788';
  ctx.fillRect(0, H - GROUND_H, W, 18);
  // Tufts
  ctx.fillStyle = '#2d6a4f';
  for (let i = 0; i < W; i += 18) {
    ctx.beginPath();
    ctx.moveTo(i, H - GROUND_H + 18);
    ctx.quadraticCurveTo(i+5,  H - GROUND_H + 4,  i+9,  H - GROUND_H + 14);
    ctx.quadraticCurveTo(i+13, H - GROUND_H + 2,  i+18, H - GROUND_H + 18);
    ctx.fill();
  }
  // Pebbles
  ctx.fillStyle = '#7c5230';
  for (let i = 20; i < W - 10; i += 42) {
    ctx.beginPath(); ctx.ellipse(i,    H-GROUND_H+40, 5, 3, 0, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(i+21, H-GROUND_H+56, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();
  }
}

function drawPipes() {
  for (const p of pipes) {
    const CAP_H = 26, CAP_EXTRA = 12;
    const capX  = p.x - CAP_EXTRA / 2;
    const capW  = PIPE_W + CAP_EXTRA;

    // Helper: pipe gradient
    function pipeRect(x, y, w, h) {
      const g = ctx.createLinearGradient(x, 0, x+w, 0);
      g.addColorStop(0,   '#1b4332');
      g.addColorStop(0.3, '#2d6a4f');
      g.addColorStop(0.65,'#40916c');
      g.addColorStop(1,   '#1b4332');
      ctx.fillStyle = g;
      ctx.fillRect(x, y, w, h);
      // Highlight strip
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(x+5, y, 10, h);
    }

    // Top shaft
    pipeRect(p.x, 0, PIPE_W, p.gapTop - CAP_H);
    // Top cap
    pipeRect(capX, p.gapTop - CAP_H, capW, CAP_H);
    // Cap edge highlight
    ctx.fillStyle = '#74c69d';
    ctx.fillRect(capX+4, p.gapTop - CAP_H + 3, 7, CAP_H - 6);

    // Bottom cap
    pipeRect(capX, p.gapBot, capW, CAP_H);
    ctx.fillStyle = '#74c69d';
    ctx.fillRect(capX+4, p.gapBot+3, 7, CAP_H-6);
    // Bottom shaft
    pipeRect(p.x, p.gapBot + CAP_H, PIPE_W, H - GROUND_H - p.gapBot - CAP_H);

    // Lily pad on top of bottom pipe cap
    drawLilyPad(p.x + PIPE_W/2, p.gapBot + CAP_H - 4);
  }
}

function drawLilyPad(cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = '#2d6a4f';
  ctx.beginPath();
  ctx.arc(0, 0, 11, 0.25, Math.PI*2 - 0.25); ctx.fill();
  ctx.fillStyle = '#40916c';
  ctx.beginPath();
  ctx.arc(0, 0, 9, 0.25, Math.PI*2 - 0.25); ctx.fill();
  // notch
  ctx.fillStyle = '#1b4332';
  ctx.beginPath();
  ctx.moveTo(0,0); ctx.arc(0,0,11,-0.25,0.25); ctx.closePath(); ctx.fill();
  // flower
  ctx.fillStyle = '#f9c6d0';
  ctx.beginPath(); ctx.arc(1, -4, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(1, -4, 1.5, 0, Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ── Frog renderer ─────────────────────────
function drawFrog(x, y, rot, alive, dyingTimer) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);

  // Squash when dying on ground
  if (!alive && dyingTimer > 0.8 && y >= H - GROUND_H - 22) {
    ctx.scale(1.5, 0.35);
  }

  // Back legs
  ctx.fillStyle = '#1b4332';
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.moveTo(side * 10, 8);
    ctx.quadraticCurveTo(side * 28, 12, side * 26, 24);
    ctx.quadraticCurveTo(side * 18, 27, side * 12, 16);
    ctx.closePath(); ctx.fill();
  });

  // Body
  const bodyG = ctx.createRadialGradient(-5,-6,2, 0,0,22);
  bodyG.addColorStop(0, '#74c69d');
  bodyG.addColorStop(1, '#2d6a4f');
  ctx.fillStyle = bodyG;
  ctx.beginPath(); ctx.ellipse(0,0,20,22,0,0,Math.PI*2); ctx.fill();

  // Belly
  ctx.fillStyle = '#d8f3dc';
  ctx.beginPath(); ctx.ellipse(0,5,11,14,0,0,Math.PI*2); ctx.fill();

  // Body outline
  ctx.strokeStyle = '#1b4332'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(0,0,20,22,0,0,Math.PI*2); ctx.stroke();

  // Front legs
  ctx.fillStyle = '#1b4332';
  [-1, 1].forEach(side => {
    ctx.beginPath();
    ctx.moveTo(side * 14, -4);
    ctx.quadraticCurveTo(side * 26, -2, side * 24, -13);
    ctx.quadraticCurveTo(side * 16, -16, side * 10, -6);
    ctx.closePath(); ctx.fill();
  });

  // Head
  const headG = ctx.createRadialGradient(-4,-18,1, 0,-14,14);
  headG.addColorStop(0, '#74c69d');
  headG.addColorStop(1, '#2d6a4f');
  ctx.fillStyle = headG;
  ctx.beginPath(); ctx.ellipse(0,-14,16,13,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#1b4332'; ctx.lineWidth = 1.5;
  ctx.stroke();

  // Eyes
  [-7, 7].forEach(ex => {
    ctx.fillStyle = '#1b4332';
    ctx.beginPath(); ctx.arc(ex,-24,7,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ex,-24,5.2,0,Math.PI*2); ctx.fill();
    const px = ex > 0 ? ex+1.5 : ex-1.5;
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(px,-24,2.8,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px-1,-25.5,1,0,Math.PI*2); ctx.fill();
  });

  // Mouth
  if (alive) {
    ctx.strokeStyle = '#1b4332'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (rot < -0.05) { // rising — happy
      ctx.arc(0,-11,5,0.1,Math.PI-0.1);
    } else {           // falling — worried
      ctx.arc(0,-8,5,Math.PI+0.2,-0.2);
    }
    ctx.stroke();
  } else {
    // X eyes when dead
    ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 2;
    [-7,7].forEach(ex => {
      ctx.beginPath(); ctx.moveTo(ex-3,-27); ctx.lineTo(ex+3,-21); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ex+3,-27); ctx.lineTo(ex-3,-21); ctx.stroke();
    });
  }

  // Spots
  ctx.fillStyle = 'rgba(29,92,55,0.3)';
  ctx.beginPath(); ctx.ellipse(-7,2,4,3,-0.4,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(8,6,3,2,0.3,0,Math.PI*2); ctx.fill();

  ctx.restore();
}

// ── Idle bob ──────────────────────────────
let idleT = 0;
function drawIdle(dt) {
  idleT += dt;
  const bobY = Math.sin(idleT * 2.4) * 9;
  drawFrog(W/2, H/2 - 10 + bobY, Math.sin(idleT*1.2)*0.08, true, 0);
}

// ── Main loop ─────────────────────────────
function loop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  update(dt);

  drawBg(dt);
  drawPipes();
  drawGround();
  drawParticles();

  if (gameState === 'idle') {
    drawIdle(dt);
  } else {
    drawFrog(frog.x, frog.y, frog.rot, frog.alive, frog.dyingTimer);
  }

  rafId = requestAnimationFrame(loop);
}

// ── Start ─────────────────────────────────
function startGame() {
  init();
  overlay.style.display = 'none';
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function boot() {
  best = parseInt(localStorage.getItem('flappyFrogBest') || '0');
  bestVal.textContent = best;
  cloudShift = 0;
  gameState  = 'idle';
  particles  = [];
  pipes      = [];
  ovEmoji.textContent   = '🐸';
  ovTitle.textContent   = 'Flappy Frog';
  ovSub.textContent     = 'Tap, click, or press Space to flap!';
  resultBox.style.display = 'none';
  playBtn.textContent   = '🐸 Start Hopping!';
  overlay.style.display = 'flex';
  rafId = requestAnimationFrame(loop);
}

boot();