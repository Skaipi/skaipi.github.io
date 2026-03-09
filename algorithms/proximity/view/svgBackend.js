import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { BaseBackend } from "./renderBackend.js";

export class SvgBackend extends BaseBackend {
  constructor(hostEl, colors) {
    super(hostEl, colors);

    this.svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.svgEl.style.display = "block";
    this.svgEl.style.width = "100%";
    this.svgEl.style.height = "100%";
    this.svgEl.style.background = this.colors.BACKGROUND_COLOR;

    this.hostEl.replaceChildren(this.svgEl);

    this.svg = d3.select(this.svgEl);
    this.gScene = this.svg.append("g").attr("class", "scene");
    this.gEdges = this.gScene.append("g").attr("class", "edges");
    this.gNodes = this.gScene.append("g").attr("class", "nodes");
  }

  render(model, state) {
    const { graph } = model;
    const { width, height } = this.getSize();
    const { pointRadius, edgeWidth, selectedId, transform } = state;

    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const hasSelectedId = selectedId !== null;

    this.svg.attr("width", width).attr("height", height);
    this.gScene.attr("transform", `translate(${transform.x},${transform.y}) scale(${transform.k})`);

    this.gEdges
      .selectAll("line")
      .data(graph.edges, (d) => d.id)
      .join("line")
      .attr("x1", (d) => nodeById.get(d.source).x)
      .attr("y1", (d) => nodeById.get(d.source).y)
      .attr("x2", (d) => nodeById.get(d.target).x)
      .attr("y2", (d) => nodeById.get(d.target).y)
      .attr("stroke", this.colors.EDGE_COLOR)
      .attr("opacity", (d) => (hasSelectedId && d.source !== selectedId && d.target !== selectedId ? 0.2 : 1))
      .attr("stroke-width", edgeWidth)
      .attr("vector-effect", "non-scaling-stroke");

    this.gNodes
      .selectAll("circle")
      .data(graph.nodes, (d) => d.id)
      .join("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", pointRadius)
      .attr("opacity", (d) => (hasSelectedId && d.id !== selectedId ? 0.2 : 1))
      .attr("fill", this.colors.NODE_COLOR);
  }
}
