// ============================================================
//  FROG DASH — Single-file HTML5 Canvas Game
//  Geometry Dash style auto-runner with frog theme
// ============================================================

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const W       = 900, H = 400;   // internal resolution
canvas.width  = W;
canvas.height = H;

// UI elements
const startScreen   = document.getElementById('startScreen');
const gameOverScreen= document.getElementById('gameOverScreen');
const pauseScreen   = document.getElementById('pauseScreen');
const goScore       = document.getElementById('goScore');
const goHiScore     = document.getElementById('goHiScore');
const startHiScore  = document.getElementById('startHiScore');
const tapBtn        = document.getElementById('tapBtn');

// ============================================================
//  CONSTANTS
// ============================================================
const GROUND_Y   = H - 80;   // ground surface y
const GRAVITY    = 0.72;
const JUMP_VEL   = -14.5;
const DOUBLE_VEL = -12.8;
const FROG_SIZE  = 34;

// Colors
const C = {
  bg1: '#050510', bg2: '#0a0a2e',
  ground: '#0d2d0d', groundTop: '#39ff14',
  frog: '#39ff14', frogEye: '#ffffff', frogPupil: '#050510',
  frogBelly: '#b2ff59',
  spike: '#ff1744', spikeGlow: '#ff6b6b',
  platform: '#00e5ff', platformGlow: '#00b8d4',
  particle: ['#39ff14','#00e5ff','#ffea00','#ff1744','#b2ff59'],
  trail: 'rgba(57,255,20,',
  score: '#ffea00',
  grid: 'rgba(57,255,20,0.06)',
  stars: '#ffffff',
};

// ============================================================
//  STATE
// ============================================================
let STATE = 'start'; // 'start' | 'playing' | 'dead' | 'paused'
let score = 0, hiScore = parseInt(localStorage.getItem('frogDashHi') || '0');
let speed = 5.5;
let frameCount = 0;
let shakeX = 0, shakeY = 0, shakeDuration = 0;

// ============================================================
//  PLAYER
// ============================================================
const player = {
  x: 130, y: GROUND_Y - FROG_SIZE,
  vy: 0,
  onGround: false,
  canDoubleJump: true,
  jumped: false,          // for animation
  squash: 1, stretch: 1,  // squash & stretch
  rotation: 0,
  trail: [],              // trail positions
  dead: false,
  deathTimer: 0,
};

function resetPlayer() {
  player.x = 130; player.y = GROUND_Y - FROG_SIZE;
  player.vy = 0; player.onGround = true;
  player.canDoubleJump = true; player.jumped = false;
  player.squash = 1; player.stretch = 1;
  player.rotation = 0; player.trail = []; player.dead = false;
  player.deathTimer = 0;
}

function jump() {
  if (STATE !== 'playing') return;
  if (player.onGround) {
    player.vy = JUMP_VEL;
    player.onGround = false;
    player.canDoubleJump = true;
    player.stretch = 1.4; player.squash = 0.7;
    spawnJumpParticles();
    playSound('jump');
  } else if (player.canDoubleJump) {
    player.vy = DOUBLE_VEL;
    player.canDoubleJump = false;
    player.stretch = 1.2; player.squash = 0.85;
    spawnJumpParticles();
    playSound('jump');
  }
}

// ============================================================
//  OBSTACLES & PLATFORMS
// ============================================================
let obstacles = [];
let platforms = [];
let particles = [];
let bgStars   = [];

// Obstacle types: 'spike' | 'spikeGroup' | 'gap' | 'wall'
function spawnObstacle() {
  const types = ['spike','spike','spikeGroup','wall','spikeGroup'];
  const t = types[Math.floor(Math.random() * types.length)];

  if (t === 'spike') {
    obstacles.push({ type:'spike', x: W + 40, y: GROUND_Y, w: 28, h: 34 });
  } else if (t === 'spikeGroup') {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++)
      obstacles.push({ type:'spike', x: W + 40 + i * 32, y: GROUND_Y, w: 26, h: 30 });
  } else if (t === 'wall') {
    obstacles.push({ type:'wall', x: W + 40, y: GROUND_Y - 60, w: 22, h: 60 });
  }
}

