import { BetaSlider } from "./betaSlider.js";
import { Painter } from "./drawing.js";
import { betaSkeleton } from "./betaGraph.js";
import { relativeNeighborGraph } from "./rngGraph.js";
import { nnGrapg } from "./nnGraph.js";
import { KNNSlider } from "./knnSlider.js";

const CONTROLLS_WIDTH = 250;
const DEBAUNCE_TIME = 0;
const DEFAULT_BETA = 1;
const DEFAULT_KNN = 5;

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
    this.graph = betaSkeleton(this.sites, 2);
    this.selectedSite = null;

    this.prevBeta = DEFAULT_BETA;
    this.prevKnn = DEFAULT_KNN;
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

  updateBeta(betaValue) {
    this.graph = betaSkeleton(this.sites, betaValue);
    this.prevBeta = betaValue;
  }

  updateKnn(k) {
    this.graph = nnGrapg(this.sites, k);
    this.prevKnn = k;
  }

  updateConnections() {
    this.graph = betaSkeleton(this.sites, 2);
  }

  draw() {
    this.painter.drawBackground();
    this.painter.drawEdges(this.graph.edges, this.graph.nodes, this.selectedSite);
    this.painter.drawSites(this.graph.nodes, this.selectedSite);
  }

  changeGraph(id) {
    this.slider?.destroy();

    if (id === "bs") {
      this.graph = betaSkeleton(this.sites, this.prevBeta);
      this.slider = new BetaSlider({ value: this.prevBeta });
    } else if (id === "rng") {
      this.graph = relativeNeighborGraph(this.sites);
    } else if (id === "nn") {
      this.graph = nnGrapg(this.sites, this.prevKnn);
      this.slider = new KNNSlider({ value: this.prevKnn });
    }

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
}

window.addEventListener("load", () => {
  const header = document.getElementsByTagName("header")[0];
  const canvas = document.getElementById("canvas");

  const headerHeight = header.offsetHeight;
  canvas.width = window.innerWidth - CONTROLLS_WIDTH;
  canvas.height = window.innerHeight - headerHeight;
  const interactiveClient = new InteractiveClient(canvas);

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
      interactiveClient.draw();
    });
  });

  // Activate default graph
  document.getElementById("bs").dispatchEvent(new Event("change"));
});
