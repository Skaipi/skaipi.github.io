import { BSTNode } from "./binaryTree.js";

/**
 * This class implements beachline arc with focal point
 * Implements BinaryTreeNode interface
 */
export class Parabola extends BSTNode {
  constructor(algorithm, focus) {
    super();

    this.algorithm = algorithm;
    this.focus = focus; // focal point of parabola
    this.circleEvent = null;
  }

  key() {
    return this.getChildrenBreakpointX();
  }

  /**
   * This function computes coefficients of quadratic equation of parabola
   */
  getCoefficients() {
    const dp = 2 * (this.focus.y - this.algorithm.sweepLine);
    const a = 1 / dp;
    const b = (-2 * this.focus.x) / dp;
    const c = this.algorithm.sweepLine + dp / 4 + this.focus.x ** 2 / dp;
    return [a, b, c];
  }

  /**
   * Given focal point of parabola, find point on parabola with given x coordinate
   * NOTES:
   * Distance from any point on the parabola to the focus p is: sqrt((x - p.x)**2 + (y - p.y)**2)
   * Distance from any point on the parabola to the sweep line is: |y - sweepLine|
   * Those two distances MUST be equal. With little algebra one obtains y in terms of x
   */
  getY(x) {
    const [a, b, c] = this.getCoefficients();
    return a * x ** 2 + b * x + c;
  }
}
