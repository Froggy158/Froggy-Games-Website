/**
 * ═══════════════════════════════════════════════════════
 *  SOLVE THE FROG  —  script.js
 *  Vanilla JS game engine with modular puzzle types
 * ═══════════════════════════════════════════════════════
 */

/* ────────────────────────────────────────────────────
   SECTION 1: GLOBAL STATE
──────────────────────────────────────────────────── */
const State = {
  coins: 0,
  soundOn: true,
  unlockedLevels: [0],   // indices
  completedLevels: {},   // { index: { stars, moves, time } }
  currentLevel: 0,
  equippedSkin: 0,       // index into SKINS
  ownedSkins: [0],
};

// Runtime game state (reset per level)
let G = {
  moves: 0,
  startTime: 0,
  timerInterval: null,
  solved: false,
  data: {},              // puzzle-specific mutable data
};

/* ────────────────────────────────────────────────────
   SECTION 2: SHOP / SKINS
──────────────────────────────────────────────────── */
const SKINS = [
  { name: 'Classic',   emoji: '🐸', price: 0   },
  { name: 'Sunny',     emoji: '🌝', price: 50  },
  { name: 'Alien',     emoji: '👽', price: 80  },
  { name: 'Robot',     emoji: '🤖', price: 100 },
  { name: 'Panda',     emoji: '🐼', price: 120 },
  { name: 'Dragon',    emoji: '🐲', price: 200 },
];

function frogEmoji() { return SKINS[State.equippedSkin].emoji; }

/* ────────────────────────────────────────────────────
   SECTION 3: LEVEL DEFINITIONS
   Each level has: title, type, hint, coinReward, data
──────────────────────────────────────────────────── */
const LEVELS = [
  // ─── 0: Lily Pad Leap (path grid) ───────────────
  {
    title: 'Lily Pad Leap',
    type: 'grid-path',
    hint: 'Tap a lily pad to jump there. Reach the golden pad!',
    coinReward: 15,
    data: {
      cols: 4, rows: 4,
      // g=goal, f=frog start, l=lily, w=water, r=rock
      grid: [
        'f','l','w','w',
        'w','l','l','w',
        'w','w','l','l',
        'w','w','w','g',
      ],
      frogPos: 0,
      goalPos: 15,
      maxMoves: 8,
    }
  },
  // ─── 1: Fly Catcher (catch in order) ────────────
  {
    title: 'Fly Catcher',
    type: 'fly-order',
    hint: 'Catch the flies in numbered order (1→2→3…)!',
    coinReward: 20,
    data: {
      cols: 4, rows: 3,
      grid: [
        'l','f1','l','f3',
        'l','l','f2','l',
        'f5','l','l','f4',
      ],
      frogStart: 4,   // index of frog starting cell (a lily)
      order: 5,       // total flies
      maxMoves: 12,
    }
  },
  // ─── 2: Memory Match (pairs) ────────────────────
  {
    title: 'Memory Pond',
    type: 'memory',
    hint: 'Flip tiles two at a time. Match all pairs!',
    coinReward: 25,
    data: {
      pairs: ['🌸','🍀','🦋','🐛','🌺','💧'],
      cols: 4,
    }
  },
  // ─── 3: Colour Sequence (Simon-ish) ─────────────
  {
    title: 'Croak Pattern',
    type: 'sequence',
    hint: 'Watch the pattern, then repeat it!',
    coinReward: 25,
    data: {
      sequence: ['🔴','🟢','🔵','🟡'],
      rounds: 4,        // show 4 steps
    }
  },
  // ─── 4: Maze Navigate ────────────────────────────
  {
    title: 'Swamp Maze',
    type: 'maze',
    hint: 'Navigate from 🐸 to 🌟 using the direction buttons!',
    coinReward: 30,
    data: {
      cols: 7, rows: 7,
      // 0=path, 1=wall, S=start, E=end
      grid: [
        1,1,1,1,1,1,1,
        1,'S',0,0,1,0,1,
        1,1,1,0,1,0,1,
        1,0,0,0,0,0,1,
        1,0,1,1,1,0,1,
        1,0,0,0,1,'E',1,
        1,1,1,1,1,1,1,
      ],
    }
  },
  // ─── 5: Moving Platforms (timing) ───────────────
  {
    title: 'Log River',
    type: 'platform',
    hint: 'Jump to each platform at the right moment!',
    coinReward: 35,
    data: {
      lanes: 4,
      targetLane: 3,
      platformWidth: 60,  // px
      laneSpeed: [60, 90, 75, 55], // px/s
    }
  },
  // ─── 6: Bigger Lily Grid ─────────────────────────
  {
    title: 'Leap of Faith',
    type: 'grid-path',
    hint: 'Reach the goal! Some pads break after one use 🔸.',
    coinReward: 35,
    data: {
      cols: 5, rows: 5,
      grid: [
        'f','l','w','w','w',
        'w','b','l','w','w',
        'w','w','b','l','w',
        'w','w','w','b','l',
        'w','w','w','w','g',
      ],
      frogPos: 0,
      goalPos: 24,
      maxMoves: 10,
      // b = breakable lily pad
    }
  },
  // ─── 7: Harder fly order ─────────────────────────
  {
    title: 'Feast of Flies',
    type: 'fly-order',
    hint: 'Catch all 7 flies in numbered order!',
    coinReward: 40,
    data: {
      cols: 4, rows: 4,
      grid: [
        'f2','l','f4','l',
        'l','f1','l','f6',
        'f3','l','l','f7',
        'l','f5','l','s',  // s = frog start
      ],
      frogStart: 15,
      order: 7,
      maxMoves: 30,
    }
  },
  // ─── 8: Harder maze ──────────────────────────────
  {
    title: 'Deep Swamp',
    type: 'maze',
    hint: 'A trickier swamp. Find the only path!',
    coinReward: 45,
    data: {
      cols: 9, rows: 9,
      grid: [
        1,1,1,1,1,1,1,1,1,
        1,'S',1,0,0,0,1,0,1,
        1,0,1,0,1,0,1,0,1,
        1,0,0,0,1,0,0,0,1,
        1,1,1,0,1,1,1,0,1,
        1,0,0,0,0,0,1,0,1,
        1,0,1,1,1,0,1,0,1,
        1,0,0,0,0,0,1,'E',1,
        1,1,1,1,1,1,1,1,1,
      ],
    }
  },
  // ─── 9: Longer sequence ──────────────────────────
  {
    title: 'Frog Choir',
    type: 'sequence',
    hint: 'The pattern grows! How long can you go?',
    coinReward: 50,
    data: {
      sequence: ['🔴','🟢','🔵','🟡','🟠','🟣'],
      rounds: 6,
    }
  },
];

