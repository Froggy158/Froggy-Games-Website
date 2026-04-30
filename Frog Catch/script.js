// ============================================================
//  FROG CATCH - Retro Arcade Game
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// ===== RESPONSIVE SIZING =====
let CW, CH, SCALE;
function resize() {
  const ratio = 400 / 600;
  let w = Math.min(window.innerWidth, window.innerHeight * ratio);
  let h = w / ratio;
  if (h > window.innerHeight) { h = window.innerHeight; w = h * ratio; }
  CW = Math.floor(w); CH = Math.floor(h);
  SCALE = CW / 400;
  canvas.width = CW; canvas.height = CH;
  canvas.style.width = CW + 'px'; canvas.style.height = CH + 'px';
  document.getElementById('hud').style.setProperty('--cw', CW + 'px');
  document.getElementById('hud').style.width = CW + 'px';
  document.getElementById('mobileControls').style.width = CW + 'px';
  document.getElementById('mobileControls').style.setProperty('--cw', CW + 'px');
  // Position home button relative to canvas
  const rect = canvas.getBoundingClientRect();
  document.getElementById('homeBtn').style.right = (window.innerWidth - rect.right + 8) + 'px';
  document.getElementById('homeBtn').style.top = (rect.top + 8) + 'px';
}
window.addEventListener('resize', () => { resize(); });
resize();

// ===== DETECT TOUCH =====
const isTouchDevice = ('ontouchstart' in window);
if (isTouchDevice) {
  document.getElementById('mobileControls').style.display = 'flex';
}

// ===== DISABLE CONTEXT MENU =====
window.addEventListener('contextmenu', e => e.preventDefault());

// ===== GAME STATE =====
const STATE = { TITLE: 0, PLAYING: 1, PAUSED: 2, GAMEOVER: 3 };
let state = STATE.TITLE;
let score = 0, highScore = 0, lives = 3;
let missCount = 0;
const MAX_MISS = 5; // missed bugs before life lost
let frameCount = 0, lastTime = 0;
let particles = [], shakeFrames = 0;
let slowMotionFrames = 0, scoreBonusFrames = 0;
let flashMsg = '', flashTimer = 0;

// ===== HIGH SCORE =====
try { highScore = parseInt(localStorage.getItem('frogcatch_hs') || '0'); } catch(e) {}

// ===== FROG =====
const frog = {
  x: 200, y: 0, w: 36, h: 32,
  speed: 220, // px/sec
  tongueFrame: 0, // 0=normal, 1-6=tongue out
  mouthOpen: false,
  init() { this.x = 200; this.y = CH - (40 * SCALE); this.tongueFrame = 0; this.mouthOpen = false; },
  shoot() { if (this.tongueFrame === 0) this.tongueFrame = 1; }
};

// ===== INSECTS =====
let insects = [];
let spawnTimer = 0;
let spawnInterval = 1.4; // seconds between spawns (decreases over time)
let gameTime = 0; // seconds played

const INSECT_TYPES = {
  fly:      { label:'FLY',      emoji:'🪰', points:10,  color:'#aaffaa', speed:90,  wobble:false, rare:false, poison:false, glow:'#00ff44' },
  beetle:   { label:'BEETLE',   emoji:'🪲', points:15,  color:'#88aaff', speed:70,  wobble:true,  rare:false, poison:false, glow:'#4488ff' },
  goldenfly:{ label:'GOLDEN',   emoji:'🌟', points:50,  color:'#ffee44', speed:130, wobble:true,  rare:true,  poison:false, glow:'#ffdd00' },
  firefly:  { label:'FIREFLY',  emoji:'✨', points:20,  color:'#ccffaa', speed:80,  wobble:true,  rare:false, poison:false, glow:'#aaff44', special:'slow' },
  poison:   { label:'POISON',   emoji:'☠️', points:-30, color:'#ff4444', speed:110, wobble:false, rare:false, poison:true,  glow:'#ff0000' },
};

