const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const W = 480, H = 600;
canvas.width = W;
canvas.height = H;

const LANES = [W * 0.22, W * 0.5, W * 0.78];
const LANE_COUNT = 3;

let state = 'menu';
let score = 0, hiScore = 0, lives = 3, frame = 0;
let speed = 6, spawnRate = 60, comboTimer = 0;
let frog, obstacles, coins, particles, bgObjs;
let coinCombo = 0;

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */
function lerp(a, b, t) { return a + (b - a) * t; }

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

function spawnParticles(x, y, n, col) {
  for (let i = 0; i < n; i++) particles.push(new Particle(x, y, col));
}

function showCombo(text) {
  const el = document.getElementById('combo-text');
  el.textContent = text;
  el.style.opacity = '1';
  if (comboTimer) clearTimeout(comboTimer);
  comboTimer = setTimeout(() => { el.style.opacity = '0'; }, 800);
}

function updateUI() {
  document.getElementById('score-display').textContent = Math.floor(score);
  const hearts = ['', '🐸', '🐸🐸', '🐸🐸🐸'];
  document.getElementById('lives-display').textContent = hearts[Math.max(0, lives)] || '💀';
}

/* ─────────────────────────────────────────
   Frog
───────────────────────────────────────── */
class Frog {
  constructor() {
    this.lane = 1;
    this.targetLane = 1;
    this.x = LANES[1];
    this.y = H - 130;
    this.w = 44;
    this.h = 44;
    this.vy = 0;
    this.isJumping = false;
    this.squish = 1;
    this.squishV = 0;
    this.invincible = 0;
    this.dead = false;
    this.deadAnim = 0;
    this.legAnim = 0;
  }

  moveLane(d) {
    if (this.dead) return;
    const nl = this.lane + d;
    if (nl >= 0 && nl < LANE_COUNT) this.targetLane = nl;
  }

  jump() {
    if (this.dead) return;
    if (!this.isJumping) {
      this.vy = -16;
      this.isJumping = true;
      this.squish = 0.6;
      spawnParticles(this.x, this.y + this.h / 2, 5, '#5eda5e');
    }
  }

  update() {
    this.x = lerp(this.x, LANES[this.targetLane], 0.18);
    this.lane = this.targetLane;

    if (this.isJumping) {
      this.vy += 0.7;
      this.y += this.vy;
      if (this.y >= H - 130) {
        this.y = H - 130;
        this.vy = 0;
        this.isJumping = false;
        this.squish = 1.35;
        spawnParticles(this.x, this.y + this.h / 2, 6, '#2aa82a');
      }
    }

    this.squish = lerp(this.squish, 1, 0.22);
    if (this.invincible > 0) this.invincible--;
    if (this.dead) this.deadAnim++;
    this.legAnim += 0.15;
  }

  draw() {
    if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) return;
    ctx.save();
    ctx.translate(this.x, this.y + this.h / 2);
    const sx = 1 / this.squish, sy = this.squish;
    if (this.dead) {
      const t = this.deadAnim / 40;
      ctx.rotate(t * Math.PI * 2);
      ctx.globalAlpha = Math.max(0, 1 - t);
    }
    ctx.scale(sx, sy);
    drawFrog(0, -this.h / 2, this.w, this.h, this.isJumping, this.legAnim);
    ctx.restore();
  }
}

