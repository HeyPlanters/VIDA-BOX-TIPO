// script.js
// Compact, readable structure following project guidelines.
('use strict');

const CONFIG = {
  // Edit these top-level values to configure the app
  FONT_PATH: 'fonts/Vida-Regular.woff2', // <-- real font file (edit here if needed)
  // We use an internal font-family name we control to avoid depending on the font's internal name
  FONT_FAMILY: 'VidaCustom',
  COLORS: [
    'rgb(0, 0, 0)',        // black
    'rgb(255, 255, 255)',  // white
    'rgb(216, 253, 210)',  // light green
    'rgb(159, 224, 182)'   // medium green
  ],
  DEFAULT_SIZE: 29,
  MIN_SIZE: 12,
  MAX_SIZE: 180,
  MAX_RENDER_WIDTH: 1000, // px - change near top of config
  CANVAS_PADDING: 20,     // px padding around text
  LINE_HEIGHT_RATIO: 1.05,
  MAX_LINES: 6,
  // Extra vertical gap (fraction of font size) inserted between two lines.
  // Increase slightly for typographic breathing. Tweakable here.
  TWO_LINE_GAP_FACTOR: 0.13,
  // Per-line horizontal offset range (px) and step
  LINE_OFFSET_MAX: 200,
  LINE_OFFSET_STEP: 1,
  FALLBACK_FILENAME: 'Mi_Titulo'
};

// DOM cache, preferences and runtime state
const dom = {};
const prefs = { size: CONFIG.DEFAULT_SIZE, colorIndex: 0 };
const state = { fontReady: false, fontLoading: true, fontLoadError: null, offsets: [] };
let statusTimer = null;

async function initApp(){
  cacheDom();
  injectFontFace();
  loadPreferences();
  setupSizeControls();
  buildColorSwatches();
  bindEvents();
  autoResizeTextarea();

  // Initialize accordions after DOM and event binding
  initAccordions();

  // Disable actions until font is verified
  dom.copyBtn.disabled = true; dom.downloadBtn.disabled = true;

  const ok = await loadAndVerifyFont();
  if(!ok){
    // font failed: keep actions disabled and show clear error
    dom.copyBtn.disabled = true; dom.downloadBtn.disabled = true;
  }

  updatePreview();
}

function cacheDom(){
  dom.previewCanvas = document.getElementById('previewCanvas');
  dom.previewBg = document.getElementById('previewBg');
  dom.titleInput = document.getElementById('titleInput');
  dom.sizeRange = document.getElementById('sizeRange');
  dom.sizeNumber = document.getElementById('sizeNumber');
  dom.colorSwatches = document.getElementById('colorSwatches');
  dom.lineControls = document.getElementById('lineControls');
  dom.compNote = document.getElementById('compNote');
  dom.toggleAdvanced = document.getElementById('toggle-advanced');
  dom.panelAdvanced = document.getElementById('panel-advanced');
  dom.copyBtn = document.getElementById('copyBtn');
  dom.downloadBtn = document.getElementById('downloadBtn');
  dom.status = document.getElementById('status');
}

function initAccordions(){
  // Single advanced disclosure control
  const btn = dom.toggleAdvanced; const panel = dom.panelAdvanced;
  if(!btn || !panel) return;
  btn.addEventListener('click', ()=>{
    const isOpen = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!isOpen));
    panel.hidden = isOpen;
  });
  btn.addEventListener('keydown', (e)=>{ if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); btn.click(); } });
}

function injectFontFace(){
  const style = document.createElement('style');
  // Use a local path and a controlled font-family name
  style.textContent = `@font-face{font-family:'${CONFIG.FONT_FAMILY}';src:url('${CONFIG.FONT_PATH}') format('woff2');font-weight:400;font-style:normal;font-display:swap;}`;
  document.head.appendChild(style);
}