function spawnInsect() {
  const keys = Object.keys(INSECT_TYPES);
  let pool = [];
  for (const k of keys) {
    const t = INSECT_TYPES[k];
    const w = t.rare ? 3 : t.poison ? 10 : 35;
    for (let i = 0; i < w; i++) pool.push(k);
  }
  const type = pool[Math.floor(Math.random() * pool.length)];
  const T = INSECT_TYPES[type];
  const difficulty = Math.min(gameTime / 60, 2.0); // ramps up over 2 min
  const speedMult = 1 + difficulty * 0.6;
  insects.push({
    type, x: 20 + Math.random() * 360, y: -20,
    speed: T.speed * speedMult,
    wobble: T.wobble, wobbleAmp: 30 + Math.random() * 40,
    wobbleFreq: 0.8 + Math.random() * 1.2,
    wobbleOff: Math.random() * Math.PI * 2,
    startX: 0, age: 0,
    size: 20, glow: T.glow, color: T.color,
    points: T.points, poison: T.poison, special: T.special,
    emoji: T.emoji,
  });
  insects[insects.length-1].startX = insects[insects.length-1].x;
}

// ===== PARTICLES =====
function spawnParticles(x, y, color, count=8) {
  for (let i = 0; i < count; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 50 + Math.random() * 100;
    particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      life: 1, color,
      size: 3 + Math.random() * 4,
    });
  }
}

// ===== INPUT =====
const keys = { left: false, right: false };
let touchStartX = 0, touchCurX = 0, touchActive = false;

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft')  keys.left  = true;
  if (e.key === 'ArrowRight') keys.right = true;
  if (e.key === ' ' || e.key === 'z' || e.key === 'Z') frog.shoot();
  if (e.key === 'p' || e.key === 'P') {
    if (state === STATE.PLAYING) state = STATE.PAUSED;
    else if (state === STATE.PAUSED) state = STATE.PLAYING;
  }
  if (e.key === 'Enter') {
    if (state === STATE.TITLE || state === STATE.GAMEOVER) startGame();
    else if (state === STATE.PAUSED) state = STATE.PLAYING;
  }
  e.preventDefault();
});
window.addEventListener('keyup', e => {
  if (e.key === 'ArrowLeft')  keys.left  = false;
  if (e.key === 'ArrowRight') keys.right = false;
});

// Touch move (swipe/drag on canvas for frog)
canvas.addEventListener('touchstart', e => {
  const t = e.touches[0];
  touchStartX = t.clientX; touchCurX = t.clientX; touchActive = true;
  if (state === STATE.TITLE || state === STATE.GAMEOVER) startGame();
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  touchCurX = e.touches[0].clientX;
  e.preventDefault();
}, { passive: false });
canvas.addEventListener('touchend', e => {
  touchActive = false;
  touchStartX = 0; touchCurX = 0;
  e.preventDefault();
}, { passive: false });

// Mobile buttons
let btnLeftDown = false, btnRightDown = false;
function setupMobBtn(id, setter) {
  const btn = document.getElementById(id);
  btn.addEventListener('touchstart', e => { setter(true); e.stopPropagation(); e.preventDefault(); }, { passive: false });
  btn.addEventListener('touchend',   e => { setter(false); e.stopPropagation(); e.preventDefault(); }, { passive: false });
  btn.addEventListener('touchcancel',e => { setter(false); e.stopPropagation(); e.preventDefault(); }, { passive: false });
  btn.addEventListener('mousedown',  e => { setter(true); });
  btn.addEventListener('mouseup',    e => { setter(false); });
}
setupMobBtn('btnLeft',  v => btnLeftDown = v);
setupMobBtn('btnRight', v => btnRightDown = v);

// ===== GAME INIT =====
function startGame() {
  score = 0; lives = 3; missCount = 0;
  insects = []; particles = [];
  shakeFrames = 0; slowMotionFrames = 0; scoreBonusFrames = 0;
  gameTime = 0; frameCount = 0; spawnTimer = 0; spawnInterval = 1.4;
  frog.init();
  updateHUD();
  state = STATE.PLAYING;
}

