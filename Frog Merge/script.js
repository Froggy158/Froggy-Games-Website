// ============================================================
//  FROG MERGE DEFENSE - Main Game Script
// ============================================================

// ===== CANVAS SETUP =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===== SIZING =====
let GW, GH; // game width/height in pixels
const GRID_COLS = 7;
const GRID_ROWS = 5;
let CELL, GRID_X, GRID_Y, GRID_W, GRID_H;
let CAVE_Y, CASTLE_Y, CASTLE_H;

function resize() {
  const wrapper = document.getElementById('canvasWrapper');
  const w = wrapper.clientWidth;
  const h = wrapper.clientHeight - 72; // minus bottomHud
  // Keep aspect ratio ~9:16 or adapt
  const aspect = 9 / 16;
  let cw = Math.min(w, h * aspect);
  let ch = cw / aspect;
  if (ch > h) { ch = h; cw = ch * aspect; }
  cw = Math.floor(cw); ch = Math.floor(ch);
  canvas.width = cw; canvas.height = ch;
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';

  GW = cw; GH = ch;
  CELL = Math.floor(Math.min(cw / GRID_COLS, ch * 0.45 / GRID_ROWS));
  GRID_W = CELL * GRID_COLS;
  GRID_H = CELL * GRID_ROWS;
  GRID_X = Math.floor((GW - GRID_W) / 2);
  CAVE_Y = Math.floor(GH * 0.06);
  GRID_Y = Math.floor(GH * 0.18);
  CASTLE_H = Math.floor(GH * 0.14);
  CASTLE_Y = GH - CASTLE_H;
}

// ===== GAME STATE =====
let state = 'start'; // start | playing | gameover
let coins = 50;
let hp = 100;
let maxHp = 100;
let wave = 0;
let score = 0;
let frameCount = 0;
let sellMode = false;

// Screen shake
let shakeX = 0, shakeY = 0, shakeMag = 0;

// ===== GRID =====
// grid[row][col] = Frog | null
let grid = [];
function initGrid() {
  grid = [];
  for (let r = 0; r < GRID_ROWS; r++) {
    grid[r] = [];
    for (let c = 0; c < GRID_COLS; c++) grid[r][c] = null;
  }
}

// ===== FROG DATA =====
// spd = cooldown in seconds between shots (lower = faster)
// range = multiplier of CELL size — boosted so frogs can actually reach enemies
const FROG_LEVELS = [
  { name: 'Tadpole',   color: '#3aff5a', glow: '#00ff44', dmg: 8,  spd: 1.4, range: 5,   cost: 15,  sell: 7 },
  { name: 'Froglet',   color: '#22ee44', glow: '#00dd33', dmg: 18, spd: 1.0, range: 6,   cost: 30,  sell: 15 },
  { name: 'Frog',      color: '#11cc33', glow: '#00bb22', dmg: 35, spd: 0.7, range: 7,   cost: 60,  sell: 30 },
  { name: 'Bull Frog', color: '#00aa22', glow: '#008811', dmg: 70, spd: 0.5, range: 8,   cost: 120, sell: 60 },
  { name: 'MEGA FROG', color: '#00ff88', glow: '#00ffaa', dmg: 150,spd: 0.3, range: 10,  cost: 240, sell: 120 },
];

let frogIdCounter = 0;
class Frog {
  constructor(row, col, level = 0) {
    this.id = frogIdCounter++;
    this.row = row; this.col = col;
    this.level = level;
    this.cooldown = 0;
    this.animAngle = 0; // tongue anim
    this.tongueAnim = 0; // 0..1
    this.mergeAnim = 0;  // scale bounce
    this.targetEnemy = null;
  }
  get data() { return FROG_LEVELS[this.level]; }
  get px() { return GRID_X + this.col * CELL + CELL / 2; }
  get py() { return GRID_Y + this.row * CELL + CELL / 2; }
}

