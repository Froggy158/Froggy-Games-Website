// =============================================
// CLICK THE FROG — Improved script.js
// =============================================

// ---- DOM refs (top-level, available before game starts) ----
const settingsBtn       = document.getElementById('settings-btn');
const settingsModal     = document.getElementById('settings-modal');
const settingsOverlay   = document.getElementById('settings-overlay');
const closeSettings     = document.getElementById('close-settings');
const darkModeToggle    = document.getElementById('dark-mode-toggle');
const autoSaveToggle    = document.getElementById('auto-save-toggle');
const soundToggle       = document.getElementById('sound-toggle');
const saveGameBtn       = document.getElementById('save-game-btn');
const resetGameBtn      = document.getElementById('reset-game-btn');
const body              = document.body;
const startScreen       = document.getElementById('start-screen');
const gameRoot          = document.getElementById('game-root');
const achievementsBtn   = document.getElementById('achievements-btn');

// ---- Settings: restore on load ----
window.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkModeEnabled') === 'true') {
    body.classList.add('dark-mode');
    darkModeToggle.checked = true;
  }
  if (localStorage.getItem('autoSaveEnabled') === 'true') {
    body.classList.add('auto-save');
    autoSaveToggle.checked = true;
  }
  if (localStorage.getItem('soundEnabled') === 'false') {
    soundToggle.checked = false;
  }
  loadSkins();
  loadAchievementsData();
});

// ---- Settings toggles ----
darkModeToggle.addEventListener('change', () => {
  body.classList.toggle('dark-mode', darkModeToggle.checked);
  localStorage.setItem('darkModeEnabled', darkModeToggle.checked);
});
autoSaveToggle.addEventListener('change', () => {
  body.classList.toggle('auto-save', autoSaveToggle.checked);
  localStorage.setItem('autoSaveEnabled', autoSaveToggle.checked);
});
soundToggle.addEventListener('change', () => {
  localStorage.setItem('soundEnabled', soundToggle.checked);
});

// ---- Settings open/close ----
function openSettings() {
  settingsModal.classList.add('show');
  settingsOverlay.classList.add('show');
  darkModeToggle.checked = body.classList.contains('dark-mode');
  autoSaveToggle.checked = body.classList.contains('auto-save');
  soundToggle.checked = localStorage.getItem('soundEnabled') !== 'false';
}
function closeSettingsModal() {
  settingsModal.classList.remove('show');
  settingsOverlay.classList.remove('show');
  closeAchievementsModal();
}
settingsBtn.addEventListener('click', openSettings);
if (closeSettings) closeSettings.addEventListener('click', closeSettingsModal);
settingsOverlay.addEventListener('click', closeSettingsModal);

// ---- Save / Reset buttons in settings ----
saveGameBtn.addEventListener('click', () => {
  saveGameState();
  const note = document.getElementById('shop-text-note');
  note.textContent = '✅ Game saved!';
  setTimeout(() => { note.textContent = ''; }, 2000);
});
resetGameBtn.addEventListener('click', () => {
  if (confirm('Reset all progress? This cannot be undone.')) {
    localStorage.clear();
    location.reload();
  }
});

// ---- Back button (Android) ----
let lastBackPress = 0;
document.addEventListener('backbutton', (e) => {
  e.preventDefault();
  if (document.querySelector('.show')) {
    document.querySelectorAll('.show').forEach(el => el.classList.remove('show'));
    return;
  }
  if (Date.now() - lastBackPress < 2000) {
    navigator.app && navigator.app.exitApp();
  } else {
    lastBackPress = Date.now();
    showToast('Press back again to exit');
  }
}, false);

// ---- Prevent zoom gestures ----
let lastTouchEnd = 0;
document.addEventListener('touchmove', (e) => {
  if (e.scale !== 1 || (e.touches && e.touches.length > 1)) e.preventDefault();
}, { passive: false });
document.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTouchEnd <= 300) e.preventDefault();
  lastTouchEnd = now;
});

// ---- Scroll vs click differentiation ----
let isScrolling = false;
document.addEventListener('touchstart', () => { isScrolling = false; }, { passive: true });
document.addEventListener('touchmove',  () => { isScrolling = true;  }, { passive: true });
document.addEventListener('click', (e) => {
  if (isScrolling) { e.stopPropagation(); isScrolling = false; }
}, true);

