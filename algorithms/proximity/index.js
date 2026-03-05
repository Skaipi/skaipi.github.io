import { BetaSlider } from "./betaSlider.js";
import { Painter } from "./drawing.js";
import { betaSkeleton } from "./betaGraph.js";
import { relativeNeighborGraph } from "./rngGraph.js";
import { nnGraph, rknnGraph } from "./nnGraph.js";
import { KNNSlider } from "./knnSlider.js";
import { RankSlider } from "./rankSlider.js";
import { CSVHandler } from "./csvHandler.js";
import { SizeSlider } from "./sizeSlider.js";
import { WidthSlider } from "./widthSlider.js";

const CONTROLLS_WIDTH = 250;
const DEBAUNCE_TIME = 0;
const DEFAULT_GRAPH = "bs";
const DEFAULT_BETA = 1;
const DEFAULT_KNN = 5;
const DEFAULT_RANK_THRESHOLD = 1;

const getRandomPoints = (amount, width, height) => {
  const points = [];
  for (let i = 0; i < amount; i++) {
    points.push([Math.random() * width, Math.random() * height]);
  }
  return points;
};

class InteractiveClient {
  constructor(canvas) {
    this.useLocalSearch = true;
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.painter = new Painter(this.context);
    this.sites = getRandomPoints(100, this.width, this.height);
    this.painterSliders = [new SizeSlider(), new WidthSlider()];
    this.graph = betaSkeleton(this.sites, 2);
    this.graphSliders = [];
    this.selectedSite = null;

    this.graphId = DEFAULT_GRAPH;
    this.beta = DEFAULT_BETA;
    this.knn = DEFAULT_KNN;
    this.rankThreshold = DEFAULT_RANK_THRESHOLD;
    canvas.onmousemove = this.onMouseMove.bind(this);
  }

  get width() {
    return this.context.canvas.width;
  }
  get height() {
    return this.context.canvas.height;
  }

  adjustCanvasSize() {
    this.canvas.width = this.canvas.clientWidth - CONTROLLS_WIDTH;
    this.canvas.height = this.canvas.clientHeight;
  }

  updatePointSize(size) {
    this.painter.setSiteRadius(size);
    this.draw();
  }

  updateEdgeWidth(width) {
    this.painter.setEdgeWidth(width);
    this.draw();
  }

  updatePoints(points) {
    this.sites = this.rescalePoints(points);
    this.updateGraph();
  }

  updateBeta(betaValue) {
    this.beta = betaValue;
    this.updateGraph();
  }

  updateKnn(k) {
    this.knn = k;
    this.updateGraph();
  }

  updateRankThreshold(t) {
    this.rankThreshold = t;
    this.updateGraph();
  }

  draw() {
    this.painter.drawBackground();
    this.painter.drawEdges(this.graph.edges, this.graph.nodes, this.selectedSite);
    this.painter.drawSites(this.graph.nodes, this.selectedSite);
  }

  updateGraph() {
    if (this.graphId === "bs") {
      this.graph = betaSkeleton(this.sites, this.beta);
    } else if (this.graphId === "rng") {
      this.graph = relativeNeighborGraph(this.sites);
    } else if (this.graphId === "nn") {
      this.graph = nnGraph(this.sites, this.knn);
    } else if (this.graphId === "rknn") {
      this.graph = rknnGraph(this.sites, this.knn, this.rankThreshold);
    }
    this.draw();
  }

  changeGraph(id) {
    while (this.graphSliders.length) {
      const sl = this.graphSliders.pop();
      sl?.destroy();
    }

    if (id === "bs") {
      this.graph = betaSkeleton(this.sites, this.beta);
      this.graphSliders.push(new BetaSlider({ value: this.beta }));
    } else if (id === "rng") {
      this.graph = relativeNeighborGraph(this.sites);
    } else if (id === "nn") {
      this.graph = nnGraph(this.sites, this.knn);
      this.graphSliders.push(new KNNSlider({ value: this.knn }));
    } else if (id === "rknn") {
      this.graph = rknnGraph(this.sites, this.knn, this.rankThreshold);
      this.graphSliders.push(new KNNSlider({ value: this.knn }));
      this.graphSliders.push(new RankSlider({ value: this.rankThreshold }));
    }

    this.graphId = id;
    this.draw();
  }

