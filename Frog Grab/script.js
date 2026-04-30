/* ============================================================
   FROG GRAB — Polished Edition
   Sections:
     1. Constants & Config
     2. Storage
     3. Canvas & Rendering Setup
     4. Audio Engine
     5. Background Renderer
     6. Entity Classes (Fly, Powerup, Particle Pool)
     7. Effects System (Floating Text, Screen Shake, Freeze)
     8. GameState
     9. Game Logic (Update / Draw)
    10. UI Manager
    11. Input Handler
    12. Bootstrap & Game Loop
============================================================ */

/* ============================================================
   1. CONSTANTS & CONFIG
============================================================ */
const CFG = {
  TONGUE_BASE_SPEED: 24,
  FLY_SPAWN_RATE_INIT: 90,  // frames between spawns
  FLY_SPAWN_RATE_MIN: 28,
  FLY_BASE_SPEED: 1.8,
  COMBO_DECAY_DURATION: 180, // frames of combo timer at max combo
  COMBO_DECAY_MIN: 80,       // minimum combo timer
  LEVEL_EVERY_FRAMES: 1200,  // how often level increases
  POWERUP_CHANCE: 0.015,     // per frame chance while >=3 flies are alive
  GOLDEN_FLY_CHANCE: 0.12,   // chance for a golden fly spawn
  RARE_FLY_CHANCE: 0.22,
  PARTICLE_POOL_SIZE: 200,
  FREEZE_FRAMES: 5,
  SCREEN_SHAKE_INTENSITY: 8,
  SCREEN_SHAKE_DECAY: 0.75,
};

/* ============================================================
   2. STORAGE
============================================================ */
const Store = {
  get: k => JSON.parse(localStorage.getItem('frogGrab_' + k) || 'null'),
  set: (k, v) => localStorage.setItem('frogGrab_' + k, JSON.stringify(v)),
  highScore:    () => Store.get('hs') || 0,
  totalCaught:  () => Store.get('tc') || 0,
  longestCombo: () => Store.get('lc') || 1,
  achievements: () => Store.get('ach') || {},
  saveHighScore:   v => Store.set('hs', v),
  saveTotalCaught: v => Store.set('tc', v),
  saveLongestCombo:v => Store.set('lc', v),
  saveAchievements:v => Store.set('ach', v),
};

/* ============================================================
   3. CANVAS & RENDERING SETUP
============================================================ */
const bgCanvas   = document.getElementById('bgCanvas');
const gameCanvas = document.getElementById('gameCanvas');
const fxCanvas   = document.getElementById('fxCanvas');
const bgCtx   = bgCanvas.getContext('2d');
const ctx     = gameCanvas.getContext('2d');
const fxCtx   = fxCanvas.getContext('2d');

let W = 0, H = 0;

function resizeCanvases() {
  W = window.innerWidth;
  H = window.innerHeight;
  [bgCanvas, gameCanvas, fxCanvas].forEach(c => { c.width = W; c.height = H; });
  if (GS.frog) { GS.frog.x = W / 2; GS.frog.y = H - 50; }
  BG.init();
}
window.addEventListener('resize', resizeCanvases);

/* ============================================================
   4. AUDIO ENGINE  (Web Audio API — no external files)
============================================================ */
const Audio = (() => {
  let ctx, enabled = true;
  const init = () => {
    if (ctx) return;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
  };

  const beep = (type, freq, dur, vol=0.3, decay='exponential') => {
    if (!enabled || !ctx) return;
    try {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain[decay + 'RampToValueAtTime'](0.001, ctx.currentTime + dur);
      o.start(); o.stop(ctx.currentTime + dur);
    } catch(e){}
  };

  const noise = (dur, vol=0.15) => {
    if (!enabled || !ctx) return;
    try {
      const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1;
      const src = ctx.createBufferSource();
      const g = ctx.createGain();
      src.buffer = buf; src.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(vol, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime+dur);
      src.start(); src.stop(ctx.currentTime+dur);
    } catch(e){}
  };

  return {
    init,
    toggle() { enabled = !enabled; return enabled; },
    isEnabled() { return enabled; },
    shoot()   { beep('sine',  300, 0.12, 0.2); beep('sine', 200, 0.15, 0.15); },
    catch()   { beep('square',520, 0.06, 0.3); beep('square',680,0.1,0.25); },
    goldCatch(){ beep('sine', 880, 0.1, 0.4);  beep('sine',1100,0.15,0.35); beep('sine',1400,0.2,0.3); },
    miss()    { noise(0.12, 0.12); beep('sine', 150, 0.18, 0.2); },
    combo()   { beep('square', 400 + GS.combo * 40, 0.08, 0.25); },
    powerup() { for(let i=0;i<4;i++) setTimeout(()=>beep('sine',440+i*110,0.1,0.3), i*60); },
    levelUp() { [500,600,700,900].forEach((f,i)=>setTimeout(()=>beep('square',f,0.12,0.3),i*80)); },
    countdown(){ beep('sine', 440, 0.15, 0.4); },
    go()      { beep('sawtooth', 200, 0.4, 0.3); beep('sawtooth', 150, 0.5, 0.2); },
  };
})();

