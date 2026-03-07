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

// export class GraphRenderer {
//   constructor(svgEl) {
//     this.svgEl = svgEl;
//     this.svg = d3.select(svgEl);
//     this.gEdges = this.svg.append("g").attr("class", "edges");
//     this.gNodes = this.svg.append("g").attr("class", "nodes");

//     this.BACKGROUND_COLOR = "#0D1117";
//     this.NODE_COLOR = "#FFC857";
//     this.EDGE_COLOR = "#2CB67D";
//     this.HIGHTLIGHT_NODE_COLOR = "#e1e8ed";
//   }

//   get width() {
//     return this.svgEl.getBoundingClientRect().width;
//   }

//   get height() {
//     return this.svgEl.getBoundingClientRect().height;
//   }

//   render(model, state) {
//     const { graph } = model;
//     const { width, height } = this.svgEl.getBoundingClientRect();
//     const { pointRadius, edgeWidth, selectedId } = state;
//     const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
//     const hasSelectedId = selectedId !== null;

//     this.svg.attr("width", width).attr("height", height);

//     this.gEdges
//       .selectAll("line")
//       .data(graph.edges, (d) => d.id)
//       .join("line")
//       .attr("x1", (d) => nodeById.get(d.source).x)
//       .attr("y1", (d) => nodeById.get(d.source).y)
//       .attr("x2", (d) => nodeById.get(d.target).x)
//       .attr("y2", (d) => nodeById.get(d.target).y)
//       .attr("stroke", this.EDGE_COLOR)
//       .attr("opacity", (d) => (hasSelectedId && d.source !== selectedId && d.target !== selectedId ? "0.2" : "1"))
//       .attr("stroke-width", edgeWidth);

//     this.gNodes
//       .selectAll("circle")
//       .data(graph.nodes, (d) => d.id)
//       .join("circle")
//       .attr("cx", (d) => d.x)
//       .attr("cy", (d) => d.y)
//       .attr("r", pointRadius)
//       .attr("opacity", (d) => (hasSelectedId && d.id !== selectedId ? "0.2" : "1"))
//       .attr("fill", this.NODE_COLOR);
//   }
// }
