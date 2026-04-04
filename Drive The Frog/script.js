'use strict';

// ── ELEMENTS ──────────────────────────────────────────────
const canvas      = document.getElementById('gameCanvas');
const ctx         = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const overScreen  = document.getElementById('overScreen');
const hud         = document.getElementById('hud');
const hudScore    = document.getElementById('hudScore');
const hudLives    = document.getElementById('hudLives');
const shieldBar   = document.getElementById('shieldBar');
const shieldFill  = document.getElementById('shieldFill');
const overScore   = document.getElementById('overScore');
const overBest    = document.getElementById('overBest');
const newBest     = document.getElementById('newBest');
const startBest   = document.getElementById('startBest');
const comboToast  = document.getElementById('comboToast');

document.getElementById('startBtn').addEventListener('click',  startGame);
document.getElementById('retryBtn').addEventListener('click',  startGame);

// ── CONSTANTS ─────────────────────────────────────────────
const LANE_COUNT  = 3;
const BASE_SPEED  = 4;
const FROG_W      = 52;
const FROG_H      = 52;
const OBS_W       = 46;
const OBS_H       = 46;
const SHIELD_DUR  = 8; // seconds

// ── STATE ─────────────────────────────────────────────────
let W, H, laneX, playerY;
let lane, vx, score, lives, gameRunning, animId;
let obstacles, powerups, particles, roadLines;
let shieldActive, shieldTimer;
let dodgeStreak, lastDodgeScore;
let spawnTimer, spawnInterval;
let bestScore = parseInt(localStorage.getItem('frogDriveBest') || '0');
startBest.textContent = `Best: ${bestScore}`;

// ── INPUT ─────────────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (!gameRunning) return;
  if (e.code === 'ArrowLeft'  || e.code === 'KeyA') moveLane(-1);
  if (e.code === 'ArrowRight' || e.code === 'KeyD') moveLane(1);
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

let touchStartX = 0, touchStartY = 0, touchHandled = false;
document.addEventListener('touchstart',  e => {
  touchStartX = e.changedTouches[0].clientX;
  touchStartY = e.changedTouches[0].clientY;
  touchHandled = false;
}, { passive: true });
document.addEventListener('touchend', e => {
  if (!gameRunning || touchHandled) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = Math.abs(e.changedTouches[0].clientY - touchStartY);
  if (Math.abs(dx) > 30 && dy < Math.abs(dx)) {
    moveLane(dx > 0 ? 1 : -1);
    touchHandled = true;
  }
}, { passive: true });

function moveLane(dir) {
  const next = lane + dir;
  if (next < 0 || next >= LANE_COUNT) return;
  lane = next;
  vx   = dir * 18; // little inertia kick
}

// ── RESIZE ────────────────────────────────────────────────
function resize() {
  W = canvas.width  = window.innerWidth;
  H = canvas.height = window.innerHeight;
  // Clamp game width to phone-like column
  const roadW = Math.min(W, 340);
  const roadX = (W - roadW) / 2;
  const laneW = roadW / LANE_COUNT;
  laneX = Array.from({ length: LANE_COUNT }, (_, i) => roadX + laneW * i + laneW / 2);
  playerY = H - 130;
}
window.addEventListener('resize', resize);
resize();

// ── ROAD LINES INIT ───────────────────────────────────────
function initRoadLines() {
  roadLines = [];
  for (let i = 0; i < 12; i++) {
    roadLines.push({ y: (H / 12) * i });
  }
}