/* ============================================================
   5. BACKGROUND RENDERER  (animated swamp)
============================================================ */
const BG = (() => {
  let bubbles = [], ripples = [], bgFrame = 0;
  const LILY_PADS = [];

  const init = () => {
    bubbles = [];
    for (let i = 0; i < 18; i++) {
      bubbles.push({ x: Math.random()*W, y: H + Math.random()*200,
        r: 3+Math.random()*8, speed: 0.3+Math.random()*0.7,
        wobble: Math.random()*Math.PI*2, alpha: 0.3+Math.random()*0.4 });
    }
    LILY_PADS.length = 0;
    const count = Math.floor(W / 120);
    for (let i = 0; i < count; i++) {
      LILY_PADS.push({ x: (i+0.5)*(W/count) + (Math.random()-0.5)*80, y: H * (0.6+Math.random()*0.3),
        r: 28+Math.random()*22, angle: Math.random()*Math.PI*2,
        hue: 110+Math.random()*40 });
    }
  };

  const addRipple = (x, y) => {
    ripples.push({ x, y, r: 0, maxR: 40+Math.random()*20, alpha: 0.6, speed: 1.5 });
  };

  const draw = () => {
    bgFrame++;
    // Sky gradient
    const sky = bgCtx.createLinearGradient(0,0,0,H);
    sky.addColorStop(0, '#0a1a0b');
    sky.addColorStop(0.5, '#122616');
    sky.addColorStop(1, '#0d2b0e');
    bgCtx.fillStyle = sky;
    bgCtx.fillRect(0,0,W,H);

    // Stars
    bgCtx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i=0; i<40; i++) {
      const sx = (i*137.5) % W;
      const sy = ((i*89.3) % (H*0.45));
      const flicker = 0.4 + 0.3*Math.sin(bgFrame*0.05 + i);
      bgCtx.globalAlpha = flicker;
      bgCtx.beginPath();
      bgCtx.arc(sx, sy, 1+Math.random()*0.5, 0,Math.PI*2);
      bgCtx.fill();
    }
    bgCtx.globalAlpha = 1;

    // Moon
    bgCtx.save();
    bgCtx.shadowBlur = 30; bgCtx.shadowColor = 'rgba(255,255,200,0.4)';
    bgCtx.fillStyle = '#fffde0';
    bgCtx.beginPath(); bgCtx.arc(W*0.82, H*0.12, 28, 0, Math.PI*2); bgCtx.fill();
    bgCtx.fillStyle = '#c8c8a0';
    bgCtx.beginPath(); bgCtx.arc(W*0.82-8, H*0.12-6, 20, 0, Math.PI*2); bgCtx.fill();
    bgCtx.fillStyle = '#fffde0';
    bgCtx.beginPath(); bgCtx.arc(W*0.82-6, H*0.12-4, 17, 0, Math.PI*2); bgCtx.fill();
    bgCtx.restore();

    // Swamp water surface
    const water = bgCtx.createLinearGradient(0, H*0.55, 0, H);
    water.addColorStop(0, '#1a3a1c');
    water.addColorStop(0.3, '#163018');
    water.addColorStop(1, '#0d2010');
    bgCtx.fillStyle = water;
    bgCtx.beginPath();
    bgCtx.moveTo(0, H*0.55);
    for (let x=0; x<=W; x+=20) {
      bgCtx.lineTo(x, H*0.55 + Math.sin(x*0.03+bgFrame*0.012)*5);
    }
    bgCtx.lineTo(W, H); bgCtx.lineTo(0, H); bgCtx.closePath();
    bgCtx.fill();

    // Water shimmer lines
    for (let i=0; i<5; i++) {
      const yy = H*0.6 + i*30;
      const alpha = 0.06+0.04*Math.sin(bgFrame*0.02+i);
      bgCtx.strokeStyle = `rgba(127,255,127,${alpha})`;
      bgCtx.lineWidth = 1;
      bgCtx.beginPath();
      for (let x=0; x<=W; x+=15) {
        const y2 = yy + Math.sin(x*0.02+bgFrame*0.015+i)*4;
        x===0 ? bgCtx.moveTo(x,y2) : bgCtx.lineTo(x,y2);
      }
      bgCtx.stroke();
    }

    // Lily pads
    LILY_PADS.forEach(lp => {
      bgCtx.save();
      bgCtx.translate(lp.x, lp.y + Math.sin(bgFrame*0.008+lp.angle)*3);
      bgCtx.rotate(lp.angle + Math.sin(bgFrame*0.005)*0.06);
      bgCtx.fillStyle = `hsl(${lp.hue},55%,28%)`;
      bgCtx.beginPath();
      bgCtx.arc(0,0,lp.r,0.3,Math.PI*2-0.3); bgCtx.lineTo(0,0); bgCtx.closePath(); bgCtx.fill();
      bgCtx.fillStyle = `hsl(${lp.hue},55%,35%)`;
      bgCtx.beginPath();
      bgCtx.arc(0,0,lp.r*0.5,0.3,Math.PI*2-0.3); bgCtx.lineTo(0,0); bgCtx.closePath(); bgCtx.fill();
      bgCtx.restore();
    });

    // Bubbles
    bubbles.forEach(b => {
      b.y -= b.speed;
      b.x += Math.sin(bgFrame*0.02+b.wobble)*0.5;
      if (b.y < H*0.5) { b.y = H + 10; b.x = Math.random()*W; }
      bgCtx.globalAlpha = b.alpha * (1-(b.y < H*0.6 ? (H*0.6-b.y)/(H*0.1) : 0));
      bgCtx.strokeStyle = 'rgba(150,230,180,0.9)';
      bgCtx.lineWidth = 1.5;
      bgCtx.beginPath(); bgCtx.arc(b.x, b.y, b.r, 0, Math.PI*2); bgCtx.stroke();
      bgCtx.fillStyle = 'rgba(200,255,220,0.15)';
      bgCtx.fill();
    });
    bgCtx.globalAlpha = 1;

    // Ripples
    for (let i=ripples.length-1; i>=0; i--) {
      const rp = ripples[i];
      rp.r += rp.speed; rp.alpha -= 0.015;
      if (rp.alpha <= 0) { ripples.splice(i,1); continue; }
      bgCtx.globalAlpha = rp.alpha;
      bgCtx.strokeStyle = 'rgba(150,220,180,0.8)';
      bgCtx.lineWidth = 1.5;
      bgCtx.beginPath(); bgCtx.ellipse(rp.x, rp.y, rp.r, rp.r*0.4, 0, 0, Math.PI*2);
      bgCtx.stroke();
    }
    bgCtx.globalAlpha = 1;

    // Foreground reeds
    for (let i=0; i<6; i++) {
      const rx = (i*0.17+0.03)*W;
      const baseY = H*(0.7+Math.sin(i)*0.1);
      const sway = Math.sin(bgFrame*0.015+i)*4;
      bgCtx.strokeStyle = `rgba(80,130,60,${0.4+0.2*Math.sin(i)})`;
      bgCtx.lineWidth = 3;
      bgCtx.beginPath();
      bgCtx.moveTo(rx, H);
      bgCtx.quadraticCurveTo(rx+sway*0.5, baseY+50, rx+sway, baseY);
      bgCtx.stroke();
      bgCtx.fillStyle = 'rgba(80,130,60,0.5)';
      bgCtx.beginPath(); bgCtx.ellipse(rx+sway, baseY, 4, 14, 0.3, 0, Math.PI*2); bgCtx.fill();
    }
  };

  return { init, draw, addRipple };
})();

