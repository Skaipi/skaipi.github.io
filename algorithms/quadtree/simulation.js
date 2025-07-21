import { Quadtree } from "./quadtree.js";

// ===== TUNABLE CONSTANTS ======================================================
const N = 600;
const G = 20.0; // grav. constant in screen units
const THETA = 0.45; // Barnes–Hut opening angle (smaller = better ≈ slower)
const EPS = 8; // Plummer softening (px) – prevents ejections
const PARTICLE_MASS = 1.0; // mass of every star (can vary, but unnecessary here)
const SPLIT_PROB = 0.55;
const MAX_DEPTH = 6;
const DT_MIN = 0.001;
const DT_MAX = 0.02;
const DIRECTION = Math.random() < -1.5 ? Math.PI / 2 : -Math.PI / 2;
let dt = 0.005;

class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.m = PARTICLE_MASS;
  }
}

const particles = [];

export const getState = () => particles;

// force applied on particle by the node
export const forceOn = (node, particle) => {
  const { mass, comX, comY } = accumulate(node);

  // if mass is zero or node represents the particle itself, return zero force
  if (mass === 0 || (node.points.length === 1 && node.points[0].x === particle.x && node.points[0].y === particle.y))
    return [0, 0];

  const dx = comX - particle.x;
  const dy = comY - particle.y;
  const distSq = dx * dx + dy * dy + EPS * EPS;

  // Width of node
  const cellWidth = node.boundary.x1 - node.boundary.x0;
  const cellHeight = node.boundary.y1 - node.boundary.y0;

  if (node.children.length === 0 || (cellWidth * cellHeight) / distSq < THETA * THETA) {
    // Treat entire node as one mass
    const invDist3 = 1 / (distSq * Math.sqrt(distSq));
    const force = G * mass * invDist3;
    return [force * dx, force * dy];
  } else {
    // Resolve children
    let fx = 0,
      fy = 0;
    for (const c of node.children) {
      const [cx, cy] = forceOn(c, particle);
      fx += cx;
      fy += cy;
    }
    return [fx, fy];
  }
};

// TODO: Move this to a quadtree constructor
export const accumulate = (node) => {
  // Dirty trick to cache the payload
  if (node._payload !== undefined) return node._payload;

  // Leaf node
  if (node.children.length === 0) {
    // Compute payload for the leaf node
    node._payload = {
      mass: node.points.length * PARTICLE_MASS,
      comX: 0,
      comY: 0,
    };

    for (const p of node.points) {
      node._payload.comX += p.x;
      node._payload.comY += p.y;
    }
    node._payload.comX /= node.points.length;
    node._payload.comY /= node.points.length;
    return node._payload;
  }

  // Internal node
  let combinedMass = 0,
    combinedX = 0,
    combinedY = 0;
  for (const child of node.children) {
    const { mass, comX, comY } = accumulate(child);
    combinedMass += mass;
    combinedX += mass * comX;
    combinedY += mass * comY;
  }

  node._payload = {
    mass: combinedMass,
    comX: combinedMass > 0 ? combinedX / combinedMass : 0,
    comY: combinedMass > 0 ? combinedY / combinedMass : 0,
  };
  return node._payload;
};

export function generateHierarchicalCluster(width, height) {
  const rootSize = 0.6 * Math.min(width, height);
  const x0 = width / 2 - rootSize / 2;
  const y0 = height / 2 - rootSize / 2;

  // Each particle individually walks a random path down the quad‑tree. Much
  // simpler than bookkeeping cell occupancies, and statistically identical.
  for (let i = 0; i < N; ++i) {
    let cx = x0,
      cy = y0,
      size = rootSize;
    for (let d = 0; d < MAX_DEPTH; ++d) {
      if (Math.random() >= SPLIT_PROB) break;
      size /= 2;
      const quad = Math.floor(Math.random() * 4);
      if (quad & 1) cx += size; // East
      if (quad & 2) cy += size; // South
    }
    // Avaoid overlap with random offset
    const x = cx + Math.random() * size;
    const y = cy + Math.random() * size;
    particles.push(new Particle(x, y));
  }

  particles.forEach((p) => virialKick(p, width, height, particles));
  virialise(particles);
  return particles;
}

function getTimestep(particles) {
  let aMax = 0,
    vMax = 0;
  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    aMax = Math.max(aMax, Math.hypot(p.ax, p.ay));
    vMax = Math.max(vMax, Math.hypot(p.vx, p.vy)); // Maybe not needed
  }
  const eta = 0.2; // safety factor
  const dtAcc = eta * Math.sqrt(EPS / (aMax + 1e-30));
  const dtVel = (eta * EPS) / (vMax + 1e-30);
  return Math.min(DT_MAX, Math.max(DT_MIN, Math.min(dtAcc, dtVel)));
}

function virialKick(p, w, h, particles) {
  // circular speed in the global potential
  const dx = p.x - w * 0.5;
  const dy = p.y - h * 0.5;
  const r = Math.hypot(dx, dy) + 1e-9;
  const v = Math.sqrt((G * particles.length * PARTICLE_MASS) / (2 * r));
  const phi = Math.atan2(dy, dx) + DIRECTION;
  p.vx = v * Math.cos(phi);
  p.vy = v * Math.sin(phi);
}

function virialise(particles) {
  let U = 0,
    K = 0;
  for (let i = 0; i < particles.length; ++i) {
    const pi = particles[i];
    K += 0.5 * pi.m * (pi.vx * pi.vx + pi.vy * pi.vy);
    for (let j = i + 1; j < particles.length; ++j) {
      const pj = particles[j];
      const dx = pi.x - pj.x,
        dy = pi.y - pj.y;
      U -= (G * pi.m * pj.m) / Math.sqrt(dx * dx + dy * dy + EPS * EPS);
    }
  }
  const scale = Math.sqrt((-0.5 * U) / K); // want 2 K + U = 0

  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    p.vx *= scale;
    p.vy *= scale;
  }
}

export function step(width, height) {
  // Update positions
  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    p.vx += 0.5 * p.ax * dt;
    p.vy += 0.5 * p.ay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x < 0) {
      p.x = 0;
      p.vx = -p.vx;
    } else if (p.x > width) {
      p.x = width;
      p.vx = -p.vx;
    }

    if (p.y < 0) {
      p.y = 0;
      p.vy = -p.vy;
    } else if (p.y > height) {
      p.y = height;
      p.vy = -p.vy;
    }
  }

  // Update forces
  const treeCapacity = 4;
  const tree = new Quadtree(particles, treeCapacity);
  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    const [fx, fy] = forceOn(tree.root, p);
    p.ax = fx / p.m;
    p.ay = fy / p.m;
    p.vx += 0.5 * p.ax * dt;
    p.vy += 0.5 * p.ay * dt;
  }

  dt = getTimestep(particles);
  return tree;
}
