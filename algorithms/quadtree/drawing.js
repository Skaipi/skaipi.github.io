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

  drawSites = (sites) => {
    this.ctx.fillStyle = this.SITE_COLOR;
    for (let i = 0; i < sites.length; i++) {
      const site = sites[i];

      this.ctx.beginPath();
      this.ctx.fillStyle = this.SITE_COLOR;
      this.ctx.arc(site.x, site.y, 2, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();
    }

    this.ctx.globalAlpha = 1;
  };

  drawTree(tree) {
    this.ctx.strokeStyle = this.VORONOI_EDGE_COLOR;
    this.ctx.lineWidth = 1;

    const unvisitedNodes = [tree.root];
    while (unvisitedNodes.length > 0) {
      const node = unvisitedNodes.shift();
      if (node.points.length === 0) continue;
      console.log(node);

      this.ctx.beginPath();
      this.ctx.rect(node.boundary.x0, node.boundary.y0, node.boundary.x1 - node.boundary.x0, node.boundary.y1 - node.boundary.y0);
      this.ctx.stroke();
      this.ctx.closePath();

      for (const child of node.children || []) {
        unvisitedNodes.push(child);
      }
    }
  }
}