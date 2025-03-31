const distance = (p1, p2) => Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);

export class Graph {
  constructor(points, createLocally = false) {
    this.items = [];

    for (let i = 0; i < points.length; i++) {
      const selectedNeighbours = [];
      let candidates = points.map((point) => ({
        x: point.x,
        y: point.y,
        distance: distance(points[i], point),
      }));

      candidates.sort((a, b) => a.distance - b.distance);
      candidates.shift(); // remove the first element, which is the point itself
      if (createLocally) candidates = candidates.slice(0, 10); // keep only the first 10 candidates

      candidates.forEach((candidate) => {
        if (selectedNeighbours.every((neighbour) => distance(neighbour, candidate) >= candidate.distance - 0.001)) {
          selectedNeighbours.push(candidate);
        }
      });

      this.items.push({
        x: points[i].x,
        y: points[i].y,
        neighbours: selectedNeighbours,
      });
    }
  }
}