/* ============================================================
   6. ENTITY CLASSES
============================================================ */

// -- Fly types --
const FLY_TYPES = [
  { name:'normal',  color:'#2c2c2c', wingColor:'rgba(200,220,255,0.75)', r:12, speed:1,   score:10,  chance:0.55 },
  { name:'fast',    color:'#c0392b', wingColor:'rgba(255,180,180,0.75)', r:10, speed:1.8, score:15,  chance:0.20 },
  { name:'big',     color:'#5d4037', wingColor:'rgba(220,200,180,0.75)', r:17, speed:0.6, score:20,  chance:0.10 },
  { name:'rare',    color:'#6c3483', wingColor:'rgba(200,150,255,0.75)', r:11, speed:1.4, score:25,  chance:0.07 },
  { name:'golden',  color:'#f1c40f', wingColor:'rgba(255,235,150,0.9)',  r:13, speed:1.2, score:50,  chance:0.05, glow:true },
  { name:'tiny',    color:'#1a5276', wingColor:'rgba(150,210,255,0.7)',  r:7,  speed:2.2, score:30,  chance:0.03 },
];

function pickFlyType() {
  const r = Math.random();
  let acc = 0;
  for (const t of FLY_TYPES) {
    acc += t.chance;
    if (r < acc) return t;
  }
  return FLY_TYPES[0];
}

class Fly {
  constructor(speedMult = 1) {
    this.type = pickFlyType();
    this.radius = this.type.r;
    this.y = Math.random() * (H * 0.72) + 40;
    this.direction = Math.random() > 0.5 ? 1 : -1;
    this.x = this.direction === 1 ? -this.radius - 10 : W + this.radius + 10;
    this.speedX = (CFG.FLY_BASE_SPEED * this.type.speed * (0.8 + Math.random() * 0.6) + speedMult) * this.direction;
    this.wobble = Math.random() * Math.PI * 2;
    this.wobbleSpeed = 0.06 + Math.random() * 0.06;
    this.wobbleAmp = 1.5 + Math.random() * 3;
    this.wingAngle = 0;
    this.wingDir = 1;
    this.glowPhase = Math.random() * Math.PI * 2;
    this.buzzOffset = { x: 0, y: 0 };
  }

  update() {
    // Slow motion check
    const mult = GS.powerupActive === 'slow' ? 0.3 : 1;
    this.x += this.speedX * mult;
    this.wobble += this.wobbleSpeed * mult;
    this.y += Math.sin(this.wobble) * this.wobbleAmp * mult;
    this.wingAngle += 0.4 * mult;
    this.glowPhase += 0.08;
    // buzz vibration
    this.buzzOffset.x = (Math.random()-0.5)*0.8;
    this.buzzOffset.y = (Math.random()-0.5)*0.8;
  }

  isOffScreen() {
    return (this.direction === 1 && this.x > W + 80) ||
           (this.direction === -1 && this.x < -80);
  }

