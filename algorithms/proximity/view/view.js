import { SvgBackend } from "./svgBackend.js";
import { CanvasBackend } from "./canvasBackend.js";

export class GraphRenderer {
  constructor(
    hostEl,
    {
      mode = "auto", // "svg" | "canvas" | "auto"
      switchThreshold = 5000,
      pixelRatio = window.devicePixelRatio || 1,
      selectBackend = null,
      colors = {},
    } = {},
  ) {
    this.hostEl = hostEl;
    this.mode = mode;
    this.switchThreshold = switchThreshold;
    this.pixelRatio = pixelRatio;

    this.colors = {
      BACKGROUND_COLOR: "#0D1117",
      NODE_COLOR: "#FFC857",
      EDGE_COLOR: "#2CB67D",
      HIGHLIGHT_NODE_COLOR: "#e1e8ed",
      ...colors,
    };

    this.selectBackend =
      selectBackend ||
      (({ nodeCount, edgeCount }) => (nodeCount + edgeCount > this.switchThreshold ? "canvas" : "svg"));

    this.backend = null;
    this.backendName = null;
  }

  get width() {
    return this.hostEl.getBoundingClientRect().width;
  }

  get height() {
    return this.hostEl.getBoundingClientRect().height;
  }

  setMode(mode) {
    this.mode = mode;
  }

  resolveBackend(model) {
    if (this.mode === "svg" || this.mode === "canvas") {
      return this.mode;
    }

    const graph = model?.graph ?? { nodes: [], edges: [] };
    const nodeCount = graph.nodes.length;
    const edgeCount = graph.edges.length;

    const result = this.selectBackend({ nodeCount, edgeCount, model });
    return result === "canvas" ? "canvas" : "svg";
  }

  ensureBackend(name) {
    if (this.backendName === name) return;

    if (this.backend) {
      this.backend.destroy();
      this.backend = null;
    }

    this.backend =
      name === "canvas"
        ? new CanvasBackend(this.hostEl, this.colors, this.pixelRatio)
        : new SvgBackend(this.hostEl, this.colors);

    this.backendName = name;
  }

  render(model, state) {
    const backendName = this.resolveBackend(model);
    this.ensureBackend(backendName);
    this.backend.render(model, state);
  }

  destroy() {
    if (this.backend) {
      this.backend.destroy();
      this.backend = null;
      this.backendName = null;
    }
  }
}
