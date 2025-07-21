const POINT_MASS = 1.0;

// Maps 8-bit value to 16-bit with zeroes between each bit of the original value.
const LookupTable = new Uint16Array(256);

for (let i = 0; i < 256; ++i) {
  let x = i;
  x = (x | (x << 4)) & 0x0f0f; // 0000111100001111 - move 4 msb
  x = (x | (x << 2)) & 0x3333; // 0011001100110011 - move every 2 bits chunks
  x = (x | (x << 1)) & 0x5555; // 0101010101010101 - move every second bit
  LookupTable[i] = x;
}

const UnlookupTable = new Uint8Array(1 << 16);
for (let i = 0; i < 256; ++i) {
  UnlookupTable[LookupTable[i]] = i;
}

// split each integer into 8-bit chunks and spread each chunk using lookup table
const morton16EncodeInt = (x, y) =>
  ((LookupTable[y >>> 8] << 17) | (LookupTable[x >>> 8] << 16) | (LookupTable[y & 255] << 1) | LookupTable[x & 255]) >>>
  0; // Ensure unsigned value

export const deinterleave = (v) => UnlookupTable[v & 0x5555];

export const morton16DecodeInt = (code) => {
  const x = deinterleave(code) | (deinterleave(code >>> 16) << 8);
  const y = deinterleave(code >>> 1) | (deinterleave(code >>> 17) << 8);
  return { x, y };
};

export class LinearQuadtree {
  constructor({ xCoords, yCoords, size }, maxDepth = 6) {
    // Containers for center of mass
    this.comX = new Float32Array(2 * xCoords.length);
    this.comY = new Float32Array(2 * xCoords.length);
    this.mass = new Float32Array(2 * xCoords.length);

    this.maxDepth = maxDepth;
    this.cells = [];
    this._entries = [];

    this.minX = 0;
    this.minY = 0;
    this.maxX = size;
    this.maxY = size;
    this.size = size;
    this.sizeBits = Math.ceil(Math.log2(size));

    // Encode cells
    this.sx = size;
    this.sy = size;
    for (let i = 0; i < xCoords.length; ++i) {
      const gx = Math.floor(xCoords[i]);
      const gy = Math.floor(yCoords[i]);
      const key = morton16EncodeInt(gx, gy);

      this._entries.push({ index: i, key, gx, gy, x: xCoords[i], y: yCoords[i] });
    }
    this._entries.sort((a, b) => a.key - b.key);

    // Build the quadtree
    this.root = this.buildTree(0, xCoords.length, 0);
  }

  buildTree(start, end, level) {
    const entry = this._entries[start];
    const thisShift = (this.sizeBits - level) * 2;
    const nextShift = (this.sizeBits - level - 1) * 2;
    const keyPrefix = entry.key >>> thisShift;
    const cell = new LinearQuadtreeNode(keyPrefix, entry.key, level, start, end);
    const cellIndex = this.cells.push(cell) - 1;

    let nodeMass = POINT_MASS;
    let nodeX = entry.x;
    let nodeY = entry.y;

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
      nodeX += childEntry.x;
      nodeY += childEntry.y;

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
      const childIdx = this.buildTree(childStarts[c], childStarts[c + 1], level + 1);
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
    return morton16EncodeInt(gx, gy);
  }

  decodeCell(code) {
    const { x: xi, y: yi } = morton16DecodeInt(code);

    const invX = this.maxX === this.minX ? 0 : (this.maxX - this.minX) / this.size;
    const invY = this.maxY === this.minY ? 0 : (this.maxY - this.minY) / this.size;

    return {
      x: this.minX + xi * invX,
      y: this.minY + yi * invY,
    };
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
