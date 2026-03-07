import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

export class GraphRenderer {
  constructor(svgEl) {
    this.svgEl = svgEl;
    this.svg = d3.select(svgEl);
    this.gEdges = this.svg.append("g").attr("class", "edges");
    this.gNodes = this.svg.append("g").attr("class", "nodes");

    this.BACKGROUND_COLOR = "#0D1117";
    this.NODE_COLOR = "#FFC857";
    this.EDGE_COLOR = "#2CB67D";
    this.HIGHTLIGHT_NODE_COLOR = "#e1e8ed";
  }

  get width() {
    return this.svgEl.getBoundingClientRect().width;
  }

  get height() {
    return this.svgEl.getBoundingClientRect().height;
  }

  render(model, state) {
    const { graph } = model;
    const { width, height } = this.svgEl.getBoundingClientRect();
    const { pointRadius, edgeWidth, selectedId } = state;
    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const hasSelectedId = selectedId !== null;

    this.svg.attr("width", width).attr("height", height);

    this.gEdges
      .selectAll("line")
      .data(graph.edges, (d) => d.id)
      .join("line")
      .attr("x1", (d) => nodeById.get(d.source).x)
      .attr("y1", (d) => nodeById.get(d.source).y)
      .attr("x2", (d) => nodeById.get(d.target).x)
      .attr("y2", (d) => nodeById.get(d.target).y)
      .attr("stroke", this.EDGE_COLOR)
      .attr("opacity", (d) => (hasSelectedId && d.source !== selectedId && d.target !== selectedId ? "0.2" : "1"))
      .attr("stroke-width", edgeWidth);

    this.gNodes
      .selectAll("circle")
      .data(graph.nodes, (d) => d.id)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", pointRadius)
      .attr("opacity", (d) => (hasSelectedId && d.id !== selectedId ? "0.2" : "1"))
      .attr("fill", this.NODE_COLOR);
  }
}