/* ─────────────────────────────────────────
   Drawing functions
───────────────────────────────────────── */
function drawFrog(x, y, w, h, jumping, legAnim) {
  ctx.save();

  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + h + 4, w * 0.4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // body
  ctx.fillStyle = '#3dba3d';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.55, w * 0.45, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();

  // belly
  ctx.fillStyle = '#a8e87a';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.6, w * 0.3, h * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();

  // back legs
  const legOff = jumping ? -8 : Math.sin(legAnim) * 3;
  ctx.strokeStyle = '#2a9a2a';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.3, y + h * 0.7);
  ctx.quadraticCurveTo(x - w * 0.55, y + h * 0.85 + legOff, x - w * 0.5, y + h + legOff);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.3, y + h * 0.7);
  ctx.quadraticCurveTo(x + w * 0.55, y + h * 0.85 + legOff, x + w * 0.5, y + h + legOff);
  ctx.stroke();

  // front legs
  ctx.beginPath();
  ctx.moveTo(x - w * 0.35, y + h * 0.45);
  ctx.lineTo(x - w * 0.55, y + h * 0.35);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + w * 0.35, y + h * 0.45);
  ctx.lineTo(x + w * 0.55, y + h * 0.35);
  ctx.stroke();

  // head
  ctx.fillStyle = '#4acc4a';
  ctx.beginPath();
  ctx.ellipse(x, y + h * 0.22, w * 0.42, h * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  // eyes
  const ey = y + h * 0.1;
  [x - w * 0.2, x + w * 0.2].forEach(ex => {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex, ey, 9, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.ellipse(ex + 1, ey + 1, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.ellipse(ex + 2, ey - 1, 2, 2, 0, 0, Math.PI * 2); ctx.fill();
  });

  // mouth
  ctx.strokeStyle = '#1a7a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y + h * 0.28, w * 0.2, 0.1, Math.PI - 0.1);
  ctx.stroke();

  ctx.restore();
}

function drawLog(x, y, w, h) {
  ctx.fillStyle = '#8b5a2b';
  ctx.beginPath();
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 8);
  ctx.fill();
  ctx.fillStyle = '#a0703a';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    roundRect(ctx, x - w / 2 + 4, y - h * 0.15 + i * h * 0.25, w - 8, 4, 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#6a3a10';
  ctx.lineWidth = 2;
  ctx.beginPath();
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 8);
  ctx.stroke();
}

function drawLily(x, y, r) {
  ctx.fillStyle = '#cc3333';
  for (let i = 0; i < 8; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 4);
    ctx.beginPath();
    ctx.ellipse(r * 0.45, 0, r * 0.28, r * 0.12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#ff5555';
  ctx.beginPath(); ctx.arc(x, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ff8888';
  ctx.beginPath(); ctx.arc(x - r * 0.08, y - r * 0.08, r * 0.15, 0, Math.PI * 2); ctx.fill();
}

function drawSnake(x, y, w, h) {
  ctx.strokeStyle = '#5a8a10';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.1);
  ctx.bezierCurveTo(x - w * 0.2, y - h * 0.5, x + w * 0.2, y + h * 0.5, x + w * 0.5, y - h * 0.1);
  ctx.stroke();

  ctx.strokeStyle = '#7ac020';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x - w * 0.5, y - h * 0.1);
  ctx.bezierCurveTo(x - w * 0.2, y - h * 0.5, x + w * 0.2, y + h * 0.5, x + w * 0.5, y - h * 0.1);
  ctx.stroke();

  // head
  ctx.fillStyle = '#aa0000';
  ctx.beginPath(); ctx.ellipse(x + w * 0.5, y - h * 0.1, 8, 7, -0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.ellipse(x + w * 0.52, y - h * 0.14, 3, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + w * 0.5, y - h * 0.04, 3, 3, 0, 0, Math.PI * 2); ctx.fill();

  // tongue
  ctx.strokeStyle = '#ff4444';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x + w * 0.58, y - h * 0.1);
  ctx.lineTo(x + w * 0.68, y - h * 0.17);
  ctx.moveTo(x + w * 0.58, y - h * 0.1);
  ctx.lineTo(x + w * 0.68, y - h * 0.03);
  ctx.stroke();
}

/* ─────────────────────────────────────────
   Obstacle
───────────────────────────────────────── */
class Obstacle {
  constructor() {
    this.lane = Math.floor(Math.random() * LANE_COUNT);
    this.x = LANES[this.lane];
    this.y = -80;
    this.w = 48;
    this.h = 48;
    this.type = Math.random() < 0.4 ? 'log' : Math.random() < 0.6 ? 'lily' : 'snake';
    this.rot = 0;
    this.rotSpeed = (Math.random() - 0.5) * 0.04;
  }
  update() { this.y += speed; this.rot += this.rotSpeed; }
  offscreen() { return this.y > H + 80; }
  draw() {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    if (this.type === 'log') drawLog(0, 0, this.w, this.h);
    else if (this.type === 'lily') drawLily(0, 0, this.w);
    else drawSnake(0, 0, this.w, this.h);
    ctx.restore();
  }
}