// ===== ENEMIES =====
const ENEMY_TYPES = [
  { name: 'Fly',    color: '#ff6666', glow: '#ff3333', hp: 12,  spd: 0.9, reward: 3,  size: 0.35, flying: false },
  { name: 'Beetle', color: '#cc8833', glow: '#aa6611', hp: 45,  spd: 0.4, reward: 8,  size: 0.55, flying: false },
  { name: 'Moth',   color: '#cc55ff', glow: '#aa22ee', hp: 20,  spd: 0.7, reward: 5,  size: 0.4,  flying: true  },
  { name: 'Hornet', color: '#ffcc00', glow: '#ffaa00', hp: 30,  spd: 1.1, reward: 7,  size: 0.38, flying: true  },
  { name: 'Grub',   color: '#88ff44', glow: '#66dd22', hp: 80,  spd: 0.25,reward: 12, size: 0.65, flying: false },
];

let enemyIdCounter = 0;
let enemies = [];

class Enemy {
  constructor(type, waveNum) {
    const t = ENEMY_TYPES[type];
    this.id = enemyIdCounter++;
    this.type = type;
    this.name = t.name;
    this.color = t.color;
    this.glow = t.glow;
    this.size = t.size;
    this.flying = t.flying;
    this.reward = t.reward;
    this.maxHp = Math.floor(t.hp * (1 + waveNum * 0.18));
    this.hp = this.maxHp;
    this.spd = t.spd * (1 + waveNum * 0.05);
    // spawn at cave, random x
    this.x = GRID_X + Math.random() * GRID_W;
    this.y = CAVE_Y + 10;
    this.hitFlash = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.dead = false;
  }
}

// ===== PROJECTILES =====
let projectiles = [];
class Projectile {
  constructor(fx, fy, enemy, dmg, color) {
    this.x = fx; this.y = fy;
    this.tx = enemy.x; this.ty = enemy.y;
    this.enemy = enemy;
    this.dmg = dmg;
    this.color = color;
    this.spd = 8; // fast fixed speed in pixels/frame
    this.done = false;
    this.len = 0;
  }
}

// ===== PARTICLES =====
let particles = [];
function spawnParticles(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1.5 + Math.random() * 2.5;
    particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, life: 1, color, size: 2 + Math.random() * 2 });
  }
}

// ===== FLOATING TEXT =====
let floatTexts = [];
function spawnText(x, y, text, color) {
  floatTexts.push({ x, y, text, color, life: 1, vy: -1.2 });
}

// ===== WAVE SYSTEM =====
let waveInProgress = false;
let spawnQueue = []; // {type, delay}
let spawnTimer = 0;
let betweenWaveTimer = 0;
const BETWEEN_WAVE_DELAY = 120; // frames (~2s)

function buildWave(n) {
  const q = [];
  const total = 5 + n * 3;
  for (let i = 0; i < total; i++) {
    let type = 0;
    const r = Math.random();
    if (n >= 2 && r < 0.25) type = 1; // beetle
    else if (n >= 3 && r < 0.45) type = 2; // moth
    else if (n >= 4 && r < 0.55) type = 3; // hornet
    else if (n >= 5 && r < 0.20) type = 4; // grub
    q.push({ type, delay: Math.max(20, 55 - n * 2) });
  }
  return q;
}

// ===== DRAG SYSTEM =====
let dragging = null; // { frog, startRow, startCol, curX, curY }
let touchStart = null;

// ===== FROG BUY COST =====
let frogCost = 15;
function updateFrogCost() {
  frogCost = FROG_LEVELS[0].cost + Math.floor(wave * 1.5);
  document.getElementById('frogCost').textContent = frogCost;
}

// ============================================================
//  GAME INIT
// ============================================================
function startGame() {
  document.getElementById('startScreen').style.display = 'none';
  resize();
  resetGame();
  state = 'playing';
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  coins = 50; hp = 100; wave = 0; score = 0; frameCount = 0;
  enemies = []; projectiles = []; particles = []; floatTexts = [];
  sellMode = false;
  initGrid();
  waveInProgress = false;
  betweenWaveTimer = 90;
  spawnQueue = [];
  updateUI();
  updateFrogCost();
}

function restartGame() {
  document.getElementById('gameOverScreen').style.display = 'none';
  resize();
  resetGame();
  state = 'playing';
  requestAnimationFrame(gameLoop);
}

// ============================================================
//  GAME LOOP
// ============================================================
function gameLoop() {
  if (state !== 'playing') return;
  frameCount++;

  updateScreenShake();
  updateWaves();
  updateEnemies();
  updateFrogs();
  updateProjectiles();
  updateParticles();
  updateFloatTexts();

  draw();
  updateUI();

  requestAnimationFrame(gameLoop);
}

