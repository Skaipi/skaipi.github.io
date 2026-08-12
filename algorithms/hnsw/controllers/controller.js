import { Painter } from "../drawing.js";
import { createHnswModel } from "../models/hnswGraph.js";
import { DEFAULT_PALETTE_ID, getPalette } from "../palettes.js";

export class Controller {
  constructor(canvas, { paletteId = DEFAULT_PALETTE_ID } = {}) {
    this.canvas = canvas;
    this.canvasModel = resizeCanvas(canvas);
    this.model = createHnswModel({ width: this.canvasModel.width, height: this.canvasModel.height });
    this.painter = new Painter(this.canvasModel, { colors: getPalette(paletteId).colors });

    this._state = { paletteId: getPalette(paletteId).id };
    this.state = new Proxy(this._state, {
      set: (target, key, value) => {
        const nextValue = key === "paletteId" ? getPalette(value).id : value;
        const prevValue = target[key];

        if (nextValue === prevValue) return true;

        target[key] = nextValue;

        if (key === "paletteId") {
          this.draw();
        }

        return true;
      },
    });
  }

  get paletteId() {
    return this.state.paletteId;
  }

  changePalette(id) {
    this.state.paletteId = id;
  }

  draw() {
    const palette = getPalette(this.state.paletteId);

    this.canvas.style.backgroundColor = palette.colors.BACKGROUND;
    this.painter.setColors(palette.colors);
    this.painter.draw(this.model);
  }

  resize() {
    this.canvasModel = resizeCanvas(this.canvas);
    this.painter.resize(this.canvasModel);
    this.draw();
  }

  downloadRender() {
    this.painter.downloadPng(this.model);
  }
}

function resizeCanvas(canvas) {
  const header = document.getElementsByTagName("header")[0];
  const headerHeight = header?.offsetHeight ?? 0;
  const targetHeight = Math.max(430, window.innerHeight - headerHeight);

  canvas.style.height = `${targetHeight}px`;

  const rect = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * pixelRatio));
  canvas.height = Math.max(1, Math.round(rect.height * pixelRatio));

  const context = canvas.getContext("2d");
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

  return { context, width: rect.width, height: rect.height };
}
