export class Painter {
  constructor(context, config = {}) {
    this.ctx = context;
    this.BACKGROUND_COLOR = config.backgroundColor ?? "#0D1117";
    this.SITE_COLOR = config.siteColor ?? "#FFC857";
    this.VORONOI_EDGE_COLOR = config.voronoiEdgeColor ?? "#2CB67D";
  }

  drawBackground = () => {
    this.ctx.fillStyle = this.BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  };

  drawSites = (sites) => {
    this.ctx.fillStyle = this.SITE_COLOR;
    for (let i = 0; i < sites.length; i++) {
      const p = sites[i];
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 6, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();
    }
  };

  drawDelaunay = (edges) => {
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = this.VORONOI_EDGE_COLOR;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      this.ctx.beginPath();
      this.ctx.moveTo(e.focusA.x, e.focusA.y);
      this.ctx.lineTo(e.focusB.x, e.focusB.y);
      this.ctx.closePath();
      this.ctx.stroke();
    }
  };

  drawVoronoi = (edges) => {
    this.ctx.lineWidth = 3;
    this.ctx.strokeStyle = this.VORONOI_EDGE_COLOR;
    for (let i = 0; i < edges.length; i++) {
      const e = edges[i];
      this.ctx.beginPath();
      this.ctx.moveTo(e.start.x, e.start.y);
      this.ctx.lineTo(e.end.x, e.end.y);
      this.ctx.closePath();
      this.ctx.stroke();
    }
  };
}
