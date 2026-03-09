import { quadtree } from "https://cdn.jsdelivr.net/npm/d3-quadtree@3.0.1/+esm";

const rectDist2 = (x, y, x0, y0, x1, y1) => {
  const dx = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
  const dy = y < y0 ? y0 - y : y > y1 ? y - y1 : 0;
  return dx * dx + dy * dy;
};

function buildIndex(points) {
  const n = points.length;
  const pts = new Array(n);
  const nodes = new Array(n);

  for (let i = 0; i < n; i++) {
    const [x, y] = points[i];
    const p = { x, y, i };
    pts[i] = p;
    nodes[i] = { id: i, x, y };
  }

  return { pts, nodes };
}

function allKnnIds(qt, pts, k) {
  const root = qt.root();
  const extent = qt.extent();
  const out = new Array(pts.length);

  if (!root || !extent || k <= 0) {
    for (let i = 0; i < pts.length; i++) out[i] = [];
    return out;
  }

  for (let i = 0; i < pts.length; i++) {
    out[i] = knnIds(root, extent, pts[i], k);
  }

  return out;
}

function knnIds(root, extent, q, k) {
  const ids = new Int32Array(k);
  const d2s = new Float64Array(k);

  let found = 0;
  let maxDist = Infinity;

  // Manual DFS stack over quadtree nodes
  const nodeStack = [root];
  const x0Stack = [extent[0][0]];
  const y0Stack = [extent[0][1]];
  const x1Stack = [extent[1][0]];
  const y1Stack = [extent[1][1]];
  const boxD2Stack = [0];

  // Reused temporary buffers for up to 4 children
  const childNode = new Array(4);
  const childX0 = new Float64Array(4);
  const childY0 = new Float64Array(4);
  const childX1 = new Float64Array(4);
  const childY1 = new Float64Array(4);
  const childD2 = new Float64Array(4);

  while (nodeStack.length) {
    const node = nodeStack.pop();
    const x0 = x0Stack.pop();
    const y0 = y0Stack.pop();
    const x1 = x1Stack.pop();
    const y1 = y1Stack.pop();
    const boxD2 = boxD2Stack.pop();

    if (boxD2 > maxDist) continue;

    // Leaf node
    if (!node.length) {
      // Correct D3 leaf-chain traversal: node -> node.next -> ...
      for (let leaf = node; leaf; leaf = leaf.next) {
        const d = leaf.data;

        // Exclude only the query point itself, not all coincident points.
        if (d.i === q.i) continue;

        const dx = d.x - q.x;
        const dy = d.y - q.y;
        const dd = dx * dx + dy * dy;

        if (found === k && dd >= maxDist) continue;

        // Insert into sorted fixed-size top-k buffer.
        let pos = found < k ? found : k - 1;

        while (pos > 0 && dd < d2s[pos - 1]) {
          if (pos < k) {
            d2s[pos] = d2s[pos - 1];
            ids[pos] = ids[pos - 1];
          }
          pos--;
        }

        d2s[pos] = dd;
        ids[pos] = d.i;

        if (found < k) found++;
        if (found === k) maxDist = d2s[k - 1];
      }

      continue;
    }

    // Internal node: visit closer quadrants first.
    const xm = (x0 + x1) * 0.5;
    const ym = (y0 + y1) * 0.5;

    let childCount = 0;

    const pushChild = (child, xx0, yy0, xx1, yy1) => {
      if (!child) return;

      const d2 = rectDist2(q.x, q.y, xx0, yy0, xx1, yy1);
      if (d2 > maxDist) return;

      // Insertion-sort into tiny (<=4) temp buffer by increasing rectangle distance.
      let p = childCount;
      while (p > 0 && d2 < childD2[p - 1]) {
        childNode[p] = childNode[p - 1];
        childX0[p] = childX0[p - 1];
        childY0[p] = childY0[p - 1];
        childX1[p] = childX1[p - 1];
        childY1[p] = childY1[p - 1];
        childD2[p] = childD2[p - 1];
        p--;
      }

      childNode[p] = child;
      childX0[p] = xx0;
      childY0[p] = yy0;
      childX1[p] = xx1;
      childY1[p] = yy1;
      childD2[p] = d2;
      childCount++;
    };

    pushChild(node[0], x0, y0, xm, ym);
    pushChild(node[1], xm, y0, x1, ym);
    pushChild(node[2], x0, ym, xm, y1);
    pushChild(node[3], xm, ym, x1, y1);

    // Push farthest first so nearest gets popped first.
    for (let i = childCount - 1; i >= 0; i--) {
      nodeStack.push(childNode[i]);
      x0Stack.push(childX0[i]);
      y0Stack.push(childY0[i]);
      x1Stack.push(childX1[i]);
      y1Stack.push(childY1[i]);
      boxD2Stack.push(childD2[i]);
    }
  }

  return Array.from(ids.subarray(0, found));
}

export function nnGraph(points, k = 5, quadTree = null) {
  const { pts, nodes } = buildIndex(points);
  const qt =
    quadTree === null
      ? quadtree()
          .x((d) => d.x)
          .y((d) => d.y)
          .addAll(pts)
      : quadTree;
  const neighbors = allKnnIds(qt, pts, k);

  const maxEdges = pts.length * Math.min(k, Math.max(0, pts.length - 1));
  const edges = new Array(maxEdges);
  let e = 0;

  for (let i = 0; i < neighbors.length; i++) {
    const nbrs = neighbors[i];
    for (let r = 0; r < nbrs.length; r++) {
      edges[e++] = { source: i, target: nbrs[r] };
    }
  }

  edges.length = e;
  return { nodes, edges };
}

export function rknnGraph(points, k = 5, T = 1, quadTree = null) {
  const { pts, nodes } = buildIndex(points);
  const qt =
    quadTree === null
      ? quadtree()
          .x((d) => d.x)
          .y((d) => d.y)
          .addAll(pts)
      : quadTree;
  const neighbors = allKnnIds(qt, pts, k);

  // O(1)-ish reverse-rank lookup instead of findIndex on every edge.
  const rankMaps = new Array(neighbors.length);
  for (let i = 0; i < neighbors.length; i++) {
    const m = new Map();
    const nbrs = neighbors[i];
    for (let r = 0; r < nbrs.length; r++) m.set(nbrs[r], r);
    rankMaps[i] = m;
  }

  const edges = [];
  for (let i = 0; i < neighbors.length; i++) {
    const nbrs = neighbors[i];
    for (let r1 = 0; r1 < nbrs.length; r1++) {
      const j = nbrs[r1];
      const r2 = rankMaps[j].get(i);
      if (r2 !== undefined && Math.abs(r2 - r1) <= T) {
        edges.push({ source: i, target: j });
      }
    }
  }

  return { nodes, edges };
}
