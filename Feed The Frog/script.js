// =============================================
// FEED THE FROG — script.js (v2)
// =============================================

// ============================================================
// DATA
// ============================================================
const FOODS = [
  { id: 'fly',      emoji: '🪲', name: 'Fly',        cost: 5,  hunger: 15,  poop: 1,  xp: 5,   delay: 2000,  rarity: 'common'    },
  { id: 'cricket',  emoji: '🦗', name: 'Cricket',    cost: 10, hunger: 25,  poop: 2,  xp: 10,  delay: 3500,  rarity: 'common'    },
  { id: 'worm',     emoji: '🪱', name: 'Worm',       cost: 8,  hunger: 20,  poop: 2,  xp: 8,   delay: 3000,  rarity: 'common'    },
  { id: 'snail',    emoji: '🐌', name: 'Snail',      cost: 15, hunger: 35,  poop: 3,  xp: 15,  delay: 5000,  rarity: 'uncommon'  },
  { id: 'berry',    emoji: '🫐', name: 'Berries',    cost: 12, hunger: 28,  poop: 2,  xp: 12,  delay: 4000,  rarity: 'uncommon'  },
  { id: 'shrimp',   emoji: '🍤', name: 'Shrimp',     cost: 20, hunger: 45,  poop: 4,  xp: 20,  delay: 6000,  rarity: 'uncommon'  },
  { id: 'mushroom', emoji: '🍄', name: 'Mushroom',   cost: 25, hunger: 50,  poop: 5,  xp: 25,  delay: 7000,  rarity: 'rare'      },
  { id: 'pizza',    emoji: '🍕', name: 'Pizza',      cost: 35, hunger: 70,  poop: 7,  xp: 40,  delay: 9000,  rarity: 'rare'      },
  { id: 'cake',     emoji: '🍰', name: 'Cake',       cost: 50, hunger: 100, poop: 10, xp: 75,  delay: 12000, rarity: 'legendary' },
];

const LEVELS = [
  { level: 1,  xp: 0,    name: 'Tiny Tadpole',   aura: null },
  { level: 2,  xp: 50,   name: 'Baby Frog',      aura: null },
  { level: 3,  xp: 120,  name: 'Happy Hopper',   aura: null },
  { level: 4,  xp: 250,  name: 'Pond Explorer',  aura: '#66bb6a44' },
  { level: 5,  xp: 450,  name: 'Bug Hunter',     aura: '#66bb6a66' },
  { level: 6,  xp: 700,  name: 'Leap Legend',    aura: '#4fc3f766' },
  { level: 7,  xp: 1050, name: 'Swamp Master',   aura: '#ffd54f66' },
  { level: 8,  xp: 1500, name: 'Golden Frog',    aura: '#ffd54f99' },
  { level: 9,  xp: 2100, name: 'Mythic Ribbit',  aura: '#ce93d899' },
  { level: 10, xp: 3000, name: 'Frog Deity',     aura: '#ff8f0099' },
];

const MOODS = [
  { min: 0,  max: 15,  emoji: '😵', label: 'Dying',   speech: ["I'm fading... 💀", "Help me!", "Food... please..."] },
  { min: 15, max: 30,  emoji: '😢', label: 'Starving', speech: ["I'm so hungry!", "Please feed me 😢", "My tummy hurts!"] },
  { min: 30, max: 55,  emoji: '😐', label: 'Okay',    speech: ["Could eat...", "A little peckish.", "Not bad not great."] },
  { min: 55, max: 80,  emoji: '😊', label: 'Happy',   speech: ["Ribbit! 🐸", "Life is good!", "What a vibe 🌿"] },
  { min: 80, max: 101, emoji: '🥰', label: 'Stuffed', speech: ["So full~", "Bliss. Pure bliss.", "Best frog ever! 💚"] },
];

const MILESTONES = [
  { coins: 20,  msg: '🎉 20 Frog Coins! Ribbit!' },
  { coins: 50,  msg: "🏆 50 Coins! You're rich!" },
  { coins: 100, msg: '💎 100 Coins! Legendary!' },
  { coins: 200, msg: '🚀 200 Coins! Galaxy brain frog!' },
  { coins: 500, msg: '👑 500 Coins! Frog King!' },
];