/* ────────────────────────────────────────────────────
   SECTION 4: SOUND (Web Audio API beeps)
──────────────────────────────────────────────────── */
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playBeep(freq = 440, duration = 0.1, type = 'sine', vol = 0.3) {
  if (!State.soundOn) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch(e) {}
}

const SFX = {
  jump:    () => playBeep(480, 0.12, 'sine'),
  fail:    () => playBeep(200, 0.2, 'sawtooth'),
  win:     () => { playBeep(523,0.15); setTimeout(()=>playBeep(659,0.15),150); setTimeout(()=>playBeep(784,0.2),300); },
  coin:    () => playBeep(880, 0.08, 'sine'),
  flip:    () => playBeep(660, 0.08, 'triangle'),
  match:   () => { playBeep(523,0.1); setTimeout(()=>playBeep(659,0.1),100); },
  wrong:   () => playBeep(180, 0.18, 'square'),
  click:   () => playBeep(700, 0.06, 'sine', 0.15),
  seq:     (i) => { const notes=[400,500,600,700,750,800]; playBeep(notes[i]||440, 0.15); },
};

/* ────────────────────────────────────────────────────
   SECTION 5: PERSISTENCE (localStorage)
──────────────────────────────────────────────────── */
const SAVE_KEY = 'solvethefrog_v1';

function saveState() {
  const payload = {
    coins: State.coins,
    soundOn: State.soundOn,
    unlockedLevels: State.unlockedLevels,
    completedLevels: State.completedLevels,
    equippedSkin: State.equippedSkin,
    ownedSkins: State.ownedSkins,
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
}

function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.assign(State, data);
  } catch(e) {}
}

/* ────────────────────────────────────────────────────
   SECTION 6: SCREEN NAVIGATION
──────────────────────────────────────────────────── */
const screens = {};
['home','levels','game','win','shop'].forEach(id => {
  screens[id] = document.getElementById(`screen-${id}`);
});
const overlay = document.getElementById('transition-overlay');

function showScreen(id, cb) {
  // Fade to black
  overlay.classList.remove('hidden');
  overlay.classList.add('active');
  setTimeout(() => {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[id].classList.add('active');
    overlay.classList.remove('active');
    setTimeout(() => {
      overlay.classList.add('hidden');
      if (cb) cb();
    }, 230);
  }, 220);
}

/* ────────────────────────────────────────────────────
   SECTION 7: HUD / UI HELPERS
──────────────────────────────────────────────────── */
function updateCoinDisplays() {
  document.getElementById('home-coin-count').textContent   = State.coins;
  document.getElementById('levels-coin-count').textContent = State.coins;
  document.getElementById('game-coin-count').textContent   = State.coins;
  document.getElementById('shop-coin-count').textContent   = State.coins;
}

function addCoins(amount, x, y) {
  State.coins += amount;
  updateCoinDisplays();
  saveState();
  SFX.coin();
  // Floating coin pop
  const pop = document.createElement('div');
  pop.className = 'coin-pop';
  pop.textContent = `+${amount}🪙`;
  pop.style.left = (x || window.innerWidth/2 - 30) + 'px';
  pop.style.top  = (y || 200) + 'px';
  document.body.appendChild(pop);
  setTimeout(() => pop.remove(), 1200);
}

const toastEl = document.getElementById('toast');
let toastTimer;
function showToast(msg, duration = 2000) {
  toastEl.classList.remove('hidden');
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    setTimeout(() => toastEl.classList.add('hidden'), 300);
  }, duration);
}

function startTimer() {
  clearInterval(G.timerInterval);
  G.startTime = Date.now();
  const el = document.getElementById('stat-timer');
  G.timerInterval = setInterval(() => {
    const s = Math.floor((Date.now() - G.startTime) / 1000);
    el.textContent = s + 's';
  }, 500);
}

function stopTimer() {
  clearInterval(G.timerInterval);
  return Math.floor((Date.now() - G.startTime) / 1000);
}

function incrementMoves() {
  G.moves++;
  document.getElementById('stat-moves').textContent = G.moves;
}

/* ────────────────────────────────────────────────────
   SECTION 8: LEVEL SELECT SCREEN
──────────────────────────────────────────────────── */
function buildLevelGrid() {
  const grid = document.getElementById('level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((lvl, i) => {
    const card = document.createElement('div');
    const completed = State.completedLevels[i];
    const unlocked  = State.unlockedLevels.includes(i);

    card.className = `level-card ${completed ? 'completed' : unlocked ? 'unlocked' : 'locked'}`;

    const stars = completed ? starsForLevel(i) : 0;
    const starStr = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);

    card.innerHTML = `
      <div class="level-emoji">${unlocked ? PUZZLE_ICONS[lvl.type] : '🔒'}</div>
      <div class="level-num">${i + 1}</div>
      ${completed ? `<div class="level-stars">${starStr}</div>` : ''}
    `;

    if (unlocked) {
      card.addEventListener('click', () => {
        SFX.click();
        startLevel(i);
      });
    }

    grid.appendChild(card);
  });
}

