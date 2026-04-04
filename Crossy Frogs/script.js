// ─────────────────────────────────────────────
//  CROSSY FROGS  –  game.js
// ─────────────────────────────────────────────

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayMsg   = document.getElementById('overlay-msg');
const finalScoreEl = document.getElementById('final-score');
const startBtn     = document.getElementById('start-btn');
const scoreEl      = document.getElementById('score');
const bestEl       = document.getElementById('best');

// ── Constants ──────────────────────────────
const CELL   = 48;          // px per grid cell
const COLS   = 9;
const ROWS   = 13;          // visible rows
const W      = COLS * CELL;
const H      = ROWS * CELL;

canvas.width  = W;
canvas.height = H;

// ── Colours ────────────────────────────────
const C = {
  safeTile:   '#16a34a',
  safeEdge:   '#15803d',
  road:       '#1f2937',
  roadEdge:   '#111827',
  roadLine:   '#fbbf24',
  water:      '#0369a1',
  waterShine: '#0ea5e9',
  log:        '#a16207',
  logEdge:    '#92400e',
  frog:       '#22c55e',
  frogDark:   '#15803d',
  frogEye:    '#fff',
  frogPupil:  '#111',
  frogBelly:  '#bbf7d0',
  car1:       '#ef4444',
  car2:       '#f97316',
  car3:       '#a855f7',
  car4:       '#3b82f6',
  truck:      '#64748b',
  lily:       '#15803d',
  lilyFlower: '#f9a8d4',
};

// ── Lane layout ────────────────────────────
// Row 0 = bottom (safe start), row ROWS-1 = top
// We procedurally build lanes upward as the frog advances.

function makeLane(rowIndex) {
  // rowIndex 0 is always safe start
  if (rowIndex === 0) return { type: 'safe' };

  // Every ~5 rows place a safe strip
  if (rowIndex % 6 === 0) return { type: 'safe' };

  const roll = Math.random();
  if (roll < 0.45) {
    // Road
    const speed  = (0.8 + Math.random() * 1.4) * (Math.random() < 0.5 ? 1 : -1);
    const gap    = 90 + Math.random() * 80;
    const type   = Math.random() < 0.25 ? 'truck' : 'car';
    const color  = [C.car1, C.car2, C.car3, C.car4][Math.floor(Math.random()*4)];
    return { type: 'road', speed, gap, vehicleType: type, color, vehicles: [] };
  } else {
    // Water + logs
    const speed = (0.5 + Math.random() * 0.8) * (Math.random() < 0.5 ? 1 : -1);
    const gap   = 100 + Math.random() * 60;
    return { type: 'water', speed, gap, logs: [] };
  }
}

// ── Game state ─────────────────────────────
let state, lanes, frog, score, best, camRow, rafId, lastTime, dead, started;

function initGame() {
  score   = 0;
  camRow  = 0;          // which world-row is at the bottom of screen
  dead    = false;
  started = true;

  // Build initial lanes (world rows 0..ROWS+5)
  lanes = [];
  for (let i = 0; i < ROWS + 10; i++) {
    const lane = makeLane(i);
    lane.worldRow = i;
    initLane(lane);
    lanes.push(lane);
  }

  frog = {
    col: Math.floor(COLS / 2),
    row: 0,              // world-row
    x:   Math.floor(COLS / 2) * CELL + CELL/2,
    y:   (ROWS - 1) * CELL + CELL/2,
    drawX: Math.floor(COLS / 2) * CELL + CELL/2,
    drawY: (ROWS - 1) * CELL + CELL/2,
    onLog: null,
    alive: true,
    squish: false,
    splash: false,
    animTimer: 0,
    facing: 'up',
    hop: 0,              // 0-1 hop animation
    hopFrom: { x:0, y:0 },
    hopTo:   { x:0, y:0 },
    hopping: false,
  };

  scoreEl.textContent = 0;
  updateBestDisplay();
}

