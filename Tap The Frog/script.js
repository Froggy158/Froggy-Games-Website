/* ══════════════════════════════════════════════
   TAP THE FROG 🐸 – script.js
   ══════════════════════════════════════════════ */

// ── PREVENT ALL SELECTION / DRAG / ZOOM ───────
document.addEventListener('contextmenu',  e => e.preventDefault());
document.addEventListener('dragstart',    e => e.preventDefault());
document.addEventListener('selectstart',  e => e.preventDefault());
document.addEventListener('touchstart',   e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
document.addEventListener('touchmove',    e => { if (e.scale && e.scale !== 1) e.preventDefault(); }, { passive: false });

// ── AUDIO ─────────────────────────────────────
const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getACtx() {
  if (!audioCtx) audioCtx = new AudioCtxClass();
  return audioCtx;
}
function playTone(freqs, type, vol, dur, gap) {
  try {
    const ctx = getACtx();
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      const t = ctx.currentTime + i * gap;
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.start(t); osc.stop(t + dur + 0.02);
    });
  } catch(e) {}
}
const playRibbit      = (v=0.25) => playTone([280, 180, 220], 'sine',     v,    0.2,  0.07);
const playCoin        = ()        => playTone([660, 880, 1100],'triangle', 0.12, 0.18, 0.07);
const playBuy         = ()        => playTone([330,440,550,660],'square',  0.07, 0.12, 0.06);
const playAchievement = ()        => playTone([523,659,784,1047],'sine',   0.18, 0.25, 0.10);

// ── GAME STATE ────────────────────────────────
const SAVE_KEY = 'tapTheFrog_v3';
const defaultState = () => ({
  taps: 0, coins: 0,
  lifetimeTaps: 0, lifetimeCoins: 0,
  tapsToCoinsRatio: 10,
  upgrades: {}, achievements: {},
  lastSave: Date.now(),
});
let state = defaultState();

// ── SHOP DEFINITIONS ──────────────────────────
// For non-special items, "perPurchase" is the stat GAIN for each purchase.
// apply() is called with the TOTAL owned count each time we recalcAll().
const SHOP = [
  {
    id: 'fly_helper',
    icon: '🪰', name: 'Fly Helper',
    desc: 'Flies buzz around auto-tapping for you.',
    baseCost: 15, costMult: 1.5,
    effectLabel: n => `+${n} tap/sec`,
    apply: (owned, s) => { s.autoTapsPerSec += owned; },
  },
  {
    id: 'lily_pad',
    icon: '🌿', name: 'Lily Pad Boost',
    desc: 'Bigger lily pad = harder tap!',
    baseCost: 50, costMult: 1.7,
    effectLabel: n => `+${n} tap/click`,
    apply: (owned, s) => { s.tapsPerClick += owned; },
  },
  {
    id: 'frog_clone',
    icon: '🐸', name: 'Frog Clone',
    desc: 'Extra frogs auto-tap alongside you.',
    baseCost: 120, costMult: 1.8,
    effectLabel: n => `+${n * 3} taps/sec`,
    apply: (owned, s) => { s.autoTapsPerSec += owned * 3; },
  },
  {
    id: 'rainstorm',
    icon: '🌧️', name: 'Rainstorm',
    desc: '2× taps for 15 seconds!',
    baseCost: 80, costMult: 2.0,
    effectLabel: () => '2× for 15s',
    special: true,
  },
  {
    id: 'efficiency',
    icon: '⚗️', name: 'Tap Efficiency',
    desc: 'Converts taps to coins faster.',
    baseCost: 40, costMult: 1.6,
    effectLabel: n => `${Math.max(1, 10 - n)} taps=1🪙`,
    apply: (owned, s) => { s.tapsToCoinsRatio = Math.max(1, 10 - owned); },
  },
  {
    id: 'golden_frog',
    icon: '👑', name: 'Golden Frog',
    desc: 'Legendary multiplier. Ultimate upgrade.',
    baseCost: 500, costMult: 3.0,
    effectLabel: n => `${n + 1}× all taps`,
    apply: (owned, s) => { s.goldenMult = 1 + owned; },
    golden: true,
  },
];