/* ─────────────────────────────────────────
   Coin (fly)
───────────────────────────────────────── */
class Coin {
  constructor() {
    this.lane = Math.floor(Math.random() * LANE_COUNT);
    this.x = LANES[this.lane];
    this.y = -30;
    this.r = 13;
    this.collected = false;
    this.anim = 0;
  }
  update() { this.y += speed; this.anim++; }
  offscreen() { return this.y > H + 40; }
  draw() {
    if (this.collected) return;
    ctx.save();
    ctx.translate(this.x, this.y);
    const bob = Math.sin(this.anim * 0.1) * 3;
    ctx.translate(0, bob);
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd000';
    ctx.beginPath(); ctx.arc(-1, -1, this.r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe066';
    ctx.font = 'bold 14px Nunito';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🪰', 0, 1);
    ctx.restore();
  }
}

/* ─────────────────────────────────────────
   Particle
───────────────────────────────────────── */
class Particle {
  constructor(x, y, col) {
    this.x = x; this.y = y; this.color = col;
    this.vx = (Math.random() - 0.5) * 6;
    this.vy = Math.random() * -5 - 2;
    this.life = 40; this.maxLife = 40;
    this.r = Math.random() * 5 + 2;
  }
  update() { this.x += this.vx; this.y += this.vy; this.vy += 0.25; this.life--; }
  draw() {
    ctx.globalAlpha = this.life / this.maxLife;
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

/* ─────────────────────────────────────────
   Background object (lily pads / reeds)
───────────────────────────────────────── */
class BgObj {
  constructor() {
    this.x = Math.random() * W;
    this.y = -40;
    this.scale = 0.4 + Math.random() * 0.6;
    this.type = Math.random() < 0.5 ? 'lpad' : 'reed';
    this.alpha = 0.15 + Math.random() * 0.2;
  }
  update() { this.y += speed * 0.4; }
  offscreen() { return this.y > H + 60; }
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);
    if (this.type === 'lpad') {
      ctx.fillStyle = '#2a6a2a';
      ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1a5a1a';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 30, -0.3, 0.3); ctx.fill();
    } else {
      ctx.strokeStyle = '#1a5a1a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 30); ctx.lineTo(0, -40); ctx.stroke();
      ctx.fillStyle = '#3a2a10';
      ctx.beginPath(); ctx.ellipse(0, -45, 5, 15, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

/* ─────────────────────────────────────────
   Background rendering
───────────────────────────────────────── */
function drawBackground() {
  const grd = ctx.createLinearGradient(0, 0, 0, H);
  grd.addColorStop(0, '#0a2010');
  grd.addColorStop(0.5, '#0f2a14');
  grd.addColorStop(1, '#122a15');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // lane highlight
  LANES.forEach(lx => {
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 60;
    ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
  });

  // lane dividers
  [W * 0.36, W * 0.64].forEach(lx => {
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    ctx.setLineDash([12, 16]);
    ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, H); ctx.stroke();
    ctx.setLineDash([]);
  });

  // ground strip
  ctx.fillStyle = 'rgba(30,70,30,0.35)';
  ctx.fillRect(0, H - 100, W, 100);
  ctx.strokeStyle = 'rgba(94,218,94,0.15)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.beginPath(); ctx.moveTo(0, H - 100); ctx.lineTo(W, H - 100); ctx.stroke();

  // water shimmer
  ctx.strokeStyle = 'rgba(100,200,100,0.05)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const yy = (frame * speed * 0.3 + i * (H / 6)) % H;
    ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke();
  }
}

/* ─────────────────────────────────────────
   Collision detection
───────────────────────────────────────── */
function checkCollisions() {
  // collect flies
  coins.forEach(c => {
    if (c.collected) return;
    const dx = Math.abs(frog.x - c.x), dy = Math.abs(frog.y - c.y);
    if (dx < 28 && dy < 34) {
      c.collected = true;
      coinCombo++;
      score += coinCombo >= 3 ? 15 : 10;
      spawnParticles(c.x, c.y, 8, '#ffe066');
      if (coinCombo >= 3) showCombo('🪰 x' + coinCombo + ' COMBO!');
      updateUI();
    }
  });

  // hit obstacles
  if (frog.invincible > 0) return;
  obstacles.forEach(o => {
    const dx = Math.abs(frog.x - o.x), dy = Math.abs((frog.y + 22) - o.y);
    if (dx < 26 && dy < 28) {
      lives--;
      frog.invincible = 90;
      coinCombo = 0;
      spawnParticles(frog.x, frog.y, 12, '#ff4444');
      showCombo(lives > 0 ? '💥 OUCH!' : '💀 GAME OVER');
      updateUI();
      if (lives <= 0) {
        frog.dead = true;
        setTimeout(() => {
          state = 'gameover';
          showGameOver();
        }, 800);
      }
    }
  });
}

/* ─────────────────────────────────────────
   Game state management
───────────────────────────────────────── */
function initGame() {
  frog = new Frog();
  obstacles = []; coins = []; particles = [];
  bgObjs = Array.from({ length: 8 }, () => {
    const b = new BgObj();
    b.y = Math.random() * H;
    return b;
  });
  score = 0; lives = 3; frame = 0;
  speed = 6; spawnRate = 60;
  coinCombo = 0;
  updateUI();
}

function startGame() {
  document.getElementById('screen-overlay').classList.add('hidden');
  initGame();
  state = 'playing';
}

function restartGame() {
  document.getElementById('screen-overlay').classList.add('hidden');
  initGame();
  state = 'playing';
}

function showGameOver() {
  hiScore = Math.max(hiScore, Math.floor(score));
  const ol = document.getElementById('screen-overlay');
  ol.innerHTML = `
    <div class="big-title" style="font-size:38px;color:#ff7777;">GAME OVER</div>
    <div style="font-family:'Fredoka One',cursive;font-size:32px;color:#ffe066;margin:12px 0">SCORE: ${Math.floor(score)}</div>
    <div class="hi-score">BEST: ${hiScore}</div>
    <button class="play-btn" style="margin-top:20px" onclick="restartGame()">TRY AGAIN</button>
  `;
  ol.classList.remove('hidden');
}

/* ─────────────────────────────────────────
   Main game loop
───────────────────────────────────────── */
function gameLoop() {
  ctx.clearRect(0, 0, W, H);

  if (state === 'playing' || state === 'gameover') {
    drawBackground();

    // background decoration
    bgObjs.forEach(b => { b.update(); b.draw(); });
    bgObjs = bgObjs.filter(b => !b.offscreen());
    if (Math.random() < 0.03) bgObjs.push(new BgObj());

    if (state === 'playing') {
      frame++;
      score += speed * 0.02;
      speed = 6 + frame * 0.003;
      spawnRate = Math.max(28, 60 - frame * 0.03);

      if (frame % Math.floor(spawnRate) === 0) obstacles.push(new Obstacle());
      if (frame % 45 === 0) coins.push(new Coin());

      frog.update();
      checkCollisions();
    }

    coins.forEach(c => { if (state === 'playing') c.update(); c.draw(); });
    coins = coins.filter(c => !c.offscreen() && !c.collected);

    obstacles.forEach(o => { if (state === 'playing') o.update(); o.draw(); });
    obstacles = obstacles.filter(o => !o.offscreen());

    particles.forEach(p => { p.update(); p.draw(); });
    particles = particles.filter(p => p.life > 0);

    frog.draw();
  }

  requestAnimationFrame(gameLoop);
}

/* ─────────────────────────────────────────
   Input handling
───────────────────────────────────────── */
document.addEventListener('keydown', e => {
  if (state !== 'playing') return;
  if (e.key === 'ArrowLeft' || e.key === 'a') frog.moveLane(-1);
  if (e.key === 'ArrowRight' || e.key === 'd') frog.moveLane(1);
  if (e.key === 'ArrowUp' || e.key === ' ' || e.key === 'w') {
    e.preventDefault();
    frog.jump();
  }
});

// Mobile buttons
document.getElementById('btn-left').addEventListener('touchstart', e => {
  e.preventDefault();
  if (state === 'playing') frog.moveLane(-1);
}, { passive: false });

document.getElementById('btn-right').addEventListener('touchstart', e => {
  e.preventDefault();
  if (state === 'playing') frog.moveLane(1);
}, { passive: false });

document.getElementById('btn-jump').addEventListener('touchstart', e => {
  e.preventDefault();
  if (state === 'playing') frog.jump();
}, { passive: false });

document.getElementById('btn-left').addEventListener('click', () => { if (state === 'playing') frog.moveLane(-1); });
document.getElementById('btn-right').addEventListener('click', () => { if (state === 'playing') frog.moveLane(1); });
document.getElementById('btn-jump').addEventListener('click', () => { if (state === 'playing') frog.jump(); });

// Swipe support
let touchStartX = 0, touchStartY = 0;
canvas.addEventListener('touchstart', e => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', e => {
  if (state !== 'playing') return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 20) frog.moveLane(dx > 0 ? 1 : -1);
  else if (dy < -20) frog.jump();
}, { passive: true });

/* ─────────────────────────────────────────
   Prevent drag / select / context menu
───────────────────────────────────────── */
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());

/* ─────────────────────────────────────────
   Boot
───────────────────────────────────────── */
gameLoop();