const EATING_SPEECHES = ['Nom nom nom!', '*munch munch*', 'Delicious!', 'So yummy! 😋', 'More please!'];
const POOP_SPEECHES   = ['Brb... 💩', '*grunt*', 'Nature calls!', 'Making coins!', '💰 Cha-ching!'];
const TAP_SPEECHES    = ['Ooh!', 'Hey! 😄', 'Boing!', 'Hehe~', '*squeak*', 'Again!'];

// ============================================================
// STATE
// ============================================================
let coins             = parseInt(localStorage.getItem('ftf_coins')     ?? '50');
let frogCoins         = parseInt(localStorage.getItem('ftf_frogcoins') ?? '0');
let hunger            = parseFloat(localStorage.getItem('ftf_hunger')  ?? '80');
let xp                = parseInt(localStorage.getItem('ftf_xp')        ?? '0');
let level             = parseInt(localStorage.getItem('ftf_level')     ?? '1');
let streak            = parseInt(localStorage.getItem('ftf_streak')    ?? '0');
let lastVisitDay      = localStorage.getItem('ftf_lastday')            ?? '';
let totalFed          = parseInt(localStorage.getItem('ftf_totalfed')  ?? '0');
let totalPoop         = parseInt(localStorage.getItem('ftf_totalpoop') ?? '0');
let favoriteFood      = localStorage.getItem('ftf_favfood')            ?? '';
let milestonesReached = JSON.parse(localStorage.getItem('ftf_ms')      || '[]');
let isNight           = localStorage.getItem('ftf_night') === 'true';
let shopOpen          = false;
let activeTab         = 'food';
let tapCooldown       = false;

// Food count tracker
let foodCounts = JSON.parse(localStorage.getItem('ftf_foodcounts') || '{}');

function save() {
  localStorage.setItem('ftf_coins',      coins);
  localStorage.setItem('ftf_frogcoins',  frogCoins);
  localStorage.setItem('ftf_hunger',     hunger.toFixed(1));
  localStorage.setItem('ftf_xp',         xp);
  localStorage.setItem('ftf_level',      level);
  localStorage.setItem('ftf_streak',     streak);
  localStorage.setItem('ftf_lastday',    lastVisitDay);
  localStorage.setItem('ftf_totalfed',   totalFed);
  localStorage.setItem('ftf_totalpoop',  totalPoop);
  localStorage.setItem('ftf_favfood',    favoriteFood);
  localStorage.setItem('ftf_ms',         JSON.stringify(milestonesReached));
  localStorage.setItem('ftf_night',      isNight);
  localStorage.setItem('ftf_foodcounts', JSON.stringify(foodCounts));
}

// ============================================================
// STREAK CHECK
// ============================================================
function checkStreak() {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  if (lastVisitDay === today) return;
  if (lastVisitDay === yesterday) {
    streak++;
    showToast(`🔥 ${streak}-day streak! +${streak * 5} bonus coins!`);
    coins += streak * 5;
  } else if (lastVisitDay !== '') {
    streak = 1;
  } else {
    streak = 1;
  }
  lastVisitDay = today;
  save();
  updateHUD();
}

// ============================================================
// DOM REFS
// ============================================================
const coinDisplay     = document.getElementById('coin-display');
const frogcoinDisplay = document.getElementById('frogcoin-display');
const hungerBar       = document.getElementById('hunger-bar');
const xpBar           = document.getElementById('xp-bar');
const xpLevelTag      = document.getElementById('xp-level-tag');
const frogBody        = document.getElementById('frog-body');
const frogWrap        = document.getElementById('frog-wrap');
const frogAura        = document.getElementById('frog-aura');
const speechEl        = document.getElementById('speech');
const shopOverlay     = document.getElementById('shop-overlay');
const shopPanel       = document.getElementById('shop-panel');
const shopBtn         = document.getElementById('shop-toggle-btn');
const foodGrid        = document.getElementById('food-grid');
const toastEl         = document.getElementById('toast');
const milestoneEl     = document.getElementById('milestone');
const moodDisplay     = document.getElementById('mood-display');
const streakBadge     = document.getElementById('streak-badge');
const streakNum       = document.getElementById('streak-num');
const daynightBtn     = document.getElementById('daynight-btn');
const levelupOverlay  = document.getElementById('levelup-overlay');
const levelupSub      = document.getElementById('levelup-sub');
const levelupOk       = document.getElementById('levelup-ok');
const statsPanel      = document.getElementById('stats-panel');
const coinPill        = document.getElementById('coin-pill');