// ============================================================
//  UPDATE FUNCTIONS
// ============================================================

function updateScreenShake() {
  if (shakeMag > 0.1) {
    shakeX = (Math.random() - 0.5) * shakeMag;
    shakeY = (Math.random() - 0.5) * shakeMag;
    shakeMag *= 0.82;
  } else { shakeX = 0; shakeY = 0; shakeMag = 0; }
}

function updateWaves() {
  if (!waveInProgress) {
    betweenWaveTimer--;
    if (betweenWaveTimer <= 0) {
      wave++;
      showWaveAnnounce('⚠ WAVE ' + wave + ' !');
      spawnQueue = buildWave(wave);
      waveInProgress = true;
      spawnTimer = 30;
      updateFrogCost();
    }
  } else {
    if (spawnQueue.length > 0) {
      spawnTimer--;
      if (spawnTimer <= 0) {
        const s = spawnQueue.shift();
        enemies.push(new Enemy(s.type, wave));
        spawnTimer = s.delay;
      }
    } else if (enemies.length === 0) {
      // wave cleared
      waveInProgress = false;
      betweenWaveTimer = BETWEEN_WAVE_DELAY;
      const bonus = wave * 5;
      coins += bonus;
      spawnText(GW / 2, GH * 0.4, '+' + bonus + '🪙 WAVE CLEAR!', '#ffd700');
    }
  }
}

function updateEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    e.wobble += 0.08;
    e.y += e.spd;
    if (e.hitFlash > 0) e.hitFlash -= 0.08;
    // Reached castle
    if (e.y >= CASTLE_Y) {
      e.dead = true;
      hp -= (e.flying ? 5 : 8);
      hp = Math.max(0, hp);
      shakeMag = 8;
      spawnParticles(e.x, CASTLE_Y, '#ff4444', 10);
      spawnText(e.x, CASTLE_Y - 20, '-' + (e.flying ? 5 : 8) + 'HP', '#ff4444');
      if (hp <= 0) gameOver();
    }
  }
  enemies = enemies.filter(e => !e.dead);
}

function updateFrogs() {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const frog = grid[r][c];
      if (!frog) continue;
      if (frog.mergeAnim > 0) frog.mergeAnim -= 0.07;
      if (frog.tongueAnim > 0) frog.tongueAnim -= 0.06;
      if (frog.cooldown > 0) { frog.cooldown -= 0.016; continue; }

      // Find target in range
      const rangePixels = frog.data.range * CELL;
      let best = null, bestDist = Infinity;
      for (const e of enemies) {
        if (e.dead) continue;
        if (e.flying && frog.level < 2) continue; // low level frogs can't hit flying
        const dx = e.x - frog.px, dy = e.y - frog.py;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < rangePixels && d < bestDist) { best = e; bestDist = d; }
      }
      if (best) {
        frog.tongueAnim = 1;
        frog.cooldown = frog.data.spd;
        projectiles.push(new Projectile(frog.px, frog.py, best, frog.data.dmg, frog.data.glow));
        playSound('shoot');
      }
    }
  }
}

function updateProjectiles() {
  for (const p of projectiles) {
    if (p.done) continue;
    if (p.enemy.dead) { p.done = true; continue; }
    // Update target
    p.tx = p.enemy.x; p.ty = p.enemy.y;
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < p.spd + 4) {
      // Hit!
      p.enemy.hp -= p.dmg;
      p.enemy.hitFlash = 1;
      p.done = true;
      spawnParticles(p.enemy.x, p.enemy.y, p.enemy.color, 4);
      if (p.enemy.hp <= 0) {
        p.enemy.dead = true;
        coins += p.enemy.reward;
        score += p.enemy.reward;
        spawnParticles(p.enemy.x, p.enemy.y, p.enemy.glow, 8);
        spawnText(p.enemy.x, p.enemy.y - 10, '+' + p.enemy.reward + '🪙', '#ffd700');
        playSound('kill');
      }
    } else {
      p.x += (dx / d) * p.spd;
      p.y += (dy / d) * p.spd;
    }
  }
  projectiles = projectiles.filter(p => !p.done);
}

function updateParticles() {
  for (const p of particles) {
    p.x += p.vx; p.y += p.vy;
    p.vy += 0.05;
    p.life -= 0.04;
  }
  particles = particles.filter(p => p.life > 0);
}