function updateHUD() {
  document.getElementById('hudScore').textContent = 'SCORE: ' + score;
  document.getElementById('hudHigh').textContent  = 'BEST: '  + highScore;
  let livesStr = '';
  for (let i = 0; i < lives; i++) livesStr += '🐸';
  document.getElementById('hudLives').textContent = livesStr;
}

function loseLife() {
  lives--;
  shakeFrames = 18;
  spawnParticles(frog.x * SCALE, frog.y, '#ff4444', 14);
  missCount = 0;
  updateHUD();
  if (lives <= 0) {
    if (score > highScore) {
      highScore = score;
      try { localStorage.setItem('frogcatch_hs', highScore); } catch(e) {}
    }
    updateHUD();
    state = STATE.GAMEOVER;
  }
}

// ===== DRAW HELPERS =====
function px(v) { return v * SCALE; }

function drawPixelRect(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(px(x), px(y), px(w), px(h));
}

function drawFrog(fx, fy) {
  const s = SCALE;
  const x = fx * s, y = fy * s;
  const W = 36 * s, H = 32 * s;

  // Body
  ctx.fillStyle = '#2d8a2d';
  ctx.fillRect(x - W/2, y - H/2, W, H);

  // Belly
  ctx.fillStyle = '#5dc85d';
  ctx.fillRect(x - W/2 + 4*s, y - H/2 + 8*s, W - 8*s, H/2);

  // Eyes
  ctx.fillStyle = '#111';
  ctx.fillRect(x - W/2 + 3*s, y - H/2 + 3*s, 7*s, 7*s);
  ctx.fillRect(x + W/2 - 10*s, y - H/2 + 3*s, 7*s, 7*s);
  ctx.fillStyle = '#ffff44';
  ctx.fillRect(x - W/2 + 4*s, y - H/2 + 4*s, 4*s, 4*s);
  ctx.fillRect(x + W/2 - 9*s, y - H/2 + 4*s, 4*s, 4*s);
  ctx.fillStyle = '#111';
  ctx.fillRect(x - W/2 + 5*s, y - H/2 + 5*s, 2*s, 2*s);
  ctx.fillRect(x + W/2 - 8*s, y - H/2 + 5*s, 2*s, 2*s);

  // Mouth
  if (frog.mouthOpen || frog.tongueFrame > 0) {
    ctx.fillStyle = '#ff4444';
    ctx.fillRect(x - 8*s, y + 4*s, 16*s, 5*s);
    ctx.fillStyle = '#ff8888';
    ctx.fillRect(x - 7*s, y + 5*s, 14*s, 3*s);
  } else {
    ctx.fillStyle = '#1a6e1a';
    ctx.fillRect(x - 6*s, y + 6*s, 12*s, 3*s);
  }

  // Tongue
  if (frog.tongueFrame > 0) {
    const progress = frog.tongueFrame / 6;
    const tongueLen = progress <= 0.5
      ? (progress / 0.5) * 60
      : ((1 - progress) / 0.5) * 60;
    ctx.fillStyle = '#ff5555';
    ctx.fillRect(x - 3*s, y - tongueLen*s, 6*s, tongueLen*s);
    // Tongue tip
    ctx.fillStyle = '#ff8888';
    ctx.fillRect(x - 5*s, y - tongueLen*s - 5*s, 10*s, 5*s);
  }

  // Feet
  ctx.fillStyle = '#2d8a2d';
  ctx.fillRect(x - W/2 - 4*s, y + H/2 - 8*s, 8*s, 8*s);
  ctx.fillRect(x + W/2 - 4*s, y + H/2 - 8*s, 8*s, 8*s);
}