// ============================================================
// HUD
// ============================================================
function getMood() {
  return MOODS.find(m => hunger >= m.min && hunger < m.max) || MOODS[0];
}

function updateHUD() {
  coinDisplay.textContent     = coins;
  frogcoinDisplay.textContent = frogCoins;

  const pct = Math.max(0, Math.min(100, hunger));
  hungerBar.style.width = pct + '%';
  if      (pct > 60) hungerBar.style.background = 'linear-gradient(90deg, #66bb6a, #00e676)';
  else if (pct > 30) hungerBar.style.background = 'linear-gradient(90deg, #ffd54f, #ff8f00)';
  else               hungerBar.style.background = 'linear-gradient(90deg, #ef5350, #b71c1c)';

  // XP bar
  const curLvlData  = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const nextLvlData = LEVELS[Math.min(level, LEVELS.length - 1)];
  const xpNeeded    = nextLvlData.xp - curLvlData.xp;
  const xpProgress  = xp - curLvlData.xp;
  const xpPct       = level >= LEVELS.length ? 100 : Math.min(100, (xpProgress / xpNeeded) * 100);
  xpBar.style.width = xpPct + '%';
  xpLevelTag.textContent = `Lv.${level}`;

  // Mood
  const mood = getMood();
  moodDisplay.textContent = mood.emoji;
  moodDisplay.title       = mood.label;

  // Streak
  if (streak > 1) {
    streakBadge.classList.remove('hidden');
    streakNum.textContent = streak;
  } else {
    streakBadge.classList.add('hidden');
  }

  // Frog aura
  const lvlData = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  if (lvlData.aura) {
    frogAura.style.background = `radial-gradient(ellipse, ${lvlData.aura} 0%, transparent 70%)`;
    frogAura.style.opacity    = '1';
  } else {
    frogAura.style.opacity = '0';
  }
}

// ============================================================
// XP & LEVELS
// ============================================================
function addXP(amount) {
  xp += amount;
  const maxLevel = LEVELS.length;
  while (level < maxLevel) {
    const nextLvl = LEVELS[level]; // index = level (next level)
    if (!nextLvl || xp < nextLvl.xp) break;
    level++;
    showLevelUp();
  }
  updateHUD();
  save();
}

function showLevelUp() {
  const lvlData = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  levelupSub.textContent = `You are now "${lvlData.name}"!`;
  levelupOverlay.classList.add('show');
  // Vibrate if supported
  if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
}

levelupOk.addEventListener('click', () => {
  levelupOverlay.classList.remove('show');
});

// ============================================================
// DAY / NIGHT
// ============================================================
function applyDayNight() {
  document.body.classList.toggle('night', isNight);
  daynightBtn.textContent = isNight ? '☀️' : '🌙';
}

daynightBtn.addEventListener('click', () => {
  isNight = !isNight;
  applyDayNight();
  save();
});

// ============================================================
// BACKGROUND CANVAS (animated gradient)
// ============================================================
const canvas = document.getElementById('bg-canvas');
const ctx    = canvas.getContext('2d');
let bgT      = 0;

function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function drawBG() {
  bgT += 0.003;
  const w = canvas.width, h = canvas.height;
  const shift = Math.sin(bgT) * 0.08;
  const grad  = ctx.createLinearGradient(0, 0, 0, h);
  if (isNight) {
    grad.addColorStop(0,       `hsl(${220 + shift * 20}, 50%, 12%)`);
    grad.addColorStop(0.45,    `hsl(${215 + shift * 15}, 35%, 20%)`);
    grad.addColorStop(1,       `hsl(${140 + shift * 10}, 35%, 18%)`);
  } else {
    grad.addColorStop(0,       `hsl(${198 + shift * 20}, 80%, ${72 + shift * 5}%)`);
    grad.addColorStop(0.45,    `hsl(${140 + shift * 10}, 55%, ${82 + shift * 5}%)`);
    grad.addColorStop(1,       `hsl(${120 + shift * 8},  55%, ${55 + shift * 5}%)`);
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
  requestAnimationFrame(drawBG);
}
drawBG();

// ============================================================
// SHOP TABS
// ============================================================
document.querySelectorAll('.shop-tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.shop-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    activeTab = btn.dataset.tab;
    document.getElementById(`tab-${activeTab}`).classList.add('active');
    if (activeTab === 'stats') buildStats();
  });
});

