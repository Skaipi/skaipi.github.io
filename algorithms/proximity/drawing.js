export class Painter {
  constructor(context, config = {}) {
    this.ctx = context;
    this.BACKGROUND_COLOR = config.backgroundColor ?? "#0D1117";
    this.SITE_COLOR = config.siteColor ?? "#FFC857";
    this.VORONOI_EDGE_COLOR = config.voronoiEdgeColor ?? "#2CB67D";
    this.SPECIAL_SITE_COLOR = "#e1e8ed";
    this.SITE_RADIUS = config.siteRadius ?? 4;
    this.EDGE_WIDTH = config.edgeWidth ?? 2;
  }

  drawBackground = () => {
    this.ctx.fillStyle = this.BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  };

  drawSites = (nodes, selectedSite) => {
    this.ctx.fillStyle = this.SITE_COLOR;
    for (let i = 0; i < nodes.length; i++) {
      const site = nodes[i];

      if (selectedSite === null || i === selectedSite) this.ctx.globalAlpha = 1;
      else this.ctx.globalAlpha = 0.1;

      this.ctx.beginPath();
      this.ctx.fillStyle = this.VORONOI_EDGE_COLOR;
      this.ctx.arc(site.x, site.y, this.SITE_RADIUS * 1.25, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();

      this.ctx.beginPath();
      this.ctx.fillStyle = this.SITE_COLOR;
      this.ctx.arc(site.x, site.y, this.SITE_RADIUS, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1;
  };

  drawEdges = (edges, points, selectedSite) => {
    this.ctx.lineWidth = this.EDGE_WIDTH;
    this.ctx.strokeStyle = this.VORONOI_EDGE_COLOR;

    for (let i = 0; i < edges.length; i++) {
      const edge = edges[i];
      const p1 = points[edge.source];
      const p2 = points[edge.target];

      if (selectedSite === null || edge.source === selectedSite) this.ctx.globalAlpha = 1;
      else this.ctx.globalAlpha = 0.1;

      this.ctx.beginPath();
      this.ctx.moveTo(p1.x, p1.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.closePath();
      this.ctx.stroke();
    }

    this.ctx.globalAlpha = 1;
  };
}
