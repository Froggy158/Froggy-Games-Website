// ===== FROGGY CANVAS - SCRIPT =====

const canvas  = document.getElementById('drawCanvas');
const ctx     = canvas.getContext('2d');
const hint    = document.getElementById('canvasHint');

// ── Prevent image/text drag and context menu on canvas ──
canvas.addEventListener('dragstart',   e => e.preventDefault());
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('selectstart', e => {
  // Allow selection inside inputs (e.g. the color picker) but nowhere else
  if (e.target.tagName !== 'INPUT') e.preventDefault();
});

// ── State ──
let tool          = 'draw';
let color         = '#2d6a2d';
let brushSize     = 8;
let opacity       = 1;
let isDrawing     = false;
let lastX         = 0, lastY = 0;
let stampEmoji    = null;
let undoStack     = [];   // array of ImageData — fully synchronous
let redoStack     = [];
let hintDismissed = false;

// ── Canvas Init ──
function initCanvas() {
  const wrapper = canvas.parentElement;
  const W = wrapper.clientWidth - 6;
  const H = Math.max(420, Math.round(W * 0.62));
  canvas.width  = W;
  canvas.height = H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  undoStack = [ctx.getImageData(0, 0, canvas.width, canvas.height)];
  redoStack = [];
  updateButtons();
}

window.addEventListener('resize', () => {
  const snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const wrapper  = canvas.parentElement;
  const W = wrapper.clientWidth - 6;
  const H = Math.max(420, Math.round(W * 0.62));
  canvas.width  = W;
  canvas.height = H;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);
  ctx.putImageData(snapshot, 0, 0);
  undoStack[undoStack.length - 1] = ctx.getImageData(0, 0, canvas.width, canvas.height);
  redoStack = [];
  updateButtons();
});

// ── Undo / Redo — fully synchronous using ImageData ──
function saveState() {
  undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
  if (undoStack.length > 40) undoStack.shift();
  redoStack = [];
  updateButtons();
}

function undo() {
  if (undoStack.length <= 1) return;
  redoStack.push(undoStack.pop());
  ctx.putImageData(undoStack[undoStack.length - 1], 0, 0);
  updateButtons();
  showToast('↩️ Undone!');
}

function redo() {
  if (!redoStack.length) return;
  const next = redoStack.pop();
  undoStack.push(next);
  ctx.putImageData(next, 0, 0);
  updateButtons();
  showToast('↪️ Redone!');
}

function updateButtons() {
  document.getElementById('undoBtn').disabled = undoStack.length <= 1;
  document.getElementById('redoBtn').disabled = redoStack.length === 0;
}

// ── Drawing Helpers ──
function getPos(e) {
  const rect  = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const src   = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY,
  };
}

function startDraw(e) {
  e.preventDefault();
  if (tool === 'fill')  { floodFill(e); return; }
  if (tool === 'stamp') { placeStamp(e); return; }

  dismissHint();
  isDrawing = true;
  const { x, y } = getPos(e);
  lastX = x; lastY = y;

  ctx.beginPath();
  ctx.arc(x, y, getBrushRadius(), 0, Math.PI * 2);
  ctx.fillStyle = getStrokeColor();
  ctx.fill();
}

function draw(e) {
  if (!isDrawing) return;
  e.preventDefault();
  const { x, y } = getPos(e);

  ctx.beginPath();
  ctx.moveTo(lastX, lastY);
  ctx.lineTo(x, y);
  ctx.strokeStyle = getStrokeColor();
  ctx.lineWidth   = getBrushRadius() * 2;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.stroke();

  lastX = x; lastY = y;
}

function stopDraw() {
  if (!isDrawing) return;
  isDrawing = false;
  saveState();
}

function getBrushRadius() {
  return tool === 'eraser' ? brushSize * 1.5 : brushSize / 2;
}

