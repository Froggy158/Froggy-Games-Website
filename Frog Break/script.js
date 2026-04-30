'use strict';
// ═══════════════════════════════════════════
//  FROG BREAKOUT  –  script.js
//  Key fix: init() called immediately on boot
//  so paddle/ball/bricks exist before first frame
// ═══════════════════════════════════════════

// ── DOM ───────────────────────────────────
const C    = document.getElementById('c');
const X    = C.getContext('2d');
const W    = 420, H = 520;

const scEl  = document.getElementById('sc');
const bsEl  = document.getElementById('bst');
const lvEl  = document.getElementById('lv');
const ov    = document.getElementById('ov');
const ovTi  = document.getElementById('ov-ti');
const ovSu  = document.getElementById('ov-su');
const rb    = document.getElementById('rb');
const rsEl  = document.getElementById('rs');
const rb2El = document.getElementById('rb2');
const pb    = document.getElementById('pb');
const blB   = document.getElementById('bl');
const brB   = document.getElementById('br');

// ── Constants ─────────────────────────────
const PW    = 86;    // paddle width
const PH    = 14;    // paddle height
const PY    = H - 44; // paddle Y position
const PSPD  = 5;     // paddle keyboard speed
const BR    = 9;     // ball radius
const ISPD  = 4.8;   // initial ball speed
const MXSPD = 10;    // max ball speed
const COLS  = 8;     // brick columns
const ROWS  = 5;     // brick rows
const BPAD  = 5;     // brick padding
const BTOP  = 52;    // bricks start Y

const ROW_COLORS = [
  { fill: '#b7e4c7', stroke: '#52b788', pts: 10 },
  { fill: '#74c69d', stroke: '#2d6a4f', pts: 20 },
  { fill: '#52b788', stroke: '#1b4332', pts: 30 },
  { fill: '#40916c', stroke: '#1b4332', pts: 40 },
  { fill: '#ffd166', stroke: '#b45309', pts: 50 },
];

// ── Persistent state ──────────────────────
let best = parseInt(localStorage.getItem('frogBreakout3') || '0');
bsEl.textContent = best;

// ── Game state ────────────────────────────
let paddle, ball, bricks, score, lives, parts;
let state  = 'idle';  // 'idle' | 'launch' | 'playing' | 'dead' | 'win'
let gt     = 0;       // game time (seconds)
let lastT  = null;
let keys   = {};
let ml     = false;   // mobile left held
let mr     = false;   // mobile right held

// ── Helpers ───────────────────────────────
function rr(x, y, w, h, r) {
  X.beginPath();
  X.moveTo(x+r, y);       X.lineTo(x+w-r, y);
  X.arcTo(x+w, y,   x+w, y+r,   r);
  X.lineTo(x+w, y+h-r);
  X.arcTo(x+w, y+h, x+w-r, y+h, r);
  X.lineTo(x+r, y+h);
  X.arcTo(x,   y+h, x,   y+h-r, r);
  X.lineTo(x,   y+r);
  X.arcTo(x,   y,   x+r, y,     r);
  X.closePath();
}

// ── Build bricks ──────────────────────────
function makeBricks() {
  const bw = (W - BPAD * (COLS + 1)) / COLS;
  const bh = 19;
  const out = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      out.push({
        x: BPAD + c * (bw + BPAD),
        y: BTOP + r * (bh + BPAD),
        w: bw, h: bh,
        alive: true,
        color: ROW_COLORS[r],
        ph: Math.random() * Math.PI * 2,
      });
  return out;
}

// ── Reset ball (glued to paddle) ──────────
function mkBall() {
  const a = (-Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 2.5);
  return {
    x: W / 2, y: PY - BR - 2,
    vx: Math.cos(a) * ISPD,
    vy: Math.sin(a) * ISPD,
    spd: ISPD,
    glued: true,
  };
}

// ── Init / reset everything ───────────────
function init() {
  paddle = { x: W/2 - PW/2, y: PY, w: PW, h: PH };
  ball   = mkBall();
  bricks = makeBricks();
  score  = 0;
  lives  = 3;
  parts  = [];
  gt     = 0;
  lastT  = null;
  keys   = {};
  ml     = false;
  mr     = false;
  state  = 'launch';
  scEl.textContent = '0';
  lvEl.textContent = '🐸🐸🐸';
}

// ── Launch ball off paddle ─────────────────
function launch() {
  if (state === 'launch') {
    ball.glued = false;
    state = 'playing';
  }
}

// ─────────────────────────────────────────
//  INPUT
// ─────────────────────────────────────────

