/**
 * MarketSync Design Studio — Fabric.js Canvas Adapter
 *
 * Provides two-way conversion between MarketSync Scene JSON and Fabric Canvas objects,
 * handling zoom, drag/drop, alignment guides, undo/redo, and inspector synchronization.
 */

window.__fabricLoadedPromise = null;

function loadFabricJs() {
  if (window.fabric) return Promise.resolve(window.fabric);
  if (window.__fabricLoadedPromise) return window.__fabricLoadedPromise;

  window.__fabricLoadedPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/fabric.js/5.3.1/fabric.min.js';
    script.onload = () => resolve(window.fabric);
    script.onerror = () => reject(new Error('Fabric.js library failed to load'));
    document.head.appendChild(script);
  });

  return window.__fabricLoadedPromise;
}

// ── Canvas bitmap budget (the blank-artboard bug) ────────────────────────────
// WebKit (every browser on iOS, plus desktop Safari) refuses to allocate a
// canvas backing store larger than roughly 16.7M pixels. It does not throw.
// The element stays in the DOM, Fabric still reports its objects, every
// renderAll() returns cleanly — and nothing is ever painted. That is exactly
// the reported failure: `canvas 15 objects`, `canvas el in DOM`, blank
// artboard, on a 3x iPhone loading a 1080x1920 story page:
//
//     1080 x 1920 logical  x  devicePixelRatio 3  =  3240 x 5760 = 18.7M px
//
// Fabric owns the multiplication (enableRetinaScaling is on by default and
// multiplies the logical page size by fabric.devicePixelRatio), so the honest
// fix is to hand Fabric a device pixel ratio that keeps the bitmap inside the
// budget. No manual width/height math is introduced anywhere — Fabric remains
// the single owner of the document coordinate system, exactly as
// docs/studio-scaling-inventory.md requires.
//
// The budget below is deliberately half of WebKit's hard ceiling: Fabric
// allocates THREE bitmaps of this size per canvas (lower, upper, and the
// object cache), so 8.39M px each (~33MB) keeps the total near 100MB, well
// inside the per-tab canvas memory WebKit will hand out on a phone. At this
// budget a 1080x1920 story renders at ratio 2 (2160x3840) and a 1080x1080
// square at ratio ~2.7 — still retina-sharp, never blank.
const MS_MAX_CANVAS_BITMAP_PX = 8388608; // 2048 x 4096

function msStudioSafeRetinaRatio(width, height) {
  const dpr = (typeof window !== 'undefined' && window.devicePixelRatio) || 1;
  const area = Math.max(1, (Number(width) || 1) * (Number(height) || 1));
  const budgetRatio = Math.sqrt(MS_MAX_CANVAS_BITMAP_PX / area);
  const capped = Math.min(dpr, budgetRatio);
  // The page fits at the device's own ratio: hand that back untouched, so a
  // 1.25x or 1.5x display keeps exactly the sharpness the browser intends.
  if (capped >= dpr) return Math.max(1, dpr);
  // The page had to be capped. Quantise DOWN to a half-step so the bitmap
  // lands on whole pixels — a fractional ratio truncates the canvas width
  // attribute while the context is still scaled by the fraction, which
  // crops a sliver off the right and bottom edge of the artboard.
  // Never below 1: the bitmap must not be smaller than the logical page.
  return Math.max(1, Math.floor(capped * 2) / 2);
}
window.msStudioSafeRetinaRatio = msStudioSafeRetinaRatio;

// Applies the budget to Fabric's global ratio. MUST run before `new
// fabric.Canvas(...)` and before every setDimensions() call, because both
// read fabric.devicePixelRatio at that moment to size the bitmap.
function msStudioApplyRetinaBudget(width, height) {
  const fabric = window.fabric;
  if (!fabric) return 1;
  const ratio = msStudioSafeRetinaRatio(width, height);
  fabric.devicePixelRatio = ratio;
  if (typeof window.studioDebugPush === 'function') {
    const px = Math.round(width * ratio) * Math.round(height * ratio);
    window.studioDebugPush(`retina dpr=${(window.devicePixelRatio || 1)} eff=${ratio.toFixed(2)} bitmap=${Math.round(width * ratio)}x${Math.round(height * ratio)} (${(px / 1e6).toFixed(1)}Mpx)`);
  }
  return ratio;
}
window.msStudioApplyRetinaBudget = msStudioApplyRetinaBudget;

class StudioFabricAdapter {
  constructor(canvasEl, options = {}) {
    this.canvasEl = canvasEl;
    this.options = options;
    this.fabricCanvas = null;
    this.currentScene = null;
    this.currentVehicle = null;
    this.undoStack = [];
    this.redoStack = [];
    this.isRendering = false;
    this.activeBreakpoint = 'desktop';
    this.activePageId = null;
    this.animationFrame = null;
  }

  async init(scene, vehicle = null) {
    const fabric = await loadFabricJs();
    this.currentScene = this.normalizeScene(scene || window.msCreateDefaultScene());
    this.currentVehicle = vehicle;

    if (this.fabricCanvas) {
      this.fabricCanvas.dispose();
    }

    // Size the retina bitmap to the budget BEFORE the canvas exists — Fabric
    // reads fabric.devicePixelRatio inside the constructor.
    msStudioApplyRetinaBudget(this.currentScene.width, this.currentScene.height);

    this.fabricCanvas = new fabric.Canvas(this.canvasEl, {
      width: this.currentScene.width,
      height: this.currentScene.height,
      backgroundColor: this.currentScene.background?.color || '#0F172A',
      preserveObjectStacking: true,
      selection: true,
      allowTouchScrolling: false,
      enablePointerEvents: true
    });
    if (this.fabricCanvas.upperCanvasEl) this.fabricCanvas.upperCanvasEl.style.touchAction = 'none';
    if (this.fabricCanvas.wrapperEl) this.fabricCanvas.wrapperEl.style.touchAction = 'none';

    this.bindEvents();
    await this.renderScene(this.currentScene);
    this.startAnimationLoop();
  }

  normalizeScene(scene) {
    if (window.msStudioSceneToDocument && window.msStudioDocumentToScene) {
      return window.msStudioDocumentToScene(window.msStudioSceneToDocument(scene));
    }
    return scene || window.msCreateDefaultScene();
  }