// ============================================================
// SHOP
// ============================================================
const RARITY_COLORS = {
  common:    { bg: 'rgba(255,255,255,0.08)', border: 'rgba(255,255,255,0.2)',  glow: 'none',                                   label: '' },
  uncommon:  { bg: 'rgba(102,187,106,0.15)', border: 'rgba(102,187,106,0.5)', glow: '0 0 12px rgba(102,187,106,0.4)',          label: '🌿' },
  rare:      { bg: 'rgba(79,195,247,0.15)',  border: 'rgba(79,195,247,0.5)',  glow: '0 0 14px rgba(79,195,247,0.5)',           label: '💎' },
  legendary: { bg: 'rgba(255,213,79,0.2)',   border: 'rgba(255,213,79,0.7)',  glow: '0 0 20px rgba(255,213,79,0.6)',           label: '⚡' },
};

function buildShop() {
  foodGrid.innerHTML = '';
  FOODS.forEach(food => {
    const r    = RARITY_COLORS[food.rarity];
    const card = document.createElement('div');
    card.className = 'food-card' + (coins < food.cost ? ' cant-afford' : '') + ` rarity-${food.rarity}`;
    card.style.cssText = `background:${r.bg};border-color:${r.border};box-shadow:${r.glow};`;
    card.innerHTML = `
      ${r.label ? `<div class="rarity-badge">${r.label}</div>` : ''}
      <div class="food-emoji">${food.emoji}</div>
      <div class="food-name">${food.name}</div>
      <div class="food-stats">
        <span class="food-cost">🪙 ${food.cost}</span>
        <span class="food-xp">⭐ +${food.xp}</span>
      </div>
      <div class="food-hunger">+${food.hunger}% hunger</div>
    `;
    card.addEventListener('click', (e) => buyFood(food, e));
    foodGrid.appendChild(card);
  });
}

function refreshShopAffordability() {
  document.querySelectorAll('.food-card').forEach((card, i) => {
    card.classList.toggle('cant-afford', coins < FOODS[i].cost);
  });
}

function toggleShop(forceOpen) {
  shopOpen = (forceOpen !== undefined) ? forceOpen : !shopOpen;
  shopPanel.classList.toggle('open', shopOpen);
  shopOverlay.classList.toggle('open', shopOpen);
  if (shopOpen) buildShop();
}

shopBtn.addEventListener('click', () => toggleShop(true));
shopOverlay.addEventListener('click', () => toggleShop(false));
shopPanel.addEventListener('click', (e) => e.stopPropagation());

let touchStartY = 0;
shopPanel.addEventListener('touchstart', (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
shopPanel.addEventListener('touchend',   (e) => {
  if (e.changedTouches[0].clientY - touchStartY > 60) toggleShop(false);
}, { passive: true });

// ============================================================
// STATS PANEL
// ============================================================
function buildStats() {
  const lvlData = LEVELS[Math.min(level - 1, LEVELS.length - 1)];
  const nextLvl = LEVELS[Math.min(level, LEVELS.length - 1)];
  const xpNeeded = nextLvl ? nextLvl.xp - xp : 0;

  // Find favorite food
  let fav = '—';
  let maxCount = 0;
  for (const [id, count] of Object.entries(foodCounts)) {
    if (count > maxCount) { maxCount = count; fav = id; }
  }
  const favFood = FOODS.find(f => f.id === fav);
  const favStr  = favFood ? `${favFood.emoji} ${favFood.name} (×${maxCount})` : '—';

  statsPanel.innerHTML = `
    <div class="stat-card">
      <div class="stat-frog">🐸</div>
      <div class="stat-name">${lvlData.name}</div>
      <div class="stat-level">Level ${level}</div>
    </div>
    <div class="stat-grid">
      <div class="stat-item"><span class="stat-icon">⭐</span><div class="stat-val">${xp}</div><div class="stat-lbl">Total XP</div></div>
      <div class="stat-item"><span class="stat-icon">🪙</span><div class="stat-val">${coins}</div><div class="stat-lbl">Coins</div></div>
      <div class="stat-item"><span class="stat-icon">💩</span><div class="stat-val">${frogCoins}</div><div class="stat-lbl">Frog Coins</div></div>
      <div class="stat-item"><span class="stat-icon">🍽️</span><div class="stat-val">${totalFed}</div><div class="stat-lbl">Times Fed</div></div>
      <div class="stat-item"><span class="stat-icon">🔥</span><div class="stat-val">${streak}</div><div class="stat-lbl">Day Streak</div></div>
      <div class="stat-item"><span class="stat-icon">❤️</span><div class="stat-val">${getMood().emoji}</div><div class="stat-lbl">Mood</div></div>
    </div>
    <div class="stat-fav">
      <span class="stat-fav-label">Favourite Food</span>
      <span class="stat-fav-val">${favStr}</span>
    </div>
    ${level < LEVELS.length ? `<div class="stat-next">⭐ ${xpNeeded} XP to Level ${level + 1}</div>` : `<div class="stat-next">🏆 MAX LEVEL!</div>`}
    <button class="stat-reset-btn" id="reset-btn">🗑️ Reset Game</button>
  `;

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reset everything? Your frog will forget you. 😢')) {
      localStorage.clear();
      location.reload();
    }
  });
}