  static mouseX = (e) => e.clientX - e.target.offsetLeft;
  static mouseY = (e) => e.clientY - e.target.offsetTop;
  onMouseMove(e) {
    const requestDraw = DEBAUNCE_TIME > 16 ? throttle(this.draw.bind(this), DEBAUNCE_TIME) : this.draw.bind(this);
    const mouseX = InteractiveClient.mouseX(e);
    const mouseY = InteractiveClient.mouseY(e);
    let found = false;
    const r2 = 64;

    for (let i = 0; i < this.sites.length; i++) {
      const [x, y] = this.sites[i];
      if (Math.pow(x - mouseX, 2) + Math.pow(y - mouseY, 2) < r2) {
        this.selectedSite = i;
        found = true;
      }
    }

    if (!found) this.selectedSite = null;
    requestDraw();
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
    const x1 = this.width;
    const y0raw = 0;
    const y1raw = this.height;
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

window.addEventListener("load", () => {
  const header = document.getElementsByTagName("header")[0];
  const canvas = document.getElementById("canvas");

  const headerHeight = header.offsetHeight;
  canvas.width = window.innerWidth - CONTROLLS_WIDTH;
  canvas.height = window.innerHeight - headerHeight;
  const interactiveClient = new InteractiveClient(canvas);
  const csvHandler = new CSVHandler();

  document.getElementById("bs").addEventListener("change", (e) => {
    interactiveClient.changeGraph("bs");

    document.querySelector('input[name="beta"]').addEventListener("change", (e) => {
      interactiveClient.updateBeta(Number(e.target.value));
      interactiveClient.draw();
    });
  });

  document.getElementById("rng").addEventListener("change", (e) => {
    interactiveClient.changeGraph("rng");
  });

  document.getElementById("nn").addEventListener("change", (e) => {
    interactiveClient.changeGraph("nn");

    document.querySelector('input[name="knn"]').addEventListener("change", (e) => {
      interactiveClient.updateKnn(Number(e.target.value));
    });
  });

  document.getElementById("rknn").addEventListener("change", (e) => {
    interactiveClient.changeGraph("rknn");

    document.querySelector('input[name="knn"]').addEventListener("change", (e) => {
      interactiveClient.updateKnn(Number(e.target.value));
    });

    document.querySelector('input[name="rankThreshold"]').addEventListener("change", (e) => {
      interactiveClient.updateRankThreshold(Number(e.target.value));
    });
  });

  document.querySelector('input[name="pointSize"]').addEventListener("change", (e) => {
    interactiveClient.updatePointSize(Number(e.target.value));
  });

  document.querySelector('input[name="edgeWidt"]').addEventListener("change", (e) => {
    interactiveClient.updateEdgeWidth(Number(e.target.value));
  });

  const inputEl = document.querySelector("input[name=csvFile]");
  const dropZoneEl = document.querySelector(".drop-zone");
  dropZoneEl.addEventListener("click", (e) => inputEl.click());

  inputEl.addEventListener("change", (e) => {
    if (inputEl.files.length) {
      csvHandler.loadFile(e.dataTransfer.files[0]).then(({ points }) => {
        interactiveClient.updatePoints(points);
      });
    }
  });

  dropZoneEl.addEventListener("dragover", (e) => {
    e.preventDefault();
  });

  dropZoneEl.addEventListener("drop", (e) => {
    e.preventDefault();

    if (e.dataTransfer.files.length) {
      inputEl.files = e.dataTransfer.files;
      csvHandler.loadFile(e.dataTransfer.files[0]).then(({ points }) => {
        interactiveClient.updatePoints(points);
      });
    }
  });

  // Activate default graph
  document.getElementById(DEFAULT_GRAPH).dispatchEvent(new Event("change"));
});
