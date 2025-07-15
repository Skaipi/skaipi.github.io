"use strict";

import { Point } from "./point.js";
import { Painter } from "./drawing.js";
import { Graph } from "./graph.js";
import { throttle } from "../commons/debounce.js";

const CONTROLLS_WIDTH = 250;
const DEBAUNCE_TIME = 0;
const modes = {
  RANDOM: "random",
  LATTICE: "lattice",
};

const getRandomPoints = (amount, width, height) => {
  const points = [];
  for (let i = 0; i < amount; i++) {
    points.push(new Point(Math.random() * width, Math.random() * height));
  }
  return points;
};

const getLatticePoints = (width, height, spacing) => {
  const points = [];
  // Vertical distance between rows
  const ySpacing = (Math.sqrt(3) / 2) * spacing;

  let y = 0;
  while (y <= height) {
    // Calculate row index by dividing y by the vertical spacing
    const rowIndex = Math.floor(y / ySpacing);
    // Determine if this row is offset
    const xOffset = rowIndex % 2 === 0 ? 0 : spacing / 2;

    let x = xOffset;
    while (x <= width) {
      points.push(new Point(x, y));
      x += spacing;
    }
    y += ySpacing;
  }

  return points;
};

class InteractiveClient {
  constructor(canvas) {
    this.mode = modes.RANDOM;
    this.useLocalSearch = true;
    this.canvas = canvas;
    this.context = canvas.getContext("2d");
    this.painter = new Painter(this.context);
    this.sites = getRandomPoints(100, this.width, this.height);
    this.graph = new Graph(this.sites, this.useLocalSearch);
    this.selectedSite = null;

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

  updatePoints() {
    this.sites =
      this.mode === modes.RANDOM
        ? getRandomPoints(100, this.width, this.height)
        : getLatticePoints(this.width, this.height, 100);
    this.graph = new Graph(this.sites, this.useLocalSearch);
  }

  updateConnections() {
    this.graph = new Graph(this.sites, this.useLocalSearch);
  }

  draw() {
    this.painter.drawBackground();
    this.painter.drawEdges(this.graph.items, this.selectedSite);
    this.painter.drawSites(this.graph.items, this.selectedSite);
  }

  static mouseX = (e) => e.clientX - e.target.offsetLeft;
  static mouseY = (e) => e.clientY - e.target.offsetTop;
  onMouseMove(e) {
    const requestDraw =
      DEBAUNCE_TIME > 16
        ? throttle(this.draw.bind(this), DEBAUNCE_TIME)
        : this.draw.bind(this);
    const mouseX = InteractiveClient.mouseX(e);
    const mouseY = InteractiveClient.mouseY(e);
    let found = false;
    this.graph.items.forEach((site) => {
      if (Math.pow(site.x - mouseX, 2) + Math.pow(site.y - mouseY, 2) < 64) {
        this.selectedSite = site;
        found = true;
      }
    });
    if (!found) {
      this.selectedSite = null;
    }
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
  interactiveClient.draw();

  document.querySelectorAll('input[name="mode"]').forEach((radio) => {
    radio.addEventListener("change", (e) => {
      interactiveClient.mode = e.target.value;
      interactiveClient.updatePoints();
      interactiveClient.draw();
    });
  });

  document.querySelector(".recompute-btn").addEventListener("click", (e) => {
    interactiveClient.updatePoints();
    interactiveClient.draw();
  });

  const checkbox = document.querySelector("#searchGlobalConnections");
  checkbox.addEventListener("change", (e) => {
    interactiveClient.useLocalSearch = checkbox.checked;
    console.log(e.target.value);
    interactiveClient.updateConnections();
    interactiveClient.draw();
  });
});