function initLane(lane) {
  if (lane.type === 'road') {
    lane.vehicles = [];
    const dir = lane.speed > 0 ? 1 : -1;
    let x = dir > 0 ? -80 : W + 80;
    for (let i = 0; i < 4; i++) {
      lane.vehicles.push({ x, w: lane.vehicleType === 'truck' ? 90 : 52, color: lane.color });
      x += dir * lane.gap;
    }
  } else if (lane.type === 'water') {
    lane.logs = [];
    const dir = lane.speed > 0 ? 1 : -1;
    let x = dir > 0 ? -140 : W + 140;
    for (let i = 0; i < 3; i++) {
      lane.logs.push({ x, w: 72 + Math.random() * 48 });
      x += dir * (lane.gap + 30);
    }
  }
}

// ── Input ──────────────────────────────────
document.addEventListener('keydown', e => {
  if (!started || dead) return;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','w','a','s','d'].includes(e.key)) {
    e.preventDefault();
    handleMove(e.key === 'ArrowUp'    || e.key === 'w' ? 'up'    :
               e.key === 'ArrowDown'  || e.key === 's' ? 'down'  :
               e.key === 'ArrowLeft'  || e.key === 'a' ? 'left'  : 'right');
  }
});

// D-pad buttons
['up','down','left','right'].forEach(dir => {
  const btn = document.getElementById('btn-' + dir);
  if (!btn) return;
  const go = e => { e.preventDefault(); if (started && !dead) handleMove(dir); };
  btn.addEventListener('touchstart', go, { passive: false });
  btn.addEventListener('mousedown',  go);
});

function handleMove(dir) {
  if (frog.hopping) return;
  const prev = { col: frog.col, row: frog.row };
  frog.facing = dir;

  if (dir === 'up')    frog.row++;
  if (dir === 'down')  frog.row = Math.max(0, frog.row - 1);
  if (dir === 'left')  frog.col = Math.max(0, frog.col - 1);
  if (dir === 'right') frog.col = Math.min(COLS - 1, frog.col + 1);

  // Score
  if (frog.row > score) {
    score = frog.row;
    scoreEl.textContent = score;
    if (score > (best || 0)) {
      best = score;
      updateBestDisplay();
      localStorage.setItem('crossyFrogsBest', best);
    }
  }

  // Trigger hop animation
  const fromX = worldColToScreenX(prev.col);
  const fromY = worldRowToScreenY(prev.row);
  const toX   = worldColToScreenX(frog.col);
  const toY   = worldRowToScreenY(frog.row);

  frog.hopFrom = { x: fromX, y: fromY };
  frog.hopTo   = { x: toX,   y: toY   };
  frog.hop     = 0;
  frog.hopping = true;
  frog.drawX   = fromX;
  frog.drawY   = fromY;

  // Scroll camera when frog moves into upper half
  ensureCamera();
  ensureLanes();
}

function worldRowToScreenY(worldRow) {
  const screenRow = worldRow - camRow;
  return (ROWS - 1 - screenRow) * CELL + CELL/2;
}

function worldColToScreenX(col) {
  return col * CELL + CELL/2;
}

function ensureCamera() {
  const screenRow = frog.row - camRow;
  if (screenRow > ROWS - 4) {
    camRow = frog.row - (ROWS - 4);
  }
  // Don't scroll back below row 0
  if (camRow < 0) camRow = 0;
}

function ensureLanes() {
  const maxNeeded = camRow + ROWS + 6;
  while (lanes.length < maxNeeded) {
    const lane = makeLane(lanes.length);
    lane.worldRow = lanes.length;
    initLane(lane);
    lanes.push(lane);
  }
}