// ── ACHIEVEMENTS ──────────────────────────────
const ACHIEVEMENTS = [
  { id: 'first_tap',  icon: '👆', name: 'First Tap!',    desc: 'Tap the frog.',            check: s => s.lifetimeTaps >= 1 },
  { id: 'taps_100',   icon: '💪', name: 'Centurian',      desc: 'Reach 100 taps.',          check: s => s.lifetimeTaps >= 100 },
  { id: 'taps_1k',    icon: '🔥', name: 'Tap Machine',    desc: 'Reach 1,000 taps.',        check: s => s.lifetimeTaps >= 1000 },
  { id: 'taps_10k',   icon: '⚡', name: 'Tapstorm',       desc: 'Reach 10,000 taps.',       check: s => s.lifetimeTaps >= 10000 },
  { id: 'taps_100k',  icon: '🌟', name: 'Tap Legend',     desc: 'Reach 100,000 taps.',      check: s => s.lifetimeTaps >= 100000 },
  { id: 'coins_50',   icon: '🪙', name: 'Coin Collector', desc: 'Earn 50 coins.',           check: s => s.lifetimeCoins >= 50 },
  { id: 'coins_500',  icon: '💰', name: 'Coin Hoarder',   desc: 'Earn 500 coins.',          check: s => s.lifetimeCoins >= 500 },
  { id: 'first_buy',  icon: '🛒', name: 'First Purchase', desc: 'Buy your first upgrade.',  check: s => Object.values(s.upgrades).some(v => v > 0) },
  { id: 'clone_army', icon: '🐸', name: 'Frog Army',      desc: 'Own 5 Frog Clones.',       check: s => (s.upgrades['frog_clone'] || 0) >= 5 },
  { id: 'golden',     icon: '👑', name: 'Golden Royalty', desc: 'Buy the Golden Frog.',     check: s => (s.upgrades['golden_frog'] || 0) >= 1 },
  { id: 'rain_rider', icon: '🌧️', name: 'Rain Rider',     desc: 'Activate Rainstorm.',      check: s => (s.upgrades['rainstorm'] || 0) >= 1 },
  { id: 'auto_10',    icon: '🤖', name: 'Auto-Pilot',     desc: 'Get 10+ auto taps/sec.',   check: s => (s.autoTapsPerSec || 0) >= 10 },
];

// ── DOM REFS ──────────────────────────────────
const frogBtn    = document.getElementById('frogBtn');
const convertBtn = document.getElementById('convertBtn');
const convertLabel = document.getElementById('convertLabel');
const convertRatioEl = document.getElementById('convertRatio');
const shopEl     = document.getElementById('shopItems');
const achListEl  = document.getElementById('achList');
const achListModalEl = document.getElementById('achListModal');
const cloneFrogsEl = document.getElementById('cloneFrogs');
const particlesEl  = document.getElementById('particles');

const totalTapsEl  = document.getElementById('totalTaps');
const totalCoinsEl = document.getElementById('totalCoins');
const tpsEl = document.getElementById('tpsDisplay');
const cpsEl = document.getElementById('cpsDisplay');
const tpcEl = document.getElementById('tpcDisplay');

const achToast = document.getElementById('achievementToast');
const achTitleEl = document.getElementById('achTitle');
const achDescEl  = document.getElementById('achDesc');
const comboEl    = document.getElementById('comboDisplay');
const rainstormOverlay = document.getElementById('rainstormOverlay');
const rainTimerEl = document.getElementById('rainTimer');

const achModalBackdrop = document.getElementById('achModalBackdrop');
const achModalClose    = document.getElementById('achModalClose');
const btnAchievements  = document.getElementById('btnAchievements');

