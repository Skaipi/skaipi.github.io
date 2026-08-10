const DEFAULT_POINT_COUNT = 20;
const DEFAULT_LAYER_COUNT = 3;
const DEFAULT_DISTRIBUTION_RATE = 1.4;

const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

function createPoints(pointCount, layerCount, distributionRate) {
  const points = [];

  for (let i = 0; i < pointCount; i += 1) {
    const layer = Math.floor(-Math.log(Math.random()) * distributionRate);

    points.push({
      id: points.length,
      x: 0.1 + Math.random() * 0.8,
      y: 0.1 + Math.random() * 0.8,
      maxLayer: Math.min(layer, layerCount - 1),
    });
  }

  return points;
}

export function createHnswModel({
  pointCount = DEFAULT_POINT_COUNT,
  layerCount = DEFAULT_LAYER_COUNT,
  distributionRate = DEFAULT_DISTRIBUTION_RATE,
} = {}) {
  const points = createPoints(pointCount, layerCount, distributionRate);
  const layers = [];

  for (let layer = 0; layer < layerCount; layer += 1) {
    const nodes = points.filter((point) => point.maxLayer >= layer);
    layers.push({ level: layer, nodes, edges: createRngEdges(nodes) });
  }

  return { layers };
}

function createRngEdges(nodes) {
  const edges = [];

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const source = nodes[i];
      const target = nodes[j];
      const distance = dist2(source, target);
      let isRelativeNeighbor = true;

      for (const point of nodes) {
        if (point.id === source.id || point.id === target.id) continue;

        if (dist2(source, point) < distance && dist2(target, point) < distance) {
          isRelativeNeighbor = false;
          break;
        }
      }

      if (isRelativeNeighbor) {
        edges.push({ source: source.id, target: target.id });
      }
    }
  }

  return edges;
}