const PUZZLE_ICONS = {
  'grid-path': '🌿',
  'fly-order': '🪰',
  'memory':    '🃏',
  'sequence':  '🎵',
  'maze':      '🗺️',
  'platform':  '🪵',
};

function starsForLevel(i) {
  const rec = State.completedLevels[i];
  if (!rec) return 0;
  let stars = 1;
  const lvl = LEVELS[i];
  if (rec.moves <= (lvl.data.maxMoves || 99) * 0.6) stars++;
  if (rec.time <= 40) stars++;
  return Math.min(stars, 3);
}

/* ────────────────────────────────────────────────────
   SECTION 9: LEVEL INIT & DISPATCH
──────────────────────────────────────────────────── */
function startLevel(index) {
  State.currentLevel = index;
  const lvl = LEVELS[index];

  // Reset G
  clearInterval(G.timerInterval);
  G = { moves: 0, startTime: 0, timerInterval: null, solved: false, data: {} };

  // HUD
  document.getElementById('hud-level-label').textContent  = `Level ${index + 1}`;
  document.getElementById('hud-puzzle-title').textContent = lvl.title;
  document.getElementById('stat-moves').textContent = '0';
  document.getElementById('hint-cost').textContent  = '(10🪙)';

  // Best score
  const rec = State.completedLevels[index];
  document.getElementById('stat-best').textContent = rec ? rec.moves : '—';

  // Show/hide timer
  document.getElementById('stat-timer-wrap').style.display =
    (lvl.type === 'platform') ? 'flex' : 'flex';
  document.getElementById('stat-timer').textContent = '0s';

  // Hide hint overlay
  document.getElementById('hint-overlay').classList.add('hidden');

  // Hint text
  document.getElementById('hint-text').textContent = lvl.hint;

  // Clear game area
  const area = document.getElementById('game-area');
  area.innerHTML = '';

  // Navigate then build puzzle
  showScreen('game', () => {
    buildPuzzle(lvl, area);
    startTimer();
  });
}

function buildPuzzle(lvl, area) {
  switch (lvl.type) {
    case 'grid-path': buildGridPath(lvl, area); break;
    case 'fly-order': buildFlyOrder(lvl, area); break;
    case 'memory':    buildMemory(lvl, area);    break;
    case 'sequence':  buildSequence(lvl, area);  break;
    case 'maze':      buildMaze(lvl, area);      break;
    case 'platform':  buildPlatform(lvl, area);  break;
    default:          area.textContent = 'Unknown puzzle type'; break;
  }
}

/* ────────────────────────────────────────────────────
   SECTION 10: PUZZLE — GRID PATH
   Frog hops across lily pads to goal.
   Adjacency: 4-directional. 'b' = breakable pad.
──────────────────────────────────────────────────── */
function buildGridPath(lvl, area) {
  const { cols, rows, grid: template, maxMoves } = lvl.data;

  // Deep-copy mutable state
  const grid = [...template];
  G.data = {
    grid,
    frogPos: template.indexOf('f'),
    goalPos: template.indexOf('g'),
    cols, rows, maxMoves,
    brokenPads: new Set(),
  };

  // If frog starts on 'f', treat as lily for display
  grid[G.data.frogPos] = 'l';

  renderGridPath(area);
}

function renderGridPath(area) {
  const { grid, frogPos, goalPos, cols, brokenPads } = G.data;
  const rows = G.data.rows;
  area.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '8px';
  wrap.style.width = '100%';

  const instr = document.createElement('p');
  instr.className = 'puzzle-instruction';
  instr.textContent = `Reach the 🌟! Max ${G.data.maxMoves} moves.`;
  wrap.appendChild(instr);

  const gridEl = document.createElement('div');
  gridEl.className = 'puzzle-grid';
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.style.maxWidth = Math.min(340, 68 * cols) + 'px';

  grid.forEach((type, i) => {
    const cell = document.createElement('div');
    const isFrog = (i === frogPos);
    const isGoal = (i === goalPos);
    const isBroken = brokenPads.has(i);

    let cls = 'cell ';
    if (isGoal) cls += 'goal';
    else if (isBroken) cls += 'water';
    else if (type === 'b') cls += 'lily';
    else if (type === 'l') cls += 'lily';
    else if (type === 'w') cls += 'water';
    else if (type === 'r') cls += 'rock';
    else cls += 'empty';

    cell.className = cls;
    cell.textContent = isFrog ? frogEmoji() : isGoal ? '🌟' : '';

    // Adjacency tap
    if ((type === 'l' || type === 'b') && !isFrog && !isBroken) {
      cell.addEventListener('click', () => handleGridMove(i, area));
    }
    if (isGoal) {
      cell.addEventListener('click', () => handleGridMove(i, area));
    }

    gridEl.appendChild(cell);
  });

  wrap.appendChild(gridEl);
  area.appendChild(wrap);
}

function handleGridMove(targetIdx, area) {
  if (G.solved) return;
  const { frogPos, cols, rows, grid, goalPos, maxMoves, brokenPads } = G.data;

  // Check adjacency
  const fr = Math.floor(frogPos / cols);
  const fc = frogPos % cols;
  const tr = Math.floor(targetIdx / cols);
  const tc = targetIdx % cols;
  const dist = Math.abs(fr - tr) + Math.abs(fc - tc);

  if (dist !== 1) { showToast('Too far! Hop to adjacent pads.'); SFX.fail(); return; }

  incrementMoves();
  SFX.jump();

  // Mark breakable
  if (grid[frogPos] === 'b') brokenPads.add(frogPos);

  G.data.frogPos = targetIdx;
  renderGridPath(area);

  // Win?
  if (targetIdx === goalPos) {
    solveLevel();
    return;
  }

  // Moves exceeded?
  if (G.moves >= maxMoves) {
    showToast('Out of moves! Restarting…');
    SFX.fail();
    setTimeout(() => restartLevel(), 1200);
  }
}

