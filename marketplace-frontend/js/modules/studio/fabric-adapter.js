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
  }

  async init(scene, vehicle = null) {
    const fabric = await loadFabricJs();
    this.currentScene = scene || window.msCreateDefaultScene();
    this.currentVehicle = vehicle;

    if (this.fabricCanvas) {
      this.fabricCanvas.dispose();
    }

    this.fabricCanvas = new fabric.Canvas(this.canvasEl, {
      width: this.currentScene.width,
      height: this.currentScene.height,
      backgroundColor: this.currentScene.background?.color || '#0F172A',
      preserveObjectStacking: true,
      selection: true
    });

    this.bindEvents();
    await this.renderScene(this.currentScene);
  }

  bindEvents() {
    if (!this.fabricCanvas) return;

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

  saveHistory() {
    if (this.isRendering) return;
    const json = JSON.stringify(this.exportScene());
    this.undoStack.push(json);
    if (this.undoStack.length > 30) this.undoStack.shift();
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
    this.currentScene = scene;
    const fabric = window.fabric;

    this.fabricCanvas.setDimensions({ width: scene.width || 1080, height: scene.height || 1080 });

    this.fabricCanvas.clear();
    this.fabricCanvas.setBackgroundColor(scene.background?.color || '#0F172A', () => this.fabricCanvas.renderAll());

    const elements = scene.elements || scene.layers || [];
    for (const el of elements) {
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
          fontFamily: el.fontFamily || 'Manrope, sans-serif'
        });
        txt.msData = el;
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
        shapeObj.set({ angle: el.rotation || 0, opacity: el.opacity ?? 1 });
        if (el.gradient?.colors?.length >= 2) {
          shapeObj.set('fill', new fabric.Gradient({ type: 'linear', gradientUnits: 'pixels', coords: { x1: 0, y1: 0, x2: shapeObj.width || el.width || 300, y2: shapeObj.height || el.height || 200 }, colorStops: el.gradient.colors.map((color, index, all) => ({ offset: index / (all.length - 1), color })) }));
        }
        shapeObj.msData = el;
        this.fabricCanvas.add(shapeObj);
      } else if (el.type === 'video' && el.src) {
        await this.addVideo(el.src, el.name || 'Video', { left: el.x, top: el.y, width: el.width, opacity: el.opacity, restoring: true }).catch(() => {});
      } else if ((el.type === 'vehicle-image' || el.type === 'image') && (el.src || this.currentVehicle?.primary_photo_url)) {
        const imgSrc = el.src || this.currentVehicle?.primary_photo_url;
        await new Promise((resolve) => {
          fabric.Image.fromURL(imgSrc, (img) => {
            if (img) {
              img.set({
                left: el.x ?? el.left ?? 100,
                top: el.y ?? el.top ?? 100,
                angle: el.rotation || 0,
                opacity: el.opacity ?? 1
              });
              if (el.width && el.height) {
                img.scaleToWidth(el.width);
                img.scaleToHeight(el.height);
              } else if (img.width > 500) {
                img.scaleToWidth(500);
              }
              img.msData = el;
              this.fabricCanvas.add(img);
            }
            resolve();
          }, { crossOrigin: 'anonymous' });
        });
      }
    }

    this.fabricCanvas.renderAll();
    this.isRendering = false;
  }

  exportScene() {
    if (!this.fabricCanvas) return this.currentScene;
    const objects = this.fabricCanvas.getObjects();
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
        name: ms.name || `Object ${idx + 1}`
      };
    });

    return {
      version: 1,
      format_key: this.currentScene.format_key || 'square',
      width: this.fabricCanvas.width,
      height: this.fabricCanvas.height,
      background: { color: this.fabricCanvas.backgroundColor || '#0F172A' },
      elements
    };
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
      fontFamily: 'Manrope, sans-serif'
    });
    txt.msData = { type: 'text', name: text.slice(0, 20) };
    this.fabricCanvas.add(txt);
    this.fabricCanvas.setActiveObject(txt);
    this.fabricCanvas.renderAll();
    this.saveHistory();
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
    this.fabricCanvas.add(shape);
    this.fabricCanvas.setActiveObject(shape);
    this.fabricCanvas.renderAll();
    this.saveHistory();
  }

  addImage(url, name = 'Image') {
    if (!this.fabricCanvas) return;
    const fabric = window.fabric;
    const center = this.fabricCanvas.getCenter();
    fabric.Image.fromURL(url, (img) => {
      if (!img) return;
      img.set({
        left: center.left - 200,
        top: center.top - 150
      });
      if (img.width > 400) img.scaleToWidth(400);
      img.msData = { type: 'image', src: url, name };
      this.fabricCanvas.add(img);
      this.fabricCanvas.setActiveObject(img);
      this.fabricCanvas.renderAll();
      this.saveHistory();
    }, { crossOrigin: 'anonymous' });
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
