class QuadNode {
  constructor(boundary, capacity = 1) {
    this.boundary = boundary;
    this.capacity = capacity;
    this.points = [];
    this.children = [];
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
    this.points.forEach((point) => {
      this.children.forEach((child) => {
        if (child.insert(point)) return;
      });
    });
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
}

export class Quadtree {
  constructor(points, capacity = 1) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point.x > 0 && point.x < minX) minX = point.x;
      if (point.y > 0 && point.y < minY) minY = point.y;
      if (point.x < window.innerWidth && point.x > maxX) maxX = point.x;
      if (point.y < window.innerHeight && point.y > maxY) maxY = point.y;
    }

    this.root = new QuadNode(
      {
        x0: minX,
        y0: minY,
        x1: maxX,
        y1: maxY,
      },
      capacity,
    );

    points.forEach((zIndex) => {
      this.root.insert(zIndex);
    });
  }
}
