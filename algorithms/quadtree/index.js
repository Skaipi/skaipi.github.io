"use strict";

import { Painter } from "./drawing.js";
import { createBarnesHutSimulation } from "./simulation.js";

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
    this.simulation = createBarnesHutSimulation();
    this.showGrid = true;
    this.draw = this.draw.bind(this);

    this.simulation.generateCluster(this.width, this.height);

    canvas.addEventListener("click", () => {
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
    const quadtree = this.simulation.step(this.width, this.height);

    this.painter.drawBackground();
    this.painter.drawSites(this.simulation.getState());

    if (this.showGrid) {
      this.painter.drawTree(quadtree);
    }

    requestAnimationFrame(this.draw);
  }
}

window.addEventListener("load", () => {
  resizeCanvas();

  const canvas = document.getElementById("canvas");
  const interactiveClient = new InteractiveClient(canvas);
  interactiveClient.draw();
});
