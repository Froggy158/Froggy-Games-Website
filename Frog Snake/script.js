'use strict';
// ═══════════════════════════════════════════
//  FROGGY SNAKE  –  game.js
//  Fix: one authoritative stepHandle; die() hard-stops it immediately
//  and sets gameState = 'dead' before any overlay timeout fires.
// ═══════════════════════════════════════════

// ── DOM refs ──────────────────────────────
const canvas  = document.getElementById('c');
const ctx     = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const bestEl  = document.getElementById('best');
const overlay = document.getElementById('overlay');
const ovEmoji = document.getElementById('ov-emoji');
const ovTitle = document.getElementById('ov-title');
const ovSub   = document.getElementById('ov-sub');
const resBx   = document.getElementById('result-box');
const resScEl = document.getElementById('res-score');
const resBsEl = document.getElementById('res-best');
const playBtn = document.getElementById('play-btn');

// ── Grid constants ────────────────────────
const COLS = 18, ROWS = 18, CELL = 24;
const W = COLS * CELL, H = ROWS * CELL;
canvas.width = W;
canvas.height = H;

// ── Speed constants ───────────────────────
const BASE_MS = 145;   // starting step interval
const MIN_MS  = 60;    // fastest allowed

// ── Game variables ────────────────────────
let snake, dir, nextDir, fly, score;
let best       = parseInt(localStorage.getItem('froggySnakeBest') || '0');
let gameState  = 'idle';   // 'idle' | 'playing' | 'dead'
let stepHandle = null;     // THE single interval handle
let stepMs     = BASE_MS;  // current interval duration
let rafId      = null;
let lastTs     = null;
let particles  = [];
let flyAnim    = 0;
let idleT      = 0;

// Pre-build background checkerboard
const bgGrid = [];
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++)
    bgGrid.push({ x: c, y: r, dark: (c + r) % 2 === 0 });

// ─────────────────────────────────────────
//  GAME LOGIC
// ─────────────────────────────────────────

function initGame() {
  const mx = Math.floor(COLS / 2), my = Math.floor(ROWS / 2);
  snake   = [{ x: mx, y: my }, { x: mx-1, y: my }, { x: mx-2, y: my }];
  dir     = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score   = 0;
  stepMs  = BASE_MS;
  particles = [];
  flyAnim   = 0;
  placeFly();
  scoreEl.textContent = '0';
}

function placeFly() {
  let p;
  do {
    p = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === p.x && s.y === p.y));
  fly = p;
}

// ── The single step tick ──────────────────
// Called only by the setInterval. Checks gameState first — belt-and-suspenders guard.
function tick() {
  if (gameState !== 'playing') return;

  dir = { ...nextDir };
  const head = snake[0];
  const next = { x: head.x + dir.x, y: head.y + dir.y };

  // Wall hit
  if (next.x < 0 || next.x >= COLS || next.y < 0 || next.y >= ROWS) {
    die(); return;
  }
  // Self hit — skip index 1 (the neck segment) so a 180° turn doesn't instantly kill you
  if (snake.some((s, i) => i !== 1 && s.x === next.x && s.y === next.y)) {
    die(); return;
  }

  snake.unshift(next);

  if (next.x === fly.x && next.y === fly.y) {
    // Ate fly
    score++;
    scoreEl.textContent = score;
    if (score > best) {
      best = score;
      bestEl.textContent = best;
      localStorage.setItem('froggySnakeBest', best);
    }
    spawnEatBurst(fly.x, fly.y);
    placeFly();

    // Speed up — replace interval with faster one
    const newMs = Math.max(MIN_MS, BASE_MS - score * 4);
    if (newMs < stepMs) {
      stepMs = newMs;
      stopStep();
      startStep();
    }
  } else {
    snake.pop();
  }
}