// ============================================================
// SPEECH BUBBLE
// ============================================================
let speechTimer = null;
function showSpeech(msg, duration = 2500) {
  clearTimeout(speechTimer);
  speechEl.textContent = msg;
  speechEl.classList.add('visible');
  speechTimer = setTimeout(() => speechEl.classList.remove('visible'), duration);
}

// ============================================================
// TOAST
// ============================================================
let toastTimer = null;
function showToast(msg, duration = 1800) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

// ============================================================
// COIN COUNTER ANIMATION
// ============================================================
function animatePill(el) {
  el.classList.remove('pill-pop');
  void el.offsetWidth;
  el.classList.add('pill-pop');
}

// ============================================================
// MILESTONES
// ============================================================
let milestoneTimer = null;
function checkMilestone() {
  for (const m of MILESTONES) {
    if (frogCoins >= m.coins && !milestonesReached.includes(m.coins)) {
      milestonesReached.push(m.coins);
      clearTimeout(milestoneTimer);
      milestoneEl.textContent = m.msg;
      milestoneEl.classList.add('show');
      milestoneTimer = setTimeout(() => milestoneEl.classList.remove('show'), 3500);
      save();
      break;
    }
  }
}

// ============================================================
// FROG ANIMATIONS
// ============================================================
function triggerEat() {
  frogBody.classList.remove('eating', 'pooping');
  void frogBody.offsetWidth;
  frogBody.classList.add('eating');
  frogBody.addEventListener('animationend', () => frogBody.classList.remove('eating'), { once: true });
}

function triggerPoop(amount) {
  frogBody.classList.remove('eating', 'pooping');
  void frogBody.offsetWidth;
  frogBody.classList.add('pooping');
  frogBody.addEventListener('animationend', () => frogBody.classList.remove('pooping'), { once: true });

  for (let i = 0; i < amount; i++) {
    setTimeout(() => spawnPoopCoin(), i * 180);
  }

  frogCoins += amount;
  totalPoop += amount;
  animatePill(document.getElementById('frogcoin-pill'));
  updateHUD();
  checkMilestone();
  save();
}

// ============================================================
// TAP MINI-GAME
// ============================================================
frogWrap.addEventListener('click', (e) => {
  if (tapCooldown) return;
  tapCooldown = true;
  setTimeout(() => tapCooldown = false, 600);

  const bonus = 1 + Math.floor(level / 3);
  coins += bonus;
  animatePill(coinPill);
  updateHUD();
  save();

  // Speech
  showSpeech(TAP_SPEECHES[Math.floor(Math.random() * TAP_SPEECHES.length)]);

  // Floating +coin VFX
  spawnFloatingText(`+${bonus}🪙`, frogWrap);

  // Bounce
  frogBody.classList.remove('tap-bounce');
  void frogBody.offsetWidth;
  frogBody.classList.add('tap-bounce');
  frogBody.addEventListener('animationend', () => frogBody.classList.remove('tap-bounce'), { once: true });

  if (navigator.vibrate) navigator.vibrate(30);
});