// ── DERIVED STATE (recomputed each recalcAll) ──
// These live on state so they persist across recalc:
// state.tapsPerClick, state.autoTapsPerSec, state.goldenMult, state.tapsToCoinsRatio

// ── RUNTIME VARS ──────────────────────────────
let rainstormActive = false;
let rainstormEndsAt = 0;
let rainstormIntervalId = null;
let comboCount  = 0;
let lastTapTime = 0;
let comboHideTimer = null;
let tapAnimTimer   = null;

// ── SAVE / LOAD ───────────────────────────────
function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) state = { ...defaultState(), ...JSON.parse(raw) };
  } catch(e) { state = defaultState(); }
  recalcAll();
}
function saveSave() {
  state.lastSave = Date.now();
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e) {}
}

// ── RECALC ALL DERIVED STATS ──────────────────
function recalcAll() {
  state.tapsPerClick  = 1;
  state.autoTapsPerSec = 0;
  state.goldenMult    = 1;
  // tapsToCoinsRatio starts at 10, efficiency reduces it
  state.tapsToCoinsRatio = 10;

  SHOP.forEach(item => {
    if (item.special) return;
    const owned = state.upgrades[item.id] || 0;
    if (owned > 0 && item.apply) item.apply(owned, state);
  });
}

// ── COST HELPER ───────────────────────────────
function getItemCost(item) {
  const owned = state.upgrades[item.id] || 0;
  return Math.floor(item.baseCost * Math.pow(item.costMult, owned));
}

// ── EFFECTIVE VALUES ──────────────────────────
function effectiveTPC() {
  return Math.max(1, Math.round(state.tapsPerClick * state.goldenMult * (rainstormActive ? 2 : 1)));
}
function effectiveAPS() {
  return state.autoTapsPerSec * state.goldenMult * (rainstormActive ? 2 : 1);
}

// ── TAP HANDLER ───────────────────────────────
function doTap(x, y) {
  const taps = effectiveTPC();
  state.taps        += taps;
  state.lifetimeTaps += taps;

  playRibbit(0.22 + Math.min(0.18, comboCount * 0.012));

  // Combo
  const now = Date.now();
  if (now - lastTapTime < 380) comboCount++;
  else comboCount = 1;
  lastTapTime = now;
  if (comboCount >= 5) showCombo();

  // Squish animation
  frogBtn.classList.remove('tapped');
  void frogBtn.offsetWidth;
  frogBtn.classList.add('tapped');
  clearTimeout(tapAnimTimer);
  tapAnimTimer = setTimeout(() => frogBtn.classList.remove('tapped'), 120);

  spawnParticles(x, y, taps);
  spawnTapLabel(x, y, taps);
  spawnRipple(x, y);

  updateHUD();
  checkAchievements();
}

frogBtn.addEventListener('pointerdown', e => {
  e.preventDefault();
  const rect = frogBtn.getBoundingClientRect();
  doTap(e.clientX - rect.left, e.clientY - rect.top);
}, { passive: false });

// ── CONVERT ───────────────────────────────────
function convertTaps() {
  const ratio = state.tapsToCoinsRatio;
  const coins = Math.floor(state.taps / ratio);
  if (coins <= 0) return;
  state.taps       -= coins * ratio;
  state.coins      += coins;
  state.lifetimeCoins += coins;
  playCoin();
  updateHUD();
  checkAchievements();
}
convertBtn.addEventListener('pointerdown', e => { e.preventDefault(); convertTaps(); }, { passive: false });

// ── BUY ITEM ──────────────────────────────────
function buyItem(itemId) {
  const item = SHOP.find(i => i.id === itemId);
  if (!item) return;
  const cost = getItemCost(item);
  if (state.coins < cost) return;

  state.coins -= cost;
  state.upgrades[itemId] = (state.upgrades[itemId] || 0) + 1;

  playBuy();

  if (item.special) {
    // Rainstorm — counts as bought for achievement but activates effect
    activateRainstorm();
  } else {
    recalcAll();
    if (item.golden && state.goldenMult > 1) {
      frogBtn.classList.add('golden-active');
    }
  }

  updateClones();
  updateShopLabels();   // update cost/affordability labels only
  updateHUD();
  checkAchievements();
  saveSave();
}