  draw(c) {
    c.save();
    c.translate(this.x + this.buzzOffset.x, this.y + this.buzzOffset.y);

    if (this.type.glow) {
      c.shadowBlur = 14 + Math.sin(this.glowPhase)*6;
      c.shadowColor = '#ffd700';
    }

    // Wings
    c.fillStyle = this.type.wingColor;
    const wingFlap = Math.sin(this.wingAngle) * 0.4;
    c.save(); c.rotate(-Math.PI/5 + wingFlap); c.beginPath();
    c.ellipse(-4, -6, 9, 5, Math.PI/5, 0, Math.PI*2); c.fill(); c.restore();
    c.save(); c.rotate(Math.PI/5 - wingFlap); c.beginPath();
    c.ellipse(4, -6, 9, 5, -Math.PI/5, 0, Math.PI*2); c.fill(); c.restore();

    // Body
    c.fillStyle = this.type.color;
    c.beginPath(); c.ellipse(0, 1, this.radius*0.65, this.radius, 0, 0, Math.PI*2); c.fill();

    // Stripes for some types
    if (this.type.name === 'fast') {
      c.fillStyle = 'rgba(255,80,80,0.4)';
      c.beginPath(); c.ellipse(0,0,this.radius*0.3, this.radius*0.5, 0, 0, Math.PI*2); c.fill();
    }
    if (this.type.name === 'golden') {
      c.fillStyle = 'rgba(255,255,150,0.5)';
      c.beginPath(); c.ellipse(0,-2, this.radius*0.4, this.radius*0.4, 0, 0, Math.PI*2); c.fill();
    }

    // Eyes
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(-3, -this.radius*0.5, 2.5, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(3,  -this.radius*0.5, 2.5, 0, Math.PI*2); c.fill();
    c.fillStyle = '#c00';
    c.beginPath(); c.arc(-3, -this.radius*0.5, 1.2, 0, Math.PI*2); c.fill();
    c.beginPath(); c.arc(3,  -this.radius*0.5, 1.2, 0, Math.PI*2); c.fill();

    c.restore();
  }
}

// -- Powerup item --
const POWERUP_TYPES = [
  { id:'slow',   label:'SLOW MO',    color:'#5dade2', icon:'🌀' },
  { id:'multi',  label:'MULTI-TONGUE',color:'#f39c12', icon:'👅' },
  { id:'magnet', label:'MAGNET',      color:'#e74c3c', icon:'🧲' },
];

class PowerupItem {
  constructor() {
    this.type = POWERUP_TYPES[Math.floor(Math.random()*POWERUP_TYPES.length)];
    this.x = 60 + Math.random()*(W-120);
    this.y = 60 + Math.random()*(H*0.65);
    this.radius = 22;
    this.angle = 0;
    this.life = 220; // frames
    this.alpha = 0;
  }
  update() {
    this.angle += 0.04;
    this.life--;
    if (this.life > 200) this.alpha = (220-this.life)/20;
    else if (this.life < 40) this.alpha = this.life/40;
    else this.alpha = 1;
  }
  draw(c) {
    c.save();
    c.globalAlpha = this.alpha;
    c.translate(this.x, this.y);
    c.rotate(this.angle);
    // Glow
    c.shadowBlur = 20; c.shadowColor = this.type.color;
    // Circle
    c.fillStyle = this.type.color;
    c.beginPath(); c.arc(0,0,this.radius,0,Math.PI*2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.2)';
    c.beginPath(); c.arc(0,0,this.radius,0,Math.PI*2); c.fill();
    // Icon
    c.shadowBlur = 0; c.globalAlpha = this.alpha;
    c.font = '18px serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(this.type.icon, 0, 1);
    c.restore();
  }
}

/* ============================================================
   7. EFFECTS SYSTEM
============================================================ */
// -- Particle Pool --
const FX = (() => {
  // Pooled particles
  const pool = [];
  for (let i=0; i<CFG.PARTICLE_POOL_SIZE; i++) {
    pool.push({ active:false, x:0,y:0,vx:0,vy:0,r:0,color:'#fff',life:0,decay:0,gravity:0 });
  }

  const floaters = []; // floating score text
  let shakeX = 0, shakeY = 0, shakePow = 0;
  let freezeFrames = 0;
  let zoomScale = 1, zoomTarget = 1;

  const getParticle = () => {
    for (const p of pool) if (!p.active) return p;
    return pool[0]; // recycle oldest
  };

  const burst = (x, y, color, count=10, speed=6, r=4) => {
    for (let i=0; i<count; i++) {
      const p = getParticle();
      const angle = (Math.PI*2/count)*i + Math.random()*0.5;
      p.active=true; p.x=x; p.y=y;
      p.vx=Math.cos(angle)*(speed*0.5+Math.random()*speed);
      p.vy=Math.sin(angle)*(speed*0.5+Math.random()*speed);
      p.r=r*0.5+Math.random()*r; p.color=color;
      p.life=1; p.decay=0.025+Math.random()*0.025; p.gravity=0.18;
    }
  };

  const sparkle = (x, y) => {
    const colors = ['#ffd700','#fff','#7fff4f','#ff6b6b'];
    for (let i=0; i<16; i++) {
      const p = getParticle();
      const angle = Math.random()*Math.PI*2;
      const speed = 3+Math.random()*8;
      p.active=true; p.x=x; p.y=y;
      p.vx=Math.cos(angle)*speed; p.vy=Math.sin(angle)*speed;
      p.r=2+Math.random()*4; p.color=colors[i%colors.length];
      p.life=1; p.decay=0.02+Math.random()*0.025; p.gravity=0.12;
    }
  };

  const addFloater = (x, y, text, color='#fff', size=22) => {
    floaters.push({ x, y, text, color, size, life:1, vy:-2, alpha:1 });
  };

  const shake = (intensity=CFG.SCREEN_SHAKE_INTENSITY) => {
    shakePow = Math.max(shakePow, intensity);
  };

  const freeze = () => { freezeFrames = CFG.FREEZE_FRAMES; };

  const setZoom = target => { zoomTarget = target; };

  const isFrozen = () => freezeFrames > 0;

  const update = () => {
    if (freezeFrames > 0) { freezeFrames--; return true; }

    // Particles
    pool.forEach(p => {
      if (!p.active) return;
      p.x += p.vx; p.y += p.vy; p.vy += p.gravity;
      p.vx *= 0.96; p.vy *= 0.96;
      p.life -= p.decay;
      if (p.life <= 0) p.active = false;
    });

    // Floaters
    for (let i=floaters.length-1; i>=0; i--) {
      const f = floaters[i];
      f.y += f.vy; f.life -= 0.018;
      if (f.life <= 0) { floaters.splice(i,1); continue; }
    }

    // Shake decay
    if (shakePow > 0.3) {
      shakeX = (Math.random()-0.5)*2*shakePow;
      shakeY = (Math.random()-0.5)*2*shakePow;
      shakePow *= CFG.SCREEN_SHAKE_DECAY;
    } else { shakeX=0; shakeY=0; shakePow=0; }

    // Zoom lerp
    zoomScale += (zoomTarget - zoomScale) * 0.1;

    return false;
  };

  const draw = c => {
    // Particles
    pool.forEach(p => {
      if (!p.active) return;
      c.globalAlpha = Math.max(0, p.life);
      c.fillStyle = p.color;
      c.beginPath(); c.arc(p.x, p.y, Math.max(0.1,p.r), 0, Math.PI*2); c.fill();
    });

    // Floaters
    floaters.forEach(f => {
      c.globalAlpha = Math.max(0, f.life);
      c.font = `${f.size}px "Segoe UI", sans-serif`;
      c.fontWeight = '900';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = f.color;
      c.shadowBlur = 6; c.shadowColor = 'rgba(0,0,0,0.5)';
      c.fillText(f.text, f.x, f.y);
      c.shadowBlur = 0;
    });
    c.globalAlpha = 1;
  };

  const getShake = () => ({ x: shakeX, y: shakeY });
  const getZoom = () => zoomScale;

  return { burst, sparkle, addFloater, shake, freeze, setZoom, isFrozen, update, draw, getShake, getZoom };
})();

/* ============================================================
   8. GAME STATE
============================================================ */
const GS = {
  // Screens: 'start','countdown','playing','paused','gameover'
  screen: 'start',

  // Per-run
  score: 0,
  combo: 1,
  comboTimer: 0,      // countdown frames
  comboTimerMax: CFG.COMBO_DECAY_DURATION,
  frames: 0,
  level: 1,
  flySpawnRate: CFG.FLY_SPAWN_RATE_INIT,
  speedMult: 0,

  // Powerup
  powerupActive: null,   // null | 'slow' | 'multi' | 'magnet'
  powerupTimer: 0,

  // Persistent (from storage)
  highScore: Store.highScore(),
  totalCaught: Store.totalCaught(),
  longestCombo: Store.longestCombo(),
  sessionCaught: 0,
  sessionBestCombo: 1,

  // Entities
  frog: null,
  tongues: [],
  flies: [],
  powerupItems: [],

  // Countdown
  countdownVal: 3,
  countdownTimer: 0,

  reset() {
    this.score = 0; this.combo = 1;
    this.comboTimer = CFG.COMBO_DECAY_DURATION;
    this.frames = 0; this.level = 1;
    this.flySpawnRate = CFG.FLY_SPAWN_RATE_INIT;
    this.speedMult = 0;
    this.powerupActive = null; this.powerupTimer = 0;
    this.flies = []; this.powerupItems = [];
    this.tongues = [{ phase:'idle', startX:0, startY:0, currentX:0, currentY:0,
                      targetX:0, targetY:0, speed:CFG.TONGUE_BASE_SPEED,
                      radius:9, hitSomething:false }];
    this.sessionCaught = 0; this.sessionBestCombo = 1;
    this.frog = { x: W/2, y: H-50, radius:40, idlePhase:0, blinkTimer:0, blinking:false };
  }
};

/* ============================================================
   9. GAME LOGIC
============================================================ */

// -- Tongue management --
function ensureTongues() {
  const needed = GS.powerupActive === 'multi' ? 3 : 1;
  while (GS.tongues.length < needed) {
    GS.tongues.push({ phase:'idle', startX:0,startY:0,currentX:0,currentY:0,
                      targetX:0,targetY:0, speed:CFG.TONGUE_BASE_SPEED,
                      radius:9, hitSomething:false });
  }
  if (GS.tongues.length > needed) {
    GS.tongues = GS.tongues.filter((t,i) => i===0 || t.phase!=='idle');
    if (GS.tongues.length > needed) GS.tongues.length = needed;
  }
}

function shootTongue(px, py) {
  const f = GS.frog;
  const mouthX = f.x, mouthY = f.y - 14;

  if (GS.powerupActive === 'multi') {
    ensureTongues();
    // Find an idle tongue
    const idle = GS.tongues.find(t => t.phase === 'idle');
    if (!idle) return;
    idle.phase = 'extending';
    idle.startX = mouthX; idle.startY = mouthY;
    idle.currentX = mouthX; idle.currentY = mouthY;
    idle.targetX = px; idle.targetY = py;
    idle.hitSomething = false;
    // Also fire two spread shots
    const spread = 22;
    GS.tongues.forEach((t,i) => {
      if (t === idle) return;
      if (t.phase === 'idle') {
        t.phase = 'extending';
        t.startX = mouthX; t.startY = mouthY;
        t.currentX = mouthX; t.currentY = mouthY;
        const offX = px + (i===0?-spread:spread);
        t.targetX = offX; t.targetY = py + (Math.random()-0.5)*spread;
        t.hitSomething = false;
      }
    });
  } else {
    const t = GS.tongues[0];
    if (t.phase !== 'idle') return;
    t.phase = 'extending';
    t.startX = mouthX; t.startY = mouthY;
    t.currentX = mouthX; t.currentY = mouthY;
    t.targetX = px; t.targetY = py;
    t.hitSomething = false;
  }
}

function catchFly(fly, tongue, isMagnet=false) {
  const pts = fly.type.score * GS.combo;
  GS.score += pts;
  if (GS.score > GS.highScore) {
    GS.highScore = GS.score;
    Store.saveHighScore(GS.highScore);
  }
  GS.combo++;
  GS.comboTimer = Math.max(CFG.COMBO_DECAY_MIN, GS.comboTimerMax - GS.combo*4);
  GS.sessionCaught++;
  GS.totalCaught++;
  if (GS.combo > GS.sessionBestCombo) GS.sessionBestCombo = GS.combo;
  if (GS.combo > GS.longestCombo) {
    GS.longestCombo = GS.combo;
    Store.saveLongestCombo(GS.longestCombo);
  }
  Store.saveTotalCaught(GS.totalCaught);

  // Effects
  if (fly.type.name === 'golden') {
    FX.sparkle(fly.x, fly.y);
    Audio.goldCatch();
    FX.addFloater(fly.x, fly.y-20, `⭐ +${pts}`, '#ffd700', 28);
  } else {
    FX.burst(fly.x, fly.y, fly.type.color, 10, 6, 4);
    FX.burst(fly.x, fly.y, '#7fff4f', 5, 8, 3);
    if (!isMagnet) Audio.catch();
    const comboTxt = GS.combo > 2 ? ` x${GS.combo-1}` : '';
    FX.addFloater(fly.x, fly.y-20, `+${pts}${comboTxt}`, GS.combo>3?'#ffd700':'#7fff4f', 22);
  }

  FX.freeze();
  if (GS.combo > 2) {
    Audio.combo();
    if (GS.combo % 5 === 0) {
      FX.addFloater(GS.frog.x, GS.frog.y-80, `🔥 COMBO x${GS.combo-1}!`, '#ff6b6b', 28);
      FX.shake(4);
    }
  }

  BG.addRipple(fly.x, fly.y);
  checkAchievements();
  UI.updateScore();
  UI.updateCombo();
}

function onMiss(tongue) {
  GS.score = Math.max(0, GS.score - 1);
  // Decay combo rather than reset
  GS.combo = Math.max(1, GS.combo - 1);
  GS.comboTimer = Math.max(CFG.COMBO_DECAY_MIN, GS.comboTimerMax - GS.combo*4);
  FX.burst(tongue.targetX, tongue.targetY, '#ff6b6b', 6, 5, 3);
  FX.addFloater(tongue.targetX, tongue.targetY-10, '-1', '#ff6b6b', 18);
  FX.shake(CFG.SCREEN_SHAKE_INTENSITY);
  Audio.miss();
  UI.updateScore();
  UI.updateCombo();
}

function activatePowerup(item) {
  GS.powerupActive = item.type.id;
  GS.powerupTimer = 300; // 5 seconds at 60fps
  if (GS.powerupActive === 'multi') ensureTongues();
  Audio.powerup();
  FX.burst(item.x, item.y, item.type.color, 20, 10, 5);
  FX.addFloater(item.x, item.y-30, `${item.type.icon} ${item.type.label}!`, item.type.color, 24);
  UI.updatePowerup();
}

function update() {
  if (FX.isFrozen()) return;

  const f = GS.frog;
  GS.frames++;

  // Idle frog animation
  f.idlePhase += 0.05;
  f.blinkTimer--;
  if (f.blinkTimer <= 0) { f.blinking = !f.blinking; f.blinkTimer = f.blinking ? 6 : 90+Math.random()*120; }

  // Level up
  const newLevel = 1 + Math.floor(GS.frames / CFG.LEVEL_EVERY_FRAMES);
  if (newLevel > GS.level) {
    GS.level = newLevel;
    GS.flySpawnRate = Math.max(CFG.FLY_SPAWN_RATE_MIN, CFG.FLY_SPAWN_RATE_INIT - GS.level*6);
    GS.speedMult = (GS.level - 1) * 0.35;
    Audio.levelUp();
    FX.addFloater(W/2, H/2, `LEVEL ${GS.level}! 🐸`, '#7fff4f', 36);
    FX.shake(5);
    UI.updateLevel();
  }

  // Spawn flies
  if (GS.frames % GS.flySpawnRate === 0) {
    GS.flies.push(new Fly(GS.speedMult));
    // Occasionally spawn 2
    if (GS.level >= 3 && Math.random() < 0.3) GS.flies.push(new Fly(GS.speedMult));
  }

  // Spawn powerup items
  if (GS.powerupActive === null && GS.flies.length >= 2 && Math.random() < CFG.POWERUP_CHANCE) {
    if (GS.powerupItems.length < 1) GS.powerupItems.push(new PowerupItem());
  }

  // Update flies
  for (let i=GS.flies.length-1; i>=0; i--) {
    GS.flies[i].update();
    if (GS.flies[i].isOffScreen()) GS.flies.splice(i,1);
  }

  // Update powerup items
  for (let i=GS.powerupItems.length-1; i>=0; i--) {
    GS.powerupItems[i].update();
    if (GS.powerupItems[i].life <= 0) GS.powerupItems.splice(i,1);
  }

  // Magnet powerup
  if (GS.powerupActive === 'magnet') {
    for (let i=GS.flies.length-1; i>=0; i--) {
      const fly = GS.flies[i];
      const dist = Math.hypot(fly.x - f.x, fly.y - f.y);
      if (dist < 150) {
        const angle = Math.atan2(f.y - fly.y, f.x - fly.x);
        fly.x += Math.cos(angle) * 5;
        fly.y += Math.sin(angle) * 5;
        if (dist < 30) {
          GS.flies.splice(i,1);
          catchFly(fly, null, true);
        }
      }
    }
  }

  // Update powerup timer
  if (GS.powerupActive && --GS.powerupTimer <= 0) {
    GS.powerupActive = null;
    if (GS.tongues.length > 1) {
      GS.tongues = [GS.tongues[0]];
      GS.tongues[0].phase = 'idle';
    }
    UI.updatePowerup();
  }

  // Combo decay
  if (GS.combo > 1) {
    GS.comboTimer--;
    if (GS.comboTimer <= 0) {
      GS.combo = Math.max(1, GS.combo-1);
      GS.comboTimer = Math.max(CFG.COMBO_DECAY_MIN, GS.comboTimerMax - GS.combo*4);
      UI.updateCombo();
    }
    UI.updateComboBar();
  }

  // Tongue zoom effect
  const anyActive = GS.tongues.some(t => t.phase !== 'idle');
  FX.setZoom(anyActive ? 1.015 : 1);

  // Update tongues
  ensureTongues();
  for (const tongue of GS.tongues) {
    if (tongue.phase === 'idle') continue;

    if (tongue.phase === 'extending') {
      const dx = tongue.targetX - tongue.currentX;
      const dy = tongue.targetY - tongue.currentY;
      const dist = Math.hypot(dx, dy);

      if (dist < tongue.speed) {
        tongue.currentX = tongue.targetX;
        tongue.currentY = tongue.targetY;
        tongue.phase = 'retracting';
        if (!tongue.hitSomething) onMiss(tongue);
      } else {
        tongue.currentX += (dx/dist)*tongue.speed;
        tongue.currentY += (dy/dist)*tongue.speed;
      }

      // Collision vs flies
      for (let i=GS.flies.length-1; i>=0; i--) {
        const fly = GS.flies[i];
        if (Math.hypot(tongue.currentX - fly.x, tongue.currentY - fly.y) < tongue.radius + fly.radius) {
          GS.flies.splice(i,1);
          tongue.hitSomething = true;
          tongue.phase = 'retracting';
          catchFly(fly, tongue);

          // Check powerup item collision
          for (let j=GS.powerupItems.length-1; j>=0; j--) {
            const pu = GS.powerupItems[j];
            if (Math.hypot(tongue.currentX - pu.x, tongue.currentY - pu.y) < tongue.radius + pu.radius) {
              activatePowerup(pu);
              GS.powerupItems.splice(j,1);
            }
          }
          break;
        }
      }

      // Tongue vs powerup item (no fly needed)
      if (tongue.phase === 'extending') {
        for (let j=GS.powerupItems.length-1; j>=0; j--) {
          const pu = GS.powerupItems[j];
          if (Math.hypot(tongue.currentX - pu.x, tongue.currentY - pu.y) < tongue.radius + pu.radius) {
            activatePowerup(pu);
            GS.powerupItems.splice(j,1);
            tongue.hitSomething = true;
            tongue.phase = 'retracting';
          }
        }
      }

    } else if (tongue.phase === 'retracting') {
      const dx = tongue.startX - tongue.currentX;
      const dy = tongue.startY - tongue.currentY;
      const dist = Math.hypot(dx, dy);
      if (dist < tongue.speed) tongue.phase = 'idle';
      else {
        tongue.currentX += (dx/dist)*tongue.speed;
        tongue.currentY += (dy/dist)*tongue.speed;
      }
    }
  }

  FX.update();
}

function draw() {
  // Get shake/zoom
  const sh = FX.getShake();
  const zoom = FX.getZoom();

  ctx.clearRect(0, 0, W, H);
  fxCtx.clearRect(0, 0, W, H);

  ctx.save();
  // Apply zoom from center, + shake
  ctx.translate(W/2 + sh.x, H/2 + sh.y);
  ctx.scale(zoom, zoom);
  ctx.translate(-W/2, -H/2);

  // Flies
  GS.flies.forEach(fly => fly.draw(ctx));
  // Powerup items
  GS.powerupItems.forEach(p => p.draw(ctx));

  // Tongues
  GS.tongues.forEach(tongue => {
    if (tongue.phase === 'idle') return;
    // Tongue line
    ctx.save();
    ctx.shadowBlur = 8; ctx.shadowColor = '#ff8fa3';
    ctx.strokeStyle = '#FF8FA3';
    ctx.lineWidth = 10; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tongue.startX, tongue.startY);
    ctx.lineTo(tongue.currentX, tongue.currentY);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Tongue tip
    ctx.fillStyle = '#FF4D6D';
    ctx.beginPath(); ctx.arc(tongue.currentX, tongue.currentY, tongue.radius, 0, Math.PI*2);
    ctx.fill();
    ctx.restore();
  });

