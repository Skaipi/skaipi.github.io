import { Point } from "./point.js";

export class BSTNode {
  constructor() {
    this.parent = null;
    this._left = null;
    this._right = null;
  }

  get left() {
    return this._left;
  }

  set left(node) {
    this._left = node;
    if (node !== null) node.parent = this;
  }

  get right() {
    return this._right;
  }

  set right(node) {
    this._right = node;
    if (node !== null) node.parent = this;
  }

  get isLeaf() {
    return this._left === null && this._right === null;
  }

  key() {
    throw new Error("key method not implemented in BST Node class");
  }
}

/**
 * In Fortune's algorithm each leaf of the beachline tree is a growing arc
 * Each inner node is an edge between two arcs
 */
export class FortuneBST {
  constructor() {
    this.root = null;
  }

  isEmpty() {
    return this.root === null;
  }

  getEdges() {
    return this._getEdges(this.root);
  }

  _getEdges(node) {
    const result = [];
    if (node.isLeaf) return result;
    result.push(...this._getEdges(node.left));
    result.push(...this._getEdges(node.right));
    result.push(node);
    return result;
  }

  findClosestLeaf(value) {
    let result = this.root;
    while (!result.isLeaf) {
      result = result.key() > value ? result.left : result.right;
    }
    return result;
  }

  find(value, node = this.root) {
    if (node == null) return null;
    if (node.key() === value) return node;
    return value > node.key() ? this.find(node.right) : this.find(node.left);
  }

  /**
   * Successor of an edge (internal node) is always a parabola (leaf)
   */
  successor(node) {
    if (node == null) return null;

    if (node.right !== null) {
      return this.minimum(node.right);
    }

    let current = node;
    let parent = current.parent;
    while (current === parent.right) {
      current = parent;
      parent = parent.parent;
      if (parent === null) return null;
    }
    return parent;
  }

  /**
   * Predecessor of an edge (internal node) is always a parabola (leaf)
   */
  predecessor(node) {
    if (node == null) return null;

    if (node.left !== null) {
      return this.maximum(node.left);
    }

    let current = node;
    let parent = current.parent;
    while (current === parent.left) {
      current = parent;
      parent = parent.parent;
      if (parent === null) return this.root;
    }
    return parent;
  }

  maximum(node) {
    let current = node;
    while (current.right !== null) {
      current = current.right;
    }
    return current;
  }

  minimum(node) {
    let current = node;
    while (current.left !== null) {
      current = current.left;
    }
    return current;
  }

  remove(node) {
    if (node.left === null) {
      this.shiftNodes(node, node.right);
      return;
    }
    if (node.right === null) {
      this.shiftNodes(node, node.left);
      return;
    }

    const successor = this.successor(node);
    if (successor.parent !== node) {
      this.shiftNodes(successor, successor.right);
      successor.right = node.right;
      successor.right.parent = successor;
    }
    this.shiftNodes(node, successor);
    successor.left = node.left;
    successor.left.parent = successor;
  }

  shiftNodes(u, v) {
    if (u.parent === null) {
      this.root = v;
    } else if (u === u.parent.left) {
      u.parent.left = v;
    } else {
      u.parent.right = v;
    }

    if (v !== null) {
      v.parent = u.parent;
    }
  }

  replace(current, other) {
    const parent = current.parent;
    if (parent === null) {
      this.root = other;
    } else if (parent.left === current) {
      parent.left = other;
    } else {
      parent.right = other;
    }

    other.left = current.left;
    other.right = current.right;
  }
}