function spawnPlatform() {
  const yPos = GROUND_Y - 100 - Math.random() * 80;
  platforms.push({
    x: W + 20, y: yPos, w: 80 + Math.random() * 60, h: 14,
    vy: (Math.random() < 0.4) ? (Math.random() * 1.2 - 0.6) : 0,
    baseY: yPos,
  });
}

// Obstacle spawn timing (frame intervals)
let nextSpawnFrame = 0;
function scheduleNextSpawn() {
  // minimum gap decreases as speed increases
  const minGap = Math.max(55, 110 - (speed - 5.5) * 8);
  const maxGap = Math.max(100, 190 - (speed - 5.5) * 10);
  nextSpawnFrame = frameCount + minGap + Math.floor(Math.random() * (maxGap - minGap));
}

let nextPlatformFrame = 200;
function scheduleNextPlatform() {
  nextPlatformFrame = frameCount + 120 + Math.floor(Math.random() * 160);
}

// ============================================================
//  PARTICLES
// ============================================================
function spawnJumpParticles() {
  for (let i = 0; i < 8; i++) {
    particles.push({
      x: player.x + FROG_SIZE/2,
      y: player.y + FROG_SIZE,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * -3 - 1,
      life: 1, decay: 0.05 + Math.random() * 0.04,
      size: 3 + Math.random() * 4,
      color: C.particle[Math.floor(Math.random() * C.particle.length)],
    });
  }
}

function spawnDeathParticles() {
  for (let i = 0; i < 28; i++) {
    const angle = (i / 28) * Math.PI * 2;
    const spd = 3 + Math.random() * 8;
    particles.push({
      x: player.x + FROG_SIZE/2,
      y: player.y + FROG_SIZE/2,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - 2,
      life: 1, decay: 0.025 + Math.random() * 0.03,
      size: 4 + Math.random() * 7,
      color: C.particle[Math.floor(Math.random() * C.particle.length)],
    });
  }
}

// ============================================================
//  BACKGROUND STARS
// ============================================================
function initStars() {
  bgStars = [];
  for (let i = 0; i < 80; i++) {
    bgStars.push({
      x: Math.random() * W, y: Math.random() * GROUND_Y * 0.85,
      r: Math.random() * 1.5 + 0.3,
      speed: Math.random() * 0.6 + 0.1,
      alpha: Math.random() * 0.6 + 0.2,
    });
  }
}

// ============================================================
//  SOUND (Web Audio API)
// ============================================================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  try {
    const ac = getAudioCtx();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain); gain.connect(ac.destination);
    if (type === 'jump') {
      osc.type = 'square';
      osc.frequency.setValueAtTime(300, ac.currentTime);
      osc.frequency.linearRampToValueAtTime(600, ac.currentTime + 0.08);
      gain.gain.setValueAtTime(0.15, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.12);
      osc.start(); osc.stop(ac.currentTime + 0.12);
    } else if (type === 'death') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, ac.currentTime);
      osc.frequency.linearRampToValueAtTime(80, ac.currentTime + 0.4);
      gain.gain.setValueAtTime(0.2, ac.currentTime);
      gain.gain.linearRampToValueAtTime(0, ac.currentTime + 0.4);
      osc.start(); osc.stop(ac.currentTime + 0.4);
    }
  } catch(e) {}
}

// ============================================================
//  SCREEN SHAKE
// ============================================================
function triggerShake(dur = 14, mag = 6) {
  shakeDuration = dur;
}

function updateShake() {
  if (shakeDuration > 0) {
    const mag = shakeDuration * 0.45;
    shakeX = (Math.random() - 0.5) * mag;
    shakeY = (Math.random() - 0.5) * mag;
    shakeDuration--;
  } else { shakeX = 0; shakeY = 0; }
}