// ── Update ─────────────────────────────────
function update(dt) {
  if (!frog.alive) return;

  // Hop animation
  if (frog.hopping) {
    frog.hop += dt * 7;
    if (frog.hop >= 1) {
      frog.hop     = 1;
      frog.hopping = false;
    }
    const t = frog.hop;
    const ease = t < 0.5 ? 2*t*t : -1+(4-2*t)*t;
    frog.drawX = frog.hopFrom.x + (frog.hopTo.x - frog.hopFrom.x) * ease;
    frog.drawY = frog.hopFrom.y + (frog.hopTo.y - frog.hopFrom.y) * ease;
  }

  // Move vehicles & logs
  for (const lane of lanes) {
    if (lane.type === 'road') {
      for (const v of lane.vehicles) {
        v.x += lane.speed * dt * 60;
        if (lane.speed > 0 && v.x > W + 120)  v.x = -120;
        if (lane.speed < 0 && v.x < -120)      v.x = W + 120;
      }
    } else if (lane.type === 'water') {
      for (const log of lane.logs) {
        log.x += lane.speed * dt * 60;
        if (lane.speed > 0 && log.x > W + 160)  log.x = -160;
        if (lane.speed < 0 && log.x < -160)      log.x = W + 160;
      }
    }
  }

  // Frog-log riding
  frog.onLog = null;
  const frogLane = lanes[frog.row];
  if (frogLane && frogLane.type === 'water') {
    for (const log of frogLane.logs) {
      const left  = log.x - log.w/2;
      const right = log.x + log.w/2;
      const fx    = frog.col * CELL + CELL/2;
      if (fx > left + 4 && fx < right - 4) {
        frog.onLog = { log, lane: frogLane };
      }
    }
    if (!frog.onLog) {
      killFrog('splash');
      return;
    }
    // Slide frog with log
    if (!frog.hopping) {
      const shift = frogLane.speed * dt * 60;
      frog.col = Math.max(0, Math.min(COLS - 1, frog.col + shift / CELL));
      frog.drawX = frog.col * CELL + CELL/2;
    }
    // Fell off edge?
    if (frog.col < 0 || frog.col >= COLS) {
      killFrog('splash');
      return;
    }
  }

  // Collision with vehicles
  if (frogLane && frogLane.type === 'road') {
    const fx = frog.col * CELL + CELL/2;
    const fy_world = frog.row;
    for (const v of frogLane.vehicles) {
      const vLeft  = v.x - v.w/2 + 6;
      const vRight = v.x + v.w/2 - 6;
      if (fx > vLeft && fx < vRight) {
        killFrog('squish');
        return;
      }
    }
  }
}

function killFrog(mode) {
  if (!frog.alive) return;
  frog.alive   = false;
  frog.squish  = mode === 'squish';
  frog.splash  = mode === 'splash';
  dead = true;

  setTimeout(() => {
    overlayTitle.textContent = mode === 'squish' ? '💀 Squished!' : '💦 Splashed!';
    overlayMsg.textContent   = 'Better luck next time!';
    finalScoreEl.textContent = 'Score: ' + score;
    finalScoreEl.style.display = 'block';
    startBtn.textContent = '🐸 Try Again';
    overlay.style.display = 'flex';
  }, 700);
}

// ── Draw ───────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, W, H);

  // Draw lanes bottom → top (screen)
  for (let screenRow = 0; screenRow < ROWS; screenRow++) {
    const worldRow = camRow + (ROWS - 1 - screenRow);
    const lane = lanes[worldRow];
    const y = screenRow * CELL;

    if (!lane || lane.type === 'safe') {
      drawSafeLane(y);
    } else if (lane.type === 'road') {
      drawRoadLane(y, lane);
    } else if (lane.type === 'water') {
      drawWaterLane(y, lane);
    }
  }

  // Draw frog
  drawFrog();
}

