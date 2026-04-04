// ===== LEVEL DEFINITIONS =====
const LEVELS = [
  {
    name: 'Lily Pond',
    emoji: '🌿',
    cell: 52,
    cols: 9,
    rows: 9,
    wallColor: '#1e5a1e',
    wallHighlight: '#2a7a2a',
    pathColor: '#0d2b0d',
    start: { x: 1, y: 1 },
    end:   { x: 7, y: 7 },
    grid: [
      [1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,0,1],
      [1,0,1,0,0,0,1,0,1],
      [1,0,1,0,1,0,1,0,1],
      [1,0,0,0,1,0,0,0,1],
      [1,1,1,0,1,1,1,0,1],
      [1,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: 'Muddy Creek',
    emoji: '💧',
    cell: 48,
    cols: 11,
    rows: 11,
    wallColor: '#2a4a1e',
    wallHighlight: '#3a6a2a',
    pathColor: '#0d200d',
    start: { x: 1, y: 1 },
    end:   { x: 9, y: 9 },
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,1,0,0,0,0,0,1],
      [1,0,1,0,1,0,1,1,1,0,1],
      [1,0,1,0,0,0,1,0,0,0,1],
      [1,0,1,1,1,1,1,0,1,1,1],
      [1,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,0,1,1,1,1,1,0,1],
      [1,0,0,0,1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: 'Dark Swamp',
    emoji: '🌑',
    cell: 44,
    cols: 13,
    rows: 13,
    wallColor: '#1a3a2a',
    wallHighlight: '#245a3a',
    pathColor: '#071510',
    start: { x: 1, y: 1 },
    end:   { x: 11, y: 11 },
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1,0,1,1,1,0,1],
      [1,0,1,0,0,0,0,0,0,0,1,0,1],
      [1,0,1,0,1,1,1,1,1,0,1,0,1],
      [1,0,0,0,1,0,0,0,1,0,0,0,1],
      [1,1,1,0,1,0,1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,1,1,0,1,1,1],
      [1,0,0,0,0,0,0,0,1,0,0,0,1],
      [1,1,1,0,1,1,1,0,1,1,1,0,1],
      [1,0,0,0,1,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: 'Haunted Bog',
    emoji: '👻',
    cell: 40,
    cols: 15,
    rows: 15,
    wallColor: '#2a1a3a',
    wallHighlight: '#3a245a',
    pathColor: '#0a070f',
    start: { x: 1, y: 1 },
    end:   { x: 13, y: 13 },
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
      [1,0,1,1,1,1,1,0,1,0,1,1,1,0,1],
      [1,0,1,0,0,0,1,0,0,0,0,0,1,0,1],
      [1,0,1,0,1,0,1,1,1,1,1,0,1,0,1],
      [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
      [1,1,1,0,1,1,1,0,1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1,0,1,0,0,0,0,0,1],
      [1,0,1,1,1,0,1,0,1,1,1,1,1,0,1],
      [1,0,1,0,0,0,0,0,0,0,0,0,1,0,1],
      [1,0,1,0,1,1,1,1,1,0,1,0,1,0,1],
      [1,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
      [1,1,1,0,1,0,1,1,1,1,1,1,1,0,1],
      [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
  },
  {
    name: 'Chaos Jungle',
    emoji: '🔥',
    cell: 36,
    cols: 17,
    rows: 17,
    wallColor: '#3a1a0a',
    wallHighlight: '#5a2a0f',
    pathColor: '#0f0700',
    start: { x: 1, y: 1 },
    end:   { x: 15, y: 15 },
    grid: [
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
      [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1],
      [1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
      [1,0,1,0,0,0,0,0,0,0,1,0,0,0,1,0,1],
      [1,0,1,0,1,1,1,1,1,0,1,1,1,1,1,0,1],
      [1,0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,1],
      [1,1,1,0,1,0,1,0,1,1,1,0,1,1,1,0,1],
      [1,0,0,0,0,0,1,0,0,0,1,0,1,0,0,0,1],
      [1,0,1,1,1,1,1,1,1,0,1,0,1,0,1,1,1],
      [1,0,0,0,0,0,0,0,1,0,0,0,1,0,0,0,1],
      [1,1,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
      [1,0,0,0,1,0,1,0,0,0,1,0,0,0,1,0,1],
      [1,0,1,0,1,0,1,1,1,0,1,1,1,0,1,0,1],
      [1,0,1,0,0,0,0,0,1,0,0,0,0,0,1,0,1],
      [1,0,1,1,1,1,1,0,1,1,1,1,1,0,1,0,1],
      [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
      [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    ],
  },
];

// ===== STATE =====
let currentLevel = 0;
let frog  = { x: 1, y: 1 };
let moves = 0;
let canvas, ctx;
let level;

// ===== SCREEN MANAGEMENT =====
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ===== GAME FLOW =====
function startGame(levelIndex) {
  currentLevel = levelIndex || 0;
  level = LEVELS[currentLevel];
  showScreen('game-screen');
  updateHUD();
  initCanvas();
  frog  = { ...level.start };
  moves = 0;
  document.getElementById('move-count').textContent = '0';
  draw();
}

function updateHUD() {
  document.getElementById('hud-level').textContent = `${level.emoji} Level ${currentLevel + 1}: ${level.name}`;
  document.getElementById('hud-total').textContent = `of ${LEVELS.length}`;
}

function nextLevel() {
  document.getElementById('confetti').innerHTML = '';
  if (currentLevel + 1 < LEVELS.length) {
    startGame(currentLevel + 1);
  } else {
    showScreen('all-clear-screen');
    spawnConfetti();
  }
}

function resetGame() {
  document.getElementById('confetti').innerHTML = '';
  showScreen('start-screen');
}

// ===== CANVAS =====
function initCanvas() {
  canvas        = document.getElementById('maze-canvas');
  canvas.width  = level.cols * level.cell;
  canvas.height = level.rows * level.cell;
  ctx           = canvas.getContext('2d');
}

// ===== DRAWING =====
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawMaze();
  drawEnd();
  drawFrog();
}

function drawMaze() {
  const { grid, rows, cols, cell, wallColor, wallHighlight, pathColor } = level;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cell;
      const y = row * cell;
      if (grid[row][col] === 1) {
        ctx.fillStyle = wallColor;
        ctx.fillRect(x, y, cell, cell);
        ctx.fillStyle = wallHighlight;
        ctx.fillRect(x, y, cell, 3);
        ctx.fillStyle = '#17481755';
        ctx.fillRect(x + 5,  y + 7,  4, 4);
        ctx.fillRect(x + 18, y + 18, 4, 4);
        ctx.fillRect(x + 30, y + 10, 4, 4);
      } else {
        ctx.fillStyle = pathColor;
        ctx.fillRect(x, y, cell, cell);
        ctx.strokeStyle = '#1a401a22';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(x, y, cell, cell);
      }
    }
  }
}

function drawEnd() {
  const { end, cell } = level;
  const x = end.x * cell;
  const y = end.y * cell;
  const grd = ctx.createRadialGradient(x + cell/2, y + cell/2, 4, x + cell/2, y + cell/2, cell/2 - 2);
  grd.addColorStop(0, '#ffdd0088');
  grd.addColorStop(1, 'transparent');
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(x + cell/2, y + cell/2, cell/2 - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.font         = `${cell * 0.7}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🪰', x + cell/2, y + cell/2 + 2);
}

function drawFrog() {
  const { cell } = level;
  const x = frog.x * cell;
  const y = frog.y * cell;
  ctx.fillStyle = '#00000044';
  ctx.beginPath();
  ctx.ellipse(x + cell/2, y + cell - 5, cell/3, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.font         = `${cell * 0.75}px serif`;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🐸', x + cell/2, y + cell/2);
}

// ===== MOVEMENT =====
function moveFrog(dx, dy) {
  const nx = frog.x + dx;
  const ny = frog.y + dy;
  const { grid, cols, rows, end } = level;
  if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) return;
  if (grid[ny][nx] === 1) { shakeCanvas(); return; }
  frog.x = nx;
  frog.y = ny;
  moves++;
  document.getElementById('move-count').textContent = moves;
  draw();
  if (frog.x === end.x && frog.y === end.y) {
    setTimeout(showWin, 300);
  }
}

function shakeCanvas() {
  const wrapper = document.querySelector('.maze-wrapper');
  wrapper.style.transform = 'translateX(-4px)';
  setTimeout(() => { wrapper.style.transform = 'translateX(4px)'; },  50);
  setTimeout(() => { wrapper.style.transform = 'translateX(-3px)'; }, 100);
  setTimeout(() => { wrapper.style.transform = 'translateX(0)'; },    150);
}

// ===== WIN =====
function showWin() {
  const isLast = currentLevel + 1 >= LEVELS.length;
  document.getElementById('win-level-name').textContent = `${level.emoji} ${level.name} — Complete!`;
  document.getElementById('win-moves').textContent      = `🐾 Moves: ${moves}`;
  const nextBtn = document.getElementById('next-level-btn');
  if (isLast) {
    nextBtn.textContent = '🏆 Final Score';
  } else {
    const next = LEVELS[currentLevel + 1];
    nextBtn.textContent = `Next: ${next.emoji} ${next.name} ➜`;
  }
  showScreen('win-screen');
  spawnConfetti();
}

function spawnConfetti() {
  const container = document.getElementById('confetti');
  container.innerHTML = '';
  const colors = ['#7fff7f','#ffd700','#ff7f7f','#7fbfff','#ff9fff','#ffb347'];
  for (let i = 0; i < 80; i++) {
    const div = document.createElement('div');
    div.className = 'confetti-piece';
    div.style.left              = Math.random() * 100 + 'vw';
    div.style.background        = colors[Math.floor(Math.random() * colors.length)];
    div.style.width             = (8 + Math.random() * 8) + 'px';
    div.style.height            = (8 + Math.random() * 8) + 'px';
    div.style.borderRadius      = Math.random() > 0.5 ? '50%' : '2px';
    div.style.animationDuration = (1.5 + Math.random() * 2) + 's';
    div.style.animationDelay    = (Math.random() * 1) + 's';
    container.appendChild(div);
  }
}

// ===== KEYBOARD SUPPORT =====
document.addEventListener('keydown', e => {
  if (!document.getElementById('game-screen').classList.contains('active')) return;
  if (e.key === 'ArrowUp')    { e.preventDefault(); moveFrog(0, -1); }
  if (e.key === 'ArrowDown')  { e.preventDefault(); moveFrog(0,  1); }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); moveFrog(-1, 0); }
  if (e.key === 'ArrowRight') { e.preventDefault(); moveFrog(1,  0); }
});