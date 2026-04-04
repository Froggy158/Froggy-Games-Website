'use strict';
// ═══════════════════════════════════════════
//  POND PANIC  –  script.js
//  Frog dodges falling meteorites.
//  Move with ← → / A D / touch buttons.
// ═══════════════════════════════════════════

// ── DOM ───────────────────────────────────
const canvas   = document.getElementById('c');
const ctx      = canvas.getContext('2d');
const scoreEl  = document.getElementById('score');
const bestEl   = document.getElementById('best');
const overlay  = document.getElementById('overlay');
const ovEmoji  = document.getElementById('ov-emoji');
const ovTitle  = document.getElementById('ov-title');
const ovSub    = document.getElementById('ov-sub');
const resultBx = document.getElementById('result-box');
const resScore = document.getElementById('res-score');
const resBest  = document.getElementById('res-best');
const playBtn  = document.getElementById('play-btn');
const btnLeft  = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');

// ── Canvas size ───────────────────────────
const W = 360;
const H = 520;
canvas.width  = W;
canvas.height = H;

// ── Game constants ────────────────────────
const LANES        = 5;                // number of dodge lanes
const LANE_W       = W / LANES;       // width of each lane
const FROG_Y       = H - 60;          // frog vertical position
const FROG_SIZE    = 32;              // frog emoji font size
const METEOR_MIN_R = 14;
const METEOR_MAX_R = 26;
const INITIAL_SPEED   = 2.8;          // meteor fall speed
const SPEED_INCREMENT = 0.0004;       // speed increase per frame
const SPAWN_INTERVAL  = 75;           // frames between meteor spawns (decreases over time)
const MIN_SPAWN_INT   = 22;

// ── Persistent ────────────────────────────
let best = parseInt(localStorage.getItem('pondPanicBest') || '0');
bestEl.textContent = best;

// ── Game state ────────────────────────────
let frogLane, meteors, particles, score, gameState;
let frameCount, spawnTimer, meteorSpeed, spawnInterval;
let rafId    = null;
let lastTs   = null;
let keys     = {};
let holdLeft = false;
let holdRight= false;
let moveCooldown = 0;   // frames before next key-held move
let prevLane;           // for smooth interpolation
let frogDrawX;          // interpolated frog x

// Stars (static background)
const STARS = Array.from({ length: 55 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H * 0.65,
  r: 0.5 + Math.random() * 1.5,
  twinkle: Math.random() * Math.PI * 2,
}));

// Pond ripples (animated background)
const RIPPLES = Array.from({ length: 4 }, (_, i) => ({
  x: 40 + (i * (W - 80) / 3),
  y: FROG_Y + 55 + Math.random() * 20,
  phase: Math.random() * Math.PI * 2,
}));

// ── Init ──────────────────────────────────
function initGame() {
  frogLane     = Math.floor(LANES / 2);
  prevLane     = frogLane;
  frogDrawX    = laneCenterX(frogLane);
  meteors      = [];
  particles    = [];
  score        = 0;
  frameCount   = 0;
  spawnTimer   = 0;
  meteorSpeed  = INITIAL_SPEED;
  spawnInterval= SPAWN_INTERVAL;
  gameState    = 'playing';
  moveCooldown = 0;
  scoreEl.textContent = '0';
}

function laneCenterX(lane) {
  return lane * LANE_W + LANE_W / 2;
}

// ── Input ─────────────────────────────────
document.addEventListener('keydown', e => {
  if (!keys[e.key]) {
    // Fresh press — move immediately
    if (e.key === 'ArrowLeft'  || e.key === 'a') { moveLeft();  }
    if (e.key === 'ArrowRight' || e.key === 'd') { moveRight(); }
  }
  keys[e.key] = true;
  if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) e.preventDefault();
  if (gameState === 'dead' || gameState === 'idle') { startGame(); return; }
});

document.addEventListener('keyup', e => { keys[e.key] = false; });