  startAnimationLoop() {
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    const tick = (time) => {
      const objects = this.fabricCanvas?.getObjects?.() || [];
      objects.forEach(object => {
        const animation = object.msData?.animation;
        if (!animation || animation === 'none') return;
        object.__animationBase ||= { left: object.left || 0, top: object.top || 0, angle: object.angle || 0, opacity: object.opacity ?? 1, scaleX: object.scaleX || 1, scaleY: object.scaleY || 1 };
        const base = object.__animationBase;
        const duration = Number(animation.duration || 1600);
        const phase = (time % duration) / duration;
        const wave = Math.sin(phase * Math.PI * 2);
        if (animation.type === 'float') object.set({ top: base.top + wave * 12 });
        else if (animation.type === 'pulse') object.set({ opacity: base.opacity * (0.78 + (wave + 1) * 0.11), scaleX: base.scaleX * (1 + wave * 0.035), scaleY: base.scaleY * (1 + wave * 0.035) });
        else if (animation.type === 'spin') object.set({ angle: base.angle + phase * 360 });
        else if (animation.type === 'bounce') object.set({ top: base.top - Math.max(0, wave) * 24 });
        else if (animation.type === 'fade') object.set({ opacity: 0.45 + (wave + 1) * 0.25 });
      });
      this.fabricCanvas?.requestRenderAll();
      this.animationFrame = requestAnimationFrame(tick);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  setSelectedAnimation(type = 'none', duration = 1600) {
    const object = this.fabricCanvas?.getActiveObject();
    if (!object) return false;
    if (type === 'none') { delete object.msData.animation; delete object.__animationBase; }
    else { object.msData = { ...(object.msData || {}), animation: { type, duration: Math.max(300, Number(duration) || 1600) } }; object.__animationBase = { left: object.left || 0, top: object.top || 0, angle: object.angle || 0, opacity: object.opacity ?? 1, scaleX: object.scaleX || 1, scaleY: object.scaleY || 1 }; }
    this.saveHistory(); this.fabricCanvas.requestRenderAll(); return true;
  }

  nudgeSelected(dx = 0, dy = 0) {
    const active = this.fabricCanvas?.getActiveObject();
    if (!active || active.lockMovementX || active.lockMovementY) return false;
    active.set({ left: (active.left || 0) + dx, top: (active.top || 0) + dy });
    active.setCoords();
    this.fabricCanvas.requestRenderAll();
    this.saveHistory();
    return true;
  }

  bindEvents() {
    if (!this.fabricCanvas) return;

    this.fabricCanvas.on('object:moving', event => this.snapMovingObject(event.target));
    this.fabricCanvas.on('object:modified', () => this.saveHistory());
    this.fabricCanvas.on('object:added', () => { if (!this.isRendering) this.saveHistory(); });
    this.fabricCanvas.on('object:removed', () => { if (!this.isRendering) this.saveHistory(); });

    this.fabricCanvas.on('selection:created', (e) => this.onSelectionChange(e.selected));
    this.fabricCanvas.on('selection:updated', (e) => this.onSelectionChange(e.selected));
    this.fabricCanvas.on('selection:cleared', () => this.onSelectionChange([]));
    this.fabricCanvas.on('path:created', (e) => {
      if (e.path) e.path.msData = { type: 'shape', shapeType: window.__studioDrawingTool || 'pencil', name: 'Freehand drawing' };
      this.saveHistory();
    });
  }

  onSelectionChange(selected) {
    if (typeof this.options.onSelection === 'function') {
      this.options.onSelection(selected);
    }
  }

  snapMovingObject(object) {
    if (!object || object.msData?.repeaterPreview || object.msData?.snapDisabled) return;
    const width = this.fabricCanvas?.getWidth?.() || 0;
    const height = this.fabricCanvas?.getHeight?.() || 0;
    const objectWidth = object.getScaledWidth?.() || object.width || 0;
    const objectHeight = object.getScaledHeight?.() || object.height || 0;
    const left = object.left || 0;
    const top = object.top || 0;
    const targetsX = [0, width / 2 - objectWidth / 2, width - objectWidth];
    const targetsY = [0, height / 2 - objectHeight / 2, height - objectHeight];
    const snap = (value, targets) => { const match = targets.find(target => Math.abs(value - target) <= 8); return match == null ? value : match; };
    object.set({ left: snap(left, targetsX), top: snap(top, targetsY) });
  }

  saveHistory() {
    if (this.isRendering) return;
    const json = JSON.stringify(this.exportScene());
    this.undoStack.push(json);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    if (typeof this.options.onStateChange === 'function') this.options.onStateChange();
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop();
    this.redoStack.push(current);
    const prev = this.undoStack[this.undoStack.length - 1];
    if (prev) this.renderScene(JSON.parse(prev));
  }

  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop();
    this.undoStack.push(next);
    this.renderScene(JSON.parse(next));
  }

  async renderScene(scene) {
    if (!this.fabricCanvas) return;
    this.isRendering = true;
    scene = this.normalizeScene(scene);
    this.currentScene = scene;
    const fabric = window.fabric;
    const shadowFor = (value) => value ? new fabric.Shadow({ color: value.color || 'rgba(15,23,42,.28)', blur: Number(value.blur ?? 18), offsetX: Number(value.offsetX ?? 0), offsetY: Number(value.offsetY ?? 8) }) : null;
    const page = Array.isArray(scene.pages) ? (scene.pages.find(p => p.id === this.activePageId) || scene.pages[0]) : null;
    if (page) this.activePageId = page.id;
    const pageWidth = page?.width || scene.width || 1080;
    const pageHeight = page?.height || scene.height || 1080;
    const pageBackground = page?.background?.color || scene.background?.color || '#0F172A';
    // Re-apply the bitmap budget for THIS page's size: a square page and a
    // story page get different safe ratios, and setDimensions re-allocates
    // the backing store from fabric.devicePixelRatio as it is right now.
    msStudioApplyRetinaBudget(pageWidth, pageHeight);
    this.fabricCanvas.setDimensions({ width: pageWidth, height: pageHeight });
    const artboard = document.getElementById('studio-artboard-container');
    if (artboard) { artboard.style.width = `${pageWidth}px`; artboard.style.height = `${pageHeight}px`; }

    this.fabricCanvas.clear();
    this.fabricCanvas.setBackgroundColor(pageBackground, () => this.fabricCanvas.renderAll());

    const elements = [...(page?.objects || scene.elements || scene.layers || [])];
    const repeaters = Array.isArray(scene.components) ? scene.components.filter(component => component.type === 'repeater') : [];
    if (repeaters.length) {
      let inventory = (typeof window !== 'undefined' && Array.isArray(window.__catalogCache)) ? window.__catalogCache : [];
      if (!inventory.length && typeof apiGetJson === 'function') {
        try { const data = await apiGetJson('/inventory/all'); inventory = Array.isArray(data) ? data : (data?.vehicles || data?.inventory || []); } catch (_) { inventory = []; }
      }
      repeaters.forEach((repeater, repeaterIndex) => {
        inventory.slice(0, 3).forEach((vehicle, index) => {
          const x = 60 + index * 330;
          const y = 80 + repeaterIndex * 260;
          elements.push({ type: 'shape', shapeType: 'rect', x, y, width: 290, height: 210, fill: '#172554', rx: 18, opacity: .96, name: `${repeater.name} card`, repeaterPreview: true });
          elements.push({ type: 'text', x: x + 18, y: y + 24, width: 250, text: `${vehicle.year || ''} ${vehicle.make || ''} ${vehicle.model || 'Vehicle'}`.trim(), fontSize: 22, fontWeight: '800', fill: '#FFFFFF', name: `${repeater.name} title`, repeaterPreview: true });
          elements.push({ type: 'text', x: x + 18, y: y + 78, width: 250, text: vehicle.price ? `$${Number(vehicle.price).toLocaleString()}` : 'Price available', fontSize: 26, fontWeight: '900', fill: '#67E8F9', name: `${repeater.name} price`, repeaterPreview: true });
          elements.push({ type: 'text', x: x + 18, y: y + 136, width: 250, text: vehicle.stock_number || vehicle.stock_no || 'Inventory item', fontSize: 16, fontWeight: '600', fill: '#CBD5E1', name: `${repeater.name} stock`, repeaterPreview: true });
        });
      });
    }
    for (const rawEl of elements) {
      const el = window.msStudioResolveObject ? window.msStudioResolveObject(rawEl, this.activeBreakpoint) : rawEl;
      if (el.type === 'text') {
        const textVal = window.msResolveTemplateVars ? window.msResolveTemplateVars(el.text, { vehicle: this.currentVehicle }) : (el.text || '');
        const txt = new fabric.Textbox(textVal, {
          left: el.x ?? el.left ?? 100,
          top: el.y ?? el.top ?? 100,
          width: el.width || 400,
          fontSize: el.fontSize || 36,
          fontWeight: el.fontWeight || '700',
          fill: el.fill || '#FFFFFF',
          angle: el.rotation || 0,
          opacity: el.opacity ?? 1,
          fontFamily: el.fontFamily || 'Manrope, sans-serif',
          lineHeight: el.lineHeight || 1.08,
          charSpacing: el.charSpacing || 0,
          textAlign: el.textAlign || 'left'
        });
        if (el.shadow) txt.set('shadow', shadowFor(el.shadow));
        txt.msData = el;
        txt.set({ selectable: el.locked !== true, evented: el.locked !== true, visible: el.visible !== false, lockMovementX: el.locked === true, lockMovementY: el.locked === true, lockScalingX: el.locked === true, lockScalingY: el.locked === true, lockRotation: el.locked === true });
        this.fabricCanvas.add(txt);
      } else if (el.type === 'shape') {
        let shapeObj;
        if (el.shapeType === 'circle') {
          shapeObj = new fabric.Circle({
            radius: (el.width || 200) / 2,
            fill: el.fill || '#2563EB',
            left: el.x ?? el.left ?? 100,
            top: el.y ?? el.top ?? 100
          });
        } else if (el.shapeType === 'ellipse') {
          shapeObj = new fabric.Ellipse({ left: el.x ?? 100, top: el.y ?? 100, rx: (el.width || 300) / 2, ry: (el.height || 180) / 2, fill: el.fill || '#2563EB' });
        } else if (el.shapeType === 'triangle') {
          shapeObj = new fabric.Triangle({ left: el.x ?? 100, top: el.y ?? 100, width: el.width || 260, height: el.height || 230, fill: el.fill || '#2563EB' });
        } else if (Array.isArray(el.points) && el.points.length > 2) {
          shapeObj = new fabric.Polygon(el.points, { left: el.x ?? 100, top: el.y ?? 100, fill: el.fill || '#2563EB', stroke: el.stroke || null, strokeWidth: el.strokeWidth || 0 });
        } else if (el.path) {
          shapeObj = new fabric.Path(el.path, { left: el.x ?? 100, top: el.y ?? 100, fill: el.fill || '', stroke: el.stroke || el.fill || '#2563EB', strokeWidth: el.strokeWidth || 6, strokeLineCap: 'round', strokeLineJoin: 'round' });
        } else {
          shapeObj = new fabric.Rect({
            left: el.x ?? el.left ?? 100,
            top: el.y ?? el.top ?? 100,
            width: el.width || 300,
            height: el.height || 150,
            fill: el.fill || '#2563EB',
            rx: el.rx || 16,
            ry: el.rx || 16
          });
        }
        shapeObj.set({ angle: el.rotation || 0, opacity: el.opacity ?? 1, selectable: el.locked !== true, evented: el.locked !== true, visible: el.visible !== false, lockMovementX: el.locked === true, lockMovementY: el.locked === true, lockScalingX: el.locked === true, lockScalingY: el.locked === true, lockRotation: el.locked === true });
        if (el.shadow) shapeObj.set('shadow', shadowFor(el.shadow));
        if (el.gradient?.colors?.length >= 2) {
          shapeObj.set('fill', new fabric.Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: shapeObj.width || el.width || 300, y2: shapeObj.height || el.height || 200 }, colorStops: el.gradient.colors.map((color, index, all) => ({ offset: index / (all.length - 1), color })) }));
        }
        shapeObj.msData = el;
        this.fabricCanvas.add(shapeObj);
      } else if (el.type === 'video' && el.src) {
        await this.addVideo(el.src, el.name || 'Video', { left: el.x, top: el.y, width: el.width, opacity: el.opacity, restoring: true }).catch(() => {});
      } else if ((el.type === 'vehicle-image' || el.type === 'image') && (el.src || this.currentVehicle?.primary_photo_url)) {
        const imgSrc = el.src || this.currentVehicle?.primary_photo_url;
        // Two-pass load: with crossOrigin first (so we can export later),
        // fall back without crossOrigin (Unsplash sometimes strips ACAO
        // on staging), then a solid gradient placeholder so a failed
        // image never leaves a huge invisible rectangle covering the
        // whole template — which was the root cause of "canvas is white
        // but 15 objects loaded" on iPhone.
        const tryLoad = (opts) => new Promise(resolve => fabric.Image.fromURL(imgSrc, (img) => resolve(img && img.width > 0 && img.height > 0 ? img : null), opts));
        let img = await tryLoad({ crossOrigin: 'anonymous' });
        if (!img) img = await tryLoad({});
        if (img) {
          img.set({ left: el.x ?? el.left ?? 100, top: el.y ?? el.top ?? 100, angle: el.rotation || 0, opacity: el.opacity ?? 1 });
          if (el.width && el.height) { img.scaleToWidth(el.width); img.scaleToHeight(el.height); }
          else if (img.width > 500) img.scaleToWidth(500);
          img.msData = el;
          if (el.shadow) img.set('shadow', shadowFor(el.shadow));
          img.set({ selectable: el.locked !== true, evented: el.locked !== true, visible: el.visible !== false, flipX: el.flipX === true, flipY: el.flipY === true, lockMovementX: el.locked === true, lockMovementY: el.locked === true, lockScalingX: el.locked === true, lockScalingY: el.locked === true, lockRotation: el.locked === true });
          this.applyImageAdjustments(img, el.adjustments || {});
          this.fabricCanvas.add(img);
        } else {
          // Placeholder: gradient rect so the template layout is visible
          // even when the underlying photo host blocks the fetch.
          const w = el.width || 400, h = el.height || 300;
          const rect = new fabric.Rect({
            left: el.x ?? 0, top: el.y ?? 0, width: w, height: h,
            angle: el.rotation || 0, opacity: el.opacity ?? 1,
            fill: new fabric.Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: w, y2: h }, colorStops: [{ offset: 0, color: '#4F46E5' }, { offset: 1, color: '#0EA5E9' }] }),
            rx: 12, ry: 12,
          });
          rect.msData = { ...el, placeholder: true };
          this.fabricCanvas.add(rect);
          if (typeof window !== 'undefined' && typeof window.studioDebugPush === 'function') window.studioDebugPush(`img placeholder for ${el.name || 'image'} (src blocked)`);
        }
      }
    }

    this.fabricCanvas.renderAll();
    this.isRendering = false;
    this.verifyBitmapPainted(pageWidth, pageHeight);
  }

  // Safety net for the blank-artboard failure. WebKit refuses an oversized
  // canvas backing store WITHOUT throwing, so a clean renderAll() is no
  // evidence that a single pixel reached the screen — the symptom is a canvas
  // that is in the DOM, reports its objects, and shows nothing. This samples
  // the bitmap after paint: if every sampled pixel is fully transparent while
  // the scene has objects, the allocation failed, so fall back to a 1:1
  // bitmap (the smallest any device will refuse to grant) and paint again.
  // Runs at most once per adapter, never touches the scene, and gives up
  // quietly when the canvas is tainted by a non-CORS image (getImageData
  // throws there, and a tainted canvas is one that definitely did paint).
  verifyBitmapPainted(pageWidth, pageHeight) {
    if (this.__retinaFallbackApplied) return;
    const push = (msg) => { if (typeof window !== 'undefined' && typeof window.studioDebugPush === 'function') window.studioDebugPush(msg); };
    setTimeout(() => {
      try {
        const fc = this.fabricCanvas;
        if (!fc || this.isRendering || !fc.getObjects || !fc.getObjects().length) return;
        const el = fc.lowerCanvasEl;
        const ctx = el && el.getContext && el.getContext('2d');
        if (!ctx || !el.width || !el.height) return;
        let painted = false;
        for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.75], [0.5, 0.12], [0.5, 0.88]]) {
          const x = Math.min(el.width - 1, Math.max(0, Math.floor(el.width * fx)));
          const y = Math.min(el.height - 1, Math.max(0, Math.floor(el.height * fy)));
          if (ctx.getImageData(x, y, 1, 1).data[3] !== 0) { painted = true; break; }
        }
        if (painted) return;
        this.__retinaFallbackApplied = true;
        push(`bitmap blank at ${el.width}x${el.height} — falling back to 1:1`);
        if (window.fabric) window.fabric.devicePixelRatio = 1;
        fc.setDimensions({ width: pageWidth || fc.getWidth(), height: pageHeight || fc.getHeight() });
        fc.calcOffset();
        fc.renderAll();
      } catch (_) {
        // Tainted canvas (a photo loaded without CORS) or no 2D context.
        // Both mean the probe cannot answer; leave the render alone.
        push('bitmap probe unavailable');
      }
    }, 260);
  }

  exportScene() {
    if (!this.fabricCanvas) return this.currentScene;
    const objects = this.fabricCanvas.getObjects().filter(obj => !obj.msData?.repeaterPreview);
    const elements = objects.map((obj, idx) => {
      const ms = obj.msData || {};
      return {
        id: ms.id || `el-${idx + 1}`,
        type: ms.type || (obj.type === 'textbox' ? 'text' : obj.type === 'image' ? 'image' : 'shape'),
        shapeType: ms.shapeType || 'rect',
        x: Math.round(obj.left || 0),
        y: Math.round(obj.top || 0),
        width: Math.round(obj.width * (obj.scaleX || 1)),
        height: Math.round(obj.height * (obj.scaleY || 1)),
        rotation: Math.round(obj.angle || 0),
        opacity: obj.opacity ?? 1,
        text: obj.text || ms.text || '',
        src: typeof obj.getSrc === 'function' ? obj.getSrc() : (ms.src || undefined),
        fill: typeof obj.fill === 'string' ? obj.fill : (ms.fill || '#FFFFFF'),
        gradient: ms.gradient || undefined,
        fontSize: obj.fontSize || ms.fontSize || 24,
        fontWeight: obj.fontWeight || ms.fontWeight || '700',
        stroke: obj.stroke || ms.stroke || null,
        strokeWidth: obj.strokeWidth || ms.strokeWidth || 0,
        points: Array.isArray(obj.points) ? obj.points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })) : undefined,
        path: obj.path ? obj.path.map(command => command.slice()) : undefined,
        rx: obj.rx || ms.rx || 0,
        z: idx + 1,
        name: ms.name || `Object ${idx + 1}`,
        responsive: ms.responsive || undefined,
        binding: ms.binding || undefined,
        constraints: ms.constraints || undefined,
        locked: obj.lockMovementX === true || ms.locked === true,
        visible: obj.visible !== false,
        flipX: obj.flipX === true,
        flipY: obj.flipY === true,
        adjustments: ms.adjustments || undefined,
        animation: ms.animation || undefined,
        fontFamily: obj.fontFamily || ms.fontFamily || undefined,
        lineHeight: obj.lineHeight || ms.lineHeight || undefined,
        charSpacing: obj.charSpacing || ms.charSpacing || undefined,
        textAlign: obj.textAlign || ms.textAlign || undefined,
        shadow: obj.shadow ? { color: obj.shadow.color, blur: Number(obj.shadow.blur || 0), offsetX: Number(obj.shadow.offsetX || 0), offsetY: Number(obj.shadow.offsetY || 0) } : (ms.shadow || undefined),
        children: obj.type === 'group' ? obj.getObjects().map(child => ({ type: child.type, text: child.text || '', name: child.msData?.name || child.type })) : undefined
      };
    });

    return {
      version: Math.max(3, Number(this.currentScene.version) || 0),
      format_key: this.currentScene.format_key || 'square',
      width: this.fabricCanvas.width,
      height: this.fabricCanvas.height,
      background: { color: this.fabricCanvas.backgroundColor || '#0F172A' },
      elements,
      pages: this.currentScene.pages ? this.currentScene.pages.map(page => page.id === this.activePageId ? { ...page, objects: elements } : page) : undefined,
      breakpoint: this.activeBreakpoint,
      metadata: this.currentScene.metadata || {},
      components: this.currentScene.components || [],
      assets: this.currentScene.assets || []
    };
  }

  setBreakpoint(breakpoint = 'desktop') {
    if (!['desktop', 'tablet', 'mobile'].includes(breakpoint)) return;
    this.activeBreakpoint = breakpoint;
    if (this.currentScene) this.renderScene(this.currentScene);
    if (typeof this.options.onBreakpointChange === 'function') this.options.onBreakpointChange(breakpoint);
  }

  setPage(pageId) {
    if (!this.currentScene?.pages?.some(page => page.id === pageId)) return;
    this.activePageId = pageId;
    this.renderScene(this.currentScene);
  }

  addText(text = 'New Text', options = {}) {
    if (!this.fabricCanvas) return;
    const fabric = window.fabric;
    const center = this.fabricCanvas.getCenter();
    const txt = new fabric.Textbox(text, {
      left: options.x || options.left || center.left - 150,
      top: options.y || options.top || center.top - 25,
      width: options.width || 350,
      fontSize: options.fontSize || 36,
      fontWeight: options.fontWeight || '800',
      fill: options.fill || '#FFFFFF',
      fontFamily: options.fontFamily || 'Manrope, sans-serif',
      textAlign: options.textAlign || 'left',
      lineHeight: options.lineHeight || 1.08,
      charSpacing: options.charSpacing || 0,
      angle: Number(options.angle || options.rotation) || 0,
      originX: options.originX || 'left',
      originY: options.originY || 'top'
    });
    txt.msData = { type: 'text', name: options.name || text.slice(0, 20), ...(options.textTemplateId ? { textTemplateId: options.textTemplateId } : {}), ...(options.premadeId ? { premadeId: options.premadeId } : {}) };
    this.fabricCanvas.add(txt);
    this.fabricCanvas.setActiveObject(txt);
    this.fabricCanvas.renderAll();
    this.saveHistory();
    this.onSelectionChange([txt]);
  }

  updateSelectedText(properties = {}) {
    if (!this.fabricCanvas) return false;
    const active = this.fabricCanvas.getActiveObject();
    if (!active || !['textbox', 'text', 'i-text'].includes(active.type)) return false;
    active.set(properties);
    active.setCoords();
    this.fabricCanvas.requestRenderAll();
    this.saveHistory();
    this.onSelectionChange([active]);
    return true;
  }

  updateSelected(properties = {}) {
    if (!this.fabricCanvas) return false;
    const active = this.fabricCanvas.getActiveObject();
    if (!active) return false;
    active.set(properties);
    active.setCoords();
    this.fabricCanvas.requestRenderAll();
    this.saveHistory();
    this.onSelectionChange([active]);
    return true;
  }

  setSelectedShadow(preset = 'none') {
    const active = this.fabricCanvas?.getActiveObject();
    if (!active || !window.fabric?.Shadow) return false;
    const presets = {
      soft: { color: 'rgba(15,23,42,.24)', blur: 20, offsetX: 0, offsetY: 9 },
      lift: { color: 'rgba(15,23,42,.32)', blur: 34, offsetX: 0, offsetY: 18 },
      glow: { color: 'rgba(37,99,235,.52)', blur: 26, offsetX: 0, offsetY: 0 }
    };
    const value = presets[preset] || null;
    active.set('shadow', value ? new window.fabric.Shadow(value) : null);
    active.msData = { ...(active.msData || {}), shadow: value || undefined };
    active.setCoords(); this.fabricCanvas.requestRenderAll(); this.saveHistory(); this.onSelectionChange([active]);
    return true;
  }

  toggleSelectedLock(force) {
    const active = this.fabricCanvas?.getActiveObject(); if (!active) return false;
    const locked = typeof force === 'boolean' ? force : !active.lockMovementX;
    active.set({ lockMovementX: locked, lockMovementY: locked, lockScalingX: locked, lockScalingY: locked, lockRotation: locked, selectable: !locked, evented: !locked });
    active.msData = { ...(active.msData || {}), locked };
    if (locked) this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.requestRenderAll(); this.saveHistory(); return locked;
  }

  toggleSelectedVisibility(force) {
    const active = this.fabricCanvas?.getActiveObject(); if (!active) return false;
    const visible = typeof force === 'boolean' ? force : active.visible === false;
    active.set({ visible }); active.msData = { ...(active.msData || {}), visible };
    this.fabricCanvas.discardActiveObject(); this.fabricCanvas.requestRenderAll(); this.saveHistory(); return visible;
  }

  alignSelected(axis = 'center') {
    const active = this.fabricCanvas?.getActiveObject(); if (!active) return false;
    const cw = this.fabricCanvas.getWidth(), ch = this.fabricCanvas.getHeight();
    const w = active.getScaledWidth(), h = active.getScaledHeight();
    const patch = axis === 'left' ? { left: 0 } : axis === 'right' ? { left: cw - w } : axis === 'top' ? { top: 0 } : axis === 'bottom' ? { top: ch - h } : axis === 'middle' ? { top: (ch - h) / 2 } : { left: (cw - w) / 2 };
    active.set(patch); active.setCoords(); this.fabricCanvas.requestRenderAll(); this.saveHistory(); return true;
  }

  distributeSelected(axis = 'horizontal') {
    const active = this.fabricCanvas?.getActiveObject();
    const objects = active?.type === 'activeSelection' ? active.getObjects() : [];
    if (objects.length < 3) return false;
    const horizontal = axis === 'horizontal';
    const sorted = objects.slice().sort((a, b) => (horizontal ? a.left - b.left : a.top - b.top));
    const start = horizontal ? sorted[0].left : sorted[0].top;
    const end = horizontal ? sorted.at(-1).left : sorted.at(-1).top;
    sorted.forEach((object, index) => object.set(horizontal ? { left: start + (end - start) * index / (sorted.length - 1) } : { top: start + (end - start) * index / (sorted.length - 1) }));
    this.fabricCanvas.requestRenderAll(); this.saveHistory(); return true;
  }

  applyImageAdjustments(image, adjustments = {}) {
    if (!image || image.type !== 'image' || !window.fabric?.Image?.filters) return false;
    const f = window.fabric.Image.filters, filters = [];
    if (Number(adjustments.brightness)) filters.push(new f.Brightness({ brightness: Math.max(-1, Math.min(1, Number(adjustments.brightness))) }));
    if (Number(adjustments.contrast)) filters.push(new f.Contrast({ contrast: Math.max(-1, Math.min(1, Number(adjustments.contrast))) }));
    if (Number(adjustments.saturation)) filters.push(new f.Saturation({ saturation: Math.max(-1, Math.min(1, Number(adjustments.saturation))) }));
    if (Number(adjustments.blur)) filters.push(new f.Blur({ blur: Math.max(0, Math.min(1, Number(adjustments.blur))) }));
    image.filters = filters; image.applyFilters(); image.msData = { ...(image.msData || {}), adjustments: { ...adjustments } }; return true;
  }

  adjustSelectedImage(adjustments = {}) {
    const image = this.fabricCanvas?.getActiveObject(); if (!image || image.type !== 'image') return false;
    this.applyImageAdjustments(image, { ...(image.msData?.adjustments || {}), ...adjustments });
    this.fabricCanvas.requestRenderAll(); this.saveHistory(); return true;
  }

  setDrawingMode(tool = 'pencil', options = {}) {
    if (!this.fabricCanvas || !window.fabric) return;
    window.__studioDrawingTool = tool;
    this.fabricCanvas.discardActiveObject();
    this.fabricCanvas.isDrawingMode = true;
    const brush = new window.fabric.PencilBrush(this.fabricCanvas);
    brush.color = options.color || '#2563EB';
    brush.width = tool === 'pen' ? 12 : 4;
    brush.decimate = tool === 'pen' ? 2 : 0.8;
    this.fabricCanvas.freeDrawingBrush = brush;
    this.fabricCanvas.requestRenderAll();
  }

  stopDrawingMode() {
    if (!this.fabricCanvas) return;
    this.fabricCanvas.isDrawingMode = false;
    window.__studioDrawingTool = null;
    this.fabricCanvas.defaultCursor = 'default';
  }

  resizeCanvas(width, height) {
    if (!this.fabricCanvas) return;
    const oldWidth = this.fabricCanvas.width || width;
    const oldHeight = this.fabricCanvas.height || height;
    const scaleX = width / oldWidth;
    const scaleY = height / oldHeight;
    const uniform = Math.min(scaleX, scaleY);
    this.fabricCanvas.getObjects().forEach(object => {
      const centerX = ((object.left || 0) + object.getScaledWidth() / 2) / oldWidth;
      const centerY = ((object.top || 0) + object.getScaledHeight() / 2) / oldHeight;
      const isBackground = /background|panel/i.test(object.msData?.name || '') && (object.left || 0) < oldWidth * 0.08 && (object.top || 0) < oldHeight * 0.08;
      if (isBackground) {
        object.set({ left: 0, top: 0, scaleX: (object.scaleX || 1) * scaleX, scaleY: (object.scaleY || 1) * scaleY });
      } else {
        object.scaleX = (object.scaleX || 1) * uniform;
        object.scaleY = (object.scaleY || 1) * uniform;
        object.left = centerX * width - object.getScaledWidth() / 2;
        object.top = centerY * height - object.getScaledHeight() / 2;
      }
      object.setCoords();
    });
    msStudioApplyRetinaBudget(width, height);
    this.fabricCanvas.setDimensions({ width, height });
    this.currentScene.width = width; this.currentScene.height = height;
    this.fabricCanvas.requestRenderAll();
    this.saveHistory();
  }

  toggleNodeEditing() {
    const object = this.fabricCanvas?.getActiveObject();
    if (!object || object.type !== 'polygon' || !Array.isArray(object.points)) return null;
    object.edit = !object.edit;
    object.hasBorders = !object.edit;
    object.cornerStyle = 'circle';
    object.cornerColor = '#38BDF8';
    object.transparentCorners = false;
    if (object.edit) {
      const controls = {};
      object.points.forEach((point, index) => {
        controls[`p${index}`] = new window.fabric.Control({
          positionHandler: (_dim, _matrix, target) => {
            const x = target.points[index].x - target.pathOffset.x;
            const y = target.points[index].y - target.pathOffset.y;
            return window.fabric.util.transformPoint(new window.fabric.Point(x, y), window.fabric.util.multiplyTransformMatrices(target.canvas.viewportTransform, target.calcTransformMatrix()));
          },
          actionHandler: (_event, transform, x, y) => {
            const target = transform.target;
            const local = target.toLocalPoint(new window.fabric.Point(x, y), 'center', 'center');
            const base = target._getNonTransformedDimensions();
            const size = target._getTransformedDimensions(0, 0);
            target.points[index] = { x: local.x * base.x / size.x + target.pathOffset.x, y: local.y * base.y / size.y + target.pathOffset.y };
            target.dirty = true;
            return true;
          },
          actionName: 'modifyPolygon'
        });
      });
      object.controls = controls;
    } else {
      object.controls = window.fabric.Object.prototype.controls;
    }
    this.fabricCanvas.requestRenderAll();
    return object.edit;
  }

  addShape(shapeType = 'rect', fill = '#2563EB') {
    if (!this.fabricCanvas) return;
    const fabric = window.fabric;
    const center = this.fabricCanvas.getCenter();
    let shape;
    const regularPoints = (sides, radius = 120) => Array.from({ length: sides }, (_, i) => {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / sides;
      return { x: radius + Math.cos(angle) * radius, y: radius + Math.sin(angle) * radius };
    });
    const starPoints = Array.from({ length: 10 }, (_, i) => {
      const radius = i % 2 ? 55 : 120;
      const angle = -Math.PI / 2 + i * Math.PI / 5;
      return { x: 120 + Math.cos(angle) * radius, y: 120 + Math.sin(angle) * radius };
    });
    if (shapeType === 'circle') {
      shape = new fabric.Circle({
        left: center.left - 100,
        top: center.top - 100,
        radius: 100,
        fill: fill
      });
    } else if (shapeType === 'ellipse') {
      shape = new fabric.Ellipse({ left: center.left - 150, top: center.top - 90, rx: 150, ry: 90, fill });
    } else if (shapeType === 'triangle') {
      shape = new fabric.Triangle({ left: center.left - 120, top: center.top - 110, width: 240, height: 220, fill });
    } else if (['diamond', 'pentagon', 'hexagon', 'star'].includes(shapeType)) {
      const points = shapeType === 'star' ? starPoints : regularPoints(shapeType === 'diamond' ? 4 : shapeType === 'pentagon' ? 5 : 6);
      shape = new fabric.Polygon(points, { left: center.left - 120, top: center.top - 120, fill, strokeWidth: 0 });
    } else if (shapeType === 'line' || shapeType === 'arrow') {
      const path = shapeType === 'arrow' ? 'M 0 50 L 220 50 M 170 0 L 220 50 L 170 100' : 'M 0 0 L 240 0';
      shape = new fabric.Path(path, { left: center.left - 120, top: center.top - 50, fill: '', stroke: fill, strokeWidth: 10, strokeLineCap: 'round', strokeLineJoin: 'round' });
    } else if (shapeType === 'heart') {
      shape = new fabric.Path('M 120 210 C 30 150 0 100 20 55 C 45 5 105 20 120 65 C 135 20 195 5 220 55 C 240 100 210 150 120 210 Z', { left: center.left - 120, top: center.top - 110, fill });
    } else if (shapeType === 'speech') {
      shape = new fabric.Polygon([{x:0,y:0},{x:260,y:0},{x:260,y:150},{x:80,y:150},{x:35,y:205},{x:45,y:150},{x:0,y:150}], { left: center.left - 130, top: center.top - 100, fill });
    } else if (shapeType === 'badge') {
      shape = new fabric.Rect({
        left: center.left - 140,
        top: center.top - 35,
        width: 280,
        height: 70,
        fill: fill,
        rx: 35,
        ry: 35
      });
    } else {
      shape = new fabric.Rect({
        left: center.left - 150,
        top: center.top - 100,
        width: 300,
        height: 200,
        fill: fill,
        rx: 16,
        ry: 16
      });
    }
    shape.msData = { type: 'shape', shapeType, name: shapeType.toUpperCase() };
    // Freeform transform: every shape can be rotated, scaled on either
    // axis independently, AND skewed by dragging the side handles with
    // shift. Uniform locks + skew locks stay OFF so nothing is
    // permanently rigid. Rotation handle stays visible so touch users
    // have a distinct control to grab. User rule: "every shape can
    // transform freeform".
    shape.set({
      lockUniScaling: false,
      lockScalingFlip: false,
      lockScalingX: false,
      lockScalingY: false,
      lockRotation: false,
      lockSkewingX: false,
      lockSkewingY: false,
      hasRotatingPoint: true,
      centeredRotation: true,
      centeredScaling: false,
    });
    if (typeof shape.setControlsVisibility === 'function') {
      shape.setControlsVisibility({
        tl: true, tr: true, bl: true, br: true, // corner scale (any axis)
        ml: true, mr: true, mt: true, mb: true, // side handles (skew with shift)
        mtr: true,                              // rotation handle
      });
    }
    this.fabricCanvas.add(shape);
    this.fabricCanvas.setActiveObject(shape);
    this.fabricCanvas.renderAll();
    this.saveHistory();
    this.onSelectionChange([shape]);
  }

  addImage(url, name = 'Image') {
    if (!this.fabricCanvas || !url) return Promise.resolve(null);
    const fabric = window.fabric;
    const center = this.fabricCanvas.getCenter();
    // Some SVG hosts (iconify included, on some clients) do not send
    // CORS headers reliably. Try WITH crossOrigin first (so the canvas
    // stays untainted for export), then fall back to WITHOUT so the
    // element still lands on the artboard rather than silently
    // vanishing — the historical bug that caused "elements don't show
    // up on canvas". The fallback path just cannot be exported through
    // toDataURL, which this app never does (renders happen server-side).
    const load = (crossOrigin) => new Promise((resolve) => {
      const opts = crossOrigin ? { crossOrigin: 'anonymous' } : {}
      try {
        fabric.Image.fromURL(url, (img) => resolve(img || null), opts)
      } catch { resolve(null) }
    })
    return (async () => {
      let img = await load(true)
      if (!img) img = await load(false)
      if (!img) return null
      img.set({ left: center.left - 200, top: center.top - 150 })
      if (img.width > 400) img.scaleToWidth(400)
      img.msData = { type: 'image', src: url, name }
      this.fabricCanvas.add(img)
      this.fabricCanvas.setActiveObject(img)
      this.fabricCanvas.renderAll()
      this.saveHistory()
      return img
    })()
  }

  async addVideo(url, name = 'Video', options = {}) {
    if (!this.fabricCanvas || !url) return;
    const video = document.createElement('video');
    // No crossOrigin here on purpose: this app never reads pixel data back off the
    // canvas client-side (saveStudioDesign/renderStudioDesignAndPublish both send the
    // scene JSON to a backend renderer, never canvas.toDataURL()), so there's nothing
    // that needs a CORS-clean canvas. Setting crossOrigin='anonymous' against a video
    // CDN that doesn't return CORS headers for its files (Pexels' does not) makes the
    // browser reject the load outright — the video never plays, never mind renders on
    // the artboard. Without it, the video loads and draws normally.
    video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'metadata';
    video.src = url;
    await new Promise((resolve, reject) => {
      video.addEventListener('loadeddata', resolve, { once: true });
      video.addEventListener('error', () => reject(new Error('Video could not be loaded')), { once: true });
      video.load();
    });
    // Unlike <img>, whose .width/.height fall back to intrinsic size when unset,
    // <video>.width/.height reflect the (never-set) content attributes and default
    // to 0. fabric.Image reads element.width/.height at construction, so without
    // this the video object gets added at 0×0 — invisible on the canvas, no error,
    // no feedback, "nothing happens when you click Add". loadeddata guarantees
    // videoWidth/videoHeight are populated, so copy them across first.
    video.width = video.videoWidth;
    video.height = video.videoHeight;
    const center = this.fabricCanvas.getCenter();
    const object = new window.fabric.Image(video, {
      left: options.left ?? center.left - 200, top: options.top ?? center.top - 120,
      opacity: options.opacity ?? 1, objectCaching: false
    });
    if (options.width) object.scaleToWidth(options.width); else if (object.width > 480) object.scaleToWidth(480);
    object.msData = { type: 'video', src: url, name };
    this.fabricCanvas.add(object);
    if (!options.restoring) this.fabricCanvas.setActiveObject(object);
    const canvas = this.fabricCanvas;
    const paint = () => {
      if (!canvas || !canvas.getObjects().includes(object) || !document.getElementById('ms-studio-master-modal')) return;
      canvas.requestRenderAll();
      requestAnimationFrame(paint);
    };
    video.play().then(() => requestAnimationFrame(paint)).catch(() => {});
    canvas.requestRenderAll();
    if (!options.restoring) this.saveHistory();
  }

  deleteSelected() {
    if (!this.fabricCanvas) return;
    const active = this.fabricCanvas.getActiveObjects();
    if (active && active.length) {
      active.forEach(obj => this.fabricCanvas.remove(obj));
      this.fabricCanvas.discardActiveObject();
      this.fabricCanvas.renderAll();
      this.saveHistory();
    }
  }

  bringForward() {
    const active = this.fabricCanvas?.getActiveObject();
    if (active) { this.fabricCanvas.bringForward(active); this.fabricCanvas.renderAll(); this.saveHistory(); }
  }

  sendBackwards() {
    const active = this.fabricCanvas?.getActiveObject();
    if (active) { this.fabricCanvas.sendBackwards(active); this.fabricCanvas.renderAll(); this.saveHistory(); }
  }

  bringToFront() {
    const active = this.fabricCanvas?.getActiveObject();
    if (active) { this.fabricCanvas.bringToFront(active); this.fabricCanvas.renderAll(); this.saveHistory(); }
  }

  sendToBack() {
    const active = this.fabricCanvas?.getActiveObject();
    if (active) { this.fabricCanvas.sendToBack(active); this.fabricCanvas.renderAll(); this.saveHistory(); }
  }

  // Places a clone offset from the source so it's visibly a new object, not
  // overlapping it exactly. Handles a multi-object ActiveSelection the same way
  // Fabric's own docs recommend (re-add each member, then re-select them together).
  _placeClone(cloned) {
    this.fabricCanvas.discardActiveObject();
    cloned.set({ left: (cloned.left || 0) + 24, top: (cloned.top || 0) + 24, evented: true });
    if (cloned.type === 'activeSelection') {
      cloned.canvas = this.fabricCanvas;
      cloned.forEachObject(obj => this.fabricCanvas.add(obj));
      cloned.setCoords();
    } else {
      this.fabricCanvas.add(cloned);
    }
    this.fabricCanvas.setActiveObject(cloned);
    this.fabricCanvas.requestRenderAll();
    this.saveHistory();
  }

  duplicateSelected() {
    const active = this.fabricCanvas?.getActiveObject();
    if (!active) return;
    active.clone(cloned => this._placeClone(cloned));
  }

  copySelected() {
    const active = this.fabricCanvas?.getActiveObject();
    if (!active) return;
    active.clone(cloned => { this._clipboard = cloned; });
  }

  pasteClipboard() {
    if (!this.fabricCanvas || !this._clipboard) return;
    this._clipboard.clone(cloned => this._placeClone(cloned));
  }

  cutSelected() {
    if (!this.fabricCanvas?.getActiveObject()) return;
    this.copySelected();
    this.deleteSelected();
  }

  groupSelected() {
    const active = this.fabricCanvas?.getActiveObject();
    if (!active || active.type !== 'activeSelection') return;
    const group = active.toGroup();
    group.msData = { ...(group.msData || {}), type: 'component', name: 'Reusable component' };
    this.fabricCanvas.setActiveObject(group);
    this.fabricCanvas.requestRenderAll();
    this.saveHistory();
  }

  ungroupSelected() {
    const active = this.fabricCanvas?.getActiveObject();
    if (!active || active.type !== 'group') return;
    const selection = active.toActiveSelection();
    this.fabricCanvas.setActiveObject(selection);
    this.fabricCanvas.requestRenderAll();
    this.saveHistory();
  }
}

window.StudioFabricAdapter = StudioFabricAdapter;