// ── RAINSTORM ─────────────────────────────────
function activateRainstorm() {
  rainstormActive = true;
  rainstormEndsAt = Date.now() + 15000;
  rainstormOverlay.classList.add('active');
  spawnRaindrops();
  clearInterval(rainstormIntervalId);
  rainstormIntervalId = setInterval(() => {
    const left = Math.max(0, rainstormEndsAt - Date.now());
    rainTimerEl.textContent = `${Math.ceil(left / 1000)}s remaining`;
    if (left <= 0) {
      rainstormActive = false;
      rainstormOverlay.classList.remove('active');
      clearInterval(rainstormIntervalId);
      updateShopLabels();
    }
  }, 200);
}
function spawnRaindrops() {
  if (!rainstormActive) return;
  for (let i = 0; i < 6; i++) {
    const d = document.createElement('div');
    d.className = 'raindrop';
    d.textContent = ['💧','🌧️','💦'][Math.floor(Math.random()*3)];
    d.style.left = Math.random() * 100 + 'vw';
    d.style.animationDuration = (0.8 + Math.random() * 1.2) + 's';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 2200);
  }
  if (rainstormActive) setTimeout(spawnRaindrops, 350);
}

// ── PARTICLES ─────────────────────────────────
const P_COLORS = ['#5ecf5e','#a8f0a8','#ffd700','#ffb703','#88ff88','#fff'];
function spawnParticles(x, y, taps) {
  const num = Math.min(10, 4 + Math.floor(taps / 3));
  for (let i = 0; i < num; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (Math.PI * 2 / num) * i + (Math.random() - 0.5) * 0.8;
    const dist  = 30 + Math.random() * 55;
    const size  = 4 + Math.random() * 7;
    p.style.cssText = `width:${size}px;height:${size}px;left:${x}px;top:${y}px;` +
      `background:${P_COLORS[Math.floor(Math.random()*P_COLORS.length)]};` +
      `--dx:${Math.cos(angle)*dist}px;--dy:${Math.sin(angle)*dist - 20}px;` +
      `animation-duration:${0.5 + Math.random()*0.3}s;`;
    particlesEl.appendChild(p);
    setTimeout(() => p.remove(), 850);
  }
}
function spawnTapLabel(x, y, taps) {
  const lbl = document.createElement('div');
  lbl.className = 'tap-label';
  lbl.textContent = `${rainstormActive ? '⚡' : ''}${state.goldenMult > 1 ? `×${state.goldenMult} ` : ''}+${formatNum(taps)}`;
  if (state.goldenMult > 1) lbl.style.color = '#ffd700';
  if (rainstormActive)      lbl.style.color = '#7df0ff';
  lbl.style.left = x + 'px';
  lbl.style.top  = y + 'px';
  particlesEl.appendChild(lbl);
  setTimeout(() => lbl.remove(), 950);
}
function spawnRipple(x, y) {
  const r = document.createElement('div');
  r.className = 'ripple';
  const s = 40;
  r.style.cssText = `width:${s}px;height:${s}px;left:${x-s/2}px;top:${y-s/2}px;`;
  particlesEl.appendChild(r);
  setTimeout(() => r.remove(), 550);
}

// ── COMBO ─────────────────────────────────────
function showCombo() {
  comboEl.textContent = comboCount >= 20 ? `🔥 ${comboCount}x COMBO!` : `⚡ ${comboCount}x Combo`;
  comboEl.classList.add('show');
  clearTimeout(comboHideTimer);
  comboHideTimer = setTimeout(() => comboEl.classList.remove('show'), 800);
}

