import { BetaSlider } from "./controlls/betaSlider.js";
import { betaSkeleton } from "./models/betaGraph.js";
import { relativeNeighborGraph } from "./models/rngGraph.js";
import { nnGraph, rknnGraph } from "./models/nnGraph.js";
import { KNNSlider } from "./controlls/knnSlider.js";
import { RankSlider } from "./controlls/rankSlider.js";
import { CSVHandler } from "./csvHandler.js";
import { SizeSlider } from "./controlls/sizeSlider.js";
import { WidthSlider } from "./controlls/widthSlider.js";
import { GraphRenderer } from "./renderer.js";

const DEBAUNCE_TIME = 0;
const DEFAULT_GRAPH = "bs";
const DEFAULT_BETA = 1;
const DEFAULT_KNN = 5;
const DEFAULT_RANK_THRESHOLD = 1;
const DEFAULT_POINT_RADIUS = 2;
const DEFAULT_EDGE_WIDTH = 0.25;

const getRandomPoints = (amount, width, height) => {
  const points = [];
  for (let i = 0; i < amount; i++) {
    points.push([Math.random() * width, Math.random() * height]);
  }
  return points;
};

class Controller {
  constructor(svg) {
    this.renderer = new GraphRenderer(svg);
    this.painterSliders = [new SizeSlider(), new WidthSlider()];
    this.graphSliders = [];
    this.sites = getRandomPoints(100, this.renderer.width, this.renderer.height);

    this._model = { graph: betaSkeleton(this.sites, DEFAULT_BETA) };
    this._state = {
      graphId: DEFAULT_GRAPH,
      beta: DEFAULT_BETA,
      knn: DEFAULT_KNN,
      pointRadius: DEFAULT_POINT_RADIUS,
      edgeWidth: DEFAULT_EDGE_WIDTH,
      rankThreshold: DEFAULT_RANK_THRESHOLD,
      selectedSite: null,
    };

    this.state = new Proxy(this._state, {
      set: (target, key, value) => {
        target[key] = value;
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
  }

  updatePoints(points) {
    this.sites = this.rescalePoints(points);
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
      this.model.graph = nnGraph(this.sites, this.state.knn);
    } else if (this.state.graphId === "rknn") {
      this.model.graph = rknnGraph(this.sites, this.state.knn, this.state.rankThreshold);
    }
  }

  changeGraph(id) {
    while (this.graphSliders.length) {
      const sl = this.graphSliders.pop();
      sl?.destroy();
    }

    if (id === "bs") {
      this.model.graph = betaSkeleton(this.sites, this.state.beta);
      this.graphSliders.push(new BetaSlider({ value: this.state.beta }));
    } else if (id === "rng") {
      this.model.graph = relativeNeighborGraph(this.sites);
    } else if (id === "nn") {
      this.model.graph = nnGraph(this.sites, this.state.knn);
      this.graphSliders.push(new KNNSlider({ value: this.state.knn }));
    } else if (id === "rknn") {
      this.model.graph = rknnGraph(this.sites, this.state.knn, this.state.rankThreshold);
      this.graphSliders.push(new KNNSlider({ value: this.state.knn }));
      this.graphSliders.push(new RankSlider({ value: this.state.rankThreshold }));
    }

    this.state.graphId = id;
  }

  draw() {
    this.renderer.render(this.model, this.state);
  }

  static mouseX = (e) => e.clientX - e.target.offsetLeft;
  static mouseY = (e) => e.clientY - e.target.offsetTop;
  onMouseMove(e) {
    const requestDraw = DEBAUNCE_TIME > 16 ? throttle(this.draw.bind(this), DEBAUNCE_TIME) : this.draw.bind(this);
    const mouseX = Controller.mouseX(e);
    const mouseY = Controller.mouseY(e);
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

window.addEventListener("load", () => {
  const header = document.getElementsByTagName("header")[0];
  const headerHeight = header.offsetHeight;

  const svgEl = document.getElementById("viz");
  svgEl.setAttribute("height", `${window.innerHeight - headerHeight - 15}`);

  const interactiveClient = new Controller(svgEl);
  const csvHandler = new CSVHandler();

  document.getElementById("bs").addEventListener("change", (e) => {
    interactiveClient.changeGraph("bs");

    document.querySelector('input[name="beta"]').addEventListener("change", (e) => {
      interactiveClient.updateBeta(Number(e.target.value));
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
    interactiveClient.updatePointRadius(Number(e.target.value));
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