document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if ([' ', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (e.key === ' ' || e.key === 'ArrowUp') launch();
  if (state === 'dead' || state === 'win') startGame();
});
document.addEventListener('keyup', e => { keys[e.key] = false; });

C.addEventListener('mousemove', e => {
  if (state !== 'playing' && state !== 'launch') return;
  const rect = C.getBoundingClientRect();
  const sx   = W / rect.width;
  paddle.x   = Math.max(0, Math.min(W - PW, (e.clientX - rect.left) * sx - PW / 2));
});

C.addEventListener('click', () => {
  launch();
  if (state === 'dead' || state === 'win') startGame();
});

C.addEventListener('touchstart', e => {
  e.preventDefault();
  launch();
}, { passive: false });

C.addEventListener('touchmove', e => {
  e.preventDefault();
  if (state !== 'playing' && state !== 'launch') return;
  const rect = C.getBoundingClientRect();
  const sx   = W / rect.width;
  paddle.x   = Math.max(0, Math.min(W - PW, (e.touches[0].clientX - rect.left) * sx - PW / 2));
}, { passive: false });

// Mobile buttons
blB.addEventListener('pointerdown', e => { e.preventDefault(); ml = true; });
blB.addEventListener('pointerup',   () => { ml = false; });
blB.addEventListener('pointerleave',() => { ml = false; });
brB.addEventListener('pointerdown', e => { e.preventDefault(); mr = true; launch(); });
brB.addEventListener('pointerup',   () => { mr = false; });
brB.addEventListener('pointerleave',() => { mr = false; });

pb.addEventListener('click', startGame);

// ─────────────────────────────────────────
//  UPDATE
// ─────────────────────────────────────────

function update() {
  if (state !== 'playing' && state !== 'launch') return;

  // Move paddle
  if (keys['ArrowLeft']  || ml) paddle.x = Math.max(0,      paddle.x - PSPD);
  if (keys['ArrowRight'] || mr) paddle.x = Math.min(W - PW, paddle.x + PSPD);

  // Ball glued to paddle
  if (state === 'launch') {
    ball.x = paddle.x + PW / 2;
    ball.y = PY - BR - 2;
    return;
  }

  // Move ball
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall bounces
  if (ball.x - BR < 0)  { ball.x = BR;   ball.vx =  Math.abs(ball.vx); spawnWall(ball.x, ball.y); }
  if (ball.x + BR > W)  { ball.x = W-BR; ball.vx = -Math.abs(ball.vx); spawnWall(ball.x, ball.y); }
  if (ball.y - BR < 0)  { ball.y = BR;   ball.vy =  Math.abs(ball.vy); spawnWall(ball.x, ball.y); }

  // Ball lost below screen
  if (ball.y - BR > H + 10) {
    lives--;
    lvEl.textContent = '🐸'.repeat(Math.max(0, lives));
    spawnDeath(W / 2, H - 30);
    if (lives <= 0) { gameOver(); return; }
    state = 'launch';
    ball  = mkBall();
    return;
  }

  // Paddle collision
  if (
    ball.vy > 0 &&
    ball.y + BR >= paddle.y &&
    ball.y - BR <= paddle.y + PH &&
    ball.x + BR >= paddle.x &&
    ball.x - BR <= paddle.x + PW
  ) {
    ball.y = paddle.y - BR;
    const hp  = (ball.x - (paddle.x + PW / 2)) / (PW / 2); // -1 to 1
    const ang = hp * (Math.PI / 3);
    const spd = Math.min(MXSPD, ball.spd + 0.08);
    ball.spd  = spd;
    ball.vx   = Math.sin(ang) * spd;
    ball.vy   = -Math.abs(Math.cos(ang) * spd);
    spawnPaddle(ball.x, ball.y);
  }

  // Brick collisions
  let allGone = true;
  for (const b of bricks) {
    if (!b.alive) continue;
    allGone = false;

    if (
      ball.x + BR > b.x &&
      ball.x - BR < b.x + b.w &&
      ball.y + BR > b.y &&
      ball.y - BR < b.y + b.h
    ) {
      b.alive = false;
      score  += b.color.pts;
      scEl.textContent = score;

      if (score > best) {
        best = score;
        bsEl.textContent = best;
        localStorage.setItem('frogBreakout3', best);
      }

      spawnBrick(b.x + b.w / 2, b.y + b.h / 2, b.color.fill);

      // Which face was hit?
      const ol = ball.x + BR - b.x;
      const or_ = b.x + b.w - (ball.x - BR);
      const ot = ball.y + BR - b.y;
      const ob = b.y + b.h - (ball.y - BR);
      if (Math.min(ol, or_) < Math.min(ot, ob)) ball.vx = -ball.vx;
      else ball.vy = -ball.vy;
      break;
    }
  }

  if (allGone) winGame();
}