// ============================================================
//  COLLISION DETECTION
// ============================================================
function checkCollisions() {
  // Hitbox inset (more forgiving)
  const inset = 5;
  const px = player.x + inset, py = player.y + inset;
  const pw = FROG_SIZE - inset * 2, ph = FROG_SIZE - inset * 2;

  for (const obs of obstacles) {
    if (obs.type === 'spike') {
      // Triangle hitbox — simplified AABB with vertical inset
      const sx = obs.x + 4, sy = obs.y - obs.h + 4;
      const sw = obs.w - 8,  sh = obs.h - 4;
      if (px < sx + sw && px + pw > sx && py < sy + sh && py + ph > sy) return true;
    } else if (obs.type === 'wall') {
      if (px < obs.x + obs.w && px + pw > obs.x && py < obs.y + obs.h && py + ph > obs.y) return true;
    }
  }

  // Ground gap — if player falls below ground without a platform
  if (player.y > H) return true;

  return false;
}

function checkPlatformLanding() {
  if (player.vy < 0) return; // going up
  const px = player.x + 4, py = player.y;
  const pw = FROG_SIZE - 8, ph = FROG_SIZE;

  for (const plat of platforms) {
    const prevBottom = py + ph - player.vy;
    const currBottom = py + ph;
    if (px < plat.x + plat.w && px + pw > plat.x &&
        prevBottom <= plat.y + 2 && currBottom >= plat.y - 2) {
      player.y = plat.y - FROG_SIZE;
      player.vy = 0;
      player.onGround = true;
      player.canDoubleJump = true;
      return;
    }
  }
}

// ============================================================
//  BACKGROUND DRAWING
// ============================================================
function drawBackground() {
  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, GROUND_Y);
  grad.addColorStop(0, '#020210');
  grad.addColorStop(1, '#0a1a20');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = C.grid;
  ctx.lineWidth = 1;
  const gridSize = 40;
  const offset = (frameCount * (speed * 0.5)) % gridSize;
  for (let x = -offset; x < W; x += gridSize) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GROUND_Y); ctx.stroke();
  }
  for (let y = 0; y < GROUND_Y; y += gridSize) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Stars
  for (const s of bgStars) {
    s.x -= s.speed * (speed / 5.5);
    if (s.x < 0) { s.x = W; s.y = Math.random() * GROUND_Y * 0.85; }
    ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(frameCount * 0.04 + s.x));
    ctx.fillStyle = C.stars;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ============================================================
//  GROUND DRAWING
// ============================================================
function drawGround() {
  // Ground block
  const gGrad = ctx.createLinearGradient(0, GROUND_Y, 0, H);
  gGrad.addColorStop(0, '#0d2d0d');
  gGrad.addColorStop(1, '#030d03');
  ctx.fillStyle = gGrad;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);

  // Top glowing line
  ctx.shadowColor = C.groundTop;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = C.groundTop;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(W, GROUND_Y); ctx.stroke();
  ctx.shadowBlur = 0;

  // Ground detail tiles
  const tileW = 50;
  const tileOffset = (frameCount * speed) % tileW;
  ctx.strokeStyle = 'rgba(57,255,20,0.15)';
  ctx.lineWidth = 1;
  for (let x = -tileOffset; x < W; x += tileW) {
    ctx.beginPath(); ctx.moveTo(x, GROUND_Y); ctx.lineTo(x, H); ctx.stroke();
  }
}