// =============================================
// ACHIEVEMENTS DATA
// =============================================
const ACHIEVEMENTS = {
  firstClick:     { unlocked: false, icon: '🐸', title: 'First Hopper!',      desc: 'Make your very first click.' },
  tenClicks:      { unlocked: false, icon: '🌿', title: 'Getting Warmed Up',   desc: 'Reach 10 clicks.' },
  hundredClicks:  { unlocked: false, icon: '💯', title: 'Century Hopper',      desc: 'Reach 100 clicks.' },
  thousandClicks: { unlocked: false, icon: '🏆', title: 'Thousand Hopper!',    desc: 'Reach 1,000 clicks.' },
  tenKClicks:     { unlocked: false, icon: '🚀', title: 'Leap of Faith',       desc: 'Reach 10,000 clicks.' },
  secretButton:   { unlocked: false, icon: '🔮', title: 'Secret Finder',       desc: 'You found the hidden secret!' },
  buyUpgrade:     { unlocked: false, icon: '🛒', title: 'Shopaholic',          desc: 'Buy your first shop upgrade.' },
  ownAllUpgrades: { unlocked: false, icon: '💎', title: 'Full Kit',            desc: 'Own every shop upgrade.' },
  changeSkin:     { unlocked: false, icon: '🎨', title: 'Fashion Frog',        desc: 'Change your frog skin.' },
  combo5:         { unlocked: false, icon: '🔥', title: 'On Fire!',            desc: 'Hit a ×5 combo.' },
  combo10:        { unlocked: false, icon: '⚡', title: 'Lightning Clicker',   desc: 'Hit a ×10 combo.' },
};

const ACHIEVEMENT_SAVE_KEY = 'achievements_v2';

function loadAchievementsData() {
  try {
    const saved = localStorage.getItem(ACHIEVEMENT_SAVE_KEY);
    if (saved) {
      const loaded = JSON.parse(saved);
      Object.keys(ACHIEVEMENTS).forEach(k => {
        if (loaded[k]) ACHIEVEMENTS[k].unlocked = loaded[k].unlocked || false;
      });
    }
  } catch(e) { console.error('Achievement load error:', e); }
}

function saveAchievements() {
  try {
    localStorage.setItem(ACHIEVEMENT_SAVE_KEY, JSON.stringify(ACHIEVEMENTS));
  } catch(e) {}
}

function checkAchievement(key) {
  if (ACHIEVEMENTS[key] && !ACHIEVEMENTS[key].unlocked) {
    ACHIEVEMENTS[key].unlocked = true;
    showAchievementPopup(key);
    saveAchievements();
  }
}

let achievementPopupEl = null;
let achievementPopupTimeout = null;

function showAchievementPopup(key) {
  const ach = ACHIEVEMENTS[key];
  if (!ach) return;

  if (achievementPopupEl) {
    achievementPopupEl.classList.add('hide');
    clearTimeout(achievementPopupTimeout);
    setTimeout(() => { if (achievementPopupEl) achievementPopupEl.remove(); }, 400);
  }

  achievementPopupEl = document.createElement('div');
  achievementPopupEl.className = 'achievement-popup';
  achievementPopupEl.innerHTML = `
    <div class="popup-inner">
      <div class="popup-trophy">${ach.icon}</div>
      <div>
        <div class="popup-unlocked">Achievement Unlocked!</div>
        <div class="popup-title">${ach.title}</div>
        <div class="popup-desc">${ach.desc}</div>
      </div>
    </div>
  `;
  document.body.appendChild(achievementPopupEl);
  requestAnimationFrame(() => achievementPopupEl.classList.add('show'));

  achievementPopupTimeout = setTimeout(() => {
    if (achievementPopupEl) {
      achievementPopupEl.classList.add('hide');
      achievementPopupEl.classList.remove('show');
      setTimeout(() => { achievementPopupEl && achievementPopupEl.remove(); achievementPopupEl = null; }, 450);
    }
  }, 4500);
}