function drawSafeLane(y) {
  ctx.fillStyle = C.safeTile;
  ctx.fillRect(0, y, W, CELL);
  ctx.fillStyle = C.safeEdge;
  ctx.fillRect(0, y + CELL - 3, W, 3);
  // Grass tufts
  ctx.fillStyle = '#15803d';
  for (let c = 0; c < COLS; c++) {
    ctx.beginPath();
    ctx.ellipse(c*CELL + 10, y + CELL - 10, 5, 8, -0.3, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(c*CELL + 30, y + CELL - 12, 4, 7, 0.2, 0, Math.PI*2);
    ctx.fill();
  }
}

function drawRoadLane(y, lane) {
  ctx.fillStyle = C.road;
  ctx.fillRect(0, y, W, CELL);

  // Dashed centre line
  ctx.strokeStyle = C.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.moveTo(0, y + CELL/2);
  ctx.lineTo(W, y + CELL/2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Vehicles
  for (const v of lane.vehicles) {
    drawVehicle(v, y, lane.vehicleType, lane.speed > 0);
  }
}

function drawVehicle(v, laneY, type, goRight) {
  const h = type === 'truck' ? 38 : 30;
  const w = v.w;
  const x = v.x - w/2;
  const y = laneY + (CELL - h)/2;
  const r = 6;

  // Body
  ctx.fillStyle = v.color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();

  // Windshield
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  if (goRight) {
    roundRect(ctx, x + w - 18, y + 4, 14, h - 8, 3);
  } else {
    roundRect(ctx, x + 4, y + 4, 14, h - 8, 3);
  }
  ctx.fill();

  // Wheels
  ctx.fillStyle = '#111';
  [[x+8, y+h-3],[x+w-14, y+h-3],[x+8, y],[x+w-14, y]].forEach(([wx,wy])=>{
    ctx.beginPath(); ctx.ellipse(wx+3, wy+2, 6, 4, 0, 0, Math.PI*2); ctx.fill();
  });

  // Headlights
  ctx.fillStyle = '#fef08a';
  const lx = goRight ? x + w - 6 : x + 2;
  ctx.fillRect(lx, y + 6, 4, 6);
  ctx.fillRect(lx, y + h - 12, 4, 6);
}

function drawWaterLane(y, lane) {
  // Water bg
  ctx.fillStyle = C.water;
  ctx.fillRect(0, y, W, CELL);

  // Shimmer lines
  ctx.strokeStyle = C.waterShine;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(0, y + 8 + i*12);
    ctx.lineTo(W, y + 8 + i*12);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Logs
  for (const log of lane.logs) {
    drawLog(log, y);
  }
}

function drawLog(log, laneY) {
  const h = 30;
  const x = log.x - log.w/2;
  const y = laneY + (CELL - h)/2;

  ctx.fillStyle = C.log;
  roundRect(ctx, x, y, log.w, h, 6);
  ctx.fill();

  // Grain lines
  ctx.strokeStyle = C.logEdge;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(x + 6, y + h/2);
  ctx.lineTo(x + log.w - 6, y + h/2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Log end rings
  ctx.strokeStyle = C.logEdge;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(x + 10, y + h/2, 8, 0, Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(x + log.w - 10, y + h/2, 8, 0, Math.PI*2); ctx.stroke();
}

function drawFrog() {
  const x = frog.drawX;
  const y = frog.drawY;

  if (frog.splash) {
    // Splash particles
    ctx.fillStyle = C.pond;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const r = 14 + i * 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(angle)*r, y + Math.sin(angle)*r, 3, 0, Math.PI*2);
      ctx.fill();
    }
    return;
  }

  if (frog.squish) {
    // Squished frog
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1.6, 0.35);
    ctx.fillStyle = C.frog;
    ctx.beginPath();
    ctx.arc(0, 0, 18, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fbbf24';
    ctx.font = '18px serif';
    ctx.textAlign = 'center';
    ctx.fillText('✕', x-7, y+4);
    ctx.fillText('✕', x+7, y+4);
    return;
  }

  const hop   = frog.hopping ? Math.sin(frog.hop * Math.PI) : 0;
  const jumpY = -hop * 14;

  ctx.save();
  ctx.translate(x, y + jumpY);

  // Rotate based on facing
  const rot = { up:0, down: Math.PI, left: -Math.PI/2, right: Math.PI/2 }[frog.facing] || 0;
  ctx.rotate(rot);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(0, 16 - jumpY/2, 14, 5, 0, 0, Math.PI*2);
  ctx.fill();

  // Body
  ctx.fillStyle = C.frog;
  ctx.beginPath();
  ctx.ellipse(0, 2, 14, 16, 0, 0, Math.PI*2);
  ctx.fill();

  // Belly
  ctx.fillStyle = C.frogBelly;
  ctx.beginPath();
  ctx.ellipse(0, 6, 8, 10, 0, 0, Math.PI*2);
  ctx.fill();

  // Back legs
  ctx.fillStyle = C.frogDark;
  // left back leg
  ctx.beginPath();
  ctx.moveTo(-8, 10);
  ctx.quadraticCurveTo(-22, 14, -20, 22);
  ctx.quadraticCurveTo(-14, 22, -10, 16);
  ctx.closePath(); ctx.fill();
  // right back leg
  ctx.beginPath();
  ctx.moveTo(8, 10);
  ctx.quadraticCurveTo(22, 14, 20, 22);
  ctx.quadraticCurveTo(14, 22, 10, 16);
  ctx.closePath(); ctx.fill();

  // Front legs
  // left
  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.quadraticCurveTo(-20, -4, -18, -12);
  ctx.quadraticCurveTo(-12, -14, -8, -8);
  ctx.closePath(); ctx.fill();
  // right
  ctx.beginPath();
  ctx.moveTo(9, -4);
  ctx.quadraticCurveTo(20, -4, 18, -12);
  ctx.quadraticCurveTo(12, -14, 8, -8);
  ctx.closePath(); ctx.fill();

  // Head bump
  ctx.fillStyle = C.frog;
  ctx.beginPath();
  ctx.ellipse(0, -12, 10, 9, 0, 0, Math.PI*2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#166534';
  ctx.beginPath(); ctx.arc(-6, -16, 5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6, -16, 5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = C.frogEye;
  ctx.beginPath(); ctx.arc(-6, -16, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6, -16, 3.5, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = C.frogPupil;
  ctx.beginPath(); ctx.arc(-5.5, -16, 2, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc( 6.5, -16, 2, 0, Math.PI*2); ctx.fill();

  // Smile
  ctx.strokeStyle = C.frogDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -9, 4, 0.2, Math.PI - 0.2);
  ctx.stroke();

  ctx.restore();
}

// ── Loop ───────────────────────────────────
function loop(ts) {
  if (!lastTime) lastTime = ts;
  const dt = Math.min((ts - lastTime) / 1000, 0.05);
  lastTime = ts;

  update(dt);
  draw();

  rafId = requestAnimationFrame(loop);
}

// ── Utils ──────────────────────────────────
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

function updateBestDisplay() {
  bestEl.textContent = best || 0;
}

// ── Start / Restart ────────────────────────
function startGame() {
  if (rafId) cancelAnimationFrame(rafId);
  lastTime = null;
  best = parseInt(localStorage.getItem('crossyFrogsBest') || '0');
  initGame();
  overlay.style.display = 'none';
  rafId = requestAnimationFrame(loop);
}

startBtn.addEventListener('click', startGame);
startBtn.addEventListener('touchstart', e => { e.preventDefault(); startGame(); }, { passive: false });

// ── Initial overlay ────────────────────────
overlayTitle.textContent    = '🐸 Crossy Frogs';
overlayMsg.textContent      = 'Hop across roads & rivers\nwithout getting squished or wet!';
finalScoreEl.style.display  = 'none';
startBtn.textContent        = '🐸 Start Hopping!';
best = parseInt(localStorage.getItem('crossyFrogsBest') || '0');
updateBestDisplay();