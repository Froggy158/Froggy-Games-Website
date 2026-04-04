// =============================================
//  FROG CUSTOMIZER — script.js
// =============================================

// ---- BODY PART GROUPS ----
const BODY_PARTS = [
  'frogBody', 'frogHead',
  'eyeBumpLeft', 'eyeBumpRight',
  'backLegLeft', 'backLegRight',
  'frontLegLeft', 'frontLegRight',
  'toeBL1','toeBL2','toeBL3','toeBL4',
  'toeBR1','toeBR2','toeBR3','toeBR4',
  'toeFL1','toeFL2','toeFL3',
  'toeFR1','toeFR2','toeFR3',
];

const BELLY_PART   = 'frogBelly';
const PUPIL_PARTS  = ['pupilLeft','pupilRight'];
const EYE_PARTS    = ['eyeLeft','eyeRight'];
const MOUTH_PARTS  = ['mouthCute','mouthAngry'];

// ---- PRESET SWATCHES ----
const BODY_PRESETS = [
  '#5cb85c','#3a9a3a','#8fd44e','#1e7a1e',
  '#4acfcf','#d4af37','#a0522d','#cc5577',
];

const EYE_PRESETS = [
  '#f5a623','#e74c3c','#3498db','#9b59b6',
  '#1abc9c','#ecf0f1','#f39c12','#27ae60',
];

// ---- STATE ----
let state = {
  bodyColor:   '#5cb85c',
  bellyColor:  '#a8e6a3',
  eyeColor:    '#f5a623',
  pupilColor:  '#1a1a1a',
  mouthColor:  '#3a2a00',
  spotColor:   '#2d7a2d',
  expression:  'cute',
  bodyWidth:   100,
  bodyHeight:  100,
  headSize:    100,
  eyeSize:     100,
  legSize:     100,
  mouthSize:   100,
  spotsOn:     false,
  blushOn:     true,
};

// =============================================
//  INIT
// =============================================
document.addEventListener('DOMContentLoaded', () => {
  buildSwatches('bodyColorSwatches', BODY_PRESETS, (c) => {
    state.bodyColor = c;
    document.getElementById('bodyColor').value = c;
    applyBodyColor(c);
  });

  buildSwatches('eyeColorSwatches', EYE_PRESETS, (c) => {
    state.eyeColor = c;
    document.getElementById('eyeColor').value = c;
    applyEyeColor(c);
  });

  applyAll();
});

// =============================================
//  SWATCH BUILDER
// =============================================
function buildSwatches(containerId, colors, onSelect) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  colors.forEach(c => {
    const s = document.createElement('div');
    s.className = 'swatch';
    s.style.background = c;
    s.title = c;
    s.onclick = () => {
      wrap.querySelectorAll('.swatch').forEach(el => el.classList.remove('selected'));
      s.classList.add('selected');
      onSelect(c);
    };
    wrap.appendChild(s);
  });
  // Mark first swatch selected
  if (wrap.firstChild) wrap.firstChild.classList.add('selected');
}

// =============================================
//  COLOR APPLIERS
// =============================================
function applyBodyColor(val) {
  state.bodyColor = val;
  BODY_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.fill = val;
  });
  // Darken for nostrils
  const dark = darkenHex(val, 0.35);
  ['nostrilLeft','nostrilRight'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.fill = dark;
  });
  // Darken for spots
  document.querySelectorAll('.spot').forEach(el => el.style.fill = darkenHex(val, 0.25));
}

function applyBellyColor(val) {
  state.bellyColor = val;
  const el = document.getElementById('frogBelly');
  if (el) el.style.fill = val;
}

function applyEyeColor(val) {
  state.eyeColor = val;
  EYE_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.fill = val;
  });
}

function applyPupilColor(val) {
  state.pupilColor = val;
  PUPIL_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.fill = val;
  });
}

function applyMouthColor(val) {
  state.mouthColor = val;
  MOUTH_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.stroke = val;
  });
}

function applySpotColor(val) {
  state.spotColor = val;
  document.querySelectorAll('.spot').forEach(el => el.style.fill = val);
}

// =============================================
//  EXPRESSION
// =============================================
function setExpression(expr) {
  state.expression = expr;

  const cute   = document.getElementById('mouthCute');
  const angry  = document.getElementById('mouthAngry');
  const brows  = document.getElementById('eyebrowGroup');
  const blush  = document.getElementById('blushGroup');
  const tongue = document.getElementById('tongue');
  const btnC   = document.getElementById('btnCute');
  const btnA   = document.getElementById('btnAngry');

  if (expr === 'cute') {
    cute.style.display  = '';
    angry.style.display = 'none';
    brows.style.display = 'none';
    tongue.style.display = '';
    if (state.blushOn) blush.style.display = '';
    btnC.classList.add('active');
    btnA.classList.remove('active');
    // Eyes more open (reset pupils)
    ['pupilLeft','pupilRight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('r', scaleVal(9, state.eyeSize));
    });
  } else {
    cute.style.display  = 'none';
    angry.style.display = '';
    brows.style.display = '';
    tongue.style.display = 'none';
    blush.style.display  = 'none';
    btnA.classList.add('active');
    btnC.classList.remove('active');
    // Slightly squinted pupils
    ['pupilLeft','pupilRight'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.setAttribute('r', scaleVal(7, state.eyeSize));
    });
  }

  bounceFrog();
}