function showAchievementsMenu() {
  const modal = document.getElementById('achievements-modal');
  const overlay = document.getElementById('settings-overlay');
  modal.classList.add('show');
  overlay.classList.add('show');

  const list = document.getElementById('achievements-list');
  const total = Object.keys(ACHIEVEMENTS).length;
  const unlocked = Object.values(ACHIEVEMENTS).filter(a => a.unlocked).length;

  const bar = document.getElementById('achievements-progress-bar');
  const label = document.getElementById('achievements-progress-label');
  bar.style.width = (unlocked / total * 100) + '%';
  label.textContent = `${unlocked} / ${total} unlocked`;

  list.innerHTML = '';
  Object.keys(ACHIEVEMENTS).forEach(key => {
    const ach = ACHIEVEMENTS[key];
    const item = document.createElement('div');
    item.className = 'achievement-list-item' + (ach.unlocked ? ' unlocked' : '');
    item.innerHTML = `
      <div class="ach-icon">${ach.unlocked ? ach.icon : '🔒'}</div>
      <div class="ach-info">
        <div class="ach-title">${ach.title}</div>
        <div class="ach-desc">${ach.desc}</div>
        <div class="ach-status">${ach.unlocked ? '✅ Unlocked' : 'Locked'}</div>
      </div>
    `;
    list.appendChild(item);
  });
}

function closeAchievementsModal() {
  document.getElementById('achievements-modal').classList.remove('show');
  document.getElementById('settings-overlay').classList.remove('show');
}
window.closeAchievementsModal = closeAchievementsModal;

achievementsBtn.onclick = showAchievementsMenu;
document.getElementById('close-achievements').onclick = closeAchievementsModal;

// =============================================
// SKINS DATA
// =============================================
const FROG_SKINS = {
  classic:       { unlocked: true,  name: 'Classic Frog',    emoji: '🐸', img: 'images/Frog-2.png',           price: 0   },
  cute:          { unlocked: false, name: 'Cute Frog',       emoji: '🥰', img: 'images/Cute-Frog.png',         price: 50  },
  red:           { unlocked: false, name: 'Red Frog',        emoji: '🔥', img: 'images/Red-Frog.png',          price: 60  },
  ultraCute:     { unlocked: false, name: 'Ultra Cute Frog', emoji: '💖', img: 'images/Ultra-Cute-Frog.png',   price: 40  },
  blueFrog:      { unlocked: false, name: 'Blue Frog',       emoji: '💙', img: 'images/Blue-Frog.png',         price: 55  },
  minecraftFrog: { unlocked: false, name: 'Minecraft Frog',  emoji: '🌿', img: 'images/Minecraft-Frog.png',    price: 70  },
};

const SKIN_SAVE_KEY = 'frogSkin';
let currentSkin = 'classic';

function loadSkins() {
  try {
    const saved = localStorage.getItem('frogSkins');
    if (saved) {
      const loaded = JSON.parse(saved);
      Object.keys(FROG_SKINS).forEach(k => {
        if (loaded[k] !== undefined) FROG_SKINS[k].unlocked = loaded[k];
      });
    }
  } catch(e) {}
  const savedSkin = localStorage.getItem(SKIN_SAVE_KEY);
  if (savedSkin && FROG_SKINS[savedSkin] && FROG_SKINS[savedSkin].unlocked) {
    currentSkin = savedSkin;
  }
  applyCurrentSkin();
}

function saveSkins() {
  try {
    const status = {};
    Object.keys(FROG_SKINS).forEach(k => { status[k] = FROG_SKINS[k].unlocked; });
    localStorage.setItem('frogSkins', JSON.stringify(status));
    localStorage.setItem(SKIN_SAVE_KEY, currentSkin);
  } catch(e) {}
}

function applyCurrentSkin() {
  const img = document.getElementById('random-img');
  const img2 = document.getElementById('second-random-img');
  if (img) img.src = FROG_SKINS[currentSkin].img;
  if (img2) img2.src = FROG_SKINS[currentSkin].img;
}

function setSkin(skinKey) {
  if (FROG_SKINS[skinKey] && FROG_SKINS[skinKey].unlocked) {
    currentSkin = skinKey;
    applyCurrentSkin();
    saveSkins();
    populateSkinsTab();
    checkAchievement('changeSkin');
  }
}
window.setSkin = setSkin;

