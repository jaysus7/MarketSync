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
        shapeObj.msData = el;
        this.fabricCanvas.add(shapeObj);
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
        fill: obj.fill || ms.fill || '#FFFFFF',
        fontSize: obj.fontSize || ms.fontSize || 24,
        fontWeight: obj.fontWeight || ms.fontWeight || '700',
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

  addShape(shapeType = 'rect', fill = '#2563EB') {
    if (!this.fabricCanvas) return;
    const fabric = window.fabric;
    const center = this.fabricCanvas.getCenter();
    let shape;
    if (shapeType === 'circle') {
      shape = new fabric.Circle({
        left: center.left - 100,
        top: center.top - 100,
        radius: 100,
        fill: fill
      });
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
}

window.StudioFabricAdapter = StudioFabricAdapter;
