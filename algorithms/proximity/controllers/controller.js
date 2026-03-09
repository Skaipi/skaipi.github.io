import { select, zoom, zoomIdentity, pointer } from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { quadtree } from "https://cdn.jsdelivr.net/npm/d3-quadtree@3.0.1/+esm";
import { BetaSlider } from "../controlls/betaSlider.js";
import { betaSkeleton } from "../models/betaGraph.js";
import { relativeNeighborGraph } from "../models/rngGraph.js";
import { nnGraph, rknnGraph } from "../models/nnGraph.js";
import { KNNSlider } from "../controlls/knnSlider.js";
import { RankSlider } from "../controlls/rankSlider.js";
import { SizeSlider } from "../controlls/sizeSlider.js";
import { WidthSlider } from "../controlls/widthSlider.js";
import { GraphRenderer } from "../view/view.js";

const DEBAUNCE_TIME = 0;
const DEFAULT_GRAPH = "bs";
const DEFAULT_BETA = 1;
const DEFAULT_KNN = 5;
const DEFAULT_RANK_THRESHOLD = 1;
const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_EDGE_WIDTH = 0.25;

export class Controller {
  constructor(hostEl, globalTranslation) {
    this.hostEl = hostEl;
    this.translate = globalTranslation;
    this.renderer = new GraphRenderer(hostEl);
    this.painterSliders = [
      new SizeSlider({ value: DEFAULT_POINT_RADIUS }),
      new WidthSlider({ value: DEFAULT_EDGE_WIDTH }),
    ];
    this.graphSliders = [];
    this.sites = [];
    this.quadtree = quadtree();

    this._model = { graph: betaSkeleton(this.sites, DEFAULT_BETA) };
    this._state = {
      graphId: DEFAULT_GRAPH,
      beta: DEFAULT_BETA,
      knn: DEFAULT_KNN,
      pointRadius: DEFAULT_POINT_RADIUS,
      edgeWidth: DEFAULT_EDGE_WIDTH,
      rankThreshold: DEFAULT_RANK_THRESHOLD,
      selectedId: null,
      transform: zoomIdentity,
    };

    // TODO: separate drawing and model state
    this.state = new Proxy(this._state, {
      set: (target, key, value) => {
        const prevValue = target[key];
        if (value === prevValue) return true;

        target[key] = value;
        // Redraw only changes in state (no model recomputation)
        if (key === "selectedId" || key === "edgeWidth" || key === "pointRadius" || key === "transform") {
          this.draw();
          return true;
        }
        this.updateGraph();
        return true;
      },
    });

    this.model = new Proxy(this._model, {
      set: (target, key, value) => {
        target[key] = value;

        if (key === "graph") {
          this.draw();
        }
        return true;
      },
    });

    this.zoom = zoom()
      .scaleExtent([0.5, 32])
      .filter((event) => !event.button) // ignore right/middle button
      .on("zoom", (event) => {
        this.state.transform = event.transform;
      });

    select(this.hostEl).call(this.zoom);

    hostEl.addEventListener("mousemove", this.onMouseMove.bind(this));
  }

  updatePoints(points) {
    this.sites = this.rescalePoints(points);
    this.quadtree = quadtree()
      .x((d) => d.x)
      .y((d) => d.y)
      .addAll(this.sites.map(([x, y], i) => ({ x, y, i })));

    this.resetZoomExtent();
    this.updateGraph();
  }

  updatePointRadius(radius) {
    this.state.pointRadius = radius;
  }

  updateEdgeWidth(width) {
    this.state.edgeWidth = width;
  }

  updateBeta(betaValue) {
    this.state.beta = betaValue;
  }

  updateKnn(k) {
    this.state.knn = k;
  }

  updateRankThreshold(t) {
    this.state.rankThreshold = t;
  }

  updateGraph() {
    if (this.state.graphId === "bs") {
      this.model.graph = betaSkeleton(this.sites, this.state.beta);
    } else if (this.state.graphId === "rng") {
      this.model.graph = relativeNeighborGraph(this.sites);
    } else if (this.state.graphId === "nn") {
      this.model.graph = nnGraph(this.sites, this.state.knn, this.quadtree);
    } else if (this.state.graphId === "rknn") {
      this.model.graph = rknnGraph(this.sites, this.state.knn, this.state.rankThreshold, this.quadtree);
    }
  }