// ── START GAME ────────────────────────────────────────────
function startGame() {
  showScreen(null);
  hud.classList.remove('hidden');

  lane         = 1;
  vx           = 0;
  score        = 0;
  lives        = 3;
  obstacles    = [];
  powerups     = [];
  particles    = [];
  shieldActive = false;
  shieldTimer  = 0;
  dodgeStreak  = 0;
  lastDodgeScore = -1;
  spawnTimer   = 0;
  spawnInterval = 90; // frames
  gameRunning  = true;
  shieldBar.style.display = 'none';

  initRoadLines();
  updateHUD();

  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ── MAIN LOOP ─────────────────────────────────────────────
function loop() {
  if (!gameRunning) return;
  update();
  draw();
  animId = requestAnimationFrame(loop);
}

// ── UPDATE ────────────────────────────────────────────────
function update() {
  score++;
  const speed = BASE_SPEED + score / 600;

  // Smooth player x toward target lane
  const targetX = laneX[lane];
  const playerX = getPlayerX();
  vx += (targetX - playerX) * 0.22;
  vx *= 0.72;
  setPlayerX(playerX + vx);

  // Road lines
  roadLines.forEach(l => {
    l.y += speed * 1.4;
    if (l.y > H + 20) l.y -= H + 20;
  });

  // Spawn
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInterval = Math.max(28, 90 - score / 180);
    spawnObstacle(speed);
    if (score > 300 && Math.random() < 0.12) spawnPowerup();
  }

  // Obstacles
  obstacles = obstacles.filter(o => {
    o.y += speed + o.speedBoost;
    // Dodge streak — check if we passed it
    if (!o.counted && o.y > playerY + FROG_H) {
      o.counted = true;
      dodgeStreak++;
      if (dodgeStreak >= 3 && dodgeStreak !== lastDodgeScore) {
        lastDodgeScore = dodgeStreak;
        showCombo(`${dodgeStreak}x DODGE!`);
      }
    }
    // Collision
    if (!shieldActive && rectsOverlap(getPlayerX(), playerY, FROG_W, FROG_H, o.x - OBS_W/2, o.y - OBS_H/2, OBS_W, OBS_H)) {
      hitPlayer(o.x, o.y);
      return false;
    }
    return o.y < H + 60;
  });

  // Powerups
  powerups = powerups.filter(p => {
    p.y += speed;
    p.pulse += 0.1;
    if (rectsOverlap(getPlayerX(), playerY, FROG_W, FROG_H, p.x - 20, p.y - 20, 40, 40)) {
      activateShield();
      spawnBurst(p.x, p.y, '#00f5ff', 14);
      return false;
    }
    return p.y < H + 60;
  });

  // Shield
  if (shieldActive) {
    shieldTimer -= 1/60;
    if (shieldTimer <= 0) {
      shieldActive = false;
      shieldBar.style.display = 'none';
    } else {
      shieldFill.style.width = (shieldTimer / SHIELD_DUR * 100) + '%';
    }
  }

  // Particles
  particles = particles.filter(p => {
    p.x  += p.vx;
    p.y  += p.vy;
    p.vy += 0.18;
    p.life -= p.decay;
    return p.life > 0;
  });

  updateHUD();
}

// ── PLAYER X HELPERS (stored in a single variable) ────────
let _playerX = 0;
function getPlayerX() { return _playerX || laneX[1] - FROG_W/2; }
function setPlayerX(x) { _playerX = x; }

// ── SPAWN ─────────────────────────────────────────────────
function spawnObstacle(speed) {
  const spawnLane = Math.floor(Math.random() * LANE_COUNT);
  obstacles.push({
    x: laneX[spawnLane],
    y: -OBS_H,
    lane: spawnLane,
    counted: false,
    speedBoost: Math.random() * 1.5,
    wobble: Math.random() * Math.PI * 2,
  });
}

function spawnPowerup() {
  const spawnLane = Math.floor(Math.random() * LANE_COUNT);
  powerups.push({ x: laneX[spawnLane], y: -20, pulse: 0 });
}

function activateShield() {
  shieldActive  = true;
  shieldTimer   = SHIELD_DUR;
  dodgeStreak   = 0;
  shieldBar.style.display = 'flex';
  shieldFill.style.width  = '100%';
}

// ── HIT PLAYER ────────────────────────────────────────────
function hitPlayer(ox, oy) {
  lives--;
  dodgeStreak = 0;
  spawnBurst(getPlayerX() + FROG_W/2, playerY + FROG_H/2, '#ff2d78', 18);
  document.body.classList.remove('shake');
  void document.body.offsetWidth;
  document.body.classList.add('shake');

  if (lives <= 0) {
    endGame();
  }
  updateHUD();
}

// ── END GAME ──────────────────────────────────────────────
function endGame() {
  gameRunning = false;
  hud.classList.add('hidden');
  const s = Math.floor(score / 10);
  if (s > bestScore) {
    bestScore = s;
    localStorage.setItem('frogDriveBest', bestScore);
    newBest.classList.remove('hidden');
  } else {
    newBest.classList.add('hidden');
  }
  overScore.textContent = s;
  overBest.textContent  = bestScore;
  startBest.textContent = `Best: ${bestScore}`;
  showScreen(overScreen);
}

// ── UPDATE HUD ────────────────────────────────────────────
function updateHUD() {
  hudScore.textContent = Math.floor(score / 10);
  const hearts = '❤️'.repeat(lives) + '🖤'.repeat(Math.max(0, 3 - lives));
  hudLives.textContent = hearts;
}

