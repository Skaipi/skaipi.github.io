import { DEFAULT_PALETTE_ID, getPalette } from "./palettes.js";

const DEFAULT_COLORS = getPalette(DEFAULT_PALETTE_ID).colors;

const NODE_RADIUS = 14;
const NODE_BORDER_SCALE = 1.25;

function project(point, plane) {
  return {
    x: plane.left + point.x * plane.width + point.y * plane.skew,
    y: plane.top + point.y * plane.height,
  };
}

export class Painter {
  constructor(canvasModel, config = {}) {
    const { context, width, height } = canvasModel;

    this.ctx = context;
    this.width = width;
    this.height = height;

    this.nodeRadius = config.nodeRadius ?? NODE_RADIUS;
    this.nodeBorderScale = config.nodeBorderScale ?? NODE_BORDER_SCALE;
    this.skewFactor = config.nodeSkewFactor ?? 0.2;

    this.setColors(config.colors);
  }

  resize(canvasModel) {
    const { context, width, height } = canvasModel;

    this.ctx = context;
    this.width = width;
    this.height = height;
  }

  setColors(colors = {}) {
    this.colors = { ...DEFAULT_COLORS, ...colors };
  }

  draw(model, planes) {
    this.ctx.fillStyle = this.colors.BACKGROUND;
    this.ctx.fillRect(0, 0, this.width, this.height);

    const planesCount = planes.length;

    for (let level = planesCount - 1; level >= 0; level -= 1) {
      this.drawPlane(planes[level]);
    }

    this.drawPromotionLinks(model, planes);

    for (let level = planesCount - 1; level >= 0; level -= 1) {
      this.drawLayerGraph(model.layers[level], planes[level]);
    }
  }

  downloadPng(filename = "hnsw-render.png") {
    const canvas = this.ctx.canvas;

    canvas.toBlob((blob) => {
      if (!blob) return;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      setTimeout(() => URL.revokeObjectURL(url), 0);
    }, "image/png");
  }

  drawPlane(plane) {
    this.ctx.save();

    this.ctx.beginPath();
    this.ctx.moveTo(plane.left, plane.top);
    this.ctx.lineTo(plane.left + plane.width, plane.top);
    this.ctx.lineTo(plane.left + plane.width + plane.skew, plane.top + plane.height);
    this.ctx.lineTo(plane.left + plane.skew, plane.top + plane.height);
    this.ctx.closePath();

    this.ctx.fillStyle = this.colors.SURFACE;
    this.ctx.globalAlpha = 0.88;
    this.ctx.fill();

    this.ctx.globalAlpha = 0.7;
    this.ctx.strokeStyle = this.colors.SURFACE_STROKE;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();

    this.ctx.restore();
  }

  drawPromotionLinks(model, planes) {
    this.ctx.save();

    this.ctx.strokeStyle = this.colors.LINK;
    this.ctx.globalAlpha = 0.55;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 8]);

    const planesCount = planes.length;

    for (let level = 1; level < planesCount; level += 1) {
      const upperPlane = planes[level];
      const lowerPlane = planes[level - 1];

      for (const point of model.layers[level].nodes) {
        const upperPoint = project(point, upperPlane);
        const lowerPoint = project(point, lowerPlane);

        this.ctx.beginPath();
        this.ctx.moveTo(upperPoint.x, upperPoint.y);
        this.ctx.lineTo(lowerPoint.x, lowerPoint.y);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  drawLayerGraph(layer, plane) {
    const nodeById = new Map(layer.nodes.map((node) => [node.id, node]));

    this.ctx.save();

    this.ctx.strokeStyle = this.colors.EDGE;
    this.ctx.globalAlpha = 0.88;
    this.ctx.lineWidth = 1.6;

    for (const edge of layer.edges) {
      const source = project(nodeById.get(edge.source), plane);
      const target = project(nodeById.get(edge.target), plane);

      this.ctx.beginPath();
      this.ctx.moveTo(source.x, source.y);
      this.ctx.lineTo(target.x, target.y);
      this.ctx.stroke();
    }

    this.ctx.restore();

    for (const node of layer.nodes) {
      this.drawNode(project(node, plane), node.maxLayer > layer.level);
    }
  }

  drawNode(point, isPromoted) {
    const radiusX = this.nodeRadius;
    const radiusY = this.nodeRadius * this.skewFactor;

    const borderWidth = 2;

    this.ctx.save();

    this.ctx.beginPath();
    this.ctx.ellipse(point.x, point.y, radiusX + borderWidth, radiusY + borderWidth, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = this.colors.EDGE;
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.ellipse(point.x, point.y, radiusX, radiusY, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = isPromoted ? this.colors.PROMOTED_NODE : this.colors.NODE;
    this.ctx.fill();

    this.ctx.restore();
  }
}