/* ────────────────────────────────────────────────────
   SECTION 11: PUZZLE — FLY ORDER
   Frog catches flies in numbered sequence.
──────────────────────────────────────────────────── */
function buildFlyOrder(lvl, area) {
  const { cols, rows, grid: template, frogStart, order, maxMoves } = lvl.data;

  // Parse grid: 'fN' = fly #N, 'l' = lily, 's' = start
  const grid = template.map(c => {
    if (c === 's') return 'l';   // frog start cell is a lily
    return c;
  });

  G.data = {
    grid, cols, rows, maxMoves, order,
    frogPos: frogStart,
    nextFly: 1,
    caughtFlies: new Set(),
  };

  renderFlyOrder(area);
}

function renderFlyOrder(area) {
  const { grid, frogPos, cols, rows, nextFly, order, caughtFlies } = G.data;
  area.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '8px';
  wrap.style.width = '100%';

  const instr = document.createElement('p');
  instr.className = 'puzzle-instruction';
  instr.textContent = `Catch fly #${nextFly} of ${order} 🪰`;
  wrap.appendChild(instr);

  const gridEl = document.createElement('div');
  gridEl.className = 'puzzle-grid';
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.style.maxWidth = Math.min(340, 72 * cols) + 'px';

  grid.forEach((type, i) => {
    const cell = document.createElement('div');
    const isFrog = (i === frogPos);
    const flyMatch = type.match(/^f(\d+)$/);
    const flyNum = flyMatch ? parseInt(flyMatch[1]) : null;
    const isCaught = flyNum && caughtFlies.has(flyNum);

    let cls = 'cell ';
    if (flyNum && !isCaught) cls += 'fly-target';
    else cls += 'lily';
    if (isCaught) cls += ' fly-caught';

    cell.className = cls;

    if (isFrog) {
      cell.textContent = frogEmoji();
    } else if (flyNum && !isCaught) {
      cell.textContent = '🪰';
      const badge = document.createElement('div');
      badge.className = 'order-badge';
      badge.textContent = flyNum;
      cell.appendChild(badge);
    }

    // Click: only walkable if adjacent
    if (!isFrog) {
      cell.addEventListener('click', () => handleFlyMove(i, area));
    }

    gridEl.appendChild(cell);
  });

  wrap.appendChild(gridEl);
  area.appendChild(wrap);
}

function handleFlyMove(targetIdx, area) {
  if (G.solved) return;
  const { frogPos, cols, grid, nextFly, caughtFlies, maxMoves } = G.data;

  const fr = Math.floor(frogPos / cols), fc = frogPos % cols;
  const tr = Math.floor(targetIdx / cols), tc = targetIdx % cols;
  if (Math.abs(fr - tr) + Math.abs(fc - tc) !== 1) {
    showToast('Only adjacent hops!'); SFX.fail(); return;
  }

  const type = grid[targetIdx];
  const flyMatch = type.match(/^f(\d+)$/);
  const flyNum = flyMatch ? parseInt(flyMatch[1]) : null;

  // If it's the wrong fly
  if (flyNum && flyNum !== nextFly) {
    showToast(`Catch fly #${nextFly} first!`); SFX.fail(); return;
  }

  incrementMoves();
  SFX.jump();
  G.data.frogPos = targetIdx;

  if (flyNum === nextFly) {
    caughtFlies.add(flyNum);
    G.data.nextFly++;
    SFX.match();
    if (G.data.nextFly > G.data.order) { solveLevel(); return; }
  }

  renderFlyOrder(area);

  if (G.moves >= maxMoves && G.data.nextFly <= G.data.order) {
    showToast('Out of moves!'); SFX.fail();
    setTimeout(() => restartLevel(), 1200);
  }
}

/* ────────────────────────────────────────────────────
   SECTION 12: PUZZLE — MEMORY MATCH
──────────────────────────────────────────────────── */
function buildMemory(lvl, area) {
  const { pairs, cols } = lvl.data;
  // Duplicate & shuffle
  const cards = [...pairs, ...pairs].sort(() => Math.random() - 0.5);
  G.data = {
    cards, cols,
    flipped: [],        // indices currently face-up
    matched: new Set(),
    locked: false,
  };
  renderMemory(area);
}

function renderMemory(area) {
  const { cards, cols, flipped, matched } = G.data;
  area.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '8px';
  wrap.style.width = '100%';

  const instr = document.createElement('p');
  instr.className = 'puzzle-instruction';
  instr.textContent = `Match all ${cards.length / 2} pairs!`;
  wrap.appendChild(instr);

  const gridEl = document.createElement('div');
  gridEl.className = 'puzzle-grid';
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.style.maxWidth = Math.min(340, 72 * cols) + 'px';

  cards.forEach((emoji, i) => {
    const cell = document.createElement('div');
    const isFlipped  = flipped.includes(i);
    const isMatched  = matched.has(i);
    const faceUp     = isFlipped || isMatched;

    cell.className = `cell memory-card ${faceUp ? 'flipped' : 'face-down'} ${isMatched ? 'matched' : ''}`;
    cell.textContent = faceUp ? emoji : '🌿';
    cell.dataset.idx = i;
    cell.addEventListener('click', () => handleMemoryClick(i, area));
    gridEl.appendChild(cell);
  });

  wrap.appendChild(gridEl);
  area.appendChild(wrap);

  // Progress bar
  const pb = document.createElement('div');
  pb.className = 'progress-bar-wrap';
  const fill = document.createElement('div');
  fill.className = 'progress-bar-fill';
  fill.style.width = `${(G.data.matched.size / cards.length) * 100}%`;
  pb.appendChild(fill);
  wrap.appendChild(pb);
}

