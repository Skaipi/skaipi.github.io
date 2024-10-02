import { Edge } from "./edge.js";
import { BeachlineEvent } from "./beachlineEvent.js";
import { Parabola } from "./parabola.js";
import { Point } from "./point.js";
import { PriorityQueue } from "./priorityQueue.js";
import { FortuneBST } from "./binaryTree.js";

/**
 * This class implements Fortune's algorithm for constructing Voronoi's diagrams
 * Within this implementation Sweep Line goes from top to bottom (along y coordinates)
 * This approach simplifies algebraic formulas (but construction along x axis is still possible)
 * beachline (with transformed regions) is sorted on x (left to right)
 */
export class Voronoi {
  constructor(sites, width, height) {
    this.beachLine = new FortuneBST();
    this.queue = new PriorityQueue();
    this.sites = sites;
    this.width = width;
    this.height = height;
    this.sweepLine = 0;
    this.edges = [];
  }

  getEdges() {
    if (this.sites.length < 2) return [];

    for (let i = 0; i < this.sites.length; i++) {
      const ble = new BeachlineEvent(this.sites[i], true);
      this.queue.enqueue(ble, ble.point.y);
    }

    while (!this.queue.isEmpty()) {
      const blEvent = this.queue.dequeue();
      this.sweepLine = blEvent.point.y;
      blEvent.isSite ? this.processSiteEvt(blEvent) : this.processVertexEvt(blEvent);
    }

    const dirtyEdges = this.beachLine.getEdges();
    for (let i = 0; i < dirtyEdges.length; i++) dirtyEdges[i].finish();

    for (let i = 0; i < this.edges.length; i++) {
      const edge = this.edges[i];
      if (edge.neighbour) edge.start = edge.neighbour.end;
    }

    return this.edges;
  }

  // process site
  processSiteEvt(event) {
    const site = event.point;
    if (this.beachLine.root === null) {
      this.beachLine.root = new Parabola(this, site);
      return;
    }

    const root = this.beachLine.root;
    // two starting points at the same x coordinate and one of them not included in binary tree
    if (root.isLeaf && root.focus.y - site.y < Number.EPSILON) {
      const middle = new Point((site.x + root.focus.x) / 2, this.height);
      root.left = new Parabola(this, root.focus);
      root.right = new Parabola(this, site);
      const newEdge =
        site.x > root.focus.x ? new Edge(this, middle, root.focus, site) : new Edge(this, middle, site, root.focus);
      this.beachLine.replace(root, newEdge);
      this.edges.push(newEdge);
      return;
    }

    // find parabola on this coordinate and remove its event
    const par = this.beachLine.findClosestLeaf(site.x);
    if (par.circleEvent) {
      this.queue.remove(par.circleEvent);
      par.circleEvent = null;
    }

    // Add edges on parabola split point
    const start = new Point(site.x, par.getY(site.x));
    const leftEdge = new Edge(this, start, par.focus, site);
    const rightEdge = new Edge(this, start, site, par.focus);
    leftEdge.neighbour = rightEdge;
    this.edges.push(leftEdge);

    // remove parabola then insert two edges and three parabolas
    this.beachLine.replace(par, rightEdge);

    // Splitting previous parabola into two parts and new arc that separates them
    const p0 = new Parabola(this, par.focus);
    const p1 = new Parabola(this, site);
    const p2 = new Parabola(this, par.focus);

    // remove parabola and insert new edges and new arcs
    rightEdge.right = p2;
    rightEdge.left = leftEdge;

    leftEdge.left = p0;
    leftEdge.right = p1;

    // Add events for splits of original parabola
    this.checkCircle(p0);
    this.checkCircle(p2);
  }

  // process vertex
  processVertexEvt(event) {
    const par1 = event.arch;

    const pred = this.beachLine.predecessor(par1);
    const succ = this.beachLine.successor(par1);

    // left and right siblings of par1 prepared in checkCircle
    const par0 = this.beachLine.predecessor(pred);
    const par2 = this.beachLine.successor(succ);

    // removal of par1 discriminates siblings envents
    if (par0.circleEvent) {
      this.queue.remove(par0.circleEvent);
      par0.circleEvent = null;
    }
    if (par2.circleEvent) {
      this.queue.remove(par2.circleEvent);
      par2.circleEvent = null;
    }

    // intersection point of par0 and par2
    const intersectionPoint = new Point(event.point.x, par1.getY(event.point.x));
    pred.end = intersectionPoint;
    succ.end = intersectionPoint;

    // check which parent is higher in tree structure
    const higher = pred === par1.parent ? succ : pred;
    const newEdge = new Edge(this, intersectionPoint, par0.focus, par2.focus);
    this.beachLine.replace(higher, newEdge);
    this.edges.push(newEdge);

    this.beachLine.remove(par1);
    this.beachLine.remove(par1.parent);

    this.checkCircle(par0);
    this.checkCircle(par2);
  }

  /**
   * Find circle whose centre is an intersection of edges and focuses of intersecting arcs are on its circumference
   * Check if parabola will disaper (shrink to zero) and create associated (circle) event
   * Circle events occur when neighboring parabolas cause other parabola to shrink into Voronoi vertex
   */
  checkCircle(parabola) {
    const pred = this.beachLine.predecessor(parabola);
    const succ = this.beachLine.successor(parabola);
    const predPred = this.beachLine.predecessor(pred);
    const succSucc = this.beachLine.successor(succ);

    // check if left and right are separate cells
    if (!predPred || !succSucc || predPred.focus == succSucc.focus) return;

    const intersection = pred.getIntersectionPoint(succ);
    if (intersection === null) return;

    const d = Point.distance(predPred.focus, intersection);
    // Check if sweep line lies on circumference
    if (intersection.y - d >= this.sweepLine) return;

    const event = new BeachlineEvent(new Point(intersection.x, intersection.y - d), false);

    parabola.circleEvent = event;
    event.arch = parabola;
    this.queue.enqueue(event, event.point.y);
  }
}
