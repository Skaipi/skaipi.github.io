import { BSTNode } from "./binaryTree.js";
import { Point } from "./point.js";

/**
 * This class implements Voronoi Edge that separates two sites (focal points)
 * Boundry is set between points called left and right becouse sweepLine goes top-bottom
 */
export class Edge extends BSTNode {
  constructor(algorithm, start, focusA, focusB) {
    super();
    this.algorithm = algorithm;

    if (start == null) debugger;
    this.focusA = focusA; // point on left
    this.focusB = focusB; // point on right

    this.start = start;
    this.end = null; // unknown at creation time

    this.slope = (focusB.x - focusA.x) / (focusA.y - focusB.y);
    this.verticalOffset = start.y - this.slope * start.x;
    this.direction = new Point(focusB.y - focusA.y, -(focusB.x - focusA.x));
    this.tmpEnd = new Point(start.x + this.direction.x, start.y + this.direction.y); // currently known second point of the line

    this.neighbour = null;
  }

  key() {
    return this.getChildrenBreakpointX();
  }

  /**
   * This function computes x coordinate of parablola (children) crossing point
   */
  getChildrenBreakpointX() {
    const left = this.algorithm.beachLine.predecessor(this);
    const right = this.algorithm.beachLine.successor(this);
    const [la, lb, lc] = left.getCoefficients();
    const [ra, rb, rc] = right.getCoefficients();

    // subtract parabolas and find zeros (crossing points)
    const a = la - ra;
    const b = lb - rb;
    const c = lc - rc;

    // check if equation is linear
    if (a == 0) return -c / b;

    // solution to quadratic equation with (a, b, c) coefficients
    const discriminant = b * b - 4 * a * c;
    const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
    const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);

    return left.focus.y < right.focus.y ? Math.max(x1, x2) : Math.min(x1, x2);
  }

  finish() {
    const endX = this.direction.x > 0 ? this.algorithm.width : 0;
    this.end = new Point(endX, this.slope * endX + this.verticalOffset);
  }

  getIntersectionPoint(other) {
    const I = Edge.getLineIntersection(this.start, this.tmpEnd, other.start, other.tmpEnd);
    if (I === null) return null;

    const wrongDirection =
      (I.x - this.start.x) * this.direction.x < 0 ||
      (I.y - this.start.y) * this.direction.y < 0 ||
      (I.x - other.start.x) * other.direction.x < 0 ||
      (I.y - other.start.y) * other.direction.y < 0;

    if (wrongDirection) return null;
    return I;
  }

  /**
   * Get intersection of two (infinite) lines
   */
  static getLineIntersection(a1, a2, b1, b2) {
    const dax = a1.x - a2.x;
    const dbx = b1.x - b2.x;
    const day = a1.y - a2.y;
    const dby = b1.y - b2.y;

    const denominator = dax * dby - day * dbx;
    if (Math.abs(denominator) < Number.EPSILON) return null; // parallel

    const A = a1.x * a2.y - a1.y * a2.x;
    const B = b1.x * b2.y - b1.y * b2.x;
    const xCoord = (A * dbx - dax * B) / denominator;
    const yCoord = (A * dby - day * B) / denominator;

    return new Point(xCoord, yCoord);
  }
}