// ── CLONE FROGS DISPLAY ───────────────────────
function updateClones() {
  const count = state.upgrades['frog_clone'] || 0;
  cloneFrogsEl.innerHTML = '';
  const shown = Math.min(count, 10);
  for (let i = 0; i < shown; i++) {
    const f = document.createElement('div');
    f.className = 'clone-frog';
    f.textContent = '🐸';
    f.style.animationDelay = (i * 0.18) + 's';
    cloneFrogsEl.appendChild(f);
  }
  if (count > 10) {
    const more = document.createElement('div');
    more.style.cssText = 'font-size:0.85rem;color:var(--green-bright);align-self:center;';
    more.textContent = `+${count - 10} more`;
    cloneFrogsEl.appendChild(more);
  }
}

// ── FORMAT NUMBER ─────────────────────────────
function formatNum(n) {
  n = Math.floor(n);
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

// ── HUD UPDATE ────────────────────────────────
function updateHUD() {
  totalTapsEl.textContent  = formatNum(state.taps);
  totalCoinsEl.textContent = formatNum(state.coins);

  const aps = effectiveAPS();
  const cps = aps / state.tapsToCoinsRatio;
  tpsEl.textContent = `⚡ ${formatNum(aps)} taps/sec`;
  cpsEl.textContent = `🪙 ${cps.toFixed(2)} coins/sec`;
  tpcEl.textContent = `👆 ${formatNum(effectiveTPC())} tap/click`;

  convertRatioEl.textContent = `${state.tapsToCoinsRatio} taps = 1 🪙`;
  convertLabel.textContent = `Convert ${formatNum(state.taps)} Taps → ${formatNum(Math.floor(state.taps / state.tapsToCoinsRatio))} Coins`;
}

// ── SHOP: BUILD ONCE ──────────────────────────
// We build the DOM once and only update cost labels + affordability class.
// This means click listeners are never wiped.
function buildShop() {
  shopEl.innerHTML = '';
  SHOP.forEach(item => {
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.id = 'shop-' + item.id;
    el.innerHTML = `
      <div class="shop-item-header">
        <span class="shop-item-icon">${item.icon}</span>
        <span class="shop-item-name">${item.name}</span>
        <span class="shop-item-owned" id="owned-${item.id}" style="display:none"></span>
      </div>
      <div class="shop-item-desc">${item.desc}</div>
      <div class="shop-item-footer">
        <span class="shop-item-cost" id="cost-${item.id}">🪙 ?</span>
        <span class="shop-item-effect" id="effect-${item.id}"></span>
      </div>
    `;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      buyItem(item.id);
    }, { passive: false });
    shopEl.appendChild(el);
  });
  updateShopLabels();
}

// Called after every purchase / every second to refresh costs + states
function updateShopLabels() {
  SHOP.forEach(item => {
    const owned    = state.upgrades[item.id] || 0;
    const cost     = getItemCost(item);
    const canAfford = state.coins >= cost;
    const isRainActive = item.special && rainstormActive;

    const el      = document.getElementById('shop-' + item.id);
    const costEl  = document.getElementById('cost-' + item.id);
    const effEl   = document.getElementById('effect-' + item.id);
    const ownedEl = document.getElementById('owned-' + item.id);
    if (!el) return;

    el.className = 'shop-item' + (isRainActive ? ' cannot-afford' : canAfford ? ' can-afford' : ' cannot-afford');
    costEl.textContent  = `🪙 ${formatNum(cost)}`;
    effEl.textContent   = item.effectLabel(owned + 1);

    if (owned > 0) {
      ownedEl.style.display = '';
      ownedEl.textContent   = `×${owned}`;
    } else {
      ownedEl.style.display = 'none';
    }
  });
}

