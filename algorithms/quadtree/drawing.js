const FORCE_GRADIENT = Object.freeze([
  { stop: 0, color: Object.freeze([44, 182, 125]) },
  { stop: 0.55, color: Object.freeze([151, 205, 91]) },
  { stop: 1, color: Object.freeze([255, 200, 87]) },
]);

const clamp01 = (value) => Math.min(1, Math.max(0, value));

const mix = (from, to, amount) => Math.round(from + (to - from) * amount);

const computeColorAt = (force) => {
  const value = clamp01(force);

  for (let i = 1; i < FORCE_GRADIENT.length; ++i) {
    const from = FORCE_GRADIENT[i - 1];
    const to = FORCE_GRADIENT[i];

    if (value > to.stop) continue;

    const span = to.stop - from.stop;
    const localAmount = span === 0 ? 0 : (value - from.stop) / span;
    const eased = localAmount * localAmount * (3 - 2 * localAmount);
    const color = from.color.map((channel, index) =>
      mix(channel, to.color[index], eased),
    );

    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }

  const color = FORCE_GRADIENT[FORCE_GRADIENT.length - 1].color;
  return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
};

export class Painter {
  constructor(context, config = {}) {
    this.ctx = context;
    this.BACKGROUND_COLOR = config.backgroundColor ?? "#0D1117";
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
    if (sites.length === 0) return;

    const scaledForces = [];
    let minForce = Infinity;
    let maxForce = -Infinity;

    for (const site of sites) {
      // Log scaling keeps unusually strong forces from flattening the gradient.
      const scaledForce = Math.log1p(Math.hypot(site.ax, site.ay));
      scaledForces.push(scaledForce);
      minForce = Math.min(minForce, scaledForce);
      maxForce = Math.max(maxForce, scaledForce);
    }

    const forceRange = maxForce - minForce;

    for (let i = 0; i < sites.length; ++i) {
      const site = sites[i];
      let forceAmount = 0;

      if (forceRange > 0) {
        forceAmount = (scaledForces[i] - minForce) / forceRange;
      } else if (maxForce > 0) {
        forceAmount = 0.5;
      }

      this.ctx.fillStyle = computeColorAt(forceAmount);
      this.ctx.beginPath();
      this.ctx.arc(site.x, site.y, 2, 0, Math.PI * 2, true);
      this.ctx.closePath();
      this.ctx.fill();
    }
  };
}
