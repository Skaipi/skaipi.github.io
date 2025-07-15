class ZCurvePoint {
  constructor(point) {
    Object.assign(this, point); // Copy all properties
    this.zIndex = this.getZCurveIndex(point.x, point.y);
  }

  // Spread bits of 16 bit integer to every second bit of a 32 bit integer
  spreadBits(number) {
    number &= 0xffff; // Ensure number is 16 bits
    number = (number | (number << 8)) & 0x00ff00ff; // 8-bit gaps
    number = (number | (number << 4)) & 0x0f0f0f0f; // 4-bit gaps
    number = (number | (number << 2)) & 0x33333333; // 2-bit gaps
    number = (number | (number << 1)) & 0x55555555; // 1-bit gaps
    return number;
  }

  getZCurveIndex() {
    const xBits = this.spreadBits(this.x);
    const yBits = this.spreadBits(this.y);
    return (yBits << 1) | xBits;
  }
}

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

    // const zPoints = points.map(point => new ZCurvePoint(point));
    // zPoints.sort((a, b) => a.zIndex - b.zIndex);
    points.forEach((zIndex) => {
      this.root.insert(zIndex);
    });
  }
}