btnLeft.addEventListener('pointerdown',  e => { e.preventDefault(); if (gameState !== 'playing') { startGame(); return; } moveLeft(); });
btnRight.addEventListener('pointerdown', e => { e.preventDefault(); if (gameState !== 'playing') { startGame(); return; } moveRight(); });

playBtn.addEventListener('click', startGame);

function moveLeft() {
  if (gameState !== 'playing') return;
  if (frogLane > 0) { prevLane = frogLane; frogLane--; }
}

function moveRight() {
  if (gameState !== 'playing') return;
  if (frogLane < LANES - 1) { prevLane = frogLane; frogLane++; }
}

// ── Update ────────────────────────────────
function update(dt) {
  if (gameState !== 'playing') return;

  frameCount++;
  meteorSpeed   += SPEED_INCREMENT;
  spawnInterval  = Math.max(MIN_SPAWN_INT, SPAWN_INTERVAL - Math.floor(frameCount / 200));

  // No hold-repeat — each button/key tap moves exactly one lane

  // Smooth frog draw position
  const targetX = laneCenterX(frogLane);
  frogDrawX += (targetX - frogDrawX) * 0.35;

  // Score increases with time survived
  score = Math.floor(frameCount / 6);
  scoreEl.textContent = score;

  // Spawn meteors
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnMeteor();
  }

  // Update meteors
  for (let i = meteors.length - 1; i >= 0; i--) {
    const m = meteors[i];
    m.y    += meteorSpeed + m.extraSpeed;
    m.rot  += m.rotSpeed;

    // Check collision with frog
    const fx = frogDrawX;
    const fy = FROG_Y;
    const dx = fx - m.x;
    const dy = fy - m.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < m.r + 16) {
      spawnDeathBurst(fx, fy);
      die();
      return;
    }

    // Off screen
    if (m.y - m.r > H) {
      meteors.splice(i, 1);
    }
  }

  // Update particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x   += p.vx * dt;
    p.y   += p.vy * dt;
    p.vy  += 380 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function spawnMeteor() {
  // Pick a random lane (avoid spawning too many in same lane in a row)
  const lane = Math.floor(Math.random() * LANES);
  const r    = METEOR_MIN_R + Math.random() * (METEOR_MAX_R - METEOR_MIN_R);
  meteors.push({
    x:         lane * LANE_W + LANE_W / 2 + (Math.random() - 0.5) * LANE_W * 0.5,
    y:         -r,
    r,
    extraSpeed: Math.random() * 1.5,
    rot:       Math.random() * Math.PI * 2,
    rotSpeed:  (Math.random() - 0.5) * 0.12,
    // Meteor colour varies
    color:     ['#b45309','#92400e','#78350f','#c2410c','#a16207'][Math.floor(Math.random() * 5)],
    craters:   Math.floor(2 + Math.random() * 3),
    trail:     [],
  });
}

// ── Die ───────────────────────────────────
function die() {
  gameState = 'dead';

  if (score > best) {
    best = score;
    localStorage.setItem('pondPanicBest', best);
    bestEl.textContent = best;
  }

  setTimeout(() => {
    if (gameState !== 'dead') return;
    ovEmoji.textContent  = score > 60 ? '🏆' : score > 30 ? '😤' : '💀';
    ovTitle.textContent  = score > 60 ? 'Pond Legend!' : score > 30 ? 'Nice Dodging!' : 'Splat!';
    ovSub.textContent    = 'The meteorites got your frog!';
    resScore.textContent = '☄️ Survived: ' + score + ' pts';
    resBest.textContent  = 'Best: ' + best;
    resultBx.style.display = 'flex';
    playBtn.textContent  = '🐸 Try Again!';
    overlay.style.display = 'flex';
  }, 700);
}

// ── Particles ─────────────────────────────
function spawnDeathBurst(cx, cy) {
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const spd   = 80 + Math.random() * 160;
    particles.push({
      x: cx, y: cy,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 60,
      life: 0.8 + Math.random() * 0.4,
      maxLife: 1.2,
      r: 4 + Math.random() * 6,
      color: ['#52b788','#74c69d','#ffd166','#ef4444','#d8f3dc'][Math.floor(Math.random() * 5)],
    });
  }
}