// =============================================
// SHOP ITEMS DATA
// =============================================
const SHOP_ITEMS = [
  {
    id: 'auto',
    icon: '🤖', name: 'Auto Hopper',
    desc: 'Automatically clicks every 3 seconds.',
    cost: 100,
    isOwned: () => !!autoClickInterval,
    onBuy: () => { autoClickInterval = setInterval(() => clickFrog(true), 3000); }
  },
  {
    id: 'secondFrogItem',
    icon: '😈', name: 'Evil Larry',
    desc: 'A second frog joins the chaos! Hold to grow him.',
    cost: 50,
    isOwned: () => secondFrog,
    onBuy: () => {
      secondFrog = true;
      const si = document.getElementById('second-random-img');
      si.style.display = 'block';
      randomize(si);
    }
  },
  {
    id: 'multiplier',
    icon: '×2', name: '×2 Multiplier',
    desc: 'Each click counts double. Forever.',
    cost: 100,
    isOwned: () => multiplier >= 2,
    onBuy: () => { multiplier = 2; }
  },
  {
    id: 'tempAuto',
    icon: '⏱️', name: 'Temp Auto Clicker',
    desc: 'Auto-clicks every second for 30 seconds.',
    cost: 70,
    isOwned: () => timers.tempAuto > 0,
    onBuy: () => {
      timers.tempAuto = 30; updateTimers();
      tempAutoInterval = setInterval(() => {
        if (timers.tempAuto > 0) { clickFrog(true); timers.tempAuto--; updateTimers(); }
        else { clearInterval(tempAutoInterval); tempAutoInterval = null; timers.tempAuto = 0; updateTimers(); }
      }, 1000);
    }
  },
  {
    id: 'freeze',
    icon: '❄️', name: 'Freeze Frog',
    desc: 'Freezes the frogs in place for 30 seconds.',
    cost: 100,
    isOwned: () => freezeActive,
    onBuy: () => {
      freezeActive = true; timers.freeze = 30; updateTimers();
      let ft = setInterval(() => {
        timers.freeze--; updateTimers();
        if (timers.freeze <= 0) { clearInterval(ft); freezeActive = false; timers.freeze = 0; updateTimers(); }
      }, 1000);
    }
  },
];

function populateShopTab() {
  const grid = document.getElementById('shop-items-grid');
  if (!grid) return;
  grid.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    const owned = item.isOwned();
    const canAfford = clicks >= item.cost;
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.innerHTML = `
      <div class="shop-card-icon">${item.icon}</div>
      <div class="shop-card-info">
        <div class="shop-card-name">${item.name}</div>
        <div class="shop-card-desc">${item.desc}</div>
        <div class="shop-card-cost">${owned ? '✅ Owned' : `🪙 ${item.cost} clicks`}</div>
      </div>
      <button class="shop-buy-btn ${owned ? 'owned' : ''}" data-id="${item.id}" ${owned ? 'disabled' : ''}>
        ${owned ? 'Owned' : canAfford ? 'Buy' : `${item.cost}`}
      </button>
    `;
    if (!owned) {
      card.querySelector('.shop-buy-btn').addEventListener('click', () => {
        if (clicks >= item.cost && !item.isOwned()) {
          clicks -= item.cost;
          updateCounter();
          item.onBuy();
          maybeAutoSave();
          checkAchievement('buyUpgrade');
          checkAllUpgradesOwned();
          populateShopTab();
        }
      });
    }
    grid.appendChild(card);
  });
}

function checkAllUpgradesOwned() {
  if (SHOP_ITEMS.every(i => i.isOwned())) checkAchievement('ownAllUpgrades');
}

function populateSkinsTab() {
  const grid = document.getElementById('skins-grid');
  if (!grid) return;
  grid.innerHTML = '';
  Object.keys(FROG_SKINS).forEach(key => {
    const skin = FROG_SKINS[key];
    const isActive = currentSkin === key;
    const card = document.createElement('div');
    card.className = 'skin-card' + (isActive ? ' active-skin' : '');
    card.innerHTML = `
      <img src="${skin.img}" alt="${skin.name}" onerror="this.style.display='none'">
      <div class="skin-info">
        <div class="skin-name">${skin.emoji} ${skin.name}</div>
        <div class="skin-status ${skin.unlocked ? 'unlocked-text' : ''}">
          ${skin.unlocked ? (isActive ? '✨ Currently equipped' : '✅ Unlocked') : `🔒 ${skin.price} clicks`}
        </div>
      </div>
      ${skin.unlocked
        ? (isActive
            ? `<button class="skin-action-btn active-btn">Active</button>`
            : `<button class="skin-action-btn use-btn" data-skin="${key}">Use</button>`)
        : `<button class="skin-action-btn buy-btn" data-skin="${key}">Buy</button>`
      }
    `;
    const btn = card.querySelector('button');
    if (btn && !isActive) {
      btn.addEventListener('click', () => {
        if (skin.unlocked) {
          setSkin(key);
        } else if (clicks >= skin.price) {
          clicks -= skin.price;
          skin.unlocked = true;
          updateCounter();
          saveSkins();
          populateSkinsTab();
          maybeAutoSave();
        }
      });
    }
    grid.appendChild(card);
  });
}
window.populateSkinsTab = populateSkinsTab;

