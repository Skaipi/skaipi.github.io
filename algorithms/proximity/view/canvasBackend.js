import { BaseBackend } from "./renderBackend.js";

export class CanvasBackend extends BaseBackend {
  constructor(hostEl, colors, pixelRatio = window.devicePixelRatio || 1) {
    super(hostEl, colors);

    this.pixelRatio = pixelRatio;
    this.canvasEl = document.createElement("canvas");
    this.canvasEl.style.display = "block";
    this.canvasEl.style.width = "100%";
    this.canvasEl.style.height = "100%";
    this.canvasEl.style.background = colors.BACKGROUND_COLOR;

    this.hostEl.replaceChildren(this.canvasEl);

    this.ctx = this.canvasEl.getContext("2d");
  }

  resize(width, height) {
    const scaledWidth = Math.max(1, Math.round(width * this.pixelRatio));
    const scaledHeight = Math.max(1, Math.round(height * this.pixelRatio));

    if (this.canvasEl.width !== scaledWidth || this.canvasEl.height !== scaledHeight) {
      this.canvasEl.width = scaledWidth;
      this.canvasEl.height = scaledHeight;
    }
  }

  strokeEdges(edges, nodeById) {
    const ctx = this.ctx;

    ctx.beginPath();
    for (const edge of edges) {
      const source = nodeById.get(edge.source);
      const target = nodeById.get(edge.target);

      if (!source || !target) continue;

      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
    }
    ctx.stroke();
  }

  fillNodes(nodes, pointRadius) {
    const ctx = this.ctx;

    ctx.beginPath();
    for (const node of nodes) {
      ctx.moveTo(node.x + pointRadius, node.y);
      ctx.arc(node.x, node.y, pointRadius, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  render(model, state) {
    const { graph } = model;
    const { width, height } = this.getSize();
    const { pointRadius, edgeWidth, selectedId, transform } = state;
    const { x, y, k } = transform;

    const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
    const hasSelectedId = selectedId !== null;

    this.resize(width, height);

    const ctx = this.ctx;

    // Clear in device pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvasEl.width, this.canvasEl.height);

    ctx.save();
    ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    ctx.translate(x, y);
    ctx.scale(k, k);

    ctx.lineWidth = edgeWidth / k;
    ctx.strokeStyle = this.colors.EDGE_COLOR;

    if (!hasSelectedId) {
      ctx.globalAlpha = 1;
      this.strokeEdges(graph.edges, nodeById);
    } else {
      const strongEdges = [];
      const dimEdges = [];

      for (const edge of graph.edges) {
        if (edge.source === selectedId || edge.target === selectedId) {
          strongEdges.push(edge);
        } else {
          dimEdges.push(edge);
        }
      }

      ctx.globalAlpha = 0.2;
      this.strokeEdges(dimEdges, nodeById);

      ctx.globalAlpha = 1;
      this.strokeEdges(strongEdges, nodeById);
    }

    ctx.fillStyle = this.colors.NODE_COLOR;

    if (!hasSelectedId) {
      ctx.globalAlpha = 1;
      this.fillNodes(graph.nodes, pointRadius);
    } else {
      const strongNodes = [];
      const dimNodes = [];

      for (const node of graph.nodes) {
        if (node.id === selectedId) {
          strongNodes.push(node);
        } else {
          dimNodes.push(node);
        }
      }

      ctx.globalAlpha = 0.2;
      this.fillNodes(dimNodes, pointRadius / k);

      ctx.globalAlpha = 1;
      this.fillNodes(strongNodes, pointRadius / k);
    }

    ctx.globalAlpha = 1;
  }
}