  changeGraph(id) {
    while (this.graphSliders.length) {
      const sl = this.graphSliders.pop();
      sl?.destroy();
    }

    if (id === "bs") {
      this.graphSliders.push(new BetaSlider({ value: this.state.beta }));
    } else if (id === "rng") {
    } else if (id === "nn") {
      this.graphSliders.push(new KNNSlider({ value: this.state.knn }));
    } else if (id === "rknn") {
      this.graphSliders.push(new KNNSlider({ value: this.state.knn }));
      this.graphSliders.push(new RankSlider({ value: this.state.rankThreshold }));
    }

    this.state.graphId = id;
  }

  draw() {
    this.renderer.render(this.model, this.state);
  }

  resetZoomExtent() {
    if (!this.sites.length) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const [x, y] of this.sites) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }

    const pad = 40;

    this.zoom
      .extent([
        [0, 0],
        [this.renderer.width, this.renderer.height],
      ])
      .translateExtent([
        [minX - pad, minY - pad],
        [maxX + pad, maxY + pad],
      ]);

    select(this.hostEl).call(this.zoom.transform, zoomIdentity);
  }

  onMouseMove(e) {
    const [sx, sy] = pointer(e, this.hostEl);
    const [wx, wy] = this.state.transform.invert([sx, sy]);
    const hoverRadiusPx = 6;
    const hoverRadius = hoverRadiusPx / this.state.transform.k;

    const hit = this.quadtree.find(wx, wy, hoverRadius);
    this.state.selectedId = hit ? hit.i : null;
  }

  enforceBigData() {
    if (this.state.graphId === "bs" || this.state.graphId === "rng") {
      this.changeGraph("nn");
    }
  }

  rescalePoints(points, opts = {}) {
    const { mode = "contain", flipY = true } = opts;
    if (!Array.isArray(points) || points.length === 0) return [];

    let xMin = Infinity,
      xMax = -Infinity,
      yMin = Infinity,
      yMax = -Infinity;
    for (const p of points) {
      const x = p[0],
        y = p[1];
      if (x < xMin) xMin = x;
      if (x > xMax) xMax = x;
      if (y < yMin) yMin = y;
      if (y > yMax) yMax = y;
    }

    const dataW = xMax - xMin;
    const dataH = yMax - yMin;

    const x0 = 0;
    const x1 = this.renderer.width;
    const y0raw = 0;
    const y1raw = this.renderer.height;
    const vxMin = Math.min(x0, x1),
      vxMax = Math.max(x0, x1);
    const vyMin = Math.min(y0raw, y1raw),
      vyMax = Math.max(y0raw, y1raw);

    const viewW = vxMax - vxMin;
    const viewH = vyMax - vyMin;

    // Degenerate cases: all points share x and/or y
    if (dataW === 0 && dataH === 0) {
      const cx = vxMin + viewW / 2;
      const cy = vyMin + viewH / 2;
      return points.map(() => [cx, flipY ? vyMin + vyMax - cy : cy]);
    }

    // If one dimension is degenerate, treat its scale as Infinity so the other dimension drives uniform scale.
    const sx = dataW === 0 ? Infinity : viewW / dataW;
    const sy = dataH === 0 ? Infinity : viewH / dataH;

    const s = mode === "cover" ? Math.max(sx, sy) : Math.min(sx, sy);

    // Size of scaled data bbox in viewport units
    const scaledW = dataW === 0 ? 0 : dataW * s;
    const scaledH = dataH === 0 ? 0 : dataH * s;

    // Centering offsets to letterbox/pillarbox (or negative in cover mode due to cropping)
    const ox = vxMin + (viewW - scaledW) / 2;
    const oy = vyMin + (viewH - scaledH) / 2;

    // Map point: translate to origin, uniform scale, then offset into viewport
    const out = points.map(([x, y]) => {
      const xn = dataW === 0 ? vxMin + viewW / 2 : ox + (x - xMin) * s;
      const yn = dataH === 0 ? vyMin + viewH / 2 : oy + (y - yMin) * s;
      return [xn, yn];
    });

    if (!flipY) return out;

    // Flip within the yNew range
    return out.map(([x, y]) => [x, vyMin + vyMax - y]);
  }
}