async function loadAndVerifyFont(){
  if(!('fonts' in document) || !document.fonts.load){
    state.fontLoading = false;
    state.fontReady = false;
    state.fontLoadError = 'Tu navegador no permite verificar la fuente personalizada.';
    showStatus(state.fontLoadError, 'error');
    return false;
  }

  showStatus('Cargando fuente personalizada...', null);
  const spec = `12px '${CONFIG.FONT_FAMILY}'`;
  try{
    // Attempt to load and then verify with document.fonts.check
    // Use a small timeout to avoid hanging if the font resource is unreachable.
    await Promise.race([
      document.fonts.load(spec),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);
    const ok = document.fonts.check(spec);
    if(ok){
      state.fontReady = true; state.fontLoading = false; state.fontLoadError = null; showStatus('', null);
      return true;
    }
    state.fontReady = false; state.fontLoading = false;
    state.fontLoadError = `No se ha podido cargar la tipografía personalizada. Revisa el archivo ${CONFIG.FONT_PATH}.`;
    showStatus(state.fontLoadError, 'error');
    return false;
  }catch(err){
    state.fontReady = false; state.fontLoading = false; state.fontLoadError = `No se ha podido cargar la tipografía personalizada. Revisa el archivo ${CONFIG.FONT_PATH}.`;
    showStatus(state.fontLoadError, 'error');
    console.error(err);
    return false;
  }
}

function ensureFontAvailable(){
  return state.fontReady === true;
}

function loadPreferences(){
  const s = parseInt(localStorage.getItem('vb_size'),10);
  const c = parseInt(localStorage.getItem('vb_colorIndex'),10);
  if(Number.isFinite(s) && s >= CONFIG.MIN_SIZE && s <= CONFIG.MAX_SIZE) prefs.size = s;
  if(Number.isFinite(c) && c >=0 && c < CONFIG.COLORS.length) prefs.colorIndex = c;
  // set UI values
  dom.sizeRange.value = prefs.size;
  dom.sizeNumber.value = prefs.size;
}

function savePreferences(){
  localStorage.setItem('vb_size', String(prefs.size));
  localStorage.setItem('vb_colorIndex', String(prefs.colorIndex));
}

function setupSizeControls(){
  dom.sizeRange.min = CONFIG.MIN_SIZE; dom.sizeRange.max = CONFIG.MAX_SIZE;
  dom.sizeNumber.min = CONFIG.MIN_SIZE; dom.sizeNumber.max = CONFIG.MAX_SIZE;
}

function bindEvents(){
  dom.titleInput.addEventListener('input', ()=>{ autoResizeTextarea(); updatePreview(); });
  dom.sizeRange.addEventListener('input', onSizeChange);
  dom.sizeNumber.addEventListener('input', onSizeChange);
  dom.copyBtn.addEventListener('click', onCopyClick);
  dom.downloadBtn.addEventListener('click', onDownloadClick);

  document.addEventListener('keydown', (e)=>{
    if((e.ctrlKey||e.metaKey) && e.key === 'Enter'){
      e.preventDefault(); if(!dom.copyBtn.disabled) dom.copyBtn.click();
    }
  });
}

function onSizeChange(e){
  const val = Number(e.target.value);
  if(Number.isNaN(val)) return;
  prefs.size = Math.max(CONFIG.MIN_SIZE, Math.min(CONFIG.MAX_SIZE, Math.round(val)));
  dom.sizeRange.value = prefs.size; dom.sizeNumber.value = prefs.size;
  savePreferences();
  updatePreview();
}

function buildColorSwatches(){
  while(dom.colorSwatches.firstChild) dom.colorSwatches.removeChild(dom.colorSwatches.firstChild);
  CONFIG.COLORS.forEach((c,i)=>{
    const btn = document.createElement('button');
    btn.className = 'swatch';
    btn.style.backgroundColor = c;
    btn.setAttribute('data-index', String(i));
    btn.setAttribute('aria-label', `Color ${i+1}`);
    btn.addEventListener('click', ()=>{
      prefs.colorIndex = i; savePreferences(); updateSwatchSelection(); updatePreview();
    });
    dom.colorSwatches.appendChild(btn);
  });
  updateSwatchSelection();
}

function updateSwatchSelection(){
  Array.from(dom.colorSwatches.children).forEach((el,i)=>{
    el.classList.toggle('selected', i === prefs.colorIndex);
    el.setAttribute('aria-pressed', String(i===prefs.colorIndex));
  });
  // Set CSS variable for slider thumb color to match selected text color
  try{ document.documentElement.style.setProperty('--thumb-color', CONFIG.COLORS[prefs.colorIndex]); }catch(e){}
}

// Maintain offsets array length and preserve values when possible
function syncOffsets(lineCount){
  const offs = state.offsets || [];
  if(offs.length < lineCount){
    for(let i=offs.length;i<lineCount;i++) offs.push(0);
  } else if(offs.length > lineCount){
    offs.length = lineCount;
  }
  state.offsets = offs;
}

// Build or remove per-line horizontal offset controls based on actual rendered line count
function updateLineControls(lineCount){
  if(!dom.lineControls) return;
  syncOffsets(lineCount);
  // Only rebuild if the number of controls changed; avoid disrupting user interactions
  if(dom.lineControls.childElementCount === lineCount){
    // update existing inputs values to stay in sync
    for(let i=0;i<lineCount;i++){
      const input = document.getElementById(`lineOffset${i}`);
      if(input) input.value = String(state.offsets[i] || 0);
    }
    return;
  }
  // Rebuild controls cleanly when line count changes
  while(dom.lineControls.firstChild) dom.lineControls.removeChild(dom.lineControls.firstChild);
  if(lineCount <= 0) return;
  for(let i=0;i<lineCount;i++){
    const wrapper = document.createElement('div');
    wrapper.className = 'line-control';
    const label = document.createElement('label');
    label.className = 'line-label';
    label.textContent = `Línea ${i+1}`;
    label.htmlFor = `lineOffset${i}`;

    const input = document.createElement('input');
    input.type = 'range';
    input.id = `lineOffset${i}`;
    input.min = String(-CONFIG.LINE_OFFSET_MAX);
    input.max = String(CONFIG.LINE_OFFSET_MAX);
    input.step = String(CONFIG.LINE_OFFSET_STEP);
    input.value = String(state.offsets[i] || 0);
    input.setAttribute('aria-label', `Desplazar línea ${i+1}`);
    input.addEventListener('input', (e)=>{
      state.offsets[i] = Number(e.target.value) || 0;
      updatePreview();
    });

    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'line-reset';
    reset.title = 'Restablecer desplazamiento';
    reset.textContent = '↺';
    reset.addEventListener('click', ()=>{
      state.offsets[i] = 0;
      input.value = '0';
      updatePreview();
    });

    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(reset);
    dom.lineControls.appendChild(wrapper);
  }
  // Show or hide the composition note depending on whether there are controls
  if(dom.compNote){
    dom.compNote.style.display = (lineCount <= 1) ? 'block' : 'none';
  }
}

function autoResizeTextarea(){
  const ta = dom.titleInput;
  ta.style.height = 'auto';
  const lineHeight = computeLineHeight(ta);
  const maxHeight = Math.round(lineHeight * CONFIG.MAX_LINES);
  const newHeight = Math.min(ta.scrollHeight, maxHeight);
  ta.style.height = `${newHeight}px`;
}

function computeLineHeight(el){
  const cs = getComputedStyle(el);
  const lh = parseFloat(cs.lineHeight);
  if(Number.isFinite(lh)) return lh;
  return parseFloat(cs.fontSize) * 1.1;
}

function showStatus(text, type){
  clearTimeout(statusTimer);
  dom.status.textContent = text || '';
  dom.status.classList.toggle('success', type === 'success');
  dom.status.classList.toggle('error', type === 'error');
  if(type === 'success'){
    statusTimer = setTimeout(()=>{ dom.status.textContent = ''; dom.status.className = 'status'; }, 1800);
  }
}

function clearPreviewCanvas(){
  const ctx = dom.previewCanvas.getContext('2d');
  const w = dom.previewCanvas.width; const h = dom.previewCanvas.height;
  ctx.clearRect(0,0,w,h);
}

// Normalize input into up to CONFIG.MAX_LINES lines, with greedy word wrapping
function layoutTitleLines(text, size){
  text = (text||'').replace(/\r/g,'').trim();
  if(!text) return { lines: [], error: null };
  const measure = document.createElement('canvas').getContext('2d');
  measure.font = `${size}px '${CONFIG.FONT_FAMILY}'`;
  const maxW = Math.max(100, CONFIG.MAX_RENDER_WIDTH - (CONFIG.CANVAS_PADDING * 2));

  const paragraphs = text.split('\n').map(p => p.trim()).filter(Boolean);
  const lines = [];

  for(let pIndex = 0; pIndex < paragraphs.length; pIndex++){
    const para = paragraphs[pIndex];
    // fast path: paragraph fits on one line
    if(measure.measureText(para).width <= maxW){
      lines.push(para);
      if(lines.length >= CONFIG.MAX_LINES){
        return { lines: lines.slice(0, CONFIG.MAX_LINES), error: `Solo se permiten ${CONFIG.MAX_LINES} líneas. Se truncó el texto.` };
      }
      continue;
    }

    // wrap paragraph by words
    const words = para.split(/\s+/);
    // if any single word is wider than max, return an error for that word
    for(const w of words){
      if(measure.measureText(w).width > maxW){
        lines.push(w);
        return { lines: lines.slice(0, CONFIG.MAX_LINES), error: 'La palabra es demasiado larga para el ancho máximo. Reduce el tamaño.' };
      }
    }

    let current = words[0];
    for(let i=1;i<words.length;i++){
      const candidate = `${current} ${words[i]}`;
      if(measure.measureText(candidate).width <= maxW){
        current = candidate;
      } else {
        lines.push(current);
        if(lines.length >= CONFIG.MAX_LINES) return { lines: lines.slice(0, CONFIG.MAX_LINES), error: `Solo se permiten ${CONFIG.MAX_LINES} líneas. Se truncó el texto.` };
        current = words[i];
      }
    }
    if(current){
      lines.push(current);
      if(lines.length >= CONFIG.MAX_LINES) return { lines: lines.slice(0, CONFIG.MAX_LINES), error: `Solo se permiten ${CONFIG.MAX_LINES} líneas. Se truncó el texto.` };
    }
    if(lines.length >= CONFIG.MAX_LINES) break;
  }

  return { lines: lines.slice(0, CONFIG.MAX_LINES), error: null };
}

// Render title to an offscreen canvas sized tightly to content + padding
async function renderTitleToCanvas(lines, size, color, offsets = []){
  if(!ensureFontAvailable()) return null;
  if(!lines || lines.length === 0) return null;
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  mctx.font = `${size}px '${CONFIG.FONT_FAMILY}'`;

  const metrics = lines.map(l => mctx.measureText(l));
  const widths = metrics.map(m => m.width);
  const ascents = metrics.map(m => (m.actualBoundingBoxAscent || size*0.75));
  const descents = metrics.map(m => (m.actualBoundingBoxDescent || size*0.25));

  const innerW = Math.max(...widths);
  const lineHeight = size * CONFIG.LINE_HEIGHT_RATIO;
  // Add a subtle extra gap between lines derived from font size for better typographic balance.
  const gap = (lines.length > 1) ? Math.round(size * CONFIG.TWO_LINE_GAP_FACTOR) : 0;
  const innerH = lineHeight * lines.length + gap * Math.max(0, lines.length - 1);

  // Consider horizontal offsets when sizing canvas so shifted lines are not clipped
  const offs = offsets || [];
  const offsForLines = lines.map((_,i)=> Number(offs[i]||0));
  const minOffset = Math.min(...offsForLines, 0);
  const maxOffset = Math.max(...offsForLines, 0);
  const leftExtra = Math.max(0, -minOffset);
  const rightExtra = Math.max(0, maxOffset);

  const canvasInnerW = Math.ceil(innerW + leftExtra + rightExtra);
  const canvasInnerH = Math.ceil(innerH);

  const canvasW = canvasInnerW + CONFIG.CANVAS_PADDING * 2;
  const canvasH = canvasInnerH + CONFIG.CANVAS_PADDING * 2;
  const DPR = window.devicePixelRatio || 1;

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(canvasW * DPR));
  canvas.height = Math.max(1, Math.round(canvasH * DPR));
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(DPR,0,0,DPR,0,0);
  ctx.clearRect(0,0,canvasW,canvasH);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${size}px '${CONFIG.FONT_FAMILY}'`;

  // draw centered horizontally; vertically we place first baseline at padding + ascent
  const firstAscent = ascents[0] || size*0.75;
  let baseline = CONFIG.CANVAS_PADDING + firstAscent;

  // For horizontal centering we offset by leftExtra so offsets don't clip
  // Draw all lines centered horizontally, applying per-line offsets and the gap between lines
  for(let i=0;i<lines.length;i++){
    const text = lines[i];
    const w = widths[i] || 0;
    const x = CONFIG.CANVAS_PADDING + leftExtra + (innerW - w)/2 + (offsForLines[i] || 0);
    ctx.fillText(text, x, baseline);
    baseline += lineHeight + gap;
  }

  return canvas;
}

// Update preview using the same rendering pipeline (render to offscreen canvas, then scale into preview canvas)
async function updatePreview(){
  const text = dom.titleInput.value || '';
  if(!text.trim()){
    // clear preview
    clearPreviewCanvas();
    dom.copyBtn.disabled = true; dom.downloadBtn.disabled = true;
    updateLineControls(0);
    showStatus('', null);
    return;
  }

  if(state.fontLoading){
    clearPreviewCanvas();
    dom.copyBtn.disabled = true; dom.downloadBtn.disabled = true;
    updateLineControls(0);
    showStatus('Cargando fuente personalizada...', null);
    return;
  }

  if(!state.fontReady){
    clearPreviewCanvas();
    dom.copyBtn.disabled = true; dom.downloadBtn.disabled = true;
    updateLineControls(0);
    showStatus(state.fontLoadError || 'La fuente personalizada no está disponible.', 'error');
    return;
  }

  const { lines, error } = layoutTitleLines(text, prefs.size);
  if(error) showStatus(error, 'error'); else showStatus('', null);

  // Ensure offsets array and controls match actual rendered lines
  updateLineControls(lines.length);

  const exportCanvas = await renderTitleToCanvas(lines, prefs.size, CONFIG.COLORS[prefs.colorIndex], state.offsets);
  if(!exportCanvas){ dom.copyBtn.disabled = true; dom.downloadBtn.disabled = true; return; }

  // fit exportCanvas into preview area while preserving aspect ratio
  const DPR = window.devicePixelRatio || 1;
  const exportCssW = exportCanvas.width / DPR;
  const exportCssH = exportCanvas.height / DPR;
  const maxPreviewW = Math.min(dom.previewBg.clientWidth - 8, exportCssW);
  const scale = Math.min(1, maxPreviewW / exportCssW) || 1;
  const displayW = Math.max(32, Math.round(exportCssW * scale));
  const displayH = Math.max(16, Math.round(exportCssH * scale));

  dom.previewCanvas.style.width = `${displayW}px`;
  dom.previewCanvas.style.height = `${displayH}px`;
  dom.previewCanvas.width = Math.max(1, Math.round(displayW * DPR));
  dom.previewCanvas.height = Math.max(1, Math.round(displayH * DPR));
  const pctx = dom.previewCanvas.getContext('2d');
  pctx.setTransform(DPR,0,0,DPR,0,0);
  pctx.clearRect(0,0,displayW,displayH);
  pctx.drawImage(exportCanvas, 0, 0, displayW, displayH);

  dom.copyBtn.disabled = false; dom.downloadBtn.disabled = false;
}

async function onCopyClick(){
  const text = dom.titleInput.value || '';
  if(!text.trim()){ showStatus('Escribe un texto antes de copiar.', 'error'); return; }
  if(!ensureFontAvailable()){ showStatus('La fuente personalizada no está disponible. Copiar deshabilitado.', 'error'); return; }

  if(!(navigator.clipboard && window.ClipboardItem)){
    showStatus('Tu navegador no permite copiar PNG directamente. Usa "Descargar PNG".', 'error');
    return;
  }

  const { lines, error } = layoutTitleLines(text, prefs.size);
  if(error) showStatus(error, 'error');
  try{
    const exportCanvas = await renderTitleToCanvas(lines, prefs.size, CONFIG.COLORS[prefs.colorIndex], state.offsets);
    if(!exportCanvas){ showStatus('No se pudo generar la imagen.', 'error'); return; }
    exportCanvas.toBlob(async (blob)=>{
      if(!blob){ showStatus('No se pudo generar la imagen.', 'error'); return; }
      try{
        await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
        showStatus('Copiado ✓', 'success');
      }catch(err){
        console.error(err);
        showStatus('Tu navegador no permite copiar PNG directamente. Usa "Descargar PNG".', 'error');
      }
    }, 'image/png');
  }catch(e){ console.error(e); showStatus('Error al copiar. Usa "Descargar PNG".', 'error'); }
}

async function onDownloadClick(){
  const text = dom.titleInput.value || '';
  if(!text.trim()){ showStatus('Escribe un texto antes de descargar.', 'error'); return; }
  if(!ensureFontAvailable()){ showStatus('La fuente personalizada no está disponible. Descargar deshabilitado.', 'error'); return; }
  const { lines, error } = layoutTitleLines(text, prefs.size);
  if(error) showStatus(error, 'error');
  const exportCanvas = await renderTitleToCanvas(lines, prefs.size, CONFIG.COLORS[prefs.colorIndex], state.offsets);
  if(!exportCanvas){ showStatus('No se pudo generar la imagen.', 'error'); return; }

  exportCanvas.toBlob((blob)=>{
    if(!blob){ showStatus('No se pudo generar la imagen.', 'error'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = getDownloadFilename(text || CONFIG.FALLBACK_FILENAME);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 5000);
    showStatus('Descarga iniciada', 'success');
  }, 'image/png');
}

function sanitizeFilename(name){
  let s = String(name || CONFIG.FALLBACK_FILENAME).trim();
  s = s.replace(/\r?\n|\r/g,' ');
  s = s.replace(/\s+/g,'_');
  s = s.replace(/[<>:"\/\\|?*\x00-\x1F]/g,'');
  s = s.replace(/_+/g,'_');
  if(!s) s = CONFIG.FALLBACK_FILENAME;
  return `${s}.png`;
}

function getDownloadFilename(text){
  if(!text) return `${CONFIG.FALLBACK_FILENAME}.png`;
  return sanitizeFilename(text);
}

// initialize
document.addEventListener('DOMContentLoaded', initApp);