function handleMemoryClick(idx, area) {
  if (G.solved || G.data.locked) return;
  const { flipped, matched, cards } = G.data;
  if (matched.has(idx) || flipped.includes(idx)) return;

  SFX.flip();
  flipped.push(idx);
  renderMemory(area);

  if (flipped.length === 2) {
    G.data.locked = true;
    incrementMoves();
    const [a, b] = flipped;
    if (cards[a] === cards[b]) {
      // Match!
      matched.add(a); matched.add(b);
      G.data.flipped = [];
      G.data.locked = false;
      SFX.match();
      renderMemory(area);
      if (matched.size === cards.length) { solveLevel(); }
    } else {
      SFX.wrong();
      setTimeout(() => {
        G.data.flipped = [];
        G.data.locked = false;
        renderMemory(area);
      }, 900);
    }
  }
}

/* ────────────────────────────────────────────────────
   SECTION 13: PUZZLE — SEQUENCE (Simon-like)
──────────────────────────────────────────────────── */
function buildSequence(lvl, area) {
  const { sequence, rounds } = lvl.data;
  // Build a random sequence of `rounds` elements
  const seq = Array.from({length: rounds}, () => sequence[Math.floor(Math.random() * sequence.length)]);
  G.data = {
    sequence: seq,
    options: sequence,  // buttons available
    playerInput: [],
    phase: 'watching',  // watching | input
    showingIdx: 0,
  };
  renderSequence(area, seq, sequence);
  setTimeout(() => playSequence(area), 1000);
}

function renderSequence(area, seq, options) {
  area.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '14px';
  wrap.style.width = '100%';

  const instr = document.createElement('p');
  instr.className = 'puzzle-instruction';
  instr.id = 'seq-instruction';
  instr.textContent = '👀 Watch the pattern…';
  wrap.appendChild(instr);

  // Display sequence slots
  const display = document.createElement('div');
  display.className = 'seq-display';
  display.id = 'seq-display';
  seq.forEach((emoji, i) => {
    const tile = document.createElement('div');
    tile.className = 'seq-tile';
    tile.id = `seq-tile-${i}`;
    tile.style.background = 'rgba(255,255,255,0.05)';
    tile.textContent = '❓';
    display.appendChild(tile);
  });
  wrap.appendChild(display);

  // Input buttons
  const btns = document.createElement('div');
  btns.className = 'seq-buttons';
  btns.id = 'seq-buttons';
  const colors = { '🔴': '#e05252', '🟢': '#3dba6f', '🔵': '#3498c8', '🟡': '#f5c842', '🟠': '#ff9f3d', '🟣': '#9b59b6' };
  options.forEach((emoji, i) => {
    const btn = document.createElement('button');
    btn.className = 'seq-btn';
    btn.textContent = emoji;
    btn.style.background = colors[emoji] || '#555';
    btn.disabled = true;
    btn.addEventListener('click', () => handleSeqInput(emoji, area));
    btns.appendChild(btn);
  });
  wrap.appendChild(btns);

  // Progress
  const pb = document.createElement('div');
  pb.className = 'progress-bar-wrap';
  const fill = document.createElement('div');
  fill.className = 'progress-bar-fill';
  fill.id = 'seq-progress';
  fill.style.width = '0%';
  pb.appendChild(fill);
  wrap.appendChild(pb);

  area.appendChild(wrap);
}

function playSequence(area) {
  G.data.phase = 'watching';
  G.data.playerInput = [];
  const seq = G.data.sequence;
  document.getElementById('seq-instruction').textContent = '👀 Watch the pattern…';
  // Disable buttons
  document.querySelectorAll('.seq-btn').forEach(b => b.disabled = true);

  let i = 0;
  function showNext() {
    if (i >= seq.length) {
      // Done showing — player's turn
      setTimeout(() => {
        G.data.phase = 'input';
        document.getElementById('seq-instruction').textContent = '🐸 Your turn! Repeat it!';
        document.querySelectorAll('.seq-btn').forEach(b => b.disabled = false);
      }, 400);
      return;
    }
    const tile = document.getElementById(`seq-tile-${i}`);
    if (tile) {
      tile.textContent = seq[i];
      tile.classList.add('active');
      SFX.seq(G.data.options.indexOf(seq[i]));
      setTimeout(() => {
        tile.classList.remove('active');
        i++;
        setTimeout(showNext, 350);
      }, 500);
    } else { i++; showNext(); }
  }
  showNext();
}

function handleSeqInput(emoji, area) {
  if (G.data.phase !== 'input' || G.solved) return;
  const { playerInput, sequence } = G.data;
  incrementMoves();
  const idx = playerInput.length;
  playerInput.push(emoji);

  // Highlight tile
  const tile = document.getElementById(`seq-tile-${idx}`);
  if (tile) {
    tile.textContent = emoji;
    tile.classList.add('active');
    setTimeout(() => tile.classList.remove('active'), 250);
  }

  // Check correctness
  if (emoji !== sequence[idx]) {
    SFX.wrong();
    showToast('Wrong! Watch again…');
    document.getElementById('seq-instruction').textContent = '❌ Wrong! Try again…';
    document.querySelectorAll('.seq-btn').forEach(b => b.disabled = true);
    // Reset tiles
    setTimeout(() => {
      sequence.forEach((e, i) => {
        const t = document.getElementById(`seq-tile-${i}`);
        if (t) t.textContent = '❓';
      });
      G.data.playerInput = [];
      setTimeout(() => playSequence(area), 800);
    }, 800);
    return;
  }

  SFX.seq(G.data.options.indexOf(emoji));

  // Update progress
  const pct = ((idx + 1) / sequence.length) * 100;
  const prog = document.getElementById('seq-progress');
  if (prog) prog.style.width = pct + '%';

  if (playerInput.length === sequence.length) {
    // Win!
    setTimeout(() => solveLevel(), 400);
  }
}