function die() {
  // Immediately stop the interval and lock state so tick() can never re-enter
  stopStep();
  gameState = 'dead';
  spawnDeathBurst();

  // Show overlay after a short dramatic pause
  setTimeout(() => {
    // Guard: only show if we're still dead (not restarted)
    if (gameState !== 'dead') return;
    ovEmoji.textContent = score > 15 ? '🏆' : score > 7 ? '😤' : '💀';
    ovTitle.textContent = score > 15 ? 'Ribbit Royalty!' : score > 7 ? 'Juicy Chomps!' : 'Splat!';
    ovSub.textContent   = 'Eat more flies to grow!';
    resScEl.textContent = '🪰 ' + score + ' flies eaten';
    resBsEl.textContent = 'Best: ' + best;
    resBx.style.display = 'flex';
    playBtn.textContent = '🐸 Hop Again!';
    overlay.style.display = 'flex';
  }, 650);
}

function stopStep() {
  if (stepHandle !== null) {
    clearInterval(stepHandle);
    stepHandle = null;
  }
}

function startStep() {
  // Safety: never double-start
  stopStep();
  stepHandle = setInterval(tick, stepMs);
}

// ─────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────

const KEY_MAP = {
  ArrowUp:    { x:  0, y: -1 },
  ArrowDown:  { x:  0, y:  1 },
  ArrowLeft:  { x: -1, y:  0 },
  ArrowRight: { x:  1, y:  0 },
  w:          { x:  0, y: -1 },
  s:          { x:  0, y:  1 },
  a:          { x: -1, y:  0 },
  d:          { x:  1, y:  0 },
};

document.addEventListener('keydown', e => {
  const d = KEY_MAP[e.key] || KEY_MAP[e.key.toLowerCase()];
  if (!d) return;
  e.preventDefault();
  if (gameState !== 'playing') { startGame(); return; }
  queueDir(d);
});

function queueDir(d) {
  // Prevent reversing into the opposite direction
  if (d.x === -dir.x && d.y === -dir.y) return;
  nextDir = d;
}

const DPAD = { up: {x:0,y:-1}, down: {x:0,y:1}, left: {x:-1,y:0}, right: {x:1,y:0} };
['up','down','left','right'].forEach(name => {
  document.getElementById('dp-' + name).addEventListener('pointerdown', e => {
    e.preventDefault();
    if (gameState !== 'playing') { startGame(); return; }
    queueDir(DPAD[name]);
  });
});

playBtn.addEventListener('click', startGame);

// ─────────────────────────────────────────
//  START / BOOT
// ─────────────────────────────────────────

function startGame() {
  // Hard stop any existing interval first
  stopStep();
  gameState = 'playing';
  initGame();
  overlay.style.display = 'none';
  startStep();
}

function boot() {
  bestEl.textContent    = best;
  gameState             = 'idle';
  ovEmoji.textContent   = '🐸';
  ovTitle.textContent   = 'Froggy Snake';
  ovSub.textContent     = "Eat flies to grow your frog chain!\nDon't bite yourself or hit the walls!";
  resBx.style.display   = 'none';
  playBtn.textContent   = "🐸 Start Ribbitin'!";
  overlay.style.display = 'flex';
  rafId = requestAnimationFrame(renderLoop);
}

// ─────────────────────────────────────────
//  PARTICLES
// ─────────────────────────────────────────

function spawnEatBurst(gx, gy) {
  const cx = gx * CELL + CELL/2, cy = gy * CELL + CELL/2;
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2, spd = 55 + Math.random() * 90;
    particles.push({
      x: cx, y: cy, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd,
      life: 0.45, maxLife: 0.45, r: 2.5 + Math.random()*3.5,
      color: ['#ffd166','#fbbf24','#f59e0b','#fff','#d8f3dc'][Math.floor(Math.random()*5)],
    });
  }
}

function spawnDeathBurst() {
  if (!snake || !snake.length) return;
  const cx = snake[0].x * CELL + CELL/2, cy = snake[0].y * CELL + CELL/2;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2, spd = 70 + Math.random()*140;
    particles.push({
      x: cx, y: cy, vx: Math.cos(a)*spd, vy: Math.sin(a)*spd - 50,
      life: 0.9, maxLife: 0.9, r: 3.5 + Math.random()*5.5,
      color: ['#52b788','#74c69d','#d8f3dc','#ef4444','#ffd166'][Math.floor(Math.random()*5)],
    });
  }
}

// ─────────────────────────────────────────
//  DRAWING
// ─────────────────────────────────────────