function drawInsect(ins) {
  const s = SCALE;
  const x = ins.x * s, y = ins.y * s;
  const sz = ins.size * s;

  // Glow
  ctx.save();
  ctx.shadowBlur = 12 * s;
  ctx.shadowColor = ins.glow;
  ctx.font = `${sz}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(ins.emoji, x, y);
  ctx.restore();
}

function drawBackground() {
  // Night sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CH);
  grad.addColorStop(0, '#050a08');
  grad.addColorStop(0.7, '#091409');
  grad.addColorStop(1, '#0d1e0a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CW, CH);

  // Stars
  ctx.fillStyle = 'rgba(200,255,200,0.5)';
  const starSeed = 42;
  for (let i = 0; i < 40; i++) {
    // Deterministic pseudo-random stars
    const sx = ((i * 137 + 83) % 400) * SCALE;
    const sy = ((i * 251 + 17) % 250) * SCALE;
    const br = (frameCount / 80 + i * 0.3) % 1;
    ctx.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(br * Math.PI));
    ctx.fillRect(sx, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // Swamp ground
  ctx.fillStyle = '#0d2e0d';
  ctx.fillRect(0, CH - px(30), CW, px(30));
  ctx.fillStyle = '#0a220a';
  ctx.fillRect(0, CH - px(26), CW, px(4));

  // Lily pads / grass tufts
  ctx.fillStyle = '#1a4a1a';
  for (let i = 0; i < 8; i++) {
    const gx = ((i * 53 + 10) % 380) * SCALE;
    ctx.fillRect(gx, CH - px(32), px(20), px(8));
  }

  // Water shimmer
  ctx.fillStyle = 'rgba(0,100,50,0.15)';
  for (let i = 0; i < 5; i++) {
    const wx = ((frameCount * 0.3 + i * 80) % 400) * SCALE;
    ctx.fillRect(wx, CH - px(28), px(40), px(2));
  }

  // Danger zone indicator (top bar)
  ctx.fillStyle = 'rgba(255,0,0,0.04)';
  ctx.fillRect(0, 0, CW, px(16));
}

function drawMissBar() {
  // Draw miss meter at bottom
  const barW = px(100), barH = px(6);
  const bx = CW/2 - barW/2, by = CH - px(18);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
  const fill = (missCount / MAX_MISS) * barW;
  const fillColor = missCount >= 4 ? '#ff2222' : missCount >= 2 ? '#ffaa00' : '#44ff44';
  ctx.fillStyle = fillColor;
  ctx.fillRect(bx, by, fill, barH);
  ctx.strokeStyle = '#3a6a3a';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx, by, barW, barH);

  // Label
  ctx.fillStyle = '#5a9a5a';
  ctx.font = `${px(7)}px 'Courier New'`;
  ctx.textAlign = 'center';
  ctx.fillText('MISS', CW/2, by - px(2));
}

function drawParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt * SCALE;
    p.y += p.vy * dt * SCALE;
    p.vy += 120 * dt * SCALE; // gravity
    p.life -= dt * 1.8;
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.shadowBlur = 6; ctx.shadowColor = p.color;
    ctx.fillRect(p.x - p.size/2, p.y - p.size/2, p.size, p.size);
    ctx.restore();
  }
}

function drawPixelText(text, x, y, size, color, align='center') {
  ctx.save();
  ctx.font = `bold ${px(size)}px 'Courier New'`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#000';
  ctx.fillText(text, x+1, y+1);
  ctx.fillStyle = color;
  ctx.shadowBlur = 12; ctx.shadowColor = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ===== TITLE SCREEN =====
function drawTitle() {
  drawBackground();

  // Frog in center
  drawFrog(200, 240);

  // Title
  drawPixelText('FROG', CW/2, CH/2 - px(90), 28, '#7fff7f');
  drawPixelText('CATCH', CW/2, CH/2 - px(65), 28, '#44ffaa');

  // Blink prompt
  if (Math.floor(frameCount / 30) % 2 === 0) {
    drawPixelText('PRESS ENTER / TAP', CW/2, CH/2 + px(10), 10, '#aaffaa');
    drawPixelText('TO START', CW/2, CH/2 + px(22), 10, '#aaffaa');
  }

  // Insect legend
  const legend = [
    { e:'🪰', t:'FLY  +10' },
    { e:'🪲', t:'BEETLE +15' },
    { e:'🌟', t:'GOLDEN +50' },
    { e:'✨', t:'FIREFLY +20 BONUS' },
    { e:'☠️', t:'POISON -30 LIFE' },
  ];
  ctx.font = `${px(8)}px 'Courier New'`;
  ctx.textAlign = 'left';
  legend.forEach((l, i) => {
    const lx = CW/2 - px(70), ly = CH/2 + px(45) + i * px(14);
    ctx.font = `${px(10)}px serif`;
    ctx.fillText(l.e, lx, ly);
    ctx.fillStyle = '#7fff7f';
    ctx.font = `${px(7)}px 'Courier New'`;
    ctx.fillText(l.t, lx + px(14), ly + px(1));
  });
}

// ===== GAMEOVER SCREEN =====
function drawGameOver() {
  drawBackground();

  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(px(30), CH/2 - px(80), CW - px(60), px(160));
  ctx.strokeStyle = '#3a7a3a';
  ctx.lineWidth = 2;
  ctx.strokeRect(px(30), CH/2 - px(80), CW - px(60), px(160));

  drawPixelText('GAME OVER', CW/2, CH/2 - px(55), 18, '#ff4444');
  drawPixelText('SCORE: ' + score, CW/2, CH/2 - px(25), 12, '#ffff44');
  drawPixelText('BEST: '  + highScore, CW/2, CH/2 - px(8),  10, '#7fff7f');

  if (score >= highScore && score > 0)
    drawPixelText('NEW RECORD!', CW/2, CH/2 + px(10), 9, '#ffdd00');

  if (Math.floor(frameCount / 30) % 2 === 0)
    drawPixelText('ENTER / TAP TO RETRY', CW/2, CH/2 + px(50), 9, '#aaffaa');
}

// ===== PAUSE SCREEN =====
function drawPause() {
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, CW, CH);
  drawPixelText('PAUSED', CW/2, CH/2, 20, '#7fff7f');
  drawPixelText('P TO RESUME', CW/2, CH/2 + px(22), 9, '#aaffaa');
}

// ===== UPDATE =====
function update(dt) {
  if (state !== STATE.PLAYING) return;

  const timescale = slowMotionFrames > 0 ? 0.35 : 1.0;
  const rdt = dt * timescale;

  gameTime += rdt;
  frameCount++;
  if (slowMotionFrames > 0) slowMotionFrames -= dt * 60;
  if (scoreBonusFrames > 0) scoreBonusFrames -= dt * 60;
  if (shakeFrames > 0) shakeFrames--;
  if (frog.tongueFrame > 0) {
    frog.tongueFrame += 0.4;
    if (frog.tongueFrame > 6) frog.tongueFrame = 0;
  }
  if (flashTimer > 0) flashTimer--;

  // Difficulty: increase spawn rate and insect speed over time
  spawnInterval = Math.max(0.45, 1.4 - gameTime * 0.012);

  // Frog movement
  let moveDir = 0;
  if (keys.left  || btnLeftDown)  moveDir -= 1;
  if (keys.right || btnRightDown) moveDir += 1;
  if (touchActive) moveDir = (touchCurX - touchStartX) > 10 ? 1 : (touchCurX - touchStartX) < -10 ? -1 : 0;

  frog.x += moveDir * frog.speed * rdt;
  frog.x = Math.max(20, Math.min(380, frog.x));

  // Spawn insects
  spawnTimer += rdt;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnInsect();
    // Chance of double spawn at high difficulty
    if (gameTime > 30 && Math.random() < 0.3) spawnInsect();
  }

  // Update insects
  for (let i = insects.length - 1; i >= 0; i--) {
    const ins = insects[i];
    ins.age += rdt;
    ins.y += ins.speed * rdt;
    if (ins.wobble) {
      ins.x = ins.startX + Math.sin(ins.age * ins.wobbleFreq * Math.PI * 2 + ins.wobbleOff) * ins.wobbleAmp;
      ins.x = Math.max(15, Math.min(385, ins.x));
    }

    // Collision with frog (or tongue)
    const fx = frog.x, fy = frog.y;
    const insFrogDist = Math.hypot(ins.x - fx, ins.y - fy);

    // Tongue hit
    let tongueHit = false;
    if (frog.tongueFrame > 0) {
      const progress = frog.tongueFrame / 6;
      const tongueLen = progress <= 0.5
        ? (progress / 0.5) * 60
        : ((1 - progress) / 0.5) * 60;
      const tTip = fy - tongueLen;
      if (Math.abs(ins.x - fx) < 14 && ins.y >= tTip - 10 && ins.y <= fy) {
        tongueHit = true;
      }
    }

    // Body hit
    const bodyHit = insFrogDist < 22;

    if (bodyHit || tongueHit) {
      // Caught!
      let pts = ins.points;
      if (scoreBonusFrames > 0 && pts > 0) pts = Math.floor(pts * 1.5);
      score += pts;
      if (score < 0) score = 0;
      spawnParticles(ins.x * SCALE, ins.y * SCALE, ins.glow, ins.poison ? 14 : 10);
      frog.mouthOpen = true; setTimeout(() => frog.mouthOpen = false, 200);

      if (ins.poison) {
        loseLife();
        flashMsg = '-LIFE!'; flashTimer = 60;
      } else {
        if (ins.special === 'slow') {
          slowMotionFrames = 300;
          flashMsg = 'SLOW MOTION!'; flashTimer = 90;
        }
        if (pts >= 50) {
          scoreBonusFrames = 200;
          flashMsg = 'GOLDEN FLY! +50'; flashTimer = 90;
        }
        updateHUD();
      }
      insects.splice(i, 1);
      continue;
    }

    // Missed (reached bottom)
    if (ins.y > 385) {
      insects.splice(i, 1);
      if (!ins.poison) { // Poison not catching is good (or neutral)
        missCount++;
        if (missCount >= MAX_MISS) {
          loseLife();
          flashMsg = '-LIFE!'; flashTimer = 60;
        }
      }
    }
  }
}

// ===== DRAW GAME =====
function drawGame() {
  // Screen shake
  ctx.save();
  if (shakeFrames > 0) {
    const mag = shakeFrames * 0.8;
    ctx.translate(
      (Math.random() - 0.5) * mag,
      (Math.random() - 0.5) * mag
    );
  }

  drawBackground();
  drawMissBar();

  // Slow motion overlay
  if (slowMotionFrames > 0) {
    ctx.fillStyle = 'rgba(0,200,100,0.06)';
    ctx.fillRect(0, 0, CW, CH);
    drawPixelText('SLOW MOTION', CW/2, px(25), 8, '#44ff88');
  }

  // Score bonus indicator
  if (scoreBonusFrames > 0) {
    ctx.fillStyle = 'rgba(255,200,0,0.06)';
    ctx.fillRect(0, 0, CW, CH);
  }

  // Flash message
  if (flashTimer > 0) {
    ctx.globalAlpha = Math.min(1, flashTimer / 20);
    drawPixelText(flashMsg, CW/2, CH/2 - px(60), 11, '#ffff44');
    ctx.globalAlpha = 1;
  }

  // Draw insects
  insects.forEach(drawInsect);

  // Draw frog
  drawFrog(frog.x, frog.y / SCALE);

  // Draw particles
  drawParticles(0.016);

  ctx.restore();
}

// ===== MAIN LOOP =====
function loop(ts) {
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  ctx.clearRect(0, 0, CW, CH);

  if (state === STATE.TITLE) {
    frameCount++;
    drawTitle();
  } else if (state === STATE.PLAYING) {
    update(dt);
    drawGame();
  } else if (state === STATE.PAUSED) {
    drawGame();
    drawPause();
  } else if (state === STATE.GAMEOVER) {
    frameCount++;
    drawGameOver();
  }

  requestAnimationFrame(loop);
}

// Initialize frog y (needs SCALE)
frog.y = 360; // in game units (will be px'd when drawing)
frog.init = function() {
  this.x = 200; this.y = 355;
  this.tongueFrame = 0; this.mouthOpen = false;
};
frog.y = 355;

requestAnimationFrame(ts => { lastTime = ts; requestAnimationFrame(loop); });