/* ────────────────────────────────────────────────────
   SECTION 14: PUZZLE — MAZE
──────────────────────────────────────────────────── */
function buildMaze(lvl, area) {
  const { cols, rows, grid: template } = lvl.data;
  const grid = [...template];
  const startIdx = grid.indexOf('S');
  const endIdx   = grid.indexOf('E');
  G.data = { grid, cols, rows, startIdx, endIdx, frogPos: startIdx, visited: new Set([startIdx]) };
  renderMaze(area);
}

function renderMaze(area) {
  const { grid, cols, frogPos, endIdx, visited } = G.data;
  area.innerHTML = '';

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '6px';
  wrap.style.width = '100%';
  wrap.style.paddingBottom = '12px';

  const instr = document.createElement('p');
  instr.className = 'puzzle-instruction';
  instr.textContent = 'Navigate to the ⭐ using the buttons below!';
  wrap.appendChild(instr);

  // Maze grid
  const gridEl = document.createElement('div');
  gridEl.className = 'maze-grid';
  gridEl.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  gridEl.style.maxWidth = Math.min(300, 38 * cols) + 'px';

  grid.forEach((cell, i) => {
    const div = document.createElement('div');
    const isFrog = (i === frogPos);
    const isEnd  = (i === endIdx);
    let cls = 'maze-cell ';
    if (cell === 1) cls += 'wall';
    else if (isFrog) cls += 'path frog';
    else if (isEnd)  cls += 'end';
    else if (visited.has(i)) cls += 'path visited';
    else cls += 'path';
    div.className = cls;
    div.textContent = isFrog ? frogEmoji() : isEnd ? '⭐' : '';
    gridEl.appendChild(div);
  });
  wrap.appendChild(gridEl);

  // Direction buttons
  const dirPad = document.createElement('div');
  dirPad.className = 'dir-btns';
  const dirs = [
    null, {label:'↑', dr:-1, dc:0}, null,
    {label:'←', dr:0, dc:-1}, null, {label:'→', dr:0, dc:1},
    null, {label:'↓', dr:1, dc:0}, null,
  ];
  dirs.forEach(d => {
    const btn = document.createElement('button');
    if (!d) { btn.className = 'dir-btn empty'; }
    else {
      btn.className = 'dir-btn';
      btn.textContent = d.label;
      btn.addEventListener('click', () => handleMazeMove(d.dr, d.dc, area));
    }
    dirPad.appendChild(btn);
  });
  wrap.appendChild(dirPad);
  area.appendChild(wrap);
}

function handleMazeMove(dr, dc, area) {
  if (G.solved) return;
  const { frogPos, cols, rows, grid, endIdx, visited } = G.data;
  const r = Math.floor(frogPos / cols) + dr;
  const c = (frogPos % cols) + dc;
  if (r < 0 || r >= rows || c < 0 || c >= cols) return;
  const newIdx = r * cols + c;
  if (grid[newIdx] === 1) { SFX.fail(); shakeArea(area); return; }

  incrementMoves();
  SFX.jump();
  G.data.frogPos = newIdx;
  visited.add(newIdx);
  renderMaze(area);

  if (newIdx === endIdx) { solveLevel(); }
}

function shakeArea(area) {
  area.style.animation = 'none';
  void area.offsetWidth;
  area.style.animation = 'shake 0.35s ease';
  setTimeout(() => area.style.animation = '', 400);
}

/* ────────────────────────────────────────────────────
   SECTION 15: PUZZLE — MOVING PLATFORMS (timing)
──────────────────────────────────────────────────── */
function buildPlatform(lvl, area) {
  const { lanes, targetLane, platformWidth, laneSpeed } = lvl.data;

  // State
  G.data = {
    lanes, targetLane, platformWidth, laneSpeed,
    frogLane: -1,   // -1 = bank
    frogX: 0,
    platformX: laneSpeed.map((_, i) => i % 2 === 0 ? 0 : 180), // stagger starts
    cleared: Array(lanes).fill(false),
    animFrame: null,
    lastTime: 0,
    laneWidths: [], // filled after render
  };

  renderPlatformShell(area);
  requestAnimationFrame(platformLoop);
}

function renderPlatformShell(area) {
  area.innerHTML = '';
  const { lanes, targetLane } = G.data;

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.alignItems = 'center';
  wrap.style.gap = '8px';
  wrap.style.width = '100%';

  const instr = document.createElement('p');
  instr.className = 'puzzle-instruction';
  instr.textContent = 'Tap a lane to jump! Ride the logs to cross! 🪵';
  wrap.appendChild(instr);

  const platformArea = document.createElement('div');
  platformArea.className = 'platform-area';
  platformArea.id = 'platform-area';

  // Bank (start)
  const bank = document.createElement('div');
  bank.style.cssText = `width:100%;height:50px;border-radius:12px;background:rgba(61,186,111,0.2);
    border:2px solid rgba(61,186,111,0.4);display:flex;align-items:center;padding-left:12px;
    font-family:var(--font-display);color:rgba(255,255,255,0.5);font-size:0.9rem;`;
  bank.id = 'bank';
  bank.textContent = 'Start — Tap a lane to jump!';
  platformArea.appendChild(bank);

  for (let i = 0; i < lanes; i++) {
    const lane = document.createElement('div');
    lane.className = 'platform-lane';
    lane.id = `lane-${i}`;
    lane.dataset.lane = i;

    // Moving log/pad
    const pad = document.createElement('div');
    pad.className = 'platform-pad';
    pad.id = `pad-${i}`;
    pad.style.width = G.data.platformWidth + 'px';
    pad.textContent = i === lanes - 1 ? '⭐' : '🪵';
    lane.appendChild(pad);

    lane.addEventListener('click', () => handlePlatformTap(i));
    platformArea.appendChild(lane);
  }

  wrap.appendChild(platformArea);
  area.appendChild(wrap);
}

