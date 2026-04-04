'use strict';

// ─── SCREENS ────────────────────────────────────────────────────────────────
const startScreen   = document.getElementById('startScreen');
const gameScreen    = document.getElementById('gameScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const btnStart      = document.getElementById('btnStart');
const btnRestart    = document.getElementById('btnRestart');
const hudScore      = document.getElementById('hudScore');
const hudBest       = document.getElementById('hudBest');
const goScore       = document.getElementById('goScore');
const goBest        = document.getElementById('goBest');
const bestScoreDisplay = document.getElementById('bestScoreDisplay');

let bestScore = parseInt(localStorage.getItem('froggleBest') || '0');
bestScoreDisplay.textContent = `Best: ${bestScore}`;

btnStart.addEventListener('click', startGame);
btnRestart.addEventListener('click', startGame);

// ─── CANVAS ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// Responsive sizing
const W = 360;
let H = 620;
canvas.width  = W;
canvas.height = H;

// ─── GAME STATE ──────────────────────────────────────────────────────────────
const GRAVITY     = 0.38;
const JUMP_VEL    = -15;
const SPRING_VEL  = -22;
const MOVE_SPEED  = 5;
const FROG_W      = 42;
const FROG_H      = 38;

let frog, platforms, particles, enemies, score, cameraY, gameRunning, animId;

// Input
const keys = {};

document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup',   e => { keys[e.code] = false; });

// On-screen movement buttons
const btnLeft  = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');

function holdBtn(btn, code) {
    btn.addEventListener('pointerdown',   e => { e.preventDefault(); keys[code] = true;  btn.setPointerCapture(e.pointerId); }, { passive: false });
    btn.addEventListener('pointerup',     e => { keys[code] = false; });
    btn.addEventListener('pointercancel', e => { keys[code] = false; });
    btn.addEventListener('pointerleave',  e => { keys[code] = false; });
}
holdBtn(btnLeft,  'ArrowLeft');
holdBtn(btnRight, 'ArrowRight');

// ─── HOLD & DRAG INPUT ────────────────────────────────────────────────────────
// dragState: null = not dragging, otherwise { startX, currentX, active }
let dragState = null;

function getCanvasX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = W / rect.width;
    return (clientX - rect.left) * scaleX;
}

// Pointer events on canvas for hold-and-drag
canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    dragState = { startX: getCanvasX(e.clientX), currentX: getCanvasX(e.clientX) };
    canvas.setPointerCapture(e.pointerId);
}, { passive: false });

canvas.addEventListener('pointermove', e => {
    if (!dragState) return;
    e.preventDefault();
    dragState.currentX = getCanvasX(e.clientX);
}, { passive: false });

canvas.addEventListener('pointerup', e => {
    dragState = null;
});

canvas.addEventListener('pointercancel', e => {
    dragState = null;
});

// ─── PLATFORM TYPES ──────────────────────────────────────────────────────────
const PT = {
    NORMAL:  'normal',   // green, stays
    CRUMBLE: 'crumble',  // brown, breaks after 1 step
    SPRING:  'spring',   // has spring, super jump
    MOVING:  'moving',   // slides left/right
    LILY:    'lily',     // lily pad (cosmetic variant of normal)
};

function makePlatform(x, y, type) {
    return {
        x, y, type,
        w: type === PT.SPRING ? 72 : 80,
        h: 14,
        crumbling: false,
        crumbleTimer: 0,
        dx: (type === PT.MOVING) ? (Math.random() > 0.5 ? 1.2 : -1.2) : 0,
        springBounce: 0, // visual spring compression
        hasSpring: type === PT.SPRING,
    };
}

// ─── PARTICLE SYSTEM ─────────────────────────────────────────────────────────
function spawnParticles(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
        const angle = (Math.PI * 2 * i) / n + Math.random() * 0.5;
        const speed = 2 + Math.random() * 3;
        particles.push({
            x, y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 2,
            life: 1,
            decay: 0.04 + Math.random() * 0.04,
            r: 5 + Math.random() * 5,
            color,
        });
    }
}

