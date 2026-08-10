import { Painter } from "../drawing.js";
import { createHnswModel } from "../models/hnswGraph.js";
import { DEFAULT_PALETTE_ID, getPalette } from "../palettes.js";

const SKEW_FACTOR = 0.2;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class Controller {
  constructor(canvas, { paletteId = DEFAULT_PALETTE_ID } = {}) {
    this.canvas = canvas;
    this.model = createHnswModel();
    this.canvasModel = resizeCanvas(canvas);
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
    this.painter.draw(
      this.model,
      createLayerPlanes(this.canvasModel.width, this.canvasModel.height, this.model.layers.length),
    );
  }

  resize() {
    this.canvasModel = resizeCanvas(this.canvas);
    this.painter.resize(this.canvasModel);
    this.draw();
  }

  downloadRender() {
    this.painter.downloadPng();
  }
}

function createLayerPlanes(width, height, layerCount) {
  const marginX = width * 0.05;
  const skew = width * SKEW_FACTOR;
  const planeWidth = Math.max(220, width - marginX * 2 - skew);
  const planeHeight = clamp(height * 0.17, 72, 125);
  const topMargin = clamp(height * 0.06, 24, 44);
  const bottomMargin = 36;
  const gapCount = Math.max(1, layerCount - 1);
  const gap = Math.max(42, (height - topMargin - bottomMargin - planeHeight * layerCount) / gapCount);
  const planes = [];

  for (let level = 0; level < layerCount; level += 1) {
    const visualIndex = layerCount - 1 - level;
    planes[level] = {
      left: marginX,
      top: topMargin + visualIndex * (planeHeight + gap),
      width: planeWidth,
      height: planeHeight,
      skew,
    };
  }

  return planes;
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