function updateFloatTexts() {
  for (const t of floatTexts) {
    t.y += t.vy;
    t.life -= 0.022;
  }
  floatTexts = floatTexts.filter(t => t.life > 0);
}

// ============================================================
//  DRAWING
// ============================================================
function draw() {
  ctx.clearRect(0, 0, GW, GH);

  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground();
  drawCave();
  drawGrid();
  drawFrogs();
  drawEnemies();
  drawProjectiles();
  drawParticles();
  drawFloatTexts();
  drawCastle();
  drawDragging();

  ctx.restore();
}

function drawBackground() {
  // Dark swamp gradient
  const bg = ctx.createLinearGradient(0, 0, 0, GH);
  bg.addColorStop(0, '#050d05');
  bg.addColorStop(0.5, '#0a160a');
  bg.addColorStop(1, '#061006');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, GW, GH);

  // Subtle scanlines
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let y = 0; y < GH; y += 4) ctx.fillRect(0, y, GW, 2);

  // Random pixel stars
  ctx.fillStyle = '#1a3a1a';
  const seed = Math.floor(frameCount / 60);
  for (let i = 0; i < 30; i++) {
    const sx = ((i * 137 + seed * 7) % GW);
    const sy = ((i * 97 + seed * 3) % (GRID_Y - CAVE_Y - 20)) + CAVE_Y + 10;
    ctx.fillRect(Math.floor(sx), Math.floor(sy), 2, 2);
  }
}

function drawCave() {
  const cx = GW / 2;
  const cy = CAVE_Y;
  const cw = Math.floor(GW * 0.42);
  const ch = Math.floor(GH * 0.1);

  // Cave body
  ctx.save();
  ctx.shadowColor = '#ff3300';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#1a0500';
  roundRect(ctx, cx - cw / 2, cy, cw, ch, 8);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Cave arch
  ctx.fillStyle = '#0d0300';
  ctx.beginPath();
  ctx.arc(cx, cy + ch, cw * 0.38, Math.PI, 0, false);
  ctx.fill();

  // Entrance glow
  const grd = ctx.createRadialGradient(cx, cy + ch, 0, cx, cy + ch, cw * 0.38);
  grd.addColorStop(0, 'rgba(255,60,0,0.25)');
  grd.addColorStop(1, 'rgba(255,60,0,0)');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(cx, cy + ch, cw * 0.38, Math.PI, 0, false);
  ctx.fill();

  // Label
  ctx.fillStyle = '#ff6633';
  ctx.shadowColor = '#ff3300'; ctx.shadowBlur = 8;
  ctx.font = `bold ${Math.floor(CELL * 0.45)}px 'Courier New'`;
  ctx.textAlign = 'center';
  ctx.fillText('👾 ENEMY CAVE', cx, cy + ch * 0.6);
  ctx.restore();
}

function drawGrid() {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const x = GRID_X + c * CELL;
      const y = GRID_Y + r * CELL;
      // Cell bg
      ctx.fillStyle = grid[r][c] ? 'rgba(0,40,0,0.5)' : 'rgba(0,25,0,0.4)';
      ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
      // Border
      ctx.strokeStyle = grid[r][c] ? '#1a5a1a' : '#0d2a0d';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);

      // Highlight if dragging over
      if (dragging) {
        const gc = screenToGrid(dragging.curX, dragging.curY);
        if (gc && gc.row === r && gc.col === c && !(gc.row === dragging.startRow && gc.col === dragging.startCol)) {
          const canMerge = grid[r][c] && grid[r][c].level === dragging.frog.level;
          ctx.fillStyle = canMerge ? 'rgba(0,255,100,0.18)' : 'rgba(255,50,50,0.12)';
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
          ctx.strokeStyle = canMerge ? '#00ff44' : '#ff4444';
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        }
      }
    }
  }
}

function drawFrogs() {
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const frog = grid[r][c];
      if (!frog) continue;
      if (dragging && dragging.frog === frog) continue; // draw separately
      drawFrog(frog, frog.px, frog.py, false);
    }
  }
}