function platformLoop(ts) {
  if (G.solved) return;
  const dt = Math.min((ts - (G.data.lastTime || ts)) / 1000, 0.1);
  G.data.lastTime = ts;

  const { lanes, platformX, laneSpeed, platformWidth } = G.data;

  // Move pads
  for (let i = 0; i < lanes; i++) {
    const direction = i % 2 === 0 ? 1 : -1;
    const laneEl = document.getElementById(`lane-${i}`);
    const laneW = laneEl ? laneEl.clientWidth : 300;
    platformX[i] += direction * laneSpeed[i] * dt;
    if (platformX[i] > laneW) platformX[i] = -platformWidth;
    if (platformX[i] < -platformWidth) platformX[i] = laneW;

    const padEl = document.getElementById(`pad-${i}`);
    if (padEl) padEl.style.left = platformX[i] + 'px';
  }

  // Check frog-on-pad
  if (G.data.frogLane >= 0) {
    const fi = G.data.frogLane;
    const laneEl = document.getElementById(`lane-${fi}`);
    const laneW = laneEl ? laneEl.clientWidth : 300;
    // Move frog with pad
    G.data.frogX = platformX[fi] + platformWidth / 2 - 16;

    // Update frog position
    const frogEl = document.getElementById('platform-frog');
    const laneTop = laneEl ? laneEl.offsetTop + laneEl.parentElement.offsetTop : 0;
    if (frogEl) {
      frogEl.style.left = (laneEl.offsetLeft + G.data.frogX) + 'px';
    }

    // Check if fell off
    if (platformX[fi] + platformWidth < 0 || platformX[fi] > laneW + platformWidth) {
      // Frog fell!
      SFX.fail();
      showToast('Splashed! Try again…');
      G.data.frogLane = -1;
      if (frogEl) { frogEl.style.display = 'none'; }
    }

    // Reached goal lane?
    if (fi === G.data.targetLane && !G.data.cleared[fi]) {
      G.data.cleared[fi] = true;
      setTimeout(() => { if (!G.solved) solveLevel(); }, 200);
      return;
    }
  }

  G.data.animFrame = requestAnimationFrame(platformLoop);
}

function handlePlatformTap(laneIdx) {
  if (G.solved) return;
  const { platformX, platformWidth, frogLane } = G.data;
  const laneEl = document.getElementById(`lane-${laneIdx}`);
  if (!laneEl) return;
  const laneW = laneEl.clientWidth;

  // Check if platform is reachable (within lane area)
  const padLeft = platformX[laneIdx];
  const padRight = padLeft + platformWidth;
  const isVisible = padRight > 0 && padLeft < laneW;

  if (!isVisible) { showToast('Wait for the log!'); SFX.fail(); return; }

  incrementMoves();
  SFX.jump();

  // Move frog to this lane
  G.data.frogLane = laneIdx;

  // Create or move frog element
  let frogEl = document.getElementById('platform-frog');
  const platformAreaEl = document.getElementById('platform-area');
  if (!frogEl && platformAreaEl) {
    frogEl = document.createElement('div');
    frogEl.id = 'platform-frog';
    frogEl.className = 'frog-player';
    frogEl.textContent = frogEmoji();
    platformAreaEl.style.position = 'relative';
    platformAreaEl.appendChild(frogEl);
  }
  if (frogEl) {
    frogEl.style.display = 'block';
    frogEl.style.top = (laneEl.offsetTop + 6) + 'px';
    frogEl.classList.add('jump-anim');
    setTimeout(() => frogEl.classList.remove('jump-anim'), 400);
  }
}

/* ────────────────────────────────────────────────────
   SECTION 16: WIN / COMPLETION
──────────────────────────────────────────────────── */
function solveLevel() {
  if (G.solved) return;
  G.solved = true;
  const time = stopTimer();
  SFX.win();

  const lvl = LEVELS[State.currentLevel];

  // Stars
  const stars = starsCalc(G.moves, time, lvl);
  // Coins
  const coins = coinsCalc(lvl, stars);

  // Save progress
  const prev = State.completedLevels[State.currentLevel];
  if (!prev || prev.moves > G.moves) {
    State.completedLevels[State.currentLevel] = { stars, moves: G.moves, time };
  }

  // Unlock next level
  const next = State.currentLevel + 1;
  if (next < LEVELS.length && !State.unlockedLevels.includes(next)) {
    State.unlockedLevels.push(next);
  }

  addCoins(coins, window.innerWidth / 2, 200);
  saveState();

  // Stop platform loop
  if (G.data.animFrame) cancelAnimationFrame(G.data.animFrame);

  // Show win screen after short delay
  setTimeout(() => showWinScreen(stars, G.moves, time, coins), 600);
}

function starsCalc(moves, time, lvl) {
  let s = 1;
  const mx = lvl.data.maxMoves || 99;
  if (moves <= mx * 0.6) s++;
  if (time <= 40) s++;
  return Math.min(s, 3);
}

function coinsCalc(lvl, stars) {
  return lvl.coinReward + (stars - 1) * 10;
}

function showWinScreen(stars, moves, time, coinsEarned) {
  // Stars
  const starsEl = document.getElementById('win-stars');
  starsEl.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const s = document.createElement('span');
    s.textContent = i <= stars ? '⭐' : '☆';
    s.className = 'star-pop';
    s.style.animationDelay = (i * 0.15) + 's';
    starsEl.appendChild(s);
  }
  document.getElementById('win-moves').textContent = moves;
  document.getElementById('win-time').textContent  = time + 's';
  document.getElementById('win-coins').textContent = '+' + coinsEarned;

  // Next button state
  const hasNext = State.currentLevel + 1 < LEVELS.length;
  document.getElementById('btn-next-level').style.display = hasNext ? '' : 'none';

  showScreen('win');
}

