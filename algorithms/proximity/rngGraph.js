const dist2 = (p1, p2) => Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);

export function relativeNeighborGraph(points, createLocally = false) {
  const pts = points.map(([x, y], i) => ({ x, y, i }));
  const nodes = pts.map((p) => ({ id: p.i, x: p.x, y: p.y }));
  const edges = [];

  for (let i = 0; i < pts.length; i++) {
    const selectedNeighbours = [];
    let candidates = pts.map((point) => ({
      id: point.i,
      x: point.x,
      y: point.y,
      distance: dist2(pts[i], point),
    }));

    candidates.sort((a, b) => a.distance - b.distance);
    candidates.shift(); // remove the first element, which is the point itself
    if (createLocally) candidates = candidates.slice(0, 10); // keep only the first 10 candidates

    candidates.forEach((candidate) => {
      if (selectedNeighbours.every((neighbour) => dist2(neighbour, candidate) >= candidate.distance - 0.0001)) {
        selectedNeighbours.push(candidate);
      }
    });

    for (let j = 0; j < selectedNeighbours.length; j++) {
      edges.push({ source: i, target: selectedNeighbours[j].id });
    }
  }

  return { nodes, edges };
}