  // Frog
  drawFrog(ctx);

  ctx.restore();

  // FX layer (unshaken for floaters)
  fxCtx.save();
  fxCtx.translate(W/2 + sh.x, H/2 + sh.y);
  fxCtx.scale(zoom, zoom);
  fxCtx.translate(-W/2, -H/2);
  FX.draw(fxCtx);
  fxCtx.restore();
}

function drawFrog(c) {
  const f = GS.frog;
  const breathe = Math.sin(f.idlePhase) * 2;

  c.save();
  c.translate(f.x, f.y);

  // Shadow
  c.fillStyle = 'rgba(0,0,0,0.25)';
  c.beginPath(); c.ellipse(0, 28, 36, 10, 0, 0, Math.PI*2); c.fill();

  // Back legs
  c.fillStyle = '#2d6b2e';
  c.beginPath(); c.ellipse(-32, 22+breathe*0.3, 26, 11, -Math.PI/5, 0, Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(32, 22+breathe*0.3, 26, 11, Math.PI/5, 0, Math.PI*2); c.fill();

  // Body
  const bodyGrad = c.createRadialGradient(-8,-8,5, 0,0,44);
  bodyGrad.addColorStop(0, '#6ed46e');
  bodyGrad.addColorStop(0.5, '#4CAF50');
  bodyGrad.addColorStop(1, '#2d7a2e');
  c.fillStyle = bodyGrad;
  c.beginPath();
  c.ellipse(0, breathe*0.3, f.radius+10, f.radius-4+breathe, 0, 0, Math.PI*2);
  c.fill();

  // Belly
  c.fillStyle = 'rgba(200,240,180,0.5)';
  c.beginPath(); c.ellipse(0, 8+breathe*0.3, 22, 18, 0, 0, Math.PI*2); c.fill();

  // Spots
  c.fillStyle = 'rgba(40,100,40,0.35)';
  c.beginPath(); c.ellipse(-18,-5,8,6,0.4,0,Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(16,0,7,5,-0.3,0,Math.PI*2); c.fill();

  // Determine pupil direction
  let pOffX=0, pOffY=0;
  const activeTongue = GS.tongues.find(t => t.phase !== 'idle');
  if (activeTongue) {
    const angle = Math.atan2(activeTongue.currentY - f.y, activeTongue.currentX - f.x);
    pOffX = Math.cos(angle)*6; pOffY = Math.sin(angle)*6;
  }

  // Eyes
  [-20,20].forEach(ex => {
    // Eyeball
    c.fillStyle = '#c8e6c9';
    c.beginPath(); c.arc(ex, -28+breathe*0.2, 14, 0, Math.PI*2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(ex, -28+breathe*0.2, 12, 0, Math.PI*2); c.fill();

    // Eye rim
    c.strokeStyle = '#2d7a2e'; c.lineWidth=2;
    c.beginPath(); c.arc(ex, -28+breathe*0.2, 13, 0, Math.PI*2); c.stroke();

    // Pupil / blink
    if (f.blinking) {
      c.fillStyle = '#2d7a2e';
      c.beginPath(); c.ellipse(ex, -28+breathe*0.2, 12, 3, 0, 0, Math.PI*2); c.fill();
    } else {
      // Iris
      c.fillStyle = '#8bc34a';
      c.beginPath(); c.arc(ex+pOffX*0.5, -28+breathe*0.2+pOffY*0.5, 8, 0, Math.PI*2); c.fill();
      // Pupil
      c.fillStyle = '#111';
      c.beginPath(); c.arc(ex+pOffX, -28+breathe*0.2+pOffY, 5, 0, Math.PI*2); c.fill();
      // Highlight
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(ex+pOffX+2, -31+breathe*0.2+pOffY, 2, 0, Math.PI*2); c.fill();
    }
  });

  // Nostrils
  c.fillStyle = 'rgba(40,90,40,0.5)';
  c.beginPath(); c.ellipse(-6,-12+breathe*0.2, 2.5,2,0.3,0,Math.PI*2); c.fill();
  c.beginPath(); c.ellipse(6,-12+breathe*0.2, 2.5,2,-0.3,0,Math.PI*2); c.fill();

  // Mouth
  c.strokeStyle = '#1a4a1a'; c.lineWidth = 2.5;
  c.beginPath();
  if (activeTongue) {
    c.arc(0, -8+breathe*0.2, 10, 0, Math.PI);
  } else {
    c.arc(0, -4+breathe*0.2, 12, 0.15, Math.PI-0.15);
  }
  c.stroke();

  // Throat puff
  const puffSize = 10 + Math.abs(breathe)*1.5;
  c.fillStyle = 'rgba(180,240,160,0.3)';
  c.beginPath(); c.ellipse(0, 12+breathe, puffSize, puffSize*0.65, 0, 0, Math.PI*2); c.fill();

  c.restore();
}

/* ============================================================
   10. UI MANAGER
============================================================ */
const UI = {
  updateScore() {
    document.getElementById('score-display').textContent = `Score: ${GS.score}`;
    document.getElementById('high-score-display').textContent = `Best: ${GS.highScore}`;
  },
  updateCombo() {
    const el = document.getElementById('combo-val');
    el.textContent = `x${GS.combo}`;
    if (GS.combo > 1) {
      el.style.transform = 'scale(1.3)';
      setTimeout(() => { el.style.transform = 'scale(1)'; }, 80);
    }
    const hue = Math.min(GS.combo*18, 60);
    document.getElementById('combo-bar').style.background =
      `linear-gradient(90deg, hsl(0,80%,65%), hsl(${hue},90%,60%))`;
  },
  updateComboBar() {
    const pct = GS.combo > 1 ? (GS.comboTimer / Math.max(CFG.COMBO_DECAY_MIN, GS.comboTimerMax - GS.combo*4)) * 100 : 100;
    document.getElementById('combo-bar').style.width = `${Math.max(0,pct)}%`;
  },
  updateLevel() {
    document.getElementById('level-badge').textContent = `Level ${GS.level}`;
  },
  updatePowerup() {
    const el = document.getElementById('powerup-hud');
    if (GS.powerupActive) {
      const type = POWERUP_TYPES.find(t => t.id === GS.powerupActive);
      document.getElementById('powerup-name').textContent = type.label;
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
  },
  showScreen(name) {
    ['start-screen','countdown-screen','pause-screen','gameover-screen'].forEach(id => {
      document.getElementById(id).classList.remove('visible');
    });
    GS.screen = name;
    if (name !== 'playing') {
      const id = name === 'start' ? 'start-screen' :
                 name === 'countdown' ? 'countdown-screen' :
                 name === 'paused' ? 'pause-screen' : 'gameover-screen';
      document.getElementById(id).classList.add('visible');
    }
  },
  populateStartScreen() {
    document.getElementById('ss-best').textContent = GS.highScore;
    document.getElementById('ss-caught').textContent = GS.totalCaught;
    document.getElementById('ss-combo').textContent = `x${GS.longestCombo}`;
  },
  populateGameOver() {
    document.getElementById('go-score').textContent = GS.score;
    document.getElementById('go-best').textContent = `Best: ${GS.highScore}`;
    document.getElementById('go-caught').textContent = GS.sessionCaught;
    document.getElementById('go-combo').textContent = `x${GS.sessionBestCombo}`;
    document.getElementById('go-level').textContent = GS.level;
  }
};

/* ============================================================
   ACHIEVEMENTS
============================================================ */
const ACHIEVEMENTS = [
  { id:'first',    label:'First Catch!',       check: ()=> GS.totalCaught >= 1 },
  { id:'c50',      label:'50 Flies Caught',    check: ()=> GS.totalCaught >= 50 },
  { id:'c200',     label:'200 Flies Caught',   check: ()=> GS.totalCaught >= 200 },
  { id:'combo5',   label:'Combo x5!',          check: ()=> GS.longestCombo >= 5 },
  { id:'combo10',  label:'Combo x10!',         check: ()=> GS.longestCombo >= 10 },
  { id:'combo20',  label:'Combo x20! 🔥',      check: ()=> GS.longestCombo >= 20 },
  { id:'score100', label:'Score 100',          check: ()=> GS.score >= 100 },
  { id:'score500', label:'Score 500',          check: ()=> GS.score >= 500 },
  { id:'level5',   label:'Reached Level 5',   check: ()=> GS.level >= 5 },
];
let achievementQueue = [];
let showingAchievement = false;

function checkAchievements() {
  const ach = Store.achievements();
  for (const a of ACHIEVEMENTS) {
    if (!ach[a.id] && a.check()) {
      ach[a.id] = true;
      Store.saveAchievements(ach);
      achievementQueue.push(a.label);
      if (!showingAchievement) showNextAchievement();
    }
  }
}

function showNextAchievement() {
  if (achievementQueue.length === 0) { showingAchievement = false; return; }
  showingAchievement = true;
  const toast = document.getElementById('achievement-toast');
  toast.textContent = '🏆 ' + achievementQueue.shift();
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(showNextAchievement, 400);
  }, 2400);
}

/* ============================================================
   11. INPUT HANDLER
============================================================ */
document.getElementById('btn-start').addEventListener('click', () => {
  Audio.init();
  UI.showScreen('countdown');
  startCountdown();
});

document.getElementById('btn-resume').addEventListener('click', () => {
  UI.showScreen('playing');
});

document.getElementById('btn-quit-pause').addEventListener('click', () => {
  GS.screen = 'start';
  UI.populateStartScreen();
  UI.showScreen('start');
});

document.getElementById('btn-restart').addEventListener('click', () => {
  Audio.init();
  GS.reset();
  UI.updateScore(); UI.updateCombo(); UI.updateLevel(); UI.updatePowerup();
  UI.showScreen('countdown');
  startCountdown();
});

document.getElementById('btn-menu').addEventListener('click', () => {
  GS.screen = 'start';
  UI.populateStartScreen();
  UI.showScreen('start');
});

document.getElementById('btn-pause').addEventListener('click', () => {
  if (GS.screen === 'playing') UI.showScreen('paused');
  else if (GS.screen === 'paused') UI.showScreen('playing');
});

document.getElementById('sound-toggle').addEventListener('click', () => {
  Audio.init();
  const on = Audio.toggle();
  document.getElementById('sound-toggle').textContent = on ? '🔊' : '🔇';
});

// Tap to shoot
window.addEventListener('pointerdown', e => {
  if (GS.screen !== 'playing') return;
  if (e.target.closest('.btn-home') || e.target.closest('#btn-pause') ||
      e.target.closest('#sound-toggle')) return;
  Audio.init();
  Audio.shoot();
  FX.burst(e.clientX, e.clientY, 'rgba(255,255,255,0.5)', 4, 3, 2);
  shootTongue(e.clientX, e.clientY);
});

/* ============================================================
   COUNTDOWN
============================================================ */
function startCountdown() {
  GS.countdownVal = 3;
  showCountdownNumber(3);
}

function showCountdownNumber(n) {
  const el = document.getElementById('countdown-num');
  if (n <= 0) {
    UI.showScreen('playing');
    return;
  }
  el.textContent = n === -1 ? 'GO!' : n;
  // Re-trigger animation
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = 'countAnim 0.9s ease-out forwards';
  Audio.countdown();
  const next = n > 1 ? n-1 : -1;
  setTimeout(() => showCountdownNumber(next), 950);
}

/* ============================================================
   12. BOOTSTRAP & GAME LOOP
============================================================ */
resizeCanvases();
GS.reset();
UI.updateScore();
UI.updateCombo();
UI.updateLevel();
UI.populateStartScreen();

let lastTime = 0;
function gameLoop(ts) {
  requestAnimationFrame(gameLoop);

  // Background always animates
  BG.draw();

  if (GS.screen === 'playing') {
    update();
  } else if (GS.screen === 'paused') {
    // Still draw entities but don't update logic
    FX.update();
  }

  draw();

  // Powerup timer display
  if (GS.powerupActive && GS.screen === 'playing') {
    const secs = Math.ceil(GS.powerupTimer / 60);
    document.getElementById('powerup-timer').textContent = `${secs}s`;
  }
}

requestAnimationFrame(gameLoop);