/* ────────────────────────────────────────────────────
   SECTION 17: SHOP
──────────────────────────────────────────────────── */
function buildShop() {
  const grid = document.getElementById('shop-grid');
  grid.innerHTML = '';
  SKINS.forEach((skin, i) => {
    const card = document.createElement('div');
    const owned    = State.ownedSkins.includes(i);
    const equipped = State.equippedSkin === i;
    card.className = `shop-card ${equipped ? 'equipped' : owned ? 'owned' : ''}`;

    let badge = '';
    if (equipped) badge = `<span class="shop-badge badge-equipped">Equipped</span>`;
    else if (owned) badge = `<span class="shop-badge badge-owned">Owned</span>`;
    else badge = `<span class="shop-badge badge-locked">🪙 ${skin.price}</span>`;

    card.innerHTML = `
      <div class="shop-frog">${skin.emoji}</div>
      <div class="shop-name">${skin.name}</div>
      ${badge}
    `;

    card.addEventListener('click', () => handleShopClick(i));
    grid.appendChild(card);
  });
  document.getElementById('shop-coin-count').textContent = State.coins;
}

function handleShopClick(i) {
  SFX.click();
  const skin = SKINS[i];
  if (State.equippedSkin === i) { showToast('Already equipped!'); return; }

  if (State.ownedSkins.includes(i)) {
    // Equip
    State.equippedSkin = i;
    saveState();
    buildShop();
    showToast(`${skin.emoji} ${skin.name} equipped!`);
    return;
  }

  // Buy
  if (State.coins < skin.price) {
    showToast('Not enough coins! 🪙');
    SFX.fail();
    return;
  }
  State.coins -= skin.price;
  State.ownedSkins.push(i);
  State.equippedSkin = i;
  updateCoinDisplays();
  saveState();
  buildShop();
  showToast(`${skin.emoji} ${skin.name} unlocked!`);
  SFX.win();
}

/* ────────────────────────────────────────────────────
   SECTION 18: RESTART
──────────────────────────────────────────────────── */
function restartLevel() {
  if (G.data.animFrame) cancelAnimationFrame(G.data.animFrame);
  startLevel(State.currentLevel);
}

/* ────────────────────────────────────────────────────
   SECTION 19: EVENT LISTENERS — GLOBAL BUTTONS
──────────────────────────────────────────────────── */
// Home buttons
document.getElementById('btn-play').addEventListener('click', () => {
  SFX.click();
  buildLevelGrid();
  showScreen('levels');
});

document.getElementById('btn-shop').addEventListener('click', () => {
  SFX.click();
  buildShop();
  showScreen('shop');
});

document.getElementById('btn-sound').addEventListener('click', () => {
  State.soundOn = !State.soundOn;
  document.getElementById('btn-sound').textContent = `${State.soundOn ? '🔊' : '🔇'} Sound: ${State.soundOn ? 'ON' : 'OFF'}`;
  saveState();
});

// Level select back
document.getElementById('btn-levels-back').addEventListener('click', () => {
  SFX.click(); showScreen('home');
});

// Game back
document.getElementById('btn-game-back').addEventListener('click', () => {
  SFX.click();
  if (G.data.animFrame) cancelAnimationFrame(G.data.animFrame);
  clearInterval(G.timerInterval);
  buildLevelGrid();
  showScreen('levels');
});

// Restart
document.getElementById('btn-restart').addEventListener('click', () => {
  SFX.click(); restartLevel();
});

// Hint
document.getElementById('btn-hint').addEventListener('click', () => {
  if (State.coins < 10) { showToast('Need 10🪙 for a hint!'); SFX.fail(); return; }
  State.coins -= 10;
  updateCoinDisplays();
  saveState();
  SFX.click();
  document.getElementById('hint-overlay').classList.remove('hidden');
});

document.getElementById('btn-hint-close').addEventListener('click', () => {
  SFX.click();
  document.getElementById('hint-overlay').classList.add('hidden');
});

// Win screen buttons
document.getElementById('btn-next-level').addEventListener('click', () => {
  SFX.click();
  startLevel(State.currentLevel + 1);
});

document.getElementById('btn-win-restart').addEventListener('click', () => {
  SFX.click(); restartLevel();
});

document.getElementById('btn-win-levels').addEventListener('click', () => {
  SFX.click();
  buildLevelGrid();
  showScreen('levels');
});

// Shop back
document.getElementById('btn-shop-back').addEventListener('click', () => {
  SFX.click(); showScreen('home');
});

/* ────────────────────────────────────────────────────
   SECTION 20: PREVENT DRAG / CONTEXT MENU
──────────────────────────────────────────────────── */
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('selectstart', e => e.preventDefault());

// Prevent pinch zoom
document.addEventListener('touchmove', e => {
  if (e.touches.length > 1) e.preventDefault();
}, { passive: false });

/* ────────────────────────────────────────────────────
   SECTION 21: KEYBOARD SUPPORT (maze + navigation)
──────────────────────────────────────────────────── */
document.addEventListener('keydown', e => {
  const gameActive = screens.game.classList.contains('active');
  if (!gameActive) return;

  const lvl = LEVELS[State.currentLevel];
  const area = document.getElementById('game-area');

  if (lvl && lvl.type === 'maze') {
    const map = { ArrowUp:[-1,0], ArrowDown:[1,0], ArrowLeft:[0,-1], ArrowRight:[0,1],
                  w:[-1,0], s:[1,0], a:[0,-1], d:[0,1] };
    const dir = map[e.key];
    if (dir) { e.preventDefault(); handleMazeMove(dir[0], dir[1], area); }
  }

  if (e.key === 'r' || e.key === 'R') restartLevel();
});

/* ────────────────────────────────────────────────────
   SECTION 22: INIT
──────────────────────────────────────────────────── */
function init() {
  loadState();
  updateCoinDisplays();
  // Sync sound button
  document.getElementById('btn-sound').textContent =
    `${State.soundOn ? '🔊' : '🔇'} Sound: ${State.soundOn ? 'ON' : 'OFF'}`;
  // Always unlock level 0
  if (!State.unlockedLevels.includes(0)) State.unlockedLevels.push(0);
  showScreen('home');
}

init();