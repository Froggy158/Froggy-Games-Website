'use strict';

// ── SCREENS & ELEMENTS ─────────────────────────────────────
const startScreen  = document.getElementById('startScreen');
const gameScreen   = document.getElementById('gameScreen');
const levelScreen  = document.getElementById('levelScreen');
const overScreen   = document.getElementById('overScreen');
const btnPlay      = document.getElementById('btnPlay');
const btnNext      = document.getElementById('btnNext');
const btnRetry     = document.getElementById('btnRetry');
const hudLevel     = document.getElementById('hudLevel');
const hudScore     = document.getElementById('hudScore');
const hudTime      = document.getElementById('hudTime');
const timerBar     = document.getElementById('timerBar');
const objectLayer  = document.getElementById('objectLayer');
const bgCanvas     = document.getElementById('bgCanvas');
const toast        = document.getElementById('toast');
const levelBanner  = document.getElementById('levelBanner');
const startBest    = document.getElementById('startBest');
const logoCanvas   = document.getElementById('logoCanvas');

let bestScore = parseInt(localStorage.getItem('ftfBest') || '0');
startBest.innerHTML = `🏆 Best: <strong>${bestScore}</strong>`;

// ── GAME STATE ─────────────────────────────────────────────
let level, score, timeLeft, timerInterval, gameActive;
let frogEl, allObjects;
const MAX_TIME = 30;

// ── BUTTON WIRING ──────────────────────────────────────────
btnPlay.addEventListener('click',  () => { level = 1; score = 0; launchLevel(); });
btnNext.addEventListener('click',  () => { level++;              launchLevel(); });
btnRetry.addEventListener('click', () => { level = 1; score = 0; launchLevel(); });

// ── FIREFLIES ──────────────────────────────────────────────
(function spawnFireflies() {
    const container = document.getElementById('fireflies');
    for (let i = 0; i < 26; i++) {
        const f = document.createElement('div');
        f.className = 'firefly';
        const tx = (Math.random() * 200 - 100) + 'px';
        const ty = (Math.random() * -200 - 20) + 'px';
        f.style.cssText = `
            left:${Math.random()*100}%;
            top:${Math.random()*100}%;
            --tx:${tx}; --ty:${ty};
            --dur:${3 + Math.random()*5}s;
            --delay:-${Math.random()*6}s;
        `;
        container.appendChild(f);
    }
})();

// ── DRAW LOGO FROG ─────────────────────────────────────────
drawFrogOnCanvas(logoCanvas, 55, 50, 34);

// ── CANVAS BACKGROUND ──────────────────────────────────────
const bgCtx = bgCanvas.getContext('2d');

function resizeBgCanvas() {
    const area = document.getElementById('gameArea');
    bgCanvas.width  = area.clientWidth  || 560;
    bgCanvas.height = area.clientHeight || 400;
    drawBackground();
}

function drawBackground() {
    const W = bgCanvas.width, H = bgCanvas.height;
    const ctx = bgCtx;

    // Sky/ground gradient
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   '#0a2e14');
    grad.addColorStop(0.5, '#1a4d28');
    grad.addColorStop(1,   '#0d2b18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Scattered grass patches
    ctx.fillStyle = '#1e5e30';
    for (let i = 0; i < 14; i++) {
        const x = (i / 14) * W + Math.sin(i * 1.7) * 20;
        const y = H * 0.55 + Math.cos(i * 2.3) * H * 0.15;
        const r = 18 + Math.sin(i * 3.1) * 12;
        ctx.beginPath();
        ctx.ellipse(x, y, r * 2.5, r, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Tree trunks
    ctx.fillStyle = '#2a1a0e';
    const trunks = [0.08, 0.22, 0.42, 0.62, 0.78, 0.92];
    trunks.forEach((tx, i) => {
        const x = tx * W;
        const h = H * (0.3 + Math.sin(i * 1.9) * 0.1);
        ctx.fillRect(x - 6, H - h, 12, h);
    });

    // Tree canopies
    trunks.forEach((tx, i) => {
        const x = tx * W;
        const baseY = H * (0.7 - Math.sin(i * 1.9) * 0.1);
        const r = 32 + i % 3 * 12;
        const hue = 130 + i * 8;
        ctx.fillStyle = `hsl(${hue}, 50%, ${18 + i % 2 * 6}%)`;
        ctx.beginPath();
        ctx.arc(x, baseY, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsl(${hue}, 50%, ${22 + i % 2 * 5}%)`;
        ctx.beginPath();
        ctx.arc(x - 10, baseY - 10, r * 0.7, 0, Math.PI * 2);
        ctx.fill();
    });

    // Pond
    ctx.fillStyle = 'rgba(30, 100, 160, 0.35)';
    ctx.beginPath();
    ctx.ellipse(W * 0.5, H * 0.72, W * 0.18, H * 0.07, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Ground mist
    const mist = ctx.createLinearGradient(0, H * 0.75, 0, H);
    mist.addColorStop(0, 'transparent');
    mist.addColorStop(1, 'rgba(100,200,130,0.12)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
}

// ── LAUNCH LEVEL ───────────────────────────────────────────
function launchLevel() {
    showScreen(gameScreen);
    clearObjects();
    resizeBgCanvas();

    hudLevel.textContent = level;
    hudScore.textContent = score;

    // Show level banner briefly then build the level
    levelBanner.textContent = `Level ${level}`;
    levelBanner.classList.remove('show');
    void levelBanner.offsetWidth;
    levelBanner.classList.add('show');
    levelBanner.classList.remove('hidden');

    setTimeout(() => {
        buildLevel();
        startTimer();
        gameActive = true;
    }, 800);
}

// ── BUILD LEVEL ────────────────────────────────────────────
const DECOYS = ['🌿','🍃','🌱','🍀','🌾','🍂','🍁','🌺','🌸','🌻','🍄','🪨','🪵','🌊','🦋','🐝','🐛','🦎','🐚','🌵'];

function buildLevel() {
    const area = document.getElementById('gameArea');
    const W = area.clientWidth;
    const H = area.clientHeight;

    const count  = 8 + level * 3;
    const frogSz = Math.max(28, 52 - level * 2.5);

    // Create frog element (canvas)
    frogEl = document.createElement('canvas');
    frogEl.width  = Math.round(frogSz * 1.4);
    frogEl.height = Math.round(frogSz * 1.3);
    frogEl.className = 'obj';
    frogEl.dataset.isFrog = '1';

    // Camouflage: at higher levels, tint frog to match background
    const camoAlpha = Math.min(0.55, (level - 1) * 0.07);
    drawFrogOnCanvas(frogEl, frogEl.width / 2, frogEl.height / 2, frogSz / 2, camoAlpha);

    // Apply brightness/opacity blend at high levels
    if (level > 4) {
        frogEl.style.filter = `brightness(${Math.max(0.6, 1 - (level - 4) * 0.06)}) saturate(${Math.max(0.5, 1 - (level - 4) * 0.05)})`;
    }

    objectLayer.appendChild(frogEl);

    // Decoys
    const decoyPool = [...DECOYS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
        const emoji = decoyPool[i % decoyPool.length];
        const el = document.createElement('div');
        el.className = 'obj';
        const sz = 28 + Math.random() * 32;
        el.style.cssText = `font-size:${sz}px; line-height:1; cursor:pointer;`;
        el.textContent = emoji;
        // Random flip
        if (Math.random() > 0.5) el.style.transform = 'scaleX(-1)';
        objectLayer.appendChild(el);
    }

    allObjects = [...objectLayer.querySelectorAll('.obj')];
    placeObjects(W, H);

    // Event delegation
    objectLayer.addEventListener('click', onObjectClick);
    objectLayer.addEventListener('touchend', onObjectTouch, { passive: true });
}

function placeObjects(W, H) {
    const placed = [];
    allObjects.forEach(el => {
        const w = el.offsetWidth  || 44;
        const h = el.offsetHeight || 44;
        let x, y, tries = 0, ok;
        do {
            x = 10 + Math.random() * (W - w - 20);
            y = 10 + Math.random() * (H - h - 20);
            ok = placed.every(p => Math.abs(p.x - x) > p.w * 0.7 || Math.abs(p.y - y) > p.h * 0.7);
            tries++;
        } while (!ok && tries < 60);
        el.style.left = x + 'px';
        el.style.top  = y + 'px';
        el.style.zIndex = Math.floor(y);
        placed.push({ x, y, w, h });
    });
}

// ── CLICK HANDLING ─────────────────────────────────────────
let touchHandled = false;

function onObjectTouch(e) {
    touchHandled = true;
    const touch = e.changedTouches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY)?.closest?.('.obj');
    if (el) handleHit(el);
    setTimeout(() => { touchHandled = false; }, 300);
}

function onObjectClick(e) {
    if (touchHandled) return;
    const el = e.target.closest('.obj');
    if (el) handleHit(el);
}

function handleHit(el) {
    if (!gameActive) return;

    if (el.dataset.isFrog) {
        gameActive = false;
        clearInterval(timerInterval);
        el.classList.add('found');

        const timeBonus  = timeLeft * 5;
        const levelBonus = level * 100;
        const gained     = levelBonus + timeBonus;
        score += gained;
        if (score > bestScore) {
            bestScore = score;
            localStorage.setItem('ftfBest', bestScore);
        }

        spawnConfetti(el);
        showToast(`+${gained} 🎉`, '#7ed957');

        setTimeout(() => {
            document.getElementById('resultStats').innerHTML = `
                <div class="stat-row"><span class="stat-label">Level bonus</span><span class="stat-val">+${levelBonus}</span></div>
                <div class="stat-row"><span class="stat-label">Time bonus</span><span class="stat-val">+${timeBonus}</span></div>
                <div class="stat-row"><span class="stat-label">Total score</span><span class="stat-val">${score}</span></div>
                ${score >= bestScore ? '<div class="stat-row"><span class="stat-label">🏆 New best!</span><span class="stat-val">' + score + '</span></div>' : ''}
            `;
            hudScore.textContent = score;
            startBest.innerHTML = `🏆 Best: <strong>${bestScore}</strong>`;
            showScreen(levelScreen);
        }, 1100);

    } else {
        el.classList.add('wrong');
        score = Math.max(0, score - 25);
        hudScore.textContent = score;
        showToast('-25 ❌', '#e85535');
        setTimeout(() => el.classList.remove('wrong'), 500);
    }
}

// ── TIMER ──────────────────────────────────────────────────
function startTimer() {
    timeLeft = MAX_TIME;
    updateTimerUI();
    timerInterval = setInterval(() => {
        timeLeft--;
        updateTimerUI();
        if (timeLeft <= 0) {
            gameActive = false;
            clearInterval(timerInterval);
            document.getElementById('overScore').textContent = score;
            const bestEl = document.getElementById('overBest');
            if (score >= bestScore && score > 0) {
                bestScore = score;
                localStorage.setItem('ftfBest', bestScore);
                bestEl.textContent = `🏆 New best: ${bestScore}!`;
            } else {
                bestEl.textContent = `Best: ${bestScore}`;
            }
            startBest.innerHTML = `🏆 Best: <strong>${bestScore}</strong>`;
            setTimeout(() => showScreen(overScreen), 300);
        }
    }, 1000);
}

function updateTimerUI() {
    hudTime.textContent = timeLeft;
    const pct = (timeLeft / MAX_TIME) * 100;
    timerBar.style.width = pct + '%';
    timerBar.classList.toggle('warn',   pct <= 50 && pct > 25);
    timerBar.classList.toggle('danger', pct <= 25);
}

// ── DRAW FROG ON CANVAS ────────────────────────────────────
function drawFrogOnCanvas(canvas, cx, cy, r, camoAlpha = 0) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Shadow
    ctx.fillStyle = 'rgba(0,40,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.85, r * 0.75, r * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hind legs
    ctx.fillStyle = '#2ea02e';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.7, cy + r * 0.55, r * 0.45, r * 0.3, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.7, cy + r * 0.55, r * 0.45, r * 0.3, 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(cx - r*0.2, cy - r*0.1, r*0.1, cx, cy, r);
    bodyGrad.addColorStop(0, '#78e878');
    bodyGrad.addColorStop(1, '#228b22');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.1, r * 0.85, r * 0.75, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#b5f0a0';
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.25, r * 0.5, r * 0.48, 0, 0, Math.PI * 2);
    ctx.fill();

    // Front feet
    ctx.fillStyle = '#2ea02e';
    ctx.beginPath();
    ctx.ellipse(cx - r * 0.75, cy + r * 0.3, r * 0.3, r * 0.18, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + r * 0.75, cy + r * 0.3, r * 0.3, r * 0.18, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eye bumps
    ctx.fillStyle = '#228b22';
    ctx.beginPath();
    ctx.arc(cx - r * 0.38, cy - r * 0.62, r * 0.32, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.38, cy - r * 0.62, r * 0.32, 0, Math.PI * 2);
    ctx.fill();

    // Eye whites
    ctx.fillStyle = '#e8ffe0';
    ctx.beginPath();
    ctx.arc(cx - r * 0.38, cy - r * 0.66, r * 0.27, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.38, cy - r * 0.66, r * 0.27, 0, Math.PI * 2);
    ctx.fill();

    // Iris
    ctx.fillStyle = '#1a5e1a';
    ctx.beginPath();
    ctx.arc(cx - r * 0.36, cy - r * 0.64, r * 0.18, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.40, cy - r * 0.64, r * 0.18, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx - r * 0.35, cy - r * 0.63, r * 0.1, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.41, cy - r * 0.63, r * 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Highlight
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(cx - r * 0.31, cy - r * 0.68, r * 0.055, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.45, cy - r * 0.68, r * 0.055, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#155015';
    ctx.lineWidth = r * 0.07;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + r * 0.06, cy + r * 0.08, r * 0.28, 0.25, Math.PI - 0.25);
    ctx.stroke();

    // Nostrils
    ctx.fillStyle = '#155015';
    ctx.beginPath();
    ctx.arc(cx - r * 0.08, cy - r * 0.12, r * 0.055, 0, Math.PI * 2);
    ctx.arc(cx + r * 0.2,  cy - r * 0.12, r * 0.055, 0, Math.PI * 2);
    ctx.fill();

    // Camo overlay at higher levels
    if (camoAlpha > 0) {
        ctx.fillStyle = `rgba(30, 90, 30, ${camoAlpha})`;
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.1, r * 0.85, r * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ── CONFETTI / PARTICLES ───────────────────────────────────
function spawnConfetti(fromEl) {
    const rect = fromEl.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top  + rect.height / 2;
    const colors = ['#7ed957','#f5c842','#4ecdc4','#ff6b6b','#b5f0a0','#ffffff'];

    for (let i = 0; i < 28; i++) {
        const p = document.createElement('div');
        p.className = 'particle';
        const angle = Math.random() * Math.PI * 2;
        const dist  = 60 + Math.random() * 100;
        const tx    = Math.cos(angle) * dist + 'px';
        const ty    = (Math.sin(angle) * dist - 40) + 'px';
        const sz    = 6 + Math.random() * 8;
        p.style.cssText = `
            left:${ox}px; top:${oy}px;
            width:${sz}px; height:${sz}px;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            --tx:${tx}; --ty:${ty};
            --dur:${0.5 + Math.random() * 0.5}s;
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 1100);
    }
}

// ── TOAST ──────────────────────────────────────────────────
function showToast(text, color = 'white') {
    toast.textContent = text;
    toast.style.color = color;
    toast.style.borderColor = color + '55';
    toast.classList.remove('pop');
    void toast.offsetWidth;
    toast.classList.add('pop');
}

// ── UTILS ──────────────────────────────────────────────────
function clearObjects() {
    objectLayer.innerHTML = '';
    objectLayer.removeEventListener('click', onObjectClick);
    objectLayer.removeEventListener('touchend', onObjectTouch);
    allObjects = [];
    frogEl = null;
    clearInterval(timerInterval);
    gameActive = false;
}

function showScreen(screen) {
    [startScreen, gameScreen, levelScreen, overScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}

// Resize handler
window.addEventListener('resize', () => {
    if (!gameScreen.classList.contains('hidden')) {
        resizeBgCanvas();
        if (allObjects?.length) {
            const area = document.getElementById('gameArea');
            placeObjects(area.clientWidth, area.clientHeight);
        }
    }
});