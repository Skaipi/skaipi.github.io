import { deinterleave, morton16DecodeInt } from "./linearQuadtree.js";

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

  drawTree = (tree) => {
    this.ctx.strokeStyle = this.VORONOI_EDGE_COLOR;
    this.ctx.lineWidth = 1;

    const unvisitedNodes = [tree.root];
    while (unvisitedNodes.length > 0) {
      const node = unvisitedNodes.shift();
      for (const child of node.children || []) {
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

  drawLinearSites = (wrapper) => {
    const { x, y } = wrapper;
    this.ctx.fillStyle = this.SITE_COLOR;
    for (let i = 0; i < x.length; i++) {
      this.ctx.beginPath();
      this.ctx.fillStyle = this.SITE_COLOR;
      this.ctx.arc(x[i], y[i], 2, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();
    }
  };

  drawLinearTree(tree) {
    this.ctx.strokeStyle = this.VORONOI_EDGE_COLOR;
    this.ctx.lineWidth = 1;

    const drawNode = (cellIdx, x0, y0) => {
      console.log(cellIdx);
      const cell = tree.cells[cellIdx];
      console.log(cell);

      if (!cell || cell.children.length === 0) return;
      const cellSize = tree.size >>> cell.level;

      this.ctx.beginPath();
      this.ctx.rect(x0, y0, cellSize, cellSize);
      this.ctx.stroke();
      this.ctx.closePath();

      drawNode(cell.children[0], x0, y0);
      drawNode(cell.children[1], x0 + cellSize, y0);
      drawNode(cell.children[2], x0, y0 + cellSize);
      drawNode(cell.children[3], x0 + cellSize, y0 + cellSize);
    };

    drawNode(tree.root, 0, 0);
  }
}