// ============================================================
//  FROG DRAWING
// ============================================================
function drawFrog() {
  if (player.dead) return;

  const cx = player.x + FROG_SIZE / 2;
  const cy = player.y + FROG_SIZE / 2;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(player.rotation);

  const sw = FROG_SIZE * player.squash;
  const sh = FROG_SIZE * player.stretch;

  // Glow
  ctx.shadowColor = C.frog;
  ctx.shadowBlur  = 18;

  // Body (rounded square like GD)
  ctx.fillStyle = C.frog;
  const r = 6;
  const bx = -sw/2, by = -sh/2;
  roundRect(ctx, bx, by, sw, sh, r);
  ctx.fill();

  // Belly highlight
  ctx.fillStyle = C.frogBelly;
  ctx.globalAlpha = 0.35;
  roundRect(ctx, bx + sw*0.15, by + sh*0.15, sw*0.7, sh*0.5, 4);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.shadowBlur = 0;

  // Eyes (top corners)
  const eyeOffset = sw * 0.22;
  const eyeY = by + sh * 0.22;
  const eyeR = sw * 0.13;
  // whites
  ctx.fillStyle = C.frogEye;
  ctx.beginPath(); ctx.arc(-eyeOffset, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( eyeOffset, eyeY, eyeR, 0, Math.PI*2); ctx.fill();
  // pupils
  const pupilShift = player.onGround ? 0 : 1;
  ctx.fillStyle = C.frogPupil;
  ctx.beginPath(); ctx.arc(-eyeOffset + pupilShift, eyeY + 1, eyeR * 0.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( eyeOffset + pupilShift, eyeY + 1, eyeR * 0.5, 0, Math.PI*2); ctx.fill();

  // Smile / determined look based on state
  ctx.strokeStyle = C.frogPupil;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  if (player.onGround) {
    ctx.arc(0, by + sh * 0.65, sw * 0.18, 0, Math.PI); // smile
  } else {
    ctx.arc(0, by + sh * 0.7, sw * 0.12, Math.PI, 0);  // determined
  }
  ctx.stroke();

  ctx.restore();
}

// ============================================================
//  TRAIL
// ============================================================
function updateTrail() {
  player.trail.unshift({ x: player.x, y: player.y, t: 1 });
  if (player.trail.length > 10) player.trail.pop();
}

function drawTrail() {
  for (let i = 0; i < player.trail.length; i++) {
    const t = player.trail[i];
    const alpha = (1 - i / player.trail.length) * 0.35;
    const size  = FROG_SIZE * (1 - i / player.trail.length) * 0.9;
    ctx.fillStyle = C.trail + alpha + ')';
    ctx.shadowColor = C.frog; ctx.shadowBlur = 6;
    roundRect(ctx, t.x + (FROG_SIZE - size)/2, t.y + (FROG_SIZE - size)/2, size, size, 5);
    ctx.fill();
  }
  ctx.shadowBlur = 0;
}

// ============================================================
//  OBSTACLES DRAWING
// ============================================================
function drawObstacles() {
  for (const obs of obstacles) {
    if (obs.type === 'spike') {
      ctx.save();
      ctx.shadowColor = C.spikeGlow;
      ctx.shadowBlur  = 14;
      ctx.fillStyle   = C.spike;
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.w / 2, obs.y - obs.h);
      ctx.lineTo(obs.x + obs.w,     obs.y);
      ctx.lineTo(obs.x,             obs.y);
      ctx.closePath();
      ctx.fill();
      // inner highlight
      ctx.fillStyle = 'rgba(255,100,100,0.4)';
      ctx.beginPath();
      ctx.moveTo(obs.x + obs.w/2, obs.y - obs.h + 4);
      ctx.lineTo(obs.x + obs.w - 6, obs.y - 4);
      ctx.lineTo(obs.x + 6,         obs.y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else if (obs.type === 'wall') {
      ctx.save();
      ctx.shadowColor = C.spike; ctx.shadowBlur = 12;
      ctx.fillStyle = '#c62828';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = C.spike; ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      // hazard stripes
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#ffea00';
      for (let i = 0; i < obs.h; i += 14) {
        ctx.fillRect(obs.x, obs.y + i, obs.w, 7);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }
}

// ============================================================
//  PLATFORMS DRAWING
// ============================================================
function drawPlatforms() {
  for (const p of platforms) {
    ctx.save();
    ctx.shadowColor = C.platform; ctx.shadowBlur = 16;
    const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    grad.addColorStop(0, C.platform);
    grad.addColorStop(1, '#006070');
    ctx.fillStyle = grad;
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = '#80ffff'; ctx.lineWidth = 1.5;
    ctx.strokeRect(p.x, p.y, p.w, p.h);
    ctx.restore();
  }
}

// ============================================================
//  PARTICLES
// ============================================================
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy; p.vy += 0.2;
    p.life -= p.decay;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.restore();
  }
}

// ============================================================
//  HUD
// ============================================================
function drawHUD() {
  ctx.save();
  ctx.font = 'bold 22px "Courier New"';
  ctx.fillStyle = C.score;
  ctx.shadowColor = C.score; ctx.shadowBlur = 12;
  ctx.fillText('SCORE: ' + Math.floor(score), 16, 36);
  ctx.font = '14px "Courier New"';
  ctx.fillStyle = 'rgba(178,255,89,0.8)';
  ctx.shadowColor = '#b2ff59'; ctx.shadowBlur = 6;
  ctx.fillText('BEST: ' + hiScore, 16, 56);
  ctx.restore();
}

// ============================================================
//  HELPER: roundRect
// ============================================================
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ============================================================
//  GAME LOGIC UPDATE
// ============================================================
function update() {
  if (STATE !== 'playing') return;

  frameCount++;

  // Speed ramp
  speed = 5.5 + frameCount * 0.0008;

  // Score
  score += speed * 0.08;

  // Spawn obstacles
  if (frameCount >= nextSpawnFrame) {
    spawnObstacle();
    scheduleNextSpawn();
  }

  // Spawn platforms occasionally
  if (frameCount >= nextPlatformFrame) {
    spawnPlatform();
    scheduleNextPlatform();
  }

  // Move obstacles
  for (let i = obstacles.length - 1; i >= 0; i--) {
    obstacles[i].x -= speed;
    if (obstacles[i].x + 50 < 0) obstacles.splice(i, 1);
  }

  // Move platforms
  for (let i = platforms.length - 1; i >= 0; i--) {
    const p = platforms[i];
    p.x -= speed;
    p.y += p.vy;
    // Bounce vertically
    if (p.y < GROUND_Y - 200) p.vy = Math.abs(p.vy);
    if (p.y > GROUND_Y - 60)  p.vy = -Math.abs(p.vy);
    if (p.x + p.w < 0) platforms.splice(i, 1);
  }

  // Player physics
  player.vy += GRAVITY;
  player.y  += player.vy;

  // Platform collision
  checkPlatformLanding();

  // Ground collision
  if (player.y + FROG_SIZE >= GROUND_Y) {
    player.y = GROUND_Y - FROG_SIZE;
    player.vy = 0;
    player.onGround = true;
    player.canDoubleJump = true;
  }

  // Air rotation
  if (!player.onGround) {
    player.rotation += 0.12;
  } else {
    player.rotation = 0;
  }

  // Squash/stretch recovery
  player.squash += (1 - player.squash) * 0.18;
  player.stretch += (1 - player.stretch) * 0.18;

  // Trail
  updateTrail();

  // Collision check
  if (checkCollisions()) {
    die();
    return;
  }

  // Shake
  updateShake();

  // Particles
  updateParticles();
}

// ============================================================
//  DRAW
// ============================================================
function draw() {
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(shakeX, shakeY);

  drawBackground();
  drawGround();
  drawPlatforms();
  drawParticles();
  drawTrail();
  drawObstacles();
  drawFrog();
  drawHUD();

  ctx.restore();
}

// ============================================================
//  GAME LOOP
// ============================================================
let animId = null;
function gameLoop() {
  update();
  draw();
  animId = requestAnimationFrame(gameLoop);
}

// ============================================================
//  GAME STATE CONTROL
// ============================================================
function startGame() {
  if (STATE === 'playing') return;
  obstacles = []; platforms = []; particles = [];
  score = 0; speed = 5.5; frameCount = 0;
  resetPlayer();
  scheduleNextSpawn();
  scheduleNextPlatform();
  STATE = 'playing';
  startScreen.classList.add('hidden');
  gameOverScreen.classList.add('hidden');
  pauseScreen.classList.add('hidden');
  tapBtn.style.display = 'block';
  if (!animId) gameLoop();
}

function die() {
  STATE = 'dead';
  player.dead = true;
  triggerShake(20, 8);
  spawnDeathParticles();
  playSound('death');

  if (Math.floor(score) > hiScore) {
    hiScore = Math.floor(score);
    localStorage.setItem('frogDashHi', hiScore);
  }

  setTimeout(() => {
    gameOverScreen.classList.remove('hidden');
    goScore.textContent  = 'SCORE: ' + Math.floor(score);
    goHiScore.textContent = 'BEST: ' + hiScore;
    tapBtn.style.display = 'block';
  }, 500);
}

function togglePause() {
  if (STATE === 'playing') {
    STATE = 'paused';
    pauseScreen.classList.remove('hidden');
    tapBtn.style.display = 'block';
  } else if (STATE === 'paused') {
    STATE = 'playing';
    pauseScreen.classList.add('hidden');
  }
}

function handleTap() {
  if (STATE === 'start')   { startGame(); return; }
  if (STATE === 'dead')    { startGame(); return; }
  if (STATE === 'paused')  { togglePause(); return; }
  if (STATE === 'playing') { jump(); }
}

// ============================================================
//  INPUT HANDLING
// ============================================================
document.addEventListener('keydown', (e) => {
  const k = e.code;
  if (k === 'Enter') {
    if (STATE === 'start' || STATE === 'dead') startGame();
  } else if (k === 'Space' || k === 'ArrowUp') {
    e.preventDefault();
    if (STATE === 'playing') jump();
    else if (STATE === 'start' || STATE === 'dead') startGame();
  } else if (k === 'KeyP') {
    if (STATE === 'playing' || STATE === 'paused') togglePause();
  }
});

// Prevent context menu
document.addEventListener('contextmenu', e => e.preventDefault());

// Prevent scroll
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// Tap button (covers the whole canvas)
tapBtn.addEventListener('touchstart', (e) => {
  e.preventDefault();
  handleTap();
}, { passive: false });

tapBtn.addEventListener('mousedown', (e) => {
  e.preventDefault();
  handleTap();
});

// ============================================================
//  IDLE ANIMATION (drawn on start/gameover screens)
// ============================================================
function idleLoop() {
  if (STATE === 'playing') return;
  frameCount++;
  ctx.clearRect(0, 0, W, H);
  ctx.save();

  // Background
  drawBackground();
  drawGround();

  // Floating idle frog
  const fy = GROUND_Y - FROG_SIZE - Math.sin(frameCount * 0.04) * 8;
  player.x = 130; player.y = fy;
  player.rotation = Math.sin(frameCount * 0.03) * 0.08;
  player.squash = 1 + Math.sin(frameCount * 0.06) * 0.05;
  player.stretch = 1 - Math.sin(frameCount * 0.06) * 0.05;
  player.dead = false;
  player.onGround = false;
  drawTrail();
  drawFrog();

  updateParticles();
  drawParticles();

  ctx.restore();
  requestAnimationFrame(idleLoop);
}

// ============================================================
//  INIT
// ============================================================
function init() {
  initStars();
  startHiScore.textContent = 'BEST: ' + hiScore;
  tapBtn.style.display = 'block';
  STATE = 'start';

  // Seed trail
  player.y = GROUND_Y - FROG_SIZE;
  player.x = 130;
  for (let i = 0; i < 8; i++) player.trail.push({ x: player.x - i*4, y: player.y });

  idleLoop();
}

init();