function drawFrog(frog, x, y, isGhost) {
  const d = frog.data;
  const r = CELL * 0.38;
  const bounce = frog.mergeAnim > 0 ? 1 + Math.sin(frog.mergeAnim * Math.PI) * 0.3 : 1;
  const alpha = isGhost ? 0.65 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(bounce, bounce);

  // Glow
  ctx.shadowColor = d.glow;
  ctx.shadowBlur = 12 + (frog.level * 3);

  // Body
  ctx.fillStyle = d.color;
  ctx.beginPath();
  ctx.ellipse(0, 0, r, r * 0.8, 0, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.45, r * 0.22, 0, Math.PI * 2);
  ctx.arc(r * 0.35, -r * 0.45, r * 0.22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.45, r * 0.11, 0, Math.PI * 2);
  ctx.arc(r * 0.35, -r * 0.45, r * 0.11, 0, Math.PI * 2);
  ctx.fill();

  // Pupils glow for high-level
  if (frog.level >= 3) {
    ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffff00';
    ctx.beginPath();
    ctx.arc(-r * 0.35, -r * 0.45, r * 0.07, 0, Math.PI * 2);
    ctx.arc(r * 0.35, -r * 0.45, r * 0.07, 0, Math.PI * 2);
    ctx.fill();
  }

  // Smile
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#003300';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, r * 0.1, r * 0.25, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Level dots
  for (let i = 0; i <= frog.level; i++) {
    const dx = (i - frog.level / 2) * (r * 0.28);
    ctx.fillStyle = '#ffff00';
    ctx.shadowColor = '#ffff00'; ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(dx, r * 0.62, r * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }

  // Tongue animation
  if (frog.tongueAnim > 0.1) {
    const tLen = r * 2.5 * frog.tongueAnim;
    ctx.shadowColor = '#ff3333'; ctx.shadowBlur = 6;
    ctx.strokeStyle = '#ff4444';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, r * 0.1);
    ctx.lineTo(0, -tLen);
    ctx.stroke();
  }

  // Level badge for level >= 2
  if (frog.level >= 2) {
    ctx.shadowColor = '#ffdd44'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffdd44';
    ctx.font = `bold ${Math.floor(r * 0.55)}px 'Courier New'`;
    ctx.textAlign = 'center';
    ctx.fillText('L' + (frog.level + 1), 0, -r * 0.85);
  }

  ctx.restore();
}

function drawEnemies() {
  for (const e of enemies) {
    if (e.dead) continue;
    drawEnemy(e);
  }
}

function drawEnemy(e) {
  const r = CELL * e.size * 0.5;
  const wobX = Math.sin(e.wobble * 2.5) * 2;
  const wobY = e.flying ? Math.sin(e.wobble * 1.8) * 3 : 0;
  const x = e.x + wobX;
  const y = e.y + wobY;

  ctx.save();
  ctx.translate(x, y);

  const flash = Math.max(0, e.hitFlash);
  ctx.globalAlpha = 0.92;

  ctx.shadowColor = e.glow;
  ctx.shadowBlur = 10 + flash * 20;

  // Body
  ctx.fillStyle = flash > 0.5 ? '#ffffff' : e.color;
  ctx.beginPath();

  if (e.type === 1) { // Beetle - ellipse
    ctx.ellipse(0, 0, r * 1.1, r * 0.8, 0, 0, Math.PI * 2);
  } else if (e.type === 2 || e.type === 3) { // Flying - diamond
    ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0);
    ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0);
    ctx.closePath();
  } else { // Default circle
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.fill();

  // Wings for flying
  if (e.flying) {
    ctx.shadowBlur = 0;
    const wingFlap = Math.sin(e.wobble * 8) * 0.4;
    ctx.globalAlpha = 0.45;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.ellipse(-r * 1.2, -r * 0.2 + wingFlap * r, r * 0.8, r * 0.35, -0.4, 0, Math.PI * 2);
    ctx.ellipse(r * 1.2, -r * 0.2 - wingFlap * r, r * 0.8, r * 0.35, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.92;
  }

  // Eyes
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ff0000';
  ctx.beginPath();
  ctx.arc(-r * 0.28, -r * 0.3, r * 0.18, 0, Math.PI * 2);
  ctx.arc(r * 0.28, -r * 0.3, r * 0.18, 0, Math.PI * 2);
  ctx.fill();

  // HP bar
  const barW = r * 2.2;
  const barH = 4;
  const barX = -barW / 2;
  const barY = r + 4;
  ctx.fillStyle = '#330000';
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = e.hp / e.maxHp > 0.5 ? '#00ff44' : e.hp / e.maxHp > 0.25 ? '#ffdd00' : '#ff3300';
  ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);

  ctx.restore();
}

