/**
 * Photo Viewer — large zoomable/pannable image window for information cards.
 * Lets the table study a card's photograph up close to find hidden details.
 * Supports wheel zoom (toward the cursor), drag pan, pinch zoom, double-click
 * zoom toggle, and a reset control.
 * @module components/photo-viewer
 */

const { ApplicationV2 } = foundry.applications.api;

const MIN_SCALE = 1;
const MAX_SCALE = 8;
const DOUBLE_CLICK_SCALE = 2.5;
const ZOOM_SENSITIVITY = 0.0018;

/**
 * Full-size photo window with zoom and pan.
 */
export class PhotoViewer extends ApplicationV2 {
  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['neon-relic', 'photo-viewer'],
    position: { width: 960, height: 720 },
    window: { resizable: true, title: 'NEONRELIC.PhotoViewer.Title' },
    actions: {
      resetView: PhotoViewer.#onResetView,
    },
  };

  /**
   * @param {object} [options]
   * @param {string} options.src   Image path to display.
   * @param {string} [options.name] Card/document name for the window title.
   */
  constructor(options = {}) {
    super(options);
    this.src = options.src;
    this.photoName = options.name ?? '';
    this.scale = MIN_SCALE;
    this.tx = 0;
    this.ty = 0;
    this._baseWidth = 0;
    this._baseHeight = 0;
    this._stage = null;
    this._image = null;
    this._zoomLabel = null;
    this._resizeObserver = null;
    this._pointers = new Map();
    this._dragStart = null;
    this._pinchStart = null;
    this.options.window.title = game.i18n.format('NEONRELIC.PhotoViewer.Title', {
      name: this.photoName || game.i18n.localize('NEONRELIC.PhotoViewer.FallbackName'),
    });
  }

  /* ------------------------------------------ */
  /*  Rendering                                  */
  /* ------------------------------------------ */

  /** @override */
  async _renderHTML() {
    const stage = document.createElement('div');
    stage.className = 'photo-stage';

    const img = document.createElement('img');
    img.className = 'photo-image';
    img.src = this.src;
    img.alt = this.photoName;
    img.draggable = false;

    const toolbar = document.createElement('div');
    toolbar.className = 'photo-toolbar';
    const zoomLabel = document.createElement('span');
    zoomLabel.className = 'photo-zoom';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.className = 'photo-reset';
    reset.dataset.action = 'resetView';
    const resetIcon = document.createElement('i');
    resetIcon.className = 'fa-solid fa-arrows-rotate';
    reset.append(resetIcon, document.createTextNode(` ${game.i18n.localize('NEONRELIC.PhotoViewer.Reset')}`));
    toolbar.append(zoomLabel, reset);

    const hint = document.createElement('div');
    hint.className = 'photo-hint';
    hint.textContent = game.i18n.localize('NEONRELIC.PhotoViewer.Hint');

    stage.append(img, toolbar, hint);
    this._stage = stage;
    this._image = img;
    this._zoomLabel = zoomLabel;

    return stage;
  }

  /** @override */
  _onRender() {
    const stage = this._stage;
    const img = this._image;
    if (!stage || !img) return;

    img
      .decode?.()
      .catch(() => {})
      .finally(() => {
        this.#fit();
        this.#reset();
      });

    stage.addEventListener('wheel', this.#onWheel.bind(this), { passive: false });
    stage.addEventListener('pointerdown', this.#onPointerDown.bind(this));
    stage.addEventListener('pointermove', this.#onPointerMove.bind(this));
    stage.addEventListener('pointerup', this.#onPointerUp.bind(this));
    stage.addEventListener('pointercancel', this.#onPointerUp.bind(this));
    stage.addEventListener('dblclick', this.#onDoubleClick.bind(this));
    stage.addEventListener('contextmenu', event => event.preventDefault());

    this._resizeObserver = new ResizeObserver(() => {
      this.#fit();
      this.#clamp();
      this.#apply();
    });
    this._resizeObserver.observe(stage);
  }

  /** @override */
  _onClose() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._pointers.clear();
  }

  /* ------------------------------------------ */
  /*  Sizing / transform math                    */
  /* ------------------------------------------ */

  /** Fit the image into the stage (contain) and record its base size. */
  #fit() {
    const stage = this._stage;
    const img = this._image;
    if (!stage || !img?.naturalWidth) return;
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    if (!sw || !sh) return;
    const fitScale = Math.min(sw / img.naturalWidth, sh / img.naturalHeight);
    this._baseWidth = img.naturalWidth * fitScale;
    this._baseHeight = img.naturalHeight * fitScale;
    img.style.width = `${this._baseWidth}px`;
    img.style.height = `${this._baseHeight}px`;
  }

  /** Keep the image inside the stage bounds (centered on axes that fit). */
  #clamp() {
    const stage = this._stage;
    if (!stage) return;
    const sw = stage.clientWidth;
    const sh = stage.clientHeight;
    const dw = this._baseWidth * this.scale;
    const dh = this._baseHeight * this.scale;
    this.tx = dw <= sw ? (sw - dw) / 2 : Math.clamp(this.tx, sw - dw, 0);
    this.ty = dh <= sh ? (sh - dh) / 2 : Math.clamp(this.ty, sh - dh, 0);
  }

  /** Apply transform + zoom label. */
  #apply() {
    if (this._image) {
      this._image.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    }
    if (this._zoomLabel) {
      this._zoomLabel.textContent = game.i18n.format('NEONRELIC.PhotoViewer.ZoomLabel', {
        percent: Math.round(this.scale * 100),
      });
    }
  }

  /** Reset to fit view. */
  #reset() {
    this.scale = MIN_SCALE;
    this.#clamp();
    this.#apply();
  }

  /** Zoom toward a point (stage-local px). */
  #zoomAt(nextScale, mx, my) {
    const next = Math.clamp(nextScale, MIN_SCALE, MAX_SCALE);
    if (next === this.scale) return;
    const k = next / this.scale;
    this.tx = mx - k * (mx - this.tx);
    this.ty = my - k * (my - this.ty);
    this.scale = next;
    this.#clamp();
    this.#apply();
  }

  /* ------------------------------------------ */
  /*  Input handlers                             */
  /* ------------------------------------------ */

  #onWheel(event) {
    event.preventDefault();
    const stage = this._stage;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    this.#zoomAt(this.scale * Math.exp(-event.deltaY * ZOOM_SENSITIVITY), mx, my);
  }

  #onPointerDown(event) {
    const stage = this._stage;
    if (!stage) return;
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    stage.setPointerCapture?.(event.pointerId);

    if (this._pointers.size === 1) {
      this._dragStart = { x: event.clientX, y: event.clientY, tx: this.tx, ty: this.ty };
      stage.classList.add('grabbing');
    } else if (this._pointers.size === 2) {
      this._dragStart = null;
      const [a, b] = [...this._pointers.values()];
      this._pinchStart = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        scale: this.scale,
      };
    }
  }

  #onPointerMove(event) {
    const stage = this._stage;
    if (!stage || !this._pointers.has(event.pointerId)) return;
    this._pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this._pointers.size === 2 && this._pinchStart) {
      const [a, b] = [...this._pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (this._pinchStart.distance > 0) {
        const rect = stage.getBoundingClientRect();
        const mx = (a.x + b.x) / 2 - rect.left;
        const my = (a.y + b.y) / 2 - rect.top;
        this.#zoomAt(this._pinchStart.scale * (distance / this._pinchStart.distance), mx, my);
      }
      return;
    }

    if (this._dragStart && this.scale > MIN_SCALE) {
      this.tx = this._dragStart.tx + (event.clientX - this._dragStart.x);
      this.ty = this._dragStart.ty + (event.clientY - this._dragStart.y);
      this.#clamp();
      this.#apply();
    }
  }

  #onPointerUp(event) {
    const stage = this._stage;
    this._pointers.delete(event.pointerId);
    stage?.releasePointerCapture?.(event.pointerId);
    if (this._pointers.size < 2) this._pinchStart = null;
    if (this._pointers.size === 0) {
      this._dragStart = null;
      stage?.classList.remove('grabbing');
    } else if (this._pointers.size === 1) {
      const [p] = [...this._pointers.values()];
      this._dragStart = { x: p.x, y: p.y, tx: this.tx, ty: this.ty };
    }
  }

  #onDoubleClick(event) {
    const stage = this._stage;
    if (!stage) return;
    if (this.scale > MIN_SCALE + 0.01) {
      this.#reset();
      return;
    }
    const rect = stage.getBoundingClientRect();
    this.#zoomAt(DOUBLE_CLICK_SCALE, event.clientX - rect.left, event.clientY - rect.top);
  }

  /* ── Actions ────────────────────────────────── */

  /** Reset the view to its fitted state. */
  static #onResetView() {
    this.#reset();
  }
}