// ─────────────────────────────────────────
//  GAME OVER / WIN
// ─────────────────────────────────────────

function gameOver() {
  state = 'dead';
  setTimeout(() => {
    if (state !== 'dead') return;
    ovTi.textContent = score > 300 ? 'So close!' : 'Ribbit... Oops!';
    ovSu.textContent = 'The lily pads won this time.';
    rsEl.textContent = '🪰 ' + score + ' pts';
    rb2El.textContent = 'Best: ' + best;
    rb.style.display  = 'flex';
    pb.textContent    = '🐸 Try Again!';
    ov.style.display  = 'flex';
  }, 700);
}

function winGame() {
  state = 'win';
  setTimeout(() => {
    if (state !== 'win') return;
    ovTi.textContent  = 'Ribbit Royalty!';
    ovSu.textContent  = 'You smashed every lily pad!';
    rsEl.textContent  = '🪰 ' + score + ' pts';
    rb2El.textContent = 'Best: ' + best;
    rb.style.display  = 'flex';
    pb.textContent    = '🐸 Play Again!';
    ov.style.display  = 'flex';
  }, 400);
}

// ─────────────────────────────────────────
//  PARTICLES
// ─────────────────────────────────────────

function spawnBrick(cx, cy, col) {
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, s = 55 + Math.random() * 90;
    parts.push({ x:cx, y:cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s, l:.45, ml:.45, r:3+Math.random()*4, c:col });
  }
}

function spawnPaddle(cx, cy) {
  for (let i = 0; i < 6; i++)
    parts.push({ x:cx+(Math.random()-.5)*26, y:cy, vx:(Math.random()-.5)*65, vy:-35-Math.random()*50, l:.3, ml:.3, r:2+Math.random()*2, c:'#74c69d' });
}

function spawnWall(cx, cy) {
  for (let i = 0; i < 4; i++)
    parts.push({ x:cx, y:cy, vx:(Math.random()-.5)*50, vy:(Math.random()-.5)*50, l:.2, ml:.2, r:2+Math.random()*2, c:'#d8f3dc' });
}

function spawnDeath(cx, cy) {
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2, s = 60 + Math.random() * 110;
    parts.push({ x:cx, y:cy, vx:Math.cos(a)*s, vy:Math.sin(a)*s-40, l:.75, ml:.75, r:3+Math.random()*5,
      c: ['#52b788','#ffd166','#ef4444','#d8f3dc'][i % 4] });
  }
}

// ─────────────────────────────────────────
//  DRAW
// ─────────────────────────────────────────

function drawBg() {
  X.fillStyle = '#0d2b1a';
  X.fillRect(0, 0, W, H);
  X.strokeStyle = 'rgba(82,183,136,0.07)';
  X.lineWidth = 1;
  for (let y = 24; y < H; y += 26) {
    X.beginPath(); X.moveTo(0, y); X.lineTo(W, y); X.stroke();
  }
}

function drawBricks() {
  for (const b of bricks) {
    if (!b.alive) continue;
    const wob = Math.sin(gt * 1.2 + b.ph) * 1.1;
    X.save();
    X.translate(b.x + b.w / 2, b.y + b.h / 2 + wob);
    // Fill
    X.fillStyle = b.color.fill;
    rr(-b.w/2, -b.h/2, b.w, b.h, 7); X.fill();
    // Shine
    X.fillStyle = 'rgba(255,255,255,0.15)';
    rr(-b.w/2+3, -b.h/2+3, b.w*0.5, b.h*0.4, 4); X.fill();
    // Border
    X.strokeStyle = b.color.stroke; X.lineWidth = 1.5;
    rr(-b.w/2, -b.h/2, b.w, b.h, 7); X.stroke();
    // Lily pad notch
    X.fillStyle = b.color.stroke;
    X.beginPath(); X.moveTo(0, -b.h/2); X.arc(0, -b.h/2, 3.5, 0, Math.PI); X.closePath(); X.fill();
    // Gold flower
    if (b.color.pts === 50) {
      X.fillStyle = '#f9a8d4'; X.beginPath(); X.arc(0, 1, 3, 0, Math.PI*2); X.fill();
      X.fillStyle = '#fbbf24'; X.beginPath(); X.arc(0, 1, 1.5, 0, Math.PI*2); X.fill();
    }
    X.restore();
  }
}

