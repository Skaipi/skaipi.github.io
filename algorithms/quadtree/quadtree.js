class QuadNode {
  constructor(boundary, capacity = 1) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.children = [];
    this.mass = 0;
    this.comX = 0;
    this.comY = 0;
  }

  contains(point) {
    const { x0, y0, x1, y1 } = this.boundary;
    return point.x >= x0 && point.x <= x1 && point.y >= y0 && point.y <= y1;
  }

  subdivide() {
    const { x0, y0, x1, y1 } = this.boundary;
    const mx = (x1 - x0) / 2;
    const my = (y1 - y0) / 2;
    this.children = [
      new QuadNode({ x0, y0, x1: x1 - mx, y1: y1 - my }, this.capacity), // NW
      new QuadNode({ x0: x0 + mx, y0, x1, y1: y1 - my }, this.capacity), // NE
      new QuadNode({ x0, y0: y0 + my, x1: x1 - mx, y1 }, this.capacity), // SW
      new QuadNode({ x0: x0 + mx, y0: y0 + my, x1, y1 }, this.capacity), // SE
    ];

    // Pass over points to children
    for (const point of this.points) {
      for (const child of this.children) {
        if (child.insert(point)) break;
      }
    }
    this.points = [];
  }

  insert(point) {
    if (!this.contains(point)) return false;

    if (this.points.length < this.capacity && this.children.length === 0) {
      this.points.push(point);
      return true;
    }

    if (this.children.length === 0) {
      this.subdivide();
    }

    for (const child of this.children) {
      if (child.insert(point) === true) return true;
    }
    return false; // should not happen
  }

  updateMass() {
    if (this.children.length === 0) {
      this.updateLeafMass();
      return;
    }

    let mass = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const child of this.children) {
      child.updateMass();
      mass += child.mass;
      weightedX += child.mass * child.comX;
      weightedY += child.mass * child.comY;
    }

    this.mass = mass;
    this.comX = mass > 0 ? weightedX / mass : 0;
    this.comY = mass > 0 ? weightedY / mass : 0;
  }

  updateLeafMass() {
    let mass = 0;
    let weightedX = 0;
    let weightedY = 0;

    for (const point of this.points) {
      const pointMass = point.m ?? 1;
      mass += pointMass;
      weightedX += pointMass * point.x;
      weightedY += pointMass * point.y;
    }

    this.mass = mass;
    this.comX = mass > 0 ? weightedX / mass : 0;
    this.comY = mass > 0 ? weightedY / mass : 0;
  }
}

export class Quadtree {
  constructor(points, capacity = 1) {
    if (points.length === 0) {
      this.root = new QuadNode({ x0: 0, y0: 0, x1: 1, y1: 1 }, capacity);
      return;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point.x < minX) minX = point.x;
      if (point.y < minY) minY = point.y;
      if (point.x > maxX) maxX = point.x;
      if (point.y > maxY) maxY = point.y;
    }

    const centerX = (minX + maxX) * 0.5;
    const centerY = (minY + maxY) * 0.5;
    const halfSize = Math.max(maxX - minX, maxY - minY, 1) * 0.5 + 1;

    this.root = new QuadNode(
      {
        x0: centerX - halfSize,
        y0: centerY - halfSize,
        x1: centerX + halfSize,
        y1: centerY + halfSize,
      },
      capacity,
    );

    points.forEach((zIndex) => {
      this.root.insert(zIndex);
    });

    this.root.updateMass();
  }
}