// =============================================
// TAB SWITCHER
// =============================================
function switchTab(tab) {
  const shopBtn  = document.getElementById('btn-shop');
  const skinsBtn = document.getElementById('btn-skins');
  const shopContent  = document.getElementById('shop-content');
  const skinsContent = document.getElementById('skins-content');
  const modal = document.getElementById('shop-modal');

  if (tab === 'shop') {
    shopBtn.classList.add('active');  skinsBtn.classList.remove('active');
    shopContent.style.display = 'block'; skinsContent.style.display = 'none';
    populateShopTab();
  } else {
    skinsBtn.classList.add('active'); shopBtn.classList.remove('active');
    shopContent.style.display = 'none'; skinsContent.style.display = 'block';
    populateSkinsTab();
  }
  modal.scrollTop = 0;
}
window.switchTab = switchTab;

// =============================================
// TOAST
// =============================================
function showToast(msg) {
  const t = document.createElement('div');
  t.style.cssText = `
    position:fixed; bottom:30px; left:50%; transform:translateX(-50%);
    background:rgba(0,0,0,0.75); color:#fff; padding:10px 22px;
    border-radius:30px; font-family:var(--font-body); font-size:0.88rem;
    z-index:9999; pointer-events:none; backdrop-filter:blur(6px);
    animation: fadeInUp 0.3s ease;
  `;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

// =============================================
// GAME LOGIC
// =============================================
let clicks = 0, multiplier = 1;
let secondFrog = false;
let autoClickInterval = null;
let tempAutoInterval = null;
let freezeActive = false;
let timers = { tempAuto: 0, freeze: 0 };
let comboCount = 0;
let comboTimeout = null;
const COMBO_WINDOW = 800; // ms between clicks to keep combo alive
const sizes = { min: 55, max: 220 };
const SAVE_KEY = 'frogGameSave_v2';

// Module-level wrappers so shop/skin buttons can always call these
// (the real implementations are set inside DOMContentLoaded)
function maybeAutoSave() { if (window._maybeAutoSave) window._maybeAutoSave(); }
function randomize(el)   { if (window._randomize) window._randomize(el); }
function clickFrog(auto, event) { if (window._clickFrog) window._clickFrog(auto, event); }
function updateCounter() { if (window._updateCounter) window._updateCounter(); }
function updateTimers()  { if (window._updateTimers) window._updateTimers(); }

window.addEventListener('DOMContentLoaded', function () {
  if (!gameRoot) return;

  const clickSound = document.getElementById('clickSound');
  const img        = document.getElementById('random-img');
  const secondImg  = document.getElementById('second-random-img');
  const counter    = document.getElementById('counter-num');
  const timerDisplay = document.getElementById('timer-display');
  const shopBtn    = document.getElementById('shop-btn');
  const shopModal  = document.getElementById('shop-modal');
  const overlay    = document.getElementById('overlay');
  const closeShop  = document.getElementById('close-shop');
  const comboDisplay = document.getElementById('combo-display');
  const comboNum   = document.getElementById('combo-num');

  // ---- START ----
  document.getElementById('startBtn').onclick = () => {
    startScreen.style.display = 'none';
    gameRoot.classList.add('game-on');
    settingsBtn.style.display = 'none';
    achievementsBtn.classList.add('game-started');
    if (!img.style.width) randomize(img);
    if (localStorage.getItem('autoSaveEnabled') === 'true') loadGameState();
    populateShopTab();
    populateSkinsTab();
  };

  // Expose inner functions to module scope so shop buttons always work
  window._maybeAutoSave = maybeAutoSave;
  window._randomize     = randomize;
  window._clickFrog     = clickFrog;
  window._updateCounter = updateCounter;
  window._updateTimers  = updateTimers;

  // ---- HOLD TO GROW (second frog only) ----
  let holdScale2 = 1;
  let holdInterval2 = null;
  const MAX_SCALE = 4;
  const GROW_SPEED = 0.03;

  function startHoldGrow() {
    if (!secondFrog || holdInterval2) return;
    holdScale2 = 1;
    secondImg.style.transition = 'transform 0s, width 0.25s, height 0.25s';
    holdInterval2 = setInterval(() => {
      holdScale2 = Math.min(holdScale2 + GROW_SPEED, MAX_SCALE);
      secondImg.style.setProperty('--scale', holdScale2);
    }, 16);
  }
  function endHoldGrow() {
    if (holdInterval2) { clearInterval(holdInterval2); holdInterval2 = null; }
    holdScale2 = 1;
    secondImg.style.transition = 'transform 0.2s ease-out, width 0.25s, height 0.25s';
    secondImg.style.setProperty('--scale', '1');
  }
  secondImg.addEventListener('mousedown', startHoldGrow);
  secondImg.addEventListener('mouseup', endHoldGrow);
  secondImg.addEventListener('mouseleave', endHoldGrow);
  secondImg.addEventListener('touchstart', (e) => {
    if (!secondFrog) return;
    e.preventDefault();
    startHoldGrow();
  }, { passive: false });
  secondImg.addEventListener('touchend', endHoldGrow);
  secondImg.addEventListener('touchcancel', endHoldGrow);

  // ---- CLICK HANDLERS ----
  img.onclick = () => clickFrog();
  secondImg.onclick = () => { if (secondFrog) clickFrog(); };
  img.addEventListener('touchstart', (e) => { e.preventDefault(); clickFrog(); }, { passive: false });
  secondImg.addEventListener('touchstart', (e) => {
    if (secondFrog) { e.preventDefault(); clickFrog(); }
  }, { passive: false });

  // ---- CORE FUNCTIONS ----
  function randomize(el) {
    const w = Math.random() * (sizes.max - sizes.min) + sizes.min;
    const x = Math.random() * (window.innerWidth - w);
    const y = Math.random() * (window.innerHeight - w - 60) + 60;
    el.style.width = w + 'px';
    el.style.height = w + 'px';
    el.style.setProperty('--tx', x + 'px');
    el.style.setProperty('--ty', y + 'px');
  }

  function updateCounter() {
    if (counter) counter.textContent = clicks.toLocaleString();
  }

  function updateTimers() {
    const texts = [];
    if (timers.tempAuto > 0) texts.push(`⏱️ Temp Auto: ${timers.tempAuto}s`);
    if (timers.freeze > 0)   texts.push(`❄️ Freeze: ${timers.freeze}s`);
    if (timerDisplay) timerDisplay.textContent = texts.join('  ·  ');
  }

  function playClickSound() {
    const enabled = localStorage.getItem('soundEnabled') !== 'false';
    if (clickSound && enabled) {
      clickSound.currentTime = 0;
      clickSound.play().catch(() => {});
    }
  }

  function spawnParticle(x, y) {
    const emojis = ['🐸', '+' + multiplier * comboMultiplier(), '✨', '💚', '🌿'];
    const pick = Math.random() < 0.5 ? '+' + (multiplier * comboMultiplier()) : emojis[Math.floor(Math.random() * emojis.length)];
    const el = document.createElement('div');
    el.className = 'click-particle';
    el.textContent = pick;
    el.style.left = (x - 20 + (Math.random() - 0.5) * 30) + 'px';
    el.style.top  = (y - 10) + 'px';
    el.style.color = multiplier > 1 ? '#ffeb3b' : '#a5d6a7';
    el.style.fontSize = (1.0 + Math.random() * 0.6) + 'rem';
    document.getElementById('particles-container').appendChild(el);
    setTimeout(() => el.remove(), 950);
  }

  function comboMultiplier() {
    if (comboCount >= 10) return 3;
    if (comboCount >= 5)  return 2;
    return 1;
  }

  function updateComboDisplay() {
    if (comboCount >= 3) {
      comboDisplay.classList.remove('hidden');
      comboNum.textContent = comboCount;
      // re-trigger animation
      comboDisplay.style.animation = 'none';
      void comboDisplay.offsetWidth;
      comboDisplay.style.animation = '';
    } else {
      comboDisplay.classList.add('hidden');
    }
  }

  function clickFrog(auto = false, event = null) {
    // Combo tracking
    if (!auto) {
      comboCount++;
      clearTimeout(comboTimeout);
      comboTimeout = setTimeout(() => {
        comboCount = 0;
        updateComboDisplay();
      }, COMBO_WINDOW);

      // Combo achievements
      if (comboCount >= 5)  checkAchievement('combo5');
      if (comboCount >= 10) checkAchievement('combo10');
      updateComboDisplay();
    }

    const earned = multiplier * (auto ? 1 : comboMultiplier());
    clicks += earned;
    updateCounter();
    playClickSound();

    // Spawn particle near the click/frog position
    if (!auto && event) {
      spawnParticle(event.clientX || event.touches?.[0]?.clientX || window.innerWidth / 2,
                    event.clientY || event.touches?.[0]?.clientY || window.innerHeight / 2);
    } else if (!auto) {
      const rect = document.getElementById('random-img').getBoundingClientRect();
      spawnParticle(rect.left + rect.width / 2, rect.top + rect.height / 2);
    }

    // Achievements
    checkAchievement('firstClick');
    if (clicks >= 10)    checkAchievement('tenClicks');
    if (clicks >= 100)   checkAchievement('hundredClicks');
    if (clicks >= 1000)  checkAchievement('thousandClicks');
    if (clicks >= 10000) checkAchievement('tenKClicks');

    // Move frogs
    if (!auto && !freezeActive) randomize(img);
    if (secondFrog && !auto && !freezeActive) randomize(secondImg);

    maybeAutoSave();
  }

  // Wire click events with event position for particles
  img.onclick = (e) => clickFrog(false, e);
  secondImg.onclick = (e) => { if (secondFrog) clickFrog(false, e); };
  img.addEventListener('touchstart', (e) => { e.preventDefault(); clickFrog(false, e); }, { passive: false });
  secondImg.addEventListener('touchstart', (e) => {
    if (secondFrog) { e.preventDefault(); clickFrog(false, e); }
  }, { passive: false });

  // Secret: click the counter label
  document.getElementById('counter').addEventListener('click', () => {
    checkAchievement('secretButton');
  });

  // ---- SHOP ----
  const toggleShop = (show) => {
    overlay.classList.toggle('show', show);
    shopModal.classList.toggle('show', show);
    if (show) {
      switchTab('shop');
      shopModal.scrollTop = 0;
    }
  };
  shopBtn.onclick = () => toggleShop(true);
  closeShop.onclick = () => toggleShop(false);
  overlay.onclick = () => toggleShop(false);
  document.addEventListener('keydown', (e) => {
    if (gameRoot.classList.contains('game-on') && (e.key === 's' || e.key === 'S')) toggleShop(true);
    if (e.key === 'Escape') toggleShop(false);
  });

  // ---- SAVE / LOAD ----
  function saveGameState() {
    const state = {
      clicks, multiplier, secondFrog, freezeActive, timers,
      hasAutoClicker: !!autoClickInterval,
      currentSkin
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch(e) {}
  }
  window.saveGameState = saveGameState;

  function loadGameState() {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      clicks       = s.clicks       ?? 0;
      multiplier   = s.multiplier   ?? 1;
      secondFrog   = !!s.secondFrog;
      freezeActive = !!s.freezeActive;
      timers       = s.timers || { tempAuto: 0, freeze: 0 };
      if (s.currentSkin && FROG_SKINS[s.currentSkin]) { currentSkin = s.currentSkin; applyCurrentSkin(); }
      updateCounter();
      updateTimers();
      if (secondFrog) {
        secondImg.style.display = 'block';
        randomize(secondImg);
      }
      if (s.hasAutoClicker && !autoClickInterval) {
        autoClickInterval = setInterval(() => clickFrog(true), 3000);
      }
    } catch(e) {}
  }

  function maybeAutoSave() {
    if (localStorage.getItem('autoSaveEnabled') === 'true') saveGameState();
  }
  window.maybeAutoSave = maybeAutoSave;

  setInterval(updateTimers, 1000);
});