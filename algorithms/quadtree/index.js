"use strict";

import { Painter } from "./drawing.js";
import { throttle } from "../commons/debounce.js";
import { generateHierarchicalCluster, getState, step } from "./simulation.js";
// import { generateHierarchicalCluster, getState, step } from "./linearQuadtreeSimulation.js";

const DEBAUNCE_TIME = 0;

const resizeCanvas = () => {
  const header = document.getElementsByTagName("header")[0];
  const canvas = document.getElementById("canvas");

  const headerHeight = header.offsetHeight;
  canvas.height = window.innerHeight - headerHeight;
  canvas.width = window.innerWidth;
};

class InteractiveClient {
  constructor(canvas) {
    this.context = canvas.getContext("2d");
    this.painter = new Painter(this.context);
    this.sites = generateHierarchicalCluster(this.width, this.height);
    // canvas.onmousemove = this.onMouseMove.bind(this);

    this.showGrid = true;
    canvas.addEventListener("click", (e) => {
      this.showGrid = !this.showGrid;
    });
  }

  get width() {
    return this.context.canvas.width;
  }
  get height() {
    return this.context.canvas.height;
  }

  draw() {
    const quadtree = step(this.width, this.height);
    const sites = getState();

    this.painter.drawBackground();
    this.painter.drawSites(sites);
    // this.painter.drawLinearSites(sites);
    if (this.showGrid) {
      this.painter.drawTree(quadtree);
      // this.painter.drawLinearTree(quadtree);
    }
    requestAnimationFrame(this.draw.bind(this));
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

window.addEventListener("load", () => {
  resizeCanvas();

  const canvas = document.getElementById("canvas");
  const interactiveClient = new InteractiveClient(canvas);
  interactiveClient.draw();
});