// ── ACHIEVEMENTS ──────────────────────────────
let toastQueue = [], toastShowing = false;
function showAchToast(ach) {
  toastQueue.push(ach);
  if (!toastShowing) drainToast();
}
function drainToast() {
  if (!toastQueue.length) { toastShowing = false; return; }
  toastShowing = true;
  const ach = toastQueue.shift();
  achTitleEl.textContent = ach.name;
  achDescEl.textContent  = ach.desc;
  document.querySelector('.ach-icon').textContent = ach.icon;
  achToast.classList.add('show');
  playAchievement();
  setTimeout(() => { achToast.classList.remove('show'); setTimeout(drainToast, 500); }, 2800);
}

function checkAchievements() {
  let changed = false;
  ACHIEVEMENTS.forEach(ach => {
    if (!state.achievements[ach.id] && ach.check(state)) {
      state.achievements[ach.id] = true;
      showAchToast(ach);
      changed = true;
    }
  });
  if (changed) renderAchievements();
}

function renderAchievements() {
  const html = ACHIEVEMENTS.map(ach => {
    const unlocked = !!state.achievements[ach.id];
    return `<div class="ach-card ${unlocked ? 'unlocked' : 'locked'}">
      <span class="ach-card-icon">${ach.icon}</span>
      <div>
        <div class="ach-card-name">${ach.name}</div>
        <div class="ach-card-desc">${ach.desc}</div>
      </div>
    </div>`;
  }).join('');
  achListEl.innerHTML = html;
  achListModalEl.innerHTML = html;
}

// ── ACHIEVEMENTS MODAL (mobile) ───────────────
btnAchievements.addEventListener('pointerdown', e => {
  e.preventDefault();
  achModalBackdrop.classList.add('open');
}, { passive: false });
achModalClose.addEventListener('pointerdown', e => {
  e.preventDefault();
  achModalBackdrop.classList.remove('open');
}, { passive: false });
achModalBackdrop.addEventListener('pointerdown', e => {
  if (e.target === achModalBackdrop) achModalBackdrop.classList.remove('open');
}, { passive: false });

// ── BG BUBBLES ────────────────────────────────
function spawnBgBubbles() {
  const container = document.getElementById('bgBubbles');
  for (let i = 0; i < 14; i++) {
    const b = document.createElement('div');
    b.className = 'bubble';
    const size = 30 + Math.random() * 90;
    b.style.cssText = `width:${size}px;height:${size}px;left:${Math.random()*100}%;` +
      `animation-duration:${8+Math.random()*14}s;animation-delay:${Math.random()*-20}s;`;
    container.appendChild(b);
  }
}

// ── GAME TICK (50ms) ──────────────────────────
let lastTick = Date.now();
let shopLabelTimer = 0;

function gameTick() {
  const now = Date.now();
  const dt  = (now - lastTick) / 1000;
  lastTick  = now;

  if (state.autoTapsPerSec > 0) {
    const autoTaps = effectiveAPS() * dt;
    state.taps        += autoTaps;
    state.lifetimeTaps += autoTaps;

    // Auto-convert when we have enough
    const ratio = state.tapsToCoinsRatio;
    if (state.taps >= ratio) {
      const earned = Math.floor(state.taps / ratio);
      state.taps       -= earned * ratio;
      state.coins      += earned;
      state.lifetimeCoins += earned;
    }
  }

  shopLabelTimer += dt;
  if (shopLabelTimer >= 0.5) {
    // Refresh shop labels every 0.5s (not every tick)
    updateShopLabels();
    shopLabelTimer = 0;
  }

  updateHUD();
  checkAchievements();
}

// ── INIT ──────────────────────────────────────
function init() {
  loadSave();
  spawnBgBubbles();
  buildShop();           // build shop DOM once with listeners
  renderAchievements();
  updateClones();
  updateHUD();

  if ((state.upgrades['golden_frog'] || 0) > 0) {
    frogBtn.classList.add('golden-active');
  }

  setInterval(gameTick, 50);
  setInterval(saveSave, 10000);
}

init();