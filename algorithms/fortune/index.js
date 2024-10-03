"use strict";

import { Point } from "./point.js";
import { Voronoi } from "./voronoi.js";
import { throttle } from "./debounce.js";
import { Painter } from "./drawing.js";

const DEBAUNCE_TIME = 0;
const modes = {
  VORONOI: "voronoi",
  DELAUNAY: "delaunay",
};

const resizeCanvas = () => {
  const header = document.getElementsByTagName("header")[0];
  const canvas = document.getElementById("canvas");

  const headerHeight = header.offsetHeight;
  canvas.height = window.innerHeight - headerHeight;
  canvas.width = window.innerWidth;
};

const getRandomPoints = (amount, width, height) => {
  const points = [];
  for (let i = 0; i < amount; i++) {
    points.push(new Point(Math.random() * width, Math.random() * height));
  }
  return points;
};

class InteractiveClient {
  constructor(canvas) {
    this.mode = modes.VORONOI;
    this.context = canvas.getContext("2d");
    this.painter = new Painter(this.context);
    this.sites = getRandomPoints(100, this.width, this.height);

    canvas.onmousemove = this.onMouseMove.bind(this);
  }

  get width() {
    return this.context.canvas.width;
  }
  get height() {
    return this.context.canvas.height;
  }

  draw() {
    const voronoi = new Voronoi(this.sites, this.width, this.height);
    const edges = voronoi.getEdges();

    this.painter.drawBackground();
    this.painter.drawSites(this.sites);
    if (this.mode === "delaunay") this.painter.drawDelaunay(edges);
    if (this.mode === "voronoi") this.painter.drawVoronoi(edges);
  }

  static mouseX = (e) => e.clientX - e.target.offsetLeft;
  static mouseY = (e) => e.clientY - e.target.offsetTop;
  onMouseMove(e) {
    const requestDraw = DEBAUNCE_TIME > 16 ? throttle(this.draw.bind(this), DEBAUNCE_TIME) : this.draw.bind(this);
    const last = this.sites[this.sites.length - 1];
    last.x = InteractiveClient.mouseX(e);
    last.y = InteractiveClient.mouseY(e);
    requestDraw();
  }
}

window.addEventListener("resize", resizeCanvas);
window.addEventListener("load", () => {
  resizeCanvas();

  const canvas = document.getElementById("canvas");
  const interactiveClient = new InteractiveClient(canvas);
  interactiveClient.draw();
});
