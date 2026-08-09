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


function project(point, plane) {
  return {
    x: plane.left + point.x * plane.width + point.y * plane.skew,
    y: plane.top + point.y * plane.height,
  };
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

export class Painter {
  constructor(context, config = {}) {
    this.ctx = context;
    this.BACKGROUND_COLOR = config.backgroundColor ?? COLORS.BACKGROUND;
    this.GRID_COLOR = config.edgeColor ?? COLORS.EDGE;
  }

  draw(model, canvas) {
    const { context, width, height } = resizeCanvas(canvas);
    const planes = createLayerPlanes(width, height);

    this.ctx.fillStyle = COLORS.BACKGROUND;
    this.ctx.fillRect(0, 0, width, height);

    for (let level = LAYER_COUNT - 1; level >= 0; level -= 1) {
      drawPlane(planes[level], level);
    }

    drawPromotionLinks(model, planes);

    for (let level = LAYER_COUNT - 1; level >= 0; level -= 1) {
      drawLayerGraph(model.layers[level], planes[level]);
    }
  }

  drawPlane(plane, layer) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.moveTo(plane.left, plane.top);
    this.ctx.lineTo(plane.left + plane.width, plane.top);
    this.ctx.lineTo(plane.left + plane.width + plane.skew, plane.top + plane.height);
    this.ctx.lineTo(plane.left + plane.skew, plane.top + plane.height);
    this.ctx.closePath();
    this.ctx.fillStyle = COLORS.SURFACE;
    this.ctx.globalAlpha = 0.88;
    this.ctx.fill();
    this.ctx.globalAlpha = 0.7;
    this.ctx.strokeStyle = COLORS.SURFACE_STROKE;
    this.ctx.lineWidth = 1.5;
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawPromotionLinks(model, planes) {
    this.ctx.save();
    this.ctx.strokeStyle = COLORS.LINK;
    this.ctx.globalAlpha = 0.55;
    this.ctx.lineWidth = 2;
    this.ctx.setLineDash([8, 8]);

    for (let level = 1; level < LAYER_COUNT; level += 1) {
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
    this.ctx.strokeStyle = COLORS.EDGE;
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
      drawNode(project(node, plane), node.maxLayer > layer.level);
    }
  }

  drawNode(point, isPromoted) {
    this.ctx.save();
    this.ctx.beginPath();
    this.ctx.ellipse(point.x, point.y, 8.5, 6.5, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = COLORS.EDGE;
    this.ctx.globalAlpha = 0.95;
    this.ctx.fill();

    this.ctx.beginPath();
    this.ctx.ellipse(point.x, point.y, 6.8, 5, 0, 0, Math.PI * 2);
    this.ctx.fillStyle = isPromoted ? COLORS.PROMOTED_NODE : COLORS.NODE;
    this.ctx.globalAlpha = 1;
    this.ctx.fill();
    this.ctx.restore();
  }
}