function rr(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y);
  ctx.arcTo(x+w,y,x+w,y+r,r); ctx.lineTo(x+w,y+h-r);
  ctx.arcTo(x+w,y+h,x+w-r,y+h,r); ctx.lineTo(x+r,y+h);
  ctx.arcTo(x,y+h,x,y+h-r,r); ctx.lineTo(x,y+r);
  ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
}

function drawBg() {
  for (const c of bgGrid) {
    const px = c.x*CELL, py = c.y*CELL;
    ctx.fillStyle = c.dark ? '#173325' : '#1c3d2c';
    ctx.fillRect(px, py, CELL, CELL);
    if (c.dark) {
      ctx.fillStyle = 'rgba(82,183,136,0.055)';
      ctx.beginPath();
      ctx.arc(px+CELL/2, py+CELL/2, CELL/2-4, 0, Math.PI*2);
      ctx.fill();
    }
  }
}

function drawFly(t) {
  const cx = fly.x*CELL + CELL/2;
  const cy = fly.y*CELL + CELL/2 + Math.sin(t*4.5)*2.5;
  ctx.save(); ctx.translate(cx, cy);

  // Glow ring
  ctx.strokeStyle = 'rgba(255,209,102,0.28)'; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.arc(0,0,CELL/2-1,0,Math.PI*2); ctx.stroke();

  // Wings (flapping)
  const wf = Math.sin(t*18)*0.28;
  ctx.save(); ctx.rotate(-wf);
  ctx.fillStyle = 'rgba(147,210,255,0.55)';
  ctx.beginPath(); ctx.ellipse(-5,-5,6.5,3.5,-0.4,0,Math.PI*2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.rotate(wf);
  ctx.fillStyle = 'rgba(147,210,255,0.55)';
  ctx.beginPath(); ctx.ellipse(5,-5,6.5,3.5,0.4,0,Math.PI*2); ctx.fill();
  ctx.restore();

  // Body
  ctx.fillStyle = '#374151'; ctx.beginPath(); ctx.ellipse(0,1.5,4,5.5,0,0,Math.PI*2); ctx.fill();
  // Head
  ctx.fillStyle = '#1f2937'; ctx.beginPath(); ctx.arc(0,-4.5,3.5,0,Math.PI*2); ctx.fill();
  // Eyes
  ctx.fillStyle = '#dc2626';
  ctx.beginPath(); ctx.arc(-2,-5.5,1.8,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( 2,-5.5,1.8,0,Math.PI*2); ctx.fill();
  // Legs
  ctx.strokeStyle = '#4b5563'; ctx.lineWidth = 1;
  [[-4,1],[-4,4],[4,1],[4,4]].forEach(([lx,ly]) => {
    ctx.beginPath(); ctx.moveTo(0,ly); ctx.lineTo(lx*1.6,ly+4); ctx.stroke();
  });

  ctx.restore();
}

function drawSnake() {
  const len = snake.length;
  for (let i = len-1; i >= 0; i--) {
    const seg = snake[i];
    const px = seg.x*CELL, py = seg.y*CELL;
    if (i === 0) {
      drawHead(px+CELL/2, py+CELL/2);
    } else {
      const t = i / Math.max(len-1, 1);
      const g = ctx.createLinearGradient(px, py, px+CELL, py+CELL);
      g.addColorStop(0, `rgba(82,183,136,${0.95 - t*0.28})`);
      g.addColorStop(1, `rgba(29,92,55,${0.95 - t*0.28})`);
      ctx.fillStyle = g;
      rr(px+2, py+2, CELL-4, CELL-4, 7); ctx.fill();
      // Belly tint
      ctx.fillStyle = 'rgba(216,243,220,0.17)';
      rr(px+5, py+5, CELL-10, CELL-10, 5); ctx.fill();
      // Shine dot
      ctx.fillStyle = 'rgba(116,198,157,0.28)';
      ctx.beginPath(); ctx.arc(px+2+(CELL-4)*0.33, py+2+(CELL-4)*0.3, (CELL-4)*0.16, 0, Math.PI*2); ctx.fill();
      // Outline
      ctx.strokeStyle = '#1b4332'; ctx.lineWidth = 1;
      rr(px+2, py+2, CELL-4, CELL-4, 7); ctx.stroke();
    }
  }
}

function drawHead(cx, cy) {
  ctx.save();
  ctx.translate(cx, cy);

  // Rotate the frog emoji to face the movement direction.
  // The 🐸 emoji naturally faces up, so:
  //   up    =>  0  (no rotation)
  //   right =>  90 deg
  //   down  => 180 deg
  //   left  => -90 deg
  const angle = dir.x === 1  ?  Math.PI / 2 :
                dir.x === -1 ? -Math.PI / 2 :
                dir.y === 1  ?  Math.PI      : 0;
  ctx.rotate(angle);

  const fontSize = CELL + 4;
  ctx.font = fontSize + 'px serif';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('\u{1F438}', 0, 1);

  ctx.restore();
}

function drawIdleFrog(dt) {
  idleT += dt;
  const bob = Math.sin(idleT*2.2)*7;
  ctx.save(); ctx.translate(W/2, H/2+bob);

  // Shadow
  ctx.fillStyle='rgba(0,0,0,0.12)';
  ctx.beginPath(); ctx.ellipse(0,26-bob/2,20,6,0,0,Math.PI*2); ctx.fill();

  // Back legs
  ctx.fillStyle='#1b4332';
  ctx.beginPath(); ctx.moveTo(-12,8); ctx.quadraticCurveTo(-30,14,-28,28); ctx.quadraticCurveTo(-19,30,-12,18); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(12,8);  ctx.quadraticCurveTo(30,14,28,28);   ctx.quadraticCurveTo(19,30,12,18);  ctx.closePath(); ctx.fill();

  // Body
  const bg=ctx.createRadialGradient(-5,-6,2,0,0,24);
  bg.addColorStop(0,'#74c69d'); bg.addColorStop(1,'#2d6a4f');
  ctx.fillStyle=bg; ctx.beginPath(); ctx.ellipse(0,0,22,24,0,0,Math.PI*2); ctx.fill();
  ctx.fillStyle='#d8f3dc'; ctx.beginPath(); ctx.ellipse(0,5,13,16,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#1b4332'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.ellipse(0,0,22,24,0,0,Math.PI*2); ctx.stroke();

  // Front legs
  ctx.fillStyle='#1b4332';
  ctx.beginPath(); ctx.moveTo(-15,-4); ctx.quadraticCurveTo(-30,-2,-28,-15); ctx.quadraticCurveTo(-19,-18,-10,-6); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(15,-4);  ctx.quadraticCurveTo(30,-2,28,-15);   ctx.quadraticCurveTo(19,-18,10,-6);  ctx.closePath(); ctx.fill();

  // Head
  const hg=ctx.createRadialGradient(-4,-18,1,0,-14,15);
  hg.addColorStop(0,'#74c69d'); hg.addColorStop(1,'#2d6a4f');
  ctx.fillStyle=hg; ctx.beginPath(); ctx.ellipse(0,-14,17,14,0,0,Math.PI*2); ctx.fill();
  ctx.strokeStyle='#1b4332'; ctx.lineWidth=1.5; ctx.stroke();

  // Eyes
  [-8,8].forEach(ex => {
    ctx.fillStyle='#1b4332'; ctx.beginPath(); ctx.arc(ex,-25,7.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';    ctx.beginPath(); ctx.arc(ex,-25,5.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#111';    ctx.beginPath(); ctx.arc(ex+1,-25,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#fff';    ctx.beginPath(); ctx.arc(ex-0.5,-26.5,1.2,0,Math.PI*2); ctx.fill();
  });

  // Smile
  ctx.strokeStyle='#1b4332'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(0,-10,6,0.15,Math.PI-0.15); ctx.stroke();

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life/p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ─────────────────────────────────────────
//  RENDER LOOP  (runs always — draw only)
// ─────────────────────────────────────────

function renderLoop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;

  // Update particles (visual only — no game logic here)
  for (let i = particles.length-1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 180*dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i,1);
  }

  drawBg();

  if (gameState === 'idle') {
    drawIdleFrog(dt);
  } else {
    // Draw game objects regardless of playing/dead so particles show over a still snake
    flyAnim += dt;
    drawFly(flyAnim);
    drawSnake();
  }

  drawParticles();
  rafId = requestAnimationFrame(renderLoop);
}

// ─────────────────────────────────────────
//  KICK OFF
// ─────────────────────────────────────────
boot();