// ─── ENEMY ───────────────────────────────────────────────────────────────────
function makeEnemy(y) {
    return {
        x: Math.random() * (W - 32),
        y,
        w: 32, h: 28,
        dx: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random()),
        alive: true,
        type: Math.random() > 0.5 ? 'fly' : 'bug',
    };
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function startGame() {
    showScreen(gameScreen);

    frog = {
        x: W / 2 - FROG_W / 2,
        y: H - 160,
        vx: 0,
        vy: JUMP_VEL,
        facingRight: true,
        squishY: 1,
        dead: false,
    };

    cameraY   = 0;
    score     = 0;
    particles = [];
    enemies   = [];

    // Build starting platforms
    platforms = [];
    // Ground platform
    platforms.push(makePlatform(W / 2 - 50, H - 60, PT.NORMAL));

    for (let i = 1; i < 18; i++) {
        const y  = H - 60 - i * 60;
        const type = pickStartType(i);
        platforms.push(makePlatform(Math.random() * (W - 80), y, type));
    }

    if (animId) cancelAnimationFrame(animId);
    gameRunning = true;
    loop();
}

function pickStartType(idx) {
    if (idx < 5) return Math.random() < 0.15 ? PT.LILY : PT.NORMAL;
    const r = Math.random();
    if (r < 0.45) return PT.NORMAL;
    if (r < 0.60) return PT.LILY;
    if (r < 0.72) return PT.MOVING;
    if (r < 0.82) return PT.CRUMBLE;
    if (r < 0.92) return PT.SPRING;
    return PT.NORMAL;
}

// ─── LOOP ─────────────────────────────────────────────────────────────────────
function loop() {
    if (!gameRunning) return;
    update();
    draw();
    animId = requestAnimationFrame(loop);
}