function drawProjectiles() {
  for (const p of projectiles) {
    if (p.done) continue;
    ctx.save();
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    // Draw trailing tongue line
    const dx = p.tx - p.x, dy = p.ty - p.y;
    const d = Math.sqrt(dx*dx+dy*dy);
    const trailLen = Math.min(16, d);
    ctx.lineTo(p.x - (dx/d)*trailLen, p.y - (dy/d)*trailLen);
    ctx.stroke();
    // Tip
    ctx.fillStyle = '#ff6666';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life * 0.9;
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 4;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    ctx.restore();
  }
}

function drawFloatTexts() {
  for (const t of floatTexts) {
    ctx.save();
    ctx.globalAlpha = t.life;
    ctx.fillStyle = t.color;
    ctx.shadowColor = t.color; ctx.shadowBlur = 6;
    ctx.font = `bold ${Math.floor(CELL * 0.42)}px 'Courier New'`;
    ctx.textAlign = 'center';
    ctx.fillText(t.text, t.x, t.y);
    ctx.restore();
  }
}

function drawCastle() {
  const cx = GW / 2;
  const cw = Math.floor(GW * 0.72);
  const x = cx - cw / 2;
  const y = CASTLE_Y;
  const h = CASTLE_H;

  ctx.save();
  // Castle glow
  const hpRatio = hp / maxHp;
  const castleColor = hpRatio > 0.5 ? '#00aa44' : hpRatio > 0.25 ? '#aaaa00' : '#aa2200';
  ctx.shadowColor = castleColor; ctx.shadowBlur = 20;

  // Battlements
  const merlonW = Math.floor(cw / 10);
  const merlonH = Math.floor(h * 0.28);
  for (let i = 0; i < 5; i++) {
    const mx = x + cw * 0.05 + i * (cw * 0.22);
    ctx.fillStyle = '#0a2a0a';
    ctx.fillRect(mx, y, merlonW * 1.8, merlonH);
  }

  // Main wall
  ctx.fillStyle = '#0d1f0d';
  ctx.fillRect(x, y + merlonH, cw, h - merlonH);

  // Gate
  ctx.fillStyle = '#050d05';
  const gw = cw * 0.18, gh = h * 0.55;
  const gx = cx - gw / 2, gy = y + merlonH + (h - merlonH - gh);
  ctx.fillRect(gx, gy, gw, gh);
  ctx.beginPath();
  ctx.arc(cx, gy, gw / 2, Math.PI, 0, false);
  ctx.fill();

  // Gate glow
  const gl = ctx.createRadialGradient(cx, gy + gh / 2, 0, cx, gy + gh / 2, gw);
  gl.addColorStop(0, 'rgba(0,200,80,0.3)');
  gl.addColorStop(1, 'rgba(0,200,80,0)');
  ctx.fillStyle = gl;
  ctx.fillRect(gx - 4, gy - 4, gw + 8, gh + 8);

  // HP bar
  const bw = cw * 0.85, bh = 6;
  const bx = cx - bw / 2, by = y + merlonH + 6;
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#1a0000';
  ctx.fillRect(bx, by, bw, bh);
  ctx.fillStyle = hpRatio > 0.5 ? '#00ff66' : hpRatio > 0.25 ? '#ffdd00' : '#ff3300';
  ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 4;
  ctx.fillRect(bx, by, bw * hpRatio, bh);

  // Label
  ctx.shadowColor = castleColor; ctx.shadowBlur = 8;
  ctx.fillStyle = castleColor;
  ctx.font = `bold ${Math.floor(CELL * 0.38)}px 'Courier New'`;
  ctx.textAlign = 'center';
  ctx.fillText('🏰 FROG CASTLE  ' + hp + '/' + maxHp + ' HP', cx, y + merlonH + 18 + bh + 12);

  ctx.restore();
}

