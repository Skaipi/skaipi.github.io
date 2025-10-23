const isNeighbour = (p1, p2) => {
  if (p1 == null || p2 == null) return false;

  let found = false;
  p2?.neighbours.forEach((n) => {
    if (isTheSamePoint(p1, n)) found = true;
  });

  return found;
};

const isTheSamePoint = (p1, p2) => {
  return p1?.x === p2?.x && p1?.y === p2?.y;
};

export class Painter {
  constructor(context, config = {}) {
    this.ctx = context;
    this.BACKGROUND_COLOR = config.backgroundColor ?? "#0D1117";
    this.SITE_COLOR = config.siteColor ?? "#FFC857";
    this.VORONOI_EDGE_COLOR = config.voronoiEdgeColor ?? "#2CB67D";
    this.SPECIAL_SITE_COLOR = "#e1e8ed";
  }

  drawBackground = () => {
    this.ctx.fillStyle = this.BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  };

  drawSites = (nodes) => {
    this.ctx.fillStyle = this.SITE_COLOR;
    for (let i = 0; i < nodes.length; i++) {
      const site = nodes[i];

      this.ctx.beginPath();
      this.ctx.fillStyle = this.VORONOI_EDGE_COLOR;
      this.ctx.arc(site.x, site.y, 10, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.fillStyle = this.SITE_COLOR;
      this.ctx.arc(site.x, site.y, 8, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1;
  };

  drawEdges = (edges, points) => {
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = this.VORONOI_EDGE_COLOR;

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const p1 = points[edge.source];
      const p2 = points[edge.target];

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.closePath();
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
  };
}