function drawPaddle() {
  const { x, y, w, h } = paddle;
  // Log body
  const g = X.createLinearGradient(x, y, x, y+h);
  g.addColorStop(0, '#a16207'); g.addColorStop(1, '#78350f');
  X.fillStyle = g; rr(x, y, w, h, h/2); X.fill();
  // Grain
  X.strokeStyle = 'rgba(255,255,255,0.1)'; X.lineWidth = 1; X.setLineDash([7, 5]);
  X.beginPath(); X.moveTo(x+8, y+h/2); X.lineTo(x+w-8, y+h/2); X.stroke();
  X.setLineDash([]);
  // End rings
  X.strokeStyle = '#92400e'; X.lineWidth = 2;
  X.beginPath(); X.arc(x+h/2,   y+h/2, h/2-1, 0, Math.PI*2); X.stroke();
  X.beginPath(); X.arc(x+w-h/2, y+h/2, h/2-1, 0, Math.PI*2); X.stroke();
  // Frog emoji on top
  X.font = '16px serif'; X.textAlign = 'center'; X.textBaseline = 'bottom';
  X.fillText('🐸', x + w/2, y + 1);
}

function drawBall() {
  const { x, y } = ball;
  // Glow
  const grd = X.createRadialGradient(x, y, 1, x, y, BR*2.2);
  grd.addColorStop(0, 'rgba(255,209,102,0.35)');
  grd.addColorStop(1, 'rgba(255,209,102,0)');
  X.fillStyle = grd; X.beginPath(); X.arc(x, y, BR*2.2, 0, Math.PI*2); X.fill();
  // Wings
  const wf = Math.sin(gt * 22) * 0.3;
  X.save(); X.translate(x, y);
  X.save(); X.rotate(-wf);
  X.fillStyle = 'rgba(147,210,255,0.6)';
  X.beginPath(); X.ellipse(-BR*0.6, -BR*0.7, BR*0.9, BR*0.5, -0.3, 0, Math.PI*2); X.fill();
  X.restore();
  X.save(); X.rotate(wf);
  X.fillStyle = 'rgba(147,210,255,0.6)';
  X.beginPath(); X.ellipse(BR*0.6, -BR*0.7, BR*0.9, BR*0.5, 0.3, 0, Math.PI*2); X.fill();
  X.restore();
  // Fly body
  X.fillStyle = '#1f2937'; X.beginPath(); X.arc(0, BR*0.1, BR*0.65, 0, Math.PI*2); X.fill();
  // Fly head
  X.fillStyle = '#111827'; X.beginPath(); X.arc(0, -BR*0.45, BR*0.5, 0, Math.PI*2); X.fill();
  // Red eyes
  X.fillStyle = '#dc2626';
  X.beginPath(); X.arc(-BR*0.24, -BR*0.56, BR*0.22, 0, Math.PI*2); X.fill();
  X.beginPath(); X.arc( BR*0.24, -BR*0.56, BR*0.22, 0, Math.PI*2); X.fill();
  X.restore();
  // Launch hint
  if (ball.glued) {
    const p = 0.55 + Math.sin(gt * 4) * 0.45;
    X.fillStyle = `rgba(255,209,102,${p})`;
    X.font = 'bold 11px sans-serif'; X.textAlign = 'center'; X.textBaseline = 'middle';
    X.fillText('TAP / CLICK TO LAUNCH', x, y - BR - 16);
  }
}

function drawParticles() {
  for (const p of parts) {
    X.globalAlpha = Math.max(0, p.l / p.ml);
    X.fillStyle = p.c;
    X.beginPath(); X.arc(p.x, p.y, p.r, 0, Math.PI*2); X.fill();
  }
  X.globalAlpha = 1;
}

// ─────────────────────────────────────────
//  RENDER LOOP
// ─────────────────────────────────────────

function loop(ts) {
  if (!lastT) lastT = ts;
  const dt = Math.min((ts - lastT) / 1000, 0.05);
  lastT = ts;
  gt   += dt;

  // Update particles
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 200 * dt;
    p.l  -= dt;
    if (p.l <= 0) parts.splice(i, 1);
  }

  update();
  drawBg();
  drawBricks();
  drawPaddle();
  drawBall();
  drawParticles();

  requestAnimationFrame(loop);
}

// ─────────────────────────────────────────
//  START / BOOT
// ─────────────────────────────────────────

function startGame() {
  init();
  ov.style.display = 'none';
}

// Boot: init() first so all objects exist before frame 1
init();
ov.style.display = 'flex';  // show start screen on top of live canvas
requestAnimationFrame(loop);