function getStrokeColor() {
  if (tool === 'eraser') return '#ffffff';
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${opacity})`;
}

function dismissHint() {
  if (!hintDismissed) {
    hintDismissed = true;
    hint.classList.add('hidden');
  }
}

// ── Flood Fill ──
function floodFill(e) {
  dismissHint();
  const { x, y } = getPos(e);
  const px = Math.floor(x), py = Math.floor(y);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data      = imageData.data;

  const idx     = (py * canvas.width + px) * 4;
  const targetR = data[idx], targetG = data[idx+1], targetB = data[idx+2], targetA = data[idx+3];

  const fillR = parseInt(color.slice(1, 3), 16);
  const fillG = parseInt(color.slice(3, 5), 16);
  const fillB = parseInt(color.slice(5, 7), 16);
  const fillA = Math.round(opacity * 255);

  if (targetR === fillR && targetG === fillG && targetB === fillB && targetA === fillA) return;

  function match(i) {
    return data[i] === targetR && data[i+1] === targetG && data[i+2] === targetB && data[i+3] === targetA;
  }
  function paint(i) {
    data[i] = fillR; data[i+1] = fillG; data[i+2] = fillB; data[i+3] = fillA;
  }

  const stack   = [idx];
  const visited = new Set();
  while (stack.length) {
    const ci = stack.pop();
    if (visited.has(ci)) continue;
    if (!match(ci)) continue;
    visited.add(ci);
    paint(ci);
    const cx = (ci / 4) % canvas.width;
    if (cx > 0)                              stack.push(ci - 4);
    if (cx < canvas.width - 1)               stack.push(ci + 4);
    if (ci - canvas.width * 4 >= 0)          stack.push(ci - canvas.width * 4);
    if (ci + canvas.width * 4 < data.length) stack.push(ci + canvas.width * 4);
  }

  ctx.putImageData(imageData, 0, 0);
  saveState();
}

// ── Stamp ──
function placeStamp(e) {
  dismissHint();
  if (!stampEmoji) return;
  const { x, y } = getPos(e);
  const size = Math.max(30, brushSize * 4);
  ctx.font          = `${size}px serif`;
  ctx.textAlign     = 'center';
  ctx.textBaseline  = 'middle';
  ctx.globalAlpha   = opacity;
  ctx.fillText(stampEmoji, x, y);
  ctx.globalAlpha   = 1;
  saveState();
}

// ── Canvas Events ──
canvas.addEventListener('mousedown',  startDraw);
canvas.addEventListener('mousemove',  draw);
canvas.addEventListener('mouseup',    stopDraw);
canvas.addEventListener('mouseleave', stopDraw);
canvas.addEventListener('touchstart', startDraw, { passive: false });
canvas.addEventListener('touchmove',  draw,      { passive: false });
canvas.addEventListener('touchend',   stopDraw);

// ── Keyboard Shortcuts ──
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') { e.preventDefault(); undo(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); redo(); }
});

// ── Color Buttons ──
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    color = btn.dataset.color;
    document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('customColor').value = color;
    if (tool === 'eraser') activateTool('draw');
  });
});

document.getElementById('customColor').addEventListener('input', e => {
  color = e.target.value;
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  if (tool === 'eraser') activateTool('draw');
});

// ── Tool Buttons ──
function activateTool(name) {
  tool = name;
  document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`btn-${name}`);
  if (btn) btn.classList.add('active');
  if (name !== 'stamp') {
    document.querySelectorAll('.stamp-btn').forEach(b => b.classList.remove('active'));
    stampEmoji = null;
  }
  canvas.style.cursor = name === 'eraser' ? 'cell' : name === 'fill' ? 'copy' : 'crosshair';
}

document.querySelectorAll('.tool-btn').forEach(btn => {
  btn.addEventListener('click', () => activateTool(btn.dataset.tool));
});

// ── Brush Size Buttons ──
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    brushSize = parseInt(btn.dataset.size);
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('brushSlider').value = brushSize;
    document.getElementById('brushLabel').textContent = brushSize + 'px';
  });
});

document.getElementById('brushSlider').addEventListener('input', e => {
  brushSize = parseInt(e.target.value);
  document.getElementById('brushLabel').textContent = brushSize + 'px';
  document.querySelectorAll('.size-btn').forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.size) === brushSize);
  });
});

// ── Opacity ──
document.getElementById('opacitySlider').addEventListener('input', e => {
  opacity = parseInt(e.target.value) / 100;
  document.getElementById('opacityLabel').textContent = e.target.value + '%';
});

// ── Stamps ──
document.querySelectorAll('.stamp-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const isSame = btn.classList.contains('active');
    document.querySelectorAll('.stamp-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    if (isSame) {
      tool = 'draw';
      stampEmoji = null;
      document.getElementById('btn-draw').classList.add('active');
      canvas.style.cursor = 'crosshair';
    } else {
      tool = 'stamp';
      stampEmoji = btn.dataset.stamp;
      btn.classList.add('active');
      canvas.style.cursor = 'copy';
    }
  });
});

// ── Action Buttons ──
document.getElementById('undoBtn').addEventListener('click', undo);
document.getElementById('redoBtn').addEventListener('click', redo);

document.getElementById('clearBtn').addEventListener('click', () => {
  if (confirm('🐸 Ribbit! Clear the whole canvas?')) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    hintDismissed = false;
    hint.classList.remove('hidden');
    saveState();
    showToast('Canvas cleared! Start fresh 🌿');
  }
});

// ── Toast ──
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

// ── Init ──
initCanvas();