function drawDragging() {
  if (!dragging) return;
  drawFrog(dragging.frog, dragging.curX, dragging.curY, true);
  // Range circle
  const rangePixels = dragging.frog.data.range * CELL;
  ctx.save();
  ctx.strokeStyle = 'rgba(0,255,100,0.3)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(dragging.curX, dragging.curY, rangePixels, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ============================================================
//  GRID HELPERS
// ============================================================
function screenToGrid(x, y) {
  const col = Math.floor((x - GRID_X) / CELL);
  const row = Math.floor((y - GRID_Y) / CELL);
  if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return null;
  return { row, col };
}

function findEmptyCell() {
  for (let r = GRID_ROWS - 1; r >= 0; r--)
    for (let c = 0; c < GRID_COLS; c++)
      if (!grid[r][c]) return { row: r, col: c };
  return null;
}

function gridFull() {
  for (let r = 0; r < GRID_ROWS; r++)
    for (let c = 0; c < GRID_COLS; c++)
      if (!grid[r][c]) return false;
  return true;
}

// ============================================================
//  ACTIONS
// ============================================================
function buyFrog() {
  if (coins < frogCost) { spawnText(GW / 2, GH / 2, 'NOT ENOUGH 🪙', '#ff4444'); return; }
  const cell = findEmptyCell();
  if (!cell) { spawnText(GW / 2, GH / 2, 'GRID FULL!', '#ff4444'); return; }
  coins -= frogCost;
  const f = new Frog(cell.row, cell.col, 0);
  f.mergeAnim = 1;
  grid[cell.row][cell.col] = f;
  playSound('place');
}

function toggleSell() {
  sellMode = !sellMode;
  document.getElementById('sellBtn').classList.toggle('active', sellMode);
  document.getElementById('sellBtn').innerHTML = sellMode
    ? '✅ CANCEL<br><small>Selling mode</small>'
    : '💰 SELL<br><small>Select to sell</small>';
}

function sellFrog(row, col) {
  const f = grid[row][col];
  if (!f) return;
  coins += f.data.sell;
  spawnText(f.px, f.py - 10, '+' + f.data.sell + '🪙', '#ffd700');
  grid[row][col] = null;
  playSound('sell');
  toggleSell();
}

function tryMerge(r1, c1, r2, c2) {
  const a = grid[r1][c1], b = grid[r2][c2];
  if (!a || !b) return false;
  if (a === b) return false;
  if (a.level !== b.level) return false;
  if (a.level >= FROG_LEVELS.length - 1) {
    spawnText(grid[r2][c2].px, grid[r2][c2].py - 10, 'MAX LEVEL!', '#ffdd44');
    return false;
  }
  // Merge into r2,c2
  const newF = new Frog(r2, c2, a.level + 1);
  newF.mergeAnim = 1;
  grid[r2][c2] = newF;
  grid[r1][c1] = null;
  spawnParticles(newF.px, newF.py, newF.data.glow, 14);
  spawnText(newF.px, newF.py - 15, '✨ ' + newF.data.name.toUpperCase() + '!', newF.data.glow);
  playSound('merge');
  return true;
}

// ============================================================
//  INPUT
// ============================================================
function getCanvasPos(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return { x: clientX - rect.left, y: clientY - rect.top };
}

// Mouse
canvas.addEventListener('mousedown', e => {
  e.preventDefault();
  const pos = getCanvasPos(e.clientX, e.clientY);
  handlePointerDown(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener('mousemove', e => {
  e.preventDefault();
  if (!dragging) return;
  const pos = getCanvasPos(e.clientX, e.clientY);
  dragging.curX = pos.x; dragging.curY = pos.y;
}, { passive: false });

canvas.addEventListener('mouseup', e => {
  e.preventDefault();
  const pos = getCanvasPos(e.clientX, e.clientY);
  handlePointerUp(pos.x, pos.y);
}, { passive: false });

// Touch
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const t = e.touches[0];
  const pos = getCanvasPos(t.clientX, t.clientY);
  touchStart = { x: pos.x, y: pos.y };
  handlePointerDown(pos.x, pos.y);
}, { passive: false });

canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (!dragging) return;
  const t = e.touches[0];
  const pos = getCanvasPos(t.clientX, t.clientY);
  dragging.curX = pos.x; dragging.curY = pos.y;
}, { passive: false });

canvas.addEventListener('touchend', e => {
  e.preventDefault();
  if (e.changedTouches.length > 0) {
    const t = e.changedTouches[0];
    const pos = getCanvasPos(t.clientX, t.clientY);
    handlePointerUp(pos.x, pos.y);
  }
}, { passive: false });

canvas.addEventListener('contextmenu', e => e.preventDefault());