function spawnMeteorTrail(m) {
  if (Math.random() > 0.4) return;
  particles.push({
    x: m.x + (Math.random() - 0.5) * m.r,
    y: m.y - m.r * 0.5,
    vx: (Math.random() - 0.5) * 30,
    vy: -20 - Math.random() * 40,
    life: 0.3 + Math.random() * 0.2,
    maxLife: 0.5,
    r: 2 + Math.random() * 3,
    color: Math.random() > 0.5 ? '#fbbf24' : '#f97316',
  });
}

// ── Draw ──────────────────────────────────
let gt = 0; // game time for animations

function drawBg() {
  // Night sky gradient
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  sky.addColorStop(0, '#05080d');
  sky.addColorStop(1, '#0a1a10');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  // Stars
  for (const s of STARS) {
    const tw = 0.5 + 0.5 * Math.sin(gt * 2 + s.twinkle);
    ctx.globalAlpha = tw * 0.9;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Pond (bottom area)
  const pond = ctx.createLinearGradient(0, FROG_Y + 20, 0, H);
  pond.addColorStop(0, '#0d4a2a');
  pond.addColorStop(1, '#073018');
  ctx.fillStyle = pond;
  ctx.fillRect(0, FROG_Y + 20, W, H - FROG_Y - 20);

  // Pond water shimmer lines
  ctx.strokeStyle = 'rgba(82,183,136,0.12)';
  ctx.lineWidth = 1;
  for (let y = FROG_Y + 30; y < H; y += 14) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // Ripples
  for (const rp of RIPPLES) {
    const sz = 18 + Math.sin(gt * 1.8 + rp.phase) * 6;
    ctx.strokeStyle = 'rgba(82,183,136,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(rp.x, rp.y, sz, sz * 0.3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Lily pads (decorative)
  const pads = [
    { x: 40,  y: FROG_Y + 45, r: 18 },
    { x: 300, y: FROG_Y + 50, r: 14 },
    { x: 180, y: FROG_Y + 70, r: 16 },
  ];
  for (const p of pads) {
    ctx.fillStyle = '#1b4332';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0.25, Math.PI * 2 - 0.25);
    ctx.fill();
    ctx.fillStyle = '#2d6a4f';
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r - 3, 0.25, Math.PI * 2 - 0.25);
    ctx.fill();
  }

  // Ground line
  ctx.strokeStyle = '#52b788';
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(0, FROG_Y + 22);
  ctx.lineTo(W, FROG_Y + 22);
  ctx.stroke();
  ctx.setLineDash([]);

  // Lane dividers (faint)
  ctx.strokeStyle = 'rgba(82,183,136,0.07)';
  ctx.lineWidth = 1;
  for (let i = 1; i < LANES; i++) {
    ctx.beginPath();
    ctx.moveTo(i * LANE_W, 0);
    ctx.lineTo(i * LANE_W, FROG_Y + 22);
    ctx.stroke();
  }
}

