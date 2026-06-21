export class Painter {
  constructor(context, config = {}) {
    this.ctx = context;
    this.BACKGROUND_COLOR = config.backgroundColor ?? "#0D1117";
    this.SITE_COLOR = config.siteColor ?? "#FFC857";
    this.GRID_COLOR = config.gridColor ?? "#2CB67D";
  }

  drawBackground = () => {
    this.ctx.fillStyle = this.BACKGROUND_COLOR;
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  };

  drawTree = (tree) => {
    this.ctx.strokeStyle = this.GRID_COLOR;
    this.ctx.lineWidth = 0.66;

    const unvisitedNodes = [tree.root];
    while (unvisitedNodes.length > 0) {
      const node = unvisitedNodes.pop();

      for (const child of node.children) {
        unvisitedNodes.push(child);
      }

      if (node.points.length === 0 || node.children.length > 0) continue;

      this.ctx.beginPath();
      this.ctx.rect(
        node.boundary.x0,
        node.boundary.y0,
        node.boundary.x1 - node.boundary.x0,
        node.boundary.y1 - node.boundary.y0,
      );
      this.ctx.stroke();
      this.ctx.closePath();
    }
  };

  drawSites = (sites) => {
    this.ctx.fillStyle = this.SITE_COLOR;

    for (const site of sites) {
      this.ctx.beginPath();
      this.ctx.arc(site.x, site.y, 2, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();
    }
  };
}