// =============================================
//  SCALING
// =============================================
function scaleVal(base, pct) {
  return (base * pct / 100).toFixed(2);
}

// --- Body Width ---
function scaleBodyWidth(val) {
  state.bodyWidth = val;
  document.getElementById('bodyWidthVal').textContent = val + '%';
  const factor = val / 100;
  const body  = document.getElementById('frogBody');
  const belly = document.getElementById('frogBelly');
  if (body)  body.setAttribute('rx',  (85 * factor).toFixed(1));
  if (belly) belly.setAttribute('rx', (55 * factor).toFixed(1));
  bounceFrog();
}

// --- Body Height ---
function scaleBodyHeight(val) {
  state.bodyHeight = val;
  document.getElementById('bodyHeightVal').textContent = val + '%';
  const factor = val / 100;
  const body  = document.getElementById('frogBody');
  const belly = document.getElementById('frogBelly');
  if (body)  body.setAttribute('ry',  (70 * factor).toFixed(1));
  if (belly) belly.setAttribute('ry', (48 * factor).toFixed(1));
  bounceFrog();
}

// --- Head ---
function scaleHead(val) {
  state.headSize = val;
  document.getElementById('headSizeVal').textContent = val + '%';
  const f = val / 100;
  const head = document.getElementById('frogHead');
  if (head) {
    head.setAttribute('rx', (72 * f).toFixed(1));
    head.setAttribute('ry', (58 * f).toFixed(1));
  }
  bounceFrog();
}

// --- Eyes ---
function scaleEyes(val) {
  state.eyeSize = val;
  document.getElementById('eyeSizeVal').textContent = val + '%';
  const f = val / 100;

  const bumpData = [['eyeBumpLeft',110,90,24],['eyeBumpRight',190,90,24]];
  bumpData.forEach(([id,cx,cy,r]) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', (r * f).toFixed(1));
  });

  const eyeData = [['eyeLeft',110,90,16],['eyeRight',190,90,16]];
  eyeData.forEach(([id,cx,cy,r]) => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', (r * f).toFixed(1));
  });

  const pupilR = state.expression === 'angry' ? 7 : 9;
  PUPIL_PARTS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', (pupilR * f).toFixed(1));
  });

  bounceFrog();
}

// --- Legs ---
function scaleLegs(val) {
  state.legSize = val;
  document.getElementById('legSizeVal').textContent = val + '%';
  const f = val / 100;

  const legData = [
    ['backLegLeft',  80,  230, 38, 22],
    ['backLegRight', 220, 230, 38, 22],
    ['frontLegLeft', 75,  205, 22, 14],
    ['frontLegRight',225, 205, 22, 14],
  ];
  legData.forEach(([id,cx,cy,rx,ry]) => {
    const el = document.getElementById(id);
    if (el) {
      el.setAttribute('rx', (rx * f).toFixed(1));
      el.setAttribute('ry', (ry * f).toFixed(1));
    }
  });

  // Scale toes too
  const toeGroups = [
    ['toeBL1','toeBL2','toeBL3','toeBL4'],
    ['toeBR1','toeBR2','toeBR3','toeBR4'],
  ];
  toeGroups.flat().forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', (9 * f).toFixed(1));
  });
  ['toeFL1','toeFL2','toeFL3','toeFR1','toeFR2','toeFR3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', (6 * f).toFixed(1));
  });

  bounceFrog();
}

// --- Mouth ---
function scaleMouth(val) {
  state.mouthSize = val;
  document.getElementById('mouthSizeVal').textContent = val + '%';
  const f    = val / 100;
  const cx   = 150;
  const baseSpread = 25 * f;
  const curveDrop  = 14 * f;
  const angryCurve = 16 * f;

  const cute  = document.getElementById('mouthCute');
  const angry = document.getElementById('mouthAngry');

  if (cute)  cute.setAttribute( 'd', `M ${cx - baseSpread} 158 Q ${cx} ${158 + curveDrop} ${cx + baseSpread} 158`);
  if (angry) angry.setAttribute('d', `M ${cx - baseSpread - 3} ${158 + angryCurve} Q ${cx} ${158} ${cx + baseSpread + 3} ${158 + angryCurve}`);

  bounceFrog();
}

// =============================================
//  EXTRAS
// =============================================
function toggleSpots(on) {
  state.spotsOn = on;
  const g = document.getElementById('spotsGroup');
  if (g) g.style.display = on ? '' : 'none';
}

function toggleBlush(on) {
  state.blushOn = on;
  const g = document.getElementById('blushGroup');
  if (!g) return;
  if (on && state.expression === 'cute') {
    g.style.display = '';
  } else {
    g.style.display = 'none';
  }
}