let dragThreshold = 8;
let pointerDownPos = null;

function handlePointerDown(x, y) {
  if (state !== 'playing') return;
  pointerDownPos = { x, y };
  const gc = screenToGrid(x, y);
  if (gc && grid[gc.row][gc.col]) {
    dragging = {
      frog: grid[gc.row][gc.col],
      startRow: gc.row, startCol: gc.col,
      curX: x, curY: y,
      moved: false
    };
  }
}

function handlePointerUp(x, y) {
  if (state !== 'playing') return;
  if (dragging) {
    const moved = Math.abs(x - pointerDownPos.x) > dragThreshold || Math.abs(y - pointerDownPos.y) > dragThreshold;
    if (moved) {
      // Drop action
      const gc = screenToGrid(x, y);
      if (gc) {
        if (gc.row === dragging.startRow && gc.col === dragging.startCol) {
          // Dropped on itself — no action
        } else if (!grid[gc.row][gc.col]) {
          // Move frog
          grid[gc.row][gc.col] = dragging.frog;
          dragging.frog.row = gc.row; dragging.frog.col = gc.col;
          grid[dragging.startRow][dragging.startCol] = null;
        } else {
          // Try merge
          const merged = tryMerge(dragging.startRow, dragging.startCol, gc.row, gc.col);
          if (!merged) {
            // Swap
            const other = grid[gc.row][gc.col];
            grid[gc.row][gc.col] = dragging.frog;
            dragging.frog.row = gc.row; dragging.frog.col = gc.col;
            grid[dragging.startRow][dragging.startCol] = other;
            if (other) { other.row = dragging.startRow; other.col = dragging.startCol; }
          }
        }
      }
    } else {
      // Tap — sell mode or range preview
      if (sellMode) {
        const gc = screenToGrid(x, y);
        if (gc && grid[gc.row][gc.col]) sellFrog(gc.row, gc.col);
      }
    }
    dragging = null;
  }
  pointerDownPos = null;
}

// ============================================================
//  UI
// ============================================================
function updateUI() {
  document.getElementById('hpVal').textContent = hp;
  document.getElementById('coinVal').textContent = coins;
  document.getElementById('coinVal2').textContent = coins;
  document.getElementById('waveNum').textContent = wave;
  document.getElementById('frogCost').textContent = frogCost;

  const buyBtn = document.getElementById('buyBtn');
  buyBtn.style.opacity = coins < frogCost ? '0.5' : '1';
}

function showWaveAnnounce(text) {
  const el = document.getElementById('waveAnnounce');
  el.textContent = text;
  el.style.opacity = '1';
  setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

function gameOver() {
  state = 'gameover';
  document.getElementById('finalScore').textContent = 'Wave reached: ' + wave + '   Score: ' + score;
  document.getElementById('gameOverScreen').style.display = 'flex';
}

// ============================================================
//  SOUND (Web Audio API — retro beeps)
// ============================================================
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function beep(freq, type, dur, vol = 0.08, detune = 0) {
  try {
    const ac = getAudio();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    osc.type = type; osc.frequency.value = freq;
    osc.detune.value = detune;
    gain.gain.setValueAtTime(vol, ac.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
    osc.start(); osc.stop(ac.currentTime + dur);
  } catch(e) {}
}

const soundCooldowns = {};
function playSound(name) {
  const now = Date.now();
  if (soundCooldowns[name] && now - soundCooldowns[name] < 80) return;
  soundCooldowns[name] = now;
  if (name === 'shoot')  beep(420, 'square', 0.05, 0.05);
  if (name === 'kill')   { beep(220, 'square', 0.1, 0.07); beep(300, 'square', 0.08, 0.05, 100); }
  if (name === 'merge')  { beep(600, 'sine', 0.12, 0.09); beep(800, 'sine', 0.1, 0.07, 200); beep(1000, 'sine', 0.08, 0.06, 400); }
  if (name === 'place')  beep(350, 'square', 0.07, 0.06);
  if (name === 'sell')   beep(180, 'sawtooth', 0.1, 0.06);
}

// ============================================================
//  UTILITY
// ============================================================
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ============================================================
//  RESIZE LISTENER
// ============================================================
window.addEventListener('resize', () => {
  if (state === 'playing') resize();
});

// Initial resize for proper layout before game starts
resize();