function drawMeteors() {
  for (const m of meteors) {
    // Trail particles
    spawnMeteorTrail(m);

    ctx.save();
    ctx.translate(m.x, m.y);
    ctx.rotate(m.rot);

    // Shadow glow
    const grd = ctx.createRadialGradient(0, 0, m.r * 0.3, 0, 0, m.r * 2.2);
    grd.addColorStop(0, 'rgba(251,146,60,0.45)');
    grd.addColorStop(1, 'rgba(251,146,60,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, m.r * 2.2, 0, Math.PI * 2);
    ctx.fill();

    // Rock body
    ctx.fillStyle = m.color;
    ctx.beginPath();
    // Slightly irregular circle via bezier approximation
    const n = 8;
    for (let i = 0; i < n; i++) {
      const angle = (i / n) * Math.PI * 2;
      const jitter = m.r * (0.85 + 0.15 * Math.sin(i * 2.3 + m.rot));
      const x = Math.cos(angle) * jitter;
      const y = Math.sin(angle) * jitter;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Rock highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath();
    ctx.ellipse(-m.r * 0.28, -m.r * 0.32, m.r * 0.35, m.r * 0.22, -0.5, 0, Math.PI * 2);
    ctx.fill();

    // Craters
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    for (let i = 0; i < m.craters; i++) {
      const ca = (i / m.craters) * Math.PI * 2 + 0.5;
      const cr = m.r * 0.18;
      const cx = Math.cos(ca) * m.r * 0.45;
      const cy = Math.sin(ca) * m.r * 0.45;
      ctx.beginPath();
      ctx.arc(cx, cy, cr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Fire tail
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, -m.r);
    ctx.quadraticCurveTo(m.r * 0.3, -m.r * 1.8, 0, -m.r * 2.6);
    ctx.stroke();
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-m.r*0.15, -m.r);
    ctx.quadraticCurveTo(m.r*0.2, -m.r*1.5, m.r*0.1, -m.r*2.1);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

function drawFrog() {
  if (gameState === 'dead') return;

  const cx = frogDrawX;
  const cy = FROG_Y;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 18, 18, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Draw frog as emoji, large and clear
  ctx.font = `${FROG_SIZE}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐸', cx, cy);

  // Danger indicator: red glow if a meteor is close
  let closeDist = Infinity;
  for (const m of meteors) {
    const dx = cx - m.x, dy = cy - m.y;
    closeDist = Math.min(closeDist, Math.sqrt(dx*dx + dy*dy));
  }
  if (closeDist < 80) {
    const alpha = (1 - closeDist / 80) * 0.6;
    ctx.strokeStyle = `rgba(239,68,68,${alpha})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawLaneHighlight() {
  // Subtle highlight on current frog lane
  if (gameState !== 'playing') return;
  ctx.fillStyle = 'rgba(82,183,136,0.05)';
  ctx.fillRect(frogLane * LANE_W, 0, LANE_W, FROG_Y + 22);
}

function drawSpeedBar() {
  // Show speed / danger level as a top bar
  if (gameState !== 'playing') return;
  const danger = Math.min(1, (meteorSpeed - INITIAL_SPEED) / 4);
  const barW   = W * danger;
  const color  = danger < 0.5
    ? `rgba(82,183,136,0.6)`
    : danger < 0.8
      ? `rgba(251,191,36,0.7)`
      : `rgba(239,68,68,0.75)`;

  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, 0, W, 4);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, barW, 4);
}

// ── Main loop ─────────────────────────────
function loop(ts) {
  if (!lastTs) lastTs = ts;
  const dt = Math.min((ts - lastTs) / 1000, 0.05);
  lastTs = ts;
  gt    += dt;

  // Particle update (runs even when dead for death burst)
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x   += p.vx * dt;
    p.y   += p.vy * dt;
    p.vy  += 380 * dt;
    p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }

  update(dt);

  // Draw
  drawBg();
  drawLaneHighlight();
  drawSpeedBar();
  drawMeteors();
  drawFrog();
  drawParticles();

  rafId = requestAnimationFrame(loop);
}

// ── Start / Boot ──────────────────────────
function startGame() {
  initGame();
  resultBx.style.display = 'none';
  overlay.style.display  = 'none';
}

function boot() {
  // Init so objects exist before first frame
  frogLane  = Math.floor(LANES / 2);
  prevLane  = frogLane;
  frogDrawX = laneCenterX(frogLane);
  meteors   = [];
  particles = [];
  gameState = 'idle';
  gt        = 0;
  lastTs    = null;

  ovEmoji.textContent   = '🐸';
  ovTitle.textContent   = 'Pond Panic!';
  ovSub.textContent     = 'Dodge the falling meteorites!\nDon\'t get squished!';
  resultBx.style.display = 'none';
  playBtn.textContent   = '🐸 Start Dodging!';
  overlay.style.display = 'flex';

  rafId = requestAnimationFrame(loop);
}

boot();