// ── COLLISION ─────────────────────────────────────────────
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ── PARTICLES ─────────────────────────────────────────────
function spawnBurst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i / n) + Math.random() * 0.4;
    const speed = 2.5 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      life: 1, decay: 0.035 + Math.random() * 0.03,
      r: 4 + Math.random() * 5,
      color,
    });
  }
}

// ── COMBO TOAST ───────────────────────────────────────────
function showCombo(text) {
  comboToast.textContent = text;
  comboToast.classList.remove('pop', 'hidden');
  void comboToast.offsetWidth;
  comboToast.classList.add('pop');
}

// ── DRAW ──────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);
  drawRoad();
  drawRoadLines();
  powerups.forEach(drawPowerup);
  obstacles.forEach(drawObstacle);
  drawPlayer();
  particles.forEach(drawParticle);
  if (shieldActive) drawShieldAura();
}

function drawRoad() {
  const roadW = Math.min(W, 340);
  const roadX = (W - roadW) / 2;

  // Offscreen dark
  ctx.fillStyle = '#060c0a';
  ctx.fillRect(0, 0, W, H);

  // Road
  const roadGrad = ctx.createLinearGradient(roadX, 0, roadX + roadW, 0);
  roadGrad.addColorStop(0,   '#0a0d0b');
  roadGrad.addColorStop(0.5, '#111418');
  roadGrad.addColorStop(1,   '#0a0d0b');
  ctx.fillStyle = roadGrad;
  ctx.fillRect(roadX, 0, roadW, H);

  // Lane dividers
  ctx.strokeStyle = 'rgba(57,255,20,0.12)';
  ctx.lineWidth = 1;
  const laneW = roadW / LANE_COUNT;
  for (let i = 1; i < LANE_COUNT; i++) {
    ctx.beginPath();
    ctx.setLineDash([22, 18]);
    ctx.moveTo(roadX + laneW * i, 0);
    ctx.lineTo(roadX + laneW * i, H);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Road edges — neon glow
  ctx.shadowColor = 'rgba(57,255,20,0.7)';
  ctx.shadowBlur  = 14;
  ctx.strokeStyle = 'rgba(57,255,20,0.5)';
  ctx.lineWidth   = 2;
  ctx.beginPath(); ctx.moveTo(roadX, 0); ctx.lineTo(roadX, H); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(roadX + roadW, 0); ctx.lineTo(roadX + roadW, H); ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawRoadLines() {
  // Speed streaks (background particles moving down)
  const roadW = Math.min(W, 340);
  const roadX = (W - roadW) / 2;
  const speed = BASE_SPEED + score / 600;

  ctx.strokeStyle = 'rgba(57,255,20,0.15)';
  ctx.lineWidth   = 1.5;
  roadLines.forEach(l => {
    const x = roadX + 6 + Math.random() * (roadW - 12);
    ctx.beginPath();
    ctx.moveTo(x, l.y);
    ctx.lineTo(x, l.y + 18 + speed * 3);
    ctx.stroke();
  });
}

function drawObstacle(o) {
  o.wobble += 0.06;
  const x = o.x;
  const y = o.y + Math.sin(o.wobble) * 3;
  const r = OBS_W / 2;

  ctx.save();
  ctx.translate(x, y);

  // Glow
  ctx.shadowColor = 'rgba(255,80,80,0.6)';
  ctx.shadowBlur  = 16;

  // Body
  const bgrad = ctx.createRadialGradient(-r*0.2, -r*0.2, r*0.1, 0, 0, r);
  bgrad.addColorStop(0, '#72e872');
  bgrad.addColorStop(1, '#1e7a1e');
  ctx.fillStyle = bgrad;
  ctx.beginPath();
  ctx.ellipse(0, 4, r * 0.85, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  // Belly
  ctx.fillStyle = '#b5f5a0';
  ctx.beginPath();
  ctx.ellipse(0, 8, r * 0.5, r * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  drawMiniEye(ctx, -r*0.36, -r*0.55, r*0.26);
  drawMiniEye(ctx,  r*0.36, -r*0.55, r*0.26);

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawMiniEye(ctx, ex, ey, er) {
  ctx.fillStyle = '#e8ffe0';
  ctx.beginPath(); ctx.arc(ex, ey, er, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#226622';
  ctx.beginPath(); ctx.arc(ex, ey + er*0.1, er*0.65, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.arc(ex + er*0.1, ey + er*0.15, er*0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'white';
  ctx.beginPath(); ctx.arc(ex + er*0.2, ey, er*0.16, 0, Math.PI * 2); ctx.fill();
}

function drawPlayer() {
  const px = getPlayerX();
  const py = playerY;
  const cx = px + FROG_W / 2;
  const cy = py + FROG_H / 2;
  const r  = FROG_W / 2;

  ctx.save();
  ctx.translate(cx, cy);

  // Shield tint
  if (shieldActive) {
    ctx.shadowColor = '#00f5ff';
    ctx.shadowBlur  = 28;
  }

  // Invisibility flicker
  ctx.globalAlpha = shieldActive ? 0.75 + Math.sin(Date.now() / 80) * 0.2 : 1;

  // Car body — sleek green racer
  // Chassis
  ctx.fillStyle = '#0a3d0a';
  roundRect(ctx, -r*0.7, -r*0.5, r*1.4, r*1.2, 8);
  ctx.fill();

  // Hood
  const carGrad = ctx.createLinearGradient(-r*0.6, -r*0.4, r*0.6, r*0.4);
  carGrad.addColorStop(0, '#4adb4a');
  carGrad.addColorStop(0.5, '#2ea02e');
  carGrad.addColorStop(1, '#1a6b1a');
  ctx.fillStyle = carGrad;
  roundRect(ctx, -r*0.62, -r*0.42, r*1.24, r*1.05, 7);
  ctx.fill();

  // Windshield
  ctx.fillStyle = 'rgba(0,245,255,0.35)';
  roundRect(ctx, -r*0.38, -r*0.3, r*0.76, r*0.42, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,245,255,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Headlights
  ctx.fillStyle = '#ffffa0';
  ctx.shadowColor = '#ffffa0';
  ctx.shadowBlur = 12;
  ctx.beginPath(); ctx.ellipse(-r*0.38, -r*0.42, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( r*0.38, -r*0.42, 5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  // Frog face on hood
  ctx.fillStyle = '#39ff14';
  ctx.font = `${r * 0.7}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐸', 0, r * 0.1);

  // Wheels
  ctx.fillStyle = '#111';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = 6;
  [[-r*0.58, -r*0.28], [r*0.58, -r*0.28], [-r*0.58, r*0.38], [r*0.58, r*0.38]].forEach(([wx, wy]) => {
    ctx.beginPath();
    ctx.ellipse(wx, wy, 7, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.ellipse(wx, wy, 4, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
  });
  ctx.shadowBlur = 0;

  // Taillights
  ctx.fillStyle = '#ff2020';
  ctx.shadowColor = '#ff2020';
  ctx.shadowBlur = 10;
  ctx.beginPath(); ctx.ellipse(-r*0.36, r*0.44, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( r*0.36, r*0.44, 5, 3.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.shadowBlur = 0;

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPowerup(p) {
  const x = p.x, y = p.y;
  const glow = 0.6 + Math.sin(p.pulse) * 0.4;

  ctx.save();
  ctx.translate(x, y);

  ctx.shadowColor = `rgba(0,245,255,${glow})`;
  ctx.shadowBlur  = 18 + glow * 14;

  // Orb
  const grad = ctx.createRadialGradient(-5, -5, 2, 0, 0, 18);
  grad.addColorStop(0, '#a0ffff');
  grad.addColorStop(1, '#0066ff');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 18, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = '18px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛡', 0, 1);

  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawShieldAura() {
  const cx = getPlayerX() + FROG_W / 2;
  const cy = playerY + FROG_H / 2;
  const t  = Date.now() / 600;

  ctx.save();
  ctx.globalAlpha = 0.25 + Math.sin(t * 3) * 0.12;
  ctx.strokeStyle = '#00f5ff';
  ctx.lineWidth   = 3;
  ctx.shadowColor = '#00f5ff';
  ctx.shadowBlur  = 20;
  ctx.beginPath();
  ctx.ellipse(cx, cy, FROG_W * 0.75, FROG_H * 0.75, t, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawParticle(p) {
  ctx.globalAlpha = p.life;
  ctx.fillStyle   = p.color;
  ctx.shadowColor = p.color;
  ctx.shadowBlur  = 8;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── HELPERS ───────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function showScreen(screen) {
  [startScreen, overScreen].forEach(s => s.classList.add('hidden'));
  if (screen) screen.classList.remove('hidden');
}