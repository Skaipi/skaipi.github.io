const POINT_MASS = 1.0;

// Maps 8-bit value to 16-bit with zeroes between each bit of the original value.
const LookupTable = new Uint16Array(256);

for (let i = 0; i < 256; ++i) {
  let x = i;
  x = (x | (x << 4)) & 0x0f0f;
  x = (x | (x << 2)) & 0x3333;
  x = (x | (x << 1)) & 0x5555;
  LookupTable[i] = x;
}

const UnlookupTable = new Uint8Array(1 << 16);
for (let i = 0; i < 256; ++i) {
  UnlookupTable[LookupTable[i]] = i;
}

const morton32EncodeInt = (x, y) =>
  ((LookupTable[y >>> 8] << 17) |
    (LookupTable[x >>> 8] << 16) |
    (LookupTable[y & 255] << 1) |
    LookupTable[x & 255]) >>>
  0; // Ensure unsigned value

export const deinterleave = (v) => UnlookupTable[v & 0x5555];

export const morton32DecodeInt = (code) => {
  const x = deinterleave(code) | (deinterleave(code >>> 16) << 8);

  const y = deinterleave(code >>> 1) | (deinterleave(code >>> 17) << 8);

  return { x, y };
};

export class LinearQuadtree {
  constructor({ xCoords, yCoords }, maxDepth = 6) {
    // Containers for center of mass
    this.comX = new Float32Array(2 * xCoords.length);
    this.comY = new Float32Array(2 * xCoords.length);
    this.mass = new Float32Array(2 * xCoords.length);

    this.maxDepth = maxDepth;
    this.cells = [];
    this._entries = [];

    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    this._computeBoundary(xCoords, yCoords);

    this.width = this.maxX - this.minX;
    this.height = this.maxY - this.minY;

    this.widthBits = Math.ceil(Math.log2(this.maxX - this.minX + 1));
    this.heightBits = Math.ceil(Math.log2(this.maxY - this.minY + 1));

    this.widthRange = Math.pow(2, this.widthBits);
    this.heightRange = Math.pow(2, this.heightBits);
    this.mostSignificantBit = Math.max(this.widthBits, this.heightBits) * 2;

    // Encode cells
    this.sx =
      this.maxX === this.minX ? 0 : this.widthRange / (this.maxX - this.minX);
    this.sy =
      this.maxY === this.minY ? 0 : this.heightRange / (this.maxY - this.minY);
    for (let i = 0; i < xCoords.length; ++i) {
      const gx = Math.floor((xCoords[i] - this.minX) * this.sx);
      const gy = Math.floor((yCoords[i] - this.minY) * this.sy);
      const key = morton32EncodeInt(gx, gy);

      this._entries.push({ index: i, key, gx, gy });
    }
    this._entries.sort((a, b) => a.key - b.key);

    // Build the quadtree
    this.root = this.buildTree(0, xCoords.length, 0);
  }

  buildTree(start, end, level) {
    const entry = this._entries[start];
    const thisShift = (this.maxDepth - level) * 2;
    const nextShift = (this.maxDepth - level - 1) * 2;
    const keyPrefix = entry.key >>> thisShift;
    const cell = new LinearQuadtreeNode(
      keyPrefix,
      entry.key,
      level,
      start,
      end,
    );
    const cellIndex = this.cells.push(cell) - 1;

    let nodeMass = POINT_MASS;
    let nodeX = entry.gx;
    let nodeY = entry.gy;

    if (level === this.maxDepth || end - start <= 1) {
      this.mass[cellIndex] = nodeMass;
      this.comX[cellIndex] = nodeX;
      this.comY[cellIndex] = nodeY;
      return cellIndex;
    }

    const childStarts = new Array(5).fill(start);
    let currentPrefix = entry.key >>> nextShift;
    let child = 0;
    for (let i = start + 1; i < end; ++i) {
      const childEntry = this._entries[i];
      nodeMass += POINT_MASS;
      nodeX += childEntry.gx;
      nodeY += childEntry.gy;

      const prefix = childEntry.key >>> nextShift;
      if (prefix !== currentPrefix) {
        child++;
        childStarts[child] = i;
        currentPrefix = prefix;
      }
    }
    childStarts[child + 1] = end;

    nodeX /= end - start;
    nodeY /= end - start;

    for (let c = 0; c <= child; ++c) {
      const childIdx = this.buildTree(
        childStarts[c],
        childStarts[c + 1],
        level + 1,
      );
      cell.children.push(childIdx);
    }

    this.mass[cellIndex] = nodeMass;
    this.comX[cellIndex] = nodeX;
    this.comY[cellIndex] = nodeY;
    return cellIndex;
  }

  encodeCell(x, y) {
    const gx = Math.floor((x - this.minX) * this.sx);
    const gy = Math.floor((y - this.minY) * this.sy);
    return morton32EncodeInt(gx, gy);
  }

  decodeCell(code) {
    const { x: xi, y: yi } = morton32DecodeInt(code);

    const invX =
      this.maxX === this.minX ? 0 : (this.maxX - this.minX) / this.widthRange;
    const invY =
      this.maxY === this.minY ? 0 : (this.maxY - this.minY) / this.heightRange;

    return {
      x: this.minX + xi * invX,
      y: this.minY + yi * invY,
    };
  }

  _computeBoundary(xCoords, yCoords) {
    for (let i = 0; i < xCoords.length; ++i) {
      if (xCoords[i] < this.minX) this.minX = xCoords[i];
      if (xCoords[i] > this.maxX) this.maxX = xCoords[i];
      if (yCoords[i] < this.minY) this.minY = yCoords[i];
      if (yCoords[i] > this.maxY) this.maxY = yCoords[i];
    }
  }
}

class LinearQuadtreeNode {
  constructor(key, fullKey, level, start, end) {
    this.key = key; // Morton short prefix
    this.fullKey = fullKey;
    this.level = level;
    this.start = start;
    this.end = end;
    this.children = [];
  }

  get count() {
    return this.end - this.start;
  }

  get mass() {
    return this.count * POINT_MASS;
  }
}