function spawnFloatingText(text, fromEl) {
  const rect = fromEl.getBoundingClientRect();
  const el   = document.createElement('div');
  el.className   = 'float-text';
  el.textContent = text;
  el.style.left  = (rect.left + rect.width / 2 + (Math.random() - 0.5) * 40) + 'px';
  el.style.top   = (rect.top - 10) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

// ============================================================
// VFX — POOP COINS
// ============================================================
function spawnPoopCoin() {
  const rect = frogWrap.getBoundingClientRect();
  const cx   = rect.left + rect.width  / 2;
  const cy   = rect.top  + rect.height / 2;

  const el = document.createElement('div');
  el.className   = 'poop-coin';
  el.textContent = Math.random() < 0.5 ? '💩' : '🟢';
  el.style.left  = (cx + (Math.random() - 0.5) * 80) + 'px';
  el.style.top   = (cy - 30) + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

// ============================================================
// VFX — FOOD FLY TO FROG
// ============================================================
function spawnFoodFly(emoji, fromEl) {
  const frogRect = frogWrap.getBoundingClientRect();
  const fromRect = fromEl.getBoundingClientRect();

  const startX = fromRect.left + fromRect.width  / 2;
  const startY = fromRect.top  + fromRect.height / 2;
  const dx     = (frogRect.left + frogRect.width  / 2) - startX;
  const dy     = (frogRect.top  + frogRect.height / 2) - startY;

  const el = document.createElement('div');
  el.className   = 'food-fly';
  el.textContent = emoji;
  el.style.left  = startX + 'px';
  el.style.top   = startY + 'px';
  el.style.setProperty('--fx', dx + 'px');
  el.style.setProperty('--fy', dy + 'px');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 750);
}

// ============================================================
// BUY FOOD
// ============================================================
function buyFood(food, e) {
  if (coins < food.cost) {
    showToast('Not enough coins! 😢');
    e.currentTarget.classList.add('shake');
    setTimeout(() => e.currentTarget.classList.remove('shake'), 500);
    return;
  }

  coins  -= food.cost;
  hunger  = Math.min(100, hunger + food.hunger);
  totalFed++;
  foodCounts[food.id] = (foodCounts[food.id] || 0) + 1;

  updateHUD();
  refreshShopAffordability();
  animatePill(coinPill);
  save();

  spawnFoodFly(food.emoji, e.currentTarget);

  setTimeout(() => {
    triggerEat();
    showSpeech(EATING_SPEECHES[Math.floor(Math.random() * EATING_SPEECHES.length)]);
  }, 300);

  setTimeout(() => {
    showSpeech(POOP_SPEECHES[Math.floor(Math.random() * POOP_SPEECHES.length)]);
    triggerPoop(food.poop);
    addXP(food.xp);
    animatePill(document.getElementById('frogcoin-pill'));
  }, food.delay);

  if (navigator.vibrate) navigator.vibrate(40);
  toggleShop(false);
}

// ============================================================
// PASSIVE HUNGER DRAIN
// ============================================================
setInterval(() => {
  if (shopOpen) return;
  hunger = Math.max(0, hunger - 0.5);
  updateHUD();
  save();

  const mood = getMood();
  if (hunger <= 30 && Math.random() < 0.35) {
    showSpeech(mood.speech[Math.floor(Math.random() * mood.speech.length)]);
  }
  if (hunger <= 0) {
    showToast('Your frog is STARVING! 😱 Buy food!');
  }
}, 3000);

// Occasional happy/idle speech
setInterval(() => {
  if (shopOpen || speechEl.classList.contains('visible')) return;
  if (hunger > 50 && Math.random() < 0.2) {
    const mood = getMood();
    showSpeech(mood.speech[Math.floor(Math.random() * mood.speech.length)]);
  }
}, 8000);

// ============================================================
// STARS (night mode)
// ============================================================
function buildStars() {
  const wrap = document.getElementById('stars-wrap');
  for (let i = 0; i < 60; i++) {
    const s = document.createElement('div');
    s.className = 'star';
    s.style.cssText = `
      left:${Math.random() * 100}%;
      top:${Math.random() * 55}%;
      width:${1 + Math.random() * 3}px;
      height:${1 + Math.random() * 3}px;
      animation-delay:${Math.random() * 3}s;
      animation-duration:${2 + Math.random() * 3}s;
    `;
    wrap.appendChild(s);
  }
}
buildStars();

// ============================================================
// INIT
// ============================================================
checkStreak();
applyDayNight();
updateHUD();

if (frogCoins === 0 && coins === 50) {
  setTimeout(() => showSpeech('Tap me or feed me! 🪲', 3500), 1200);
}