// ─── UPDATE ──────────────────────────────────────────────────────────────────
function update() {
    if (frog.dead) return;

    // ── Input ──
    let inputX = 0;
    if (keys['ArrowLeft']  || keys['KeyA']) inputX -= 1;
    if (keys['ArrowRight'] || keys['KeyD']) inputX += 1;

    // Hold & drag: steer frog toward the drag X position
    if (dragState) {
        const frogCX = frog.x + FROG_W / 2;
        const diff = dragState.currentX - frogCX;
        // Map pixel distance to input [-1, 1], threshold of 8px dead zone
        const deadZone = 8;
        if (Math.abs(diff) > deadZone) {
            inputX += Math.max(-1, Math.min(1, (diff - Math.sign(diff) * deadZone) / 60));
        }
    }

    inputX = Math.max(-1, Math.min(1, inputX));

    frog.vx += inputX * 1.2;
    frog.vx *= 0.78;
    if (Math.abs(inputX) > 0.05) frog.facingRight = inputX > 0;

    // ── Physics ──
    frog.vy += GRAVITY;
    frog.x  += frog.vx;
    frog.y  += frog.vy;

    // Wrap
    if (frog.x + FROG_W < 0) frog.x = W;
    if (frog.x > W)          frog.x = -FROG_W;

    // Squish animation
    if (frog.vy < -8)  frog.squishY = 0.75;
    else if (frog.vy > 6) frog.squishY = 1.2;
    else frog.squishY += (1 - frog.squishY) * 0.18;

    // ── Camera ──
    const scrollThresh = H * 0.38;
    if (frog.y < scrollThresh) {
        const shift = scrollThresh - frog.y;
        frog.y = scrollThresh;
        cameraY += shift;
        platforms.forEach(p => { p.y += shift; });
        particles.forEach(p => { p.y += shift; });
        enemies.forEach(e => { e.y += shift; });
        score = Math.max(score, Math.floor(cameraY / 8));
    }

    // ── Platform collision (only when falling) ──
    if (frog.vy > 0) {
        for (const p of platforms) {
            if (p.crumbling && p.crumbleTimer <= 0) continue;
            const fx = frog.x, fy = frog.y;
            const feetY = fy + FROG_H;
            const prevFeetY = feetY - frog.vy;
            if (
                fx + FROG_W - 6 > p.x &&
                fx + 6 < p.x + p.w &&
                prevFeetY <= p.y + 4 &&
                feetY >= p.y &&
                feetY <= p.y + p.h + 8
            ) {
                // Land
                if (p.hasSpring) {
                    frog.vy = SPRING_VEL;
                    p.springBounce = 1;
                    spawnParticles(p.x + p.w / 2, p.y, '#ffd54f', 8);
                } else {
                    frog.vy = JUMP_VEL;
                    spawnParticles(frog.x + FROG_W / 2, frog.y + FROG_H, '#a8e063', 5);
                }

                if (p.type === PT.CRUMBLE && !p.crumbling) {
                    p.crumbling = true;
                    p.crumbleTimer = 28;
                }
                break;
            }
        }
    }

    // ── Update platforms ──
    for (const p of platforms) {
        // Moving platforms
        if (p.type === PT.MOVING) {
            p.x += p.dx;
            if (p.x <= 0 || p.x + p.w >= W) p.dx *= -1;
        }
        // Crumble timer
        if (p.crumbling) {
            p.crumbleTimer--;
        }
        // Spring bounce anim
        if (p.springBounce > 0) {
            p.springBounce -= 0.08;
            if (p.springBounce < 0) p.springBounce = 0;
        }
    }

    // Remove fallen platforms, spawn new
    platforms = platforms.filter(p => p.y < H + 40 && !(p.crumbling && p.crumbleTimer <= 0));
    while (platforms.length < 20) {
        const topY = Math.min(...platforms.map(p => p.y));
        const newY = topY - (55 + Math.random() * 30);
        const type = pickStartType(10);
        platforms.push(makePlatform(Math.random() * (W - 80), newY, type));

        // Occasionally spawn enemies at higher scores
        if (score > 300 && Math.random() < 0.15) {
            enemies.push(makeEnemy(newY - 30));
        }
    }

    // ── Enemies ──
    for (const e of enemies) {
        e.x += e.dx;
        if (e.x <= 0 || e.x + e.w >= W) e.dx *= -1;

        // Frog stomp
        if (e.alive &&
            frog.vy > 0 &&
            frog.x + FROG_W - 6 > e.x &&
            frog.x + 6 < e.x + e.w &&
            frog.y + FROG_H > e.y + 4 &&
            frog.y < e.y + e.h
        ) {
            e.alive = false;
            frog.vy = JUMP_VEL;
            spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#ff7043', 10);
        }
        // Frog hit by enemy (side collision)
        else if (e.alive &&
            frog.x + FROG_W - 4 > e.x &&
            frog.x + 4 < e.x + e.w &&
            frog.y + FROG_H - 4 > e.y &&
            frog.y + 4 < e.y + e.h
        ) {
            endGame();
        }
    }
    enemies = enemies.filter(e => e.alive && e.y < H + 60);

    // ── Particles ──
    for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.15;
        p.life -= p.decay;
    }
    particles = particles.filter(p => p.life > 0);

    // ── Fall death ──
    if (frog.y > H + 80) {
        endGame();
    }

    // ── HUD ──
    hudScore.textContent = score;
    hudBest.textContent  = `Best: ${bestScore}`;
}

function endGame() {
    gameRunning = false;
    frog.dead = true;
    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('froggleBest', bestScore);
    }
    goScore.textContent = score;
    goBest.textContent  = bestScore;
    bestScoreDisplay.textContent = `Best: ${bestScore}`;
    setTimeout(() => showScreen(gameOverScreen), 600);
}

// ─── DRAW ─────────────────────────────────────────────────────────────────────
function draw() {
    ctx.clearRect(0, 0, W, H);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#b2ecff');
    skyGrad.addColorStop(1, '#d4f7a0');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Clouds (parallax based on cameraY)
    drawClouds();

    // Platforms
    for (const p of platforms) {
        drawPlatform(p);
    }

    // Enemies
    for (const e of enemies) {
        if (e.alive) drawEnemy(e);
    }

    // Particles
    for (const p of particles) {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Frog
    if (!frog.dead) drawFrog();
}

function drawClouds() {
    const cloudPositions = [
        { bx: 40,  by: 80  },
        { bx: 220, by: 140 },
        { bx: 100, by: 280 },
        { bx: 260, by: 360 },
        { bx: 30,  by: 460 },
        { bx: 210, by: 520 },
    ];
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (const c of cloudPositions) {
        const cy = ((c.by + cameraY * 0.2) % (H + 60));
        drawCloud(c.bx, cy);
    }
}

function drawCloud(x, y) {
    ctx.beginPath();
    ctx.arc(x + 30, y, 18, 0, Math.PI * 2);
    ctx.arc(x + 52, y - 8, 22, 0, Math.PI * 2);
    ctx.arc(x + 76, y, 18, 0, Math.PI * 2);
    ctx.arc(x + 52, y + 8, 14, 0, Math.PI * 2);
    ctx.fill();
}

function drawPlatform(p) {
    const alpha = p.crumbling ? Math.max(0, p.crumbleTimer / 28) : 1;
    ctx.globalAlpha = alpha;

    if (p.type === PT.NORMAL || p.type === PT.SPRING) {
        // Main body
        const grad = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
        grad.addColorStop(0, '#6dcc5a');
        grad.addColorStop(1, '#4aa838');
        ctx.fillStyle = grad;
        roundRect(ctx, p.x, p.y, p.w, p.h, 7);
        ctx.fill();
        // Shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        roundRect(ctx, p.x + 4, p.y + 2, p.w - 8, 4, 3);
        ctx.fill();
        // Spots (lily pad dots)
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.arc(p.x + 14 + i * 22, p.y + p.h / 2, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (p.type === PT.LILY) {
        // Lily pad — rounded ellipse in green
        ctx.fillStyle = '#56b945';
        ctx.beginPath();
        ctx.ellipse(p.x + p.w / 2, p.y + p.h / 2, p.w / 2, p.h / 2 + 2, 0, 0, Math.PI * 2);
        ctx.fill();
        // Vein lines
        ctx.strokeStyle = '#3d8c2e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
        ctx.lineTo(p.x + p.w / 2, p.y + 2);
        ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
        ctx.lineTo(p.x + 12, p.y + 4);
        ctx.moveTo(p.x + p.w / 2, p.y + p.h / 2);
        ctx.lineTo(p.x + p.w - 12, p.y + 4);
        ctx.stroke();
    } else if (p.type === PT.CRUMBLE) {
        ctx.fillStyle = '#a0724a';
        roundRect(ctx, p.x, p.y, p.w, p.h, 5);
        ctx.fill();
        // Cracks
        ctx.strokeStyle = '#6b4a2e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(p.x + 20, p.y + 2);
        ctx.lineTo(p.x + 26, p.y + p.h - 2);
        ctx.moveTo(p.x + 45, p.y + 1);
        ctx.lineTo(p.x + 40, p.y + p.h - 1);
        ctx.stroke();
    } else if (p.type === PT.MOVING) {
        // Cloud platform
        ctx.fillStyle = '#90ee90';
        roundRect(ctx, p.x, p.y, p.w, p.h, 7);
        ctx.fill();
        // Arrow indicators
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px sans-serif';
        ctx.fillText('◀ ▶', p.x + p.w / 2 - 12, p.y + p.h - 2);
    }

    // Spring
    if (p.hasSpring) {
        const sx = p.x + p.w / 2;
        const springH = 14 + p.springBounce * -10;
        const sy = p.y - springH;
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        // Coil
        ctx.beginPath();
        for (let i = 0; i <= 8; i++) {
            const t = i / 8;
            const cx2 = sx + Math.cos(t * Math.PI * 4) * 5;
            const cy2 = p.y - t * springH;
            if (i === 0) ctx.moveTo(cx2, cy2);
            else ctx.lineTo(cx2, cy2);
        }
        ctx.stroke();
        // Top cap
        ctx.fillStyle = '#ff9800';
        roundRect(ctx, sx - 9, sy - 5, 18, 7, 4);
        ctx.fill();
    }

    ctx.globalAlpha = 1;
}

function drawEnemy(e) {
    if (e.type === 'fly') {
        // Fly: buzzy black bug with wings
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2 + 4, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        // Wings
        ctx.fillStyle = 'rgba(180,230,255,0.75)';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2 - 8, e.y + e.h / 2, 10, 6, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2 + 8, e.y + e.h / 2, 10, 6, 0.4, 0, Math.PI * 2);
        ctx.fill();
        // Eyes
        ctx.fillStyle = 'red';
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2 - 3, e.y + e.h / 2 + 1, 3, 0, Math.PI * 2);
        ctx.arc(e.x + e.w / 2 + 3, e.y + e.h / 2 + 1, 3, 0, Math.PI * 2);
        ctx.fill();
    } else {
        // Bug: ladybug
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.ellipse(e.x + e.w / 2, e.y + e.h / 2, 12, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2, e.y + e.h / 2 - 3, 5, 0, Math.PI * 2);
        ctx.fill();
        // Spots
        ctx.fillStyle = '#212121';
        ctx.beginPath();
        ctx.arc(e.x + e.w / 2 - 5, e.y + e.h / 2 + 3, 2.5, 0, Math.PI * 2);
        ctx.arc(e.x + e.w / 2 + 5, e.y + e.h / 2 + 3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        // Line down middle
        ctx.strokeStyle = '#212121';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(e.x + e.w / 2, e.y + e.h / 2 + 2);
        ctx.lineTo(e.x + e.w / 2, e.y + e.h / 2 + 10);
        ctx.stroke();
    }
}

function drawFrog() {
    ctx.save();

    const cx = frog.x + FROG_W / 2;
    const cy = frog.y + FROG_H / 2;

    // Squish transform
    ctx.translate(cx, cy);
    ctx.scale(frog.facingRight ? 1 : -1, 1);
    ctx.scale(1 / frog.squishY, frog.squishY);
    ctx.translate(-cx, -cy);

    const x = frog.x, y = frog.y;

    // Shadow
    ctx.fillStyle = 'rgba(0,80,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(cx, y + FROG_H + 4, 16, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hind legs (behind body)
    ctx.fillStyle = '#3aad3a';
    // Left hind
    ctx.beginPath();
    ctx.ellipse(x + 4, y + FROG_H - 2, 9, 7, -0.6, 0, Math.PI * 2);
    ctx.fill();
    // Right hind
    ctx.beginPath();
    ctx.ellipse(x + FROG_W - 4, y + FROG_H - 2, 9, 7, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Body
    const bodyGrad = ctx.createRadialGradient(cx - 3, y + 8, 2, cx, cy, FROG_W / 2);
    bodyGrad.addColorStop(0, '#6de86d');
    bodyGrad.addColorStop(1, '#2ea02e');
    ctx.fillStyle = bodyGrad;
    ctx.beginPath();
    ctx.ellipse(cx, y + FROG_H / 2 + 2, FROG_W / 2, FROG_H / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Belly
    ctx.fillStyle = '#b8f0a0';
    ctx.beginPath();
    ctx.ellipse(cx, y + FROG_H / 2 + 5, FROG_W / 2 - 7, FROG_H / 2 - 6, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Front feet
    ctx.fillStyle = '#3aad3a';
    ctx.beginPath();
    ctx.ellipse(x + 6, y + FROG_H / 2 + 6, 7, 5, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + FROG_W - 6, y + FROG_H / 2 + 6, 7, 5, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Eyes (bulging on top of head)
    const eyeY = y + 5;
    // Eye whites
    ctx.fillStyle = '#e8ffe8';
    ctx.beginPath();
    ctx.arc(cx - 9, eyeY, 8, 0, Math.PI * 2);
    ctx.arc(cx + 9, eyeY, 8, 0, Math.PI * 2);
    ctx.fill();
    // Iris
    ctx.fillStyle = '#1a6b1a';
    ctx.beginPath();
    ctx.arc(cx - 8, eyeY + 1, 5, 0, Math.PI * 2);
    ctx.arc(cx + 10, eyeY + 1, 5, 0, Math.PI * 2);
    ctx.fill();
    // Pupil
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(cx - 7, eyeY + 2, 3, 0, Math.PI * 2);
    ctx.arc(cx + 11, eyeY + 2, 3, 0, Math.PI * 2);
    ctx.fill();
    // Highlight
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(cx - 6, eyeY, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 12, eyeY, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Smile
    ctx.strokeStyle = '#1a5e20';
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx + 2, y + 18, 6, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // Nostril dots
    ctx.fillStyle = '#1a5e20';
    ctx.beginPath();
    ctx.arc(cx - 1, y + 15, 1.5, 0, Math.PI * 2);
    ctx.arc(cx + 5, y + 15, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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

function showScreen(screen) {
    [startScreen, gameScreen, gameOverScreen].forEach(s => s.classList.add('hidden'));
    screen.classList.remove('hidden');
}