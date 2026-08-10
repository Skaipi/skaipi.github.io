"use strict";

import { Painter } from "./drawing.js";

const POINT_COUNT = 20;
const MIDDLE_LAYER_COUNT = 16;
const TOP_LAYER_COUNT = 4;
const LAYER_COUNT = 3;
const SKEW_FACTOR = 0.2;
const DISTRIBUTION_RATE = 1.4;

const COLORS = {
  BACKGROUND: "#0D1117",
  SURFACE: "#161B22",
  SURFACE_STROKE: "#B2B9BF",
  NODE: "#FFC857",
  PROMOTED_NODE: "#E1E8ED",
  EDGE: "#2CB67D",
  LINK: "#B2B9BF",
  TEXT: "#E1E8ED",
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function createPoints(count) {
  const points = [];

  for (let i = 0; i < count; i++) {
    const layer = parseInt(-Math.log(Math.random()) * DISTRIBUTION_RATE);

    const point = {
      id: points.length,
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      maxLayer: Math.min(layer, 2),
    };
    points.push(point);
  }

  return points;
}

function createHnswModel() {
  const points = createPoints(POINT_COUNT);

  const layers = [];
  for (let layer = 0; layer < LAYER_COUNT; layer += 1) {
    const nodes = points.filter((point) => point.maxLayer >= layer);
    layers.push({ level: layer, nodes, edges: createRngEdges(nodes) });
  }

  return { layers };
}

function createRngEdges(nodes) {
  const edges = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const source = nodes[i];
      const target = nodes[j];
      const distance = dist2(source, target);
      let isRelativeNeighbor = true;

      for (const point of nodes) {
        if (point.id === source.id || point.id === target.id) continue;

        if (dist2(source, point) < distance && dist2(target, point) < distance) {
          isRelativeNeighbor = false;
          break;
        }
      }

      if (isRelativeNeighbor) {
        edges.push({ source: source.id, target: target.id });
      }
    }
  }

  return edges;
}

function createLayerPlanes(width, height) {
  const marginX = width * 0.05;
  const skew = width * SKEW_FACTOR;
  const planeWidth = Math.max(220, width - marginX * 2 - skew);
  const planeHeight = clamp(height * 0.17, 72, 125);
  const topMargin = clamp(height * 0.06, 24, 44);
  const bottomMargin = 36;
  const gap = Math.max(42, (height - topMargin - bottomMargin - planeHeight * LAYER_COUNT) / (LAYER_COUNT - 1));
  const planes = [];

  for (let level = 0; level < LAYER_COUNT; level += 1) {
    const visualIndex = LAYER_COUNT - 1 - level;
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

window.addEventListener("load", () => {
  const canvas = document.getElementById("canvas");
  const downloadButton = document.getElementById("download-render");
  const model = createHnswModel();
  const canvasModel = resizeCanvas(canvas);

  const { context, width, height } = canvasModel;
  const planes = createLayerPlanes(width, height);

  const painter = new Painter(canvasModel);
  painter.draw(model, planes);

  downloadButton?.addEventListener("click", () => {
    painter.downloadPng();
  });

  window.addEventListener("resize", () => {
    const { context, width, height } = canvasModel;
    const planes = createLayerPlanes(width, height);

    painter.draw(model, planes);
  });
});

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