// =============================================
//  APPLY ALL (on load)
// =============================================
function applyAll() {
  applyBodyColor(state.bodyColor);
  applyBellyColor(state.bellyColor);
  applyEyeColor(state.eyeColor);
  applyPupilColor(state.pupilColor);
  applyMouthColor(state.mouthColor);
  setExpression(state.expression);
}

// =============================================
//  RESET
// =============================================
function resetAll() {
  state = {
    bodyColor:   '#5cb85c',
    bellyColor:  '#a8e6a3',
    eyeColor:    '#f5a623',
    pupilColor:  '#1a1a1a',
    mouthColor:  '#3a2a00',
    spotColor:   '#2d7a2d',
    expression:  'cute',
    bodyWidth:   100,
    bodyHeight:  100,
    headSize:    100,
    eyeSize:     100,
    legSize:     100,
    mouthSize:   100,
    spotsOn:     false,
    blushOn:     true,
  };

  // Reset inputs
  document.getElementById('bodyColor').value   = state.bodyColor;
  document.getElementById('bellyColor').value  = state.bellyColor;
  document.getElementById('eyeColor').value    = state.eyeColor;
  document.getElementById('pupilColor').value  = state.pupilColor;
  document.getElementById('mouthColor').value  = state.mouthColor;
  document.getElementById('spotColor').value   = state.spotColor;

  document.getElementById('bodyWidth').value   = 100;
  document.getElementById('bodyHeight').value  = 100;
  document.getElementById('headSize').value    = 100;
  document.getElementById('eyeSize').value     = 100;
  document.getElementById('legSize').value     = 100;
  document.getElementById('mouthSize').value   = 100;

  document.getElementById('bodyWidthVal').textContent  = '100%';
  document.getElementById('bodyHeightVal').textContent = '100%';
  document.getElementById('headSizeVal').textContent   = '100%';
  document.getElementById('eyeSizeVal').textContent    = '100%';
  document.getElementById('legSizeVal').textContent    = '100%';
  document.getElementById('mouthSizeVal').textContent  = '100%';

  document.getElementById('toggleSpots').checked = false;
  document.getElementById('toggleBlush').checked = true;
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });

  // Reset SVG geometry to base values
  const resets = [
    ['frogBody',      'rx', 85,  'ry', 70],
    ['frogBelly',     'rx', 55,  'ry', 48],
    ['frogHead',      'rx', 72,  'ry', 58],
    ['eyeBumpLeft',   'r',  24],
    ['eyeBumpRight',  'r',  24],
    ['eyeLeft',       'r',  16],
    ['eyeRight',      'r',  16],
    ['pupilLeft',     'r',  9],
    ['pupilRight',    'r',  9],
    ['backLegLeft',   'rx', 38, 'ry', 22],
    ['backLegRight',  'rx', 38, 'ry', 22],
    ['frontLegLeft',  'rx', 22, 'ry', 14],
    ['frontLegRight', 'rx', 22, 'ry', 14],
  ];
  resets.forEach(([id, a1, v1, a2, v2]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute(a1, v1);
    if (a2) el.setAttribute(a2, v2);
  });

  // Reset toes
  ['toeBL1','toeBL2','toeBL3','toeBL4','toeBR1','toeBR2','toeBR3','toeBR4'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', 9);
  });
  ['toeFL1','toeFL2','toeFL3','toeFR1','toeFR2','toeFR3'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.setAttribute('r', 6);
  });

  // Reset mouth paths
  const cute  = document.getElementById('mouthCute');
  const angry = document.getElementById('mouthAngry');
  if (cute)  cute.setAttribute( 'd', 'M 125 158 Q 150 172 175 158');
  if (angry) angry.setAttribute('d', 'M 122 168 Q 150 152 178 168');

  // Reset swatch selections
  document.querySelectorAll('#bodyColorSwatches .swatch').forEach((s, i) => {
    s.classList.toggle('selected', i === 0);
  });
  document.querySelectorAll('#eyeColorSwatches .swatch').forEach((s, i) => {
    s.classList.toggle('selected', i === 0);
  });

  applyAll();
  bounceFrog();
}

// =============================================
//  BOUNCE ANIMATION
// =============================================
function bounceFrog() {
  const svg = document.getElementById('frogSVG');
  if (!svg) return;
  svg.classList.remove('frog-bounce');
  void svg.offsetWidth; // reflow
  svg.classList.add('frog-bounce');
  setTimeout(() => svg.classList.remove('frog-bounce'), 500);
}



// =============================================
//  UTILITY: Darken Hex
// =============================================
function darkenHex(hex, amount) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const r = Math.max(0, parseInt(c.slice(0,2),16) - Math.round(255 * amount));
  const g = Math.max(0, parseInt(c.slice(2,4),16) - Math.round(255 * amount));
  const b = Math.max(0, parseInt(c.slice(4,6),16) - Math.round(255 * amount));
  return '#' + [r,g,b].map(v => v.toString(16).padStart(2,'0')).join('');
}