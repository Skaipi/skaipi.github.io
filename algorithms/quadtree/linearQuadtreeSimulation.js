import { LinearQuadtree } from "./linearQuadtree.js";

// ===== TUNABLE CONSTANTS ======================================================
const N = 600; // Number of particles
const G              = 20.0;   // grav. constant in screen units
const THETA          = 0.45;  // Barnes–Hut opening angle (smaller = better ≈ slower)
const EPS            = 8;   // Plummer softening (px) – prevents ejections
const PARTICLE_MASS  = 1.0;   // mass of every star (can vary, but unnecessary here)
const SPLIT_PROB     = 0.55;  // P(split) at each recursion level when making the fractal
const MAX_DEPTH      = 4;     // deeper → snowflakier clusters, ≈ 2^depth cells
const DT_MIN   = 0.001;
const DT_MAX   = 0.02;
const DIRECTION = Math.random() <-1.5 ? Math.PI/2 : -Math.PI/2
let dt = 0.005;

// Create arrays for particle properties
const x = new Float32Array(N);
const y = new Float32Array(N);
const vx = new Float32Array(N);
const vy = new Float32Array(N);
const ax = new Float32Array(N);
const ay = new Float32Array(N);

export const getState = () => ({ x, y });

// force applied on particle by the node
export const forceOn = (tree, cellIndex, pIndex) => {
  const node = tree.cells[cellIndex];
  const comX = tree.comX[cellIndex];
  const comY = tree.comY[cellIndex];
  const mass = tree.mass[cellIndex];

  // if mass is zero or node represents the particle itself, return zero force
  if (mass === 0 || (node.count === 1 && node.start === pIndex))
    return [0, 0];

  const dx = comX - x[pIndex];
  const dy = comY - y[pIndex];
  const distSq = dx*dx + dy*dy + EPS*EPS;

  // Width of node
  const cellWidth = tree.width / (1 << node.level);
  const cellHeight = tree.height / (1 << node.level);

  if (node.level === tree.maxDepth || (cellWidth*cellHeight) / distSq < THETA*THETA) {
    // Treat entire node as one mass
    const invDist3 = 1 / (distSq * Math.sqrt(distSq));
    const force = G * mass * invDist3;
    return [force*dx, force*dy];
  } else {
    // Resolve children
    let fx = 0, fy = 0;
    for (const childIdx of node.children) {
      const [cx, cy] = forceOn(tree, childIdx, pIndex);
      fx += cx;  fy += cy;
    }
    return [fx, fy];
  }
}

export function generateHierarchicalCluster(width, height) {
  const rootSize = 0.6 * Math.min(width, height);
  const x0 = width/2 - rootSize/2;
  const y0 = height/2 - rootSize/2;

  // Each particle individually walks a random path down the quad‑tree. Much
  // simpler than bookkeeping cell occupancies, and statistically identical.
  for (let i = 0; i < N; ++i) {
    let cx = x0, cy = y0, size = rootSize;
    for (let d = 0; d < MAX_DEPTH; ++d) {
      if (Math.random() >= SPLIT_PROB) break;
      size /= 2;
      const quad = Math.floor(Math.random() * 4);
      if (quad & 1) cx += size; // East
      if (quad & 2) cy += size; // South
    }
    // Avaoid overlap with random offset
    x[i] = cx + Math.random() * size;
    y[i] = cy + Math.random() * size;
  }

  for (let i = 0; i < N; ++i) virialKick(i, width, height);
  virialise();
  return { x, y };
}

function getTimestep() {
  let aMax = 0, vMax = 0;
  for (let i = 0; i < N; ++i) {
    aMax = Math.max(aMax, Math.hypot(ax[i], ay[i]));
    vMax = Math.max(vMax, Math.hypot(vx[i], vy[i])); // Maybe not needed
  }
  const eta = 0.2; // safety factor
  const dtAcc = eta * Math.sqrt(EPS / (aMax + 1e-30));
  const dtVel = eta * EPS / (vMax + 1e-30);
  return Math.min(DT_MAX, Math.max(DT_MIN, Math.min(dtAcc, dtVel)));
}

function virialKick(index, w, h) {
  // circular speed in the global potential
  const dx = x[index] - w*0.5;
  const dy = y[index] - h*0.5;
  const r  = Math.hypot(dx,dy) + 1e-9;
  const v  = Math.sqrt(G*x.length*PARTICLE_MASS / (2*r));
  const phi = Math.atan2(dy,dx) + DIRECTION;
  vx[index] = v*Math.cos(phi);
  vy[index] = v*Math.sin(phi);
}

function virialise() {
  let U = 0, K = 0;
  for (let i = 0; i < N; ++i) {
    K += 0.5 * PARTICLE_MASS * (vx[i]*vx[i] + vy[i]*vy[i]);
    for (let j = i+1; j < N; ++j) {
      const dx = x[i] - x[j], dy = y[i] - y[j];
      U -= G * PARTICLE_MASS * PARTICLE_MASS /  // mass of particle i and j
           Math.sqrt(dx*dx + dy*dy + EPS*EPS);
    }
  }
  const scale = Math.sqrt((-0.5*U) / K);   // want 2 K + U = 0
  
  for (let i = 0; i < N; ++i) {
    vx[i] *= scale;
    vy[i] *= scale;
  }
}

export function step(width, height) {
  // Update positions
  for (let i = 0; i < N; ++i) {
    vx[i] += 0.5 * ax[i] * dt;
    vy[i] += 0.5 * ay[i] * dt;
    x[i] += vx[i] * dt;
    y[i] += vy[i] * dt;

    if (x[i] < 0) { x[i] = 0; vx[i] = -vx[i]; }
    else if (x[i] > width) { x[i] = width; vx[i] = -vx[i]; }

    if (y[i] < 0) { y[i] = 0; vy[i] = -vy[i]; }
    else if (y[i] > height){ y[i] = height; vy[i] = -vy[i]; }
  }

  // Update forces
  const tree = new LinearQuadtree({xCoords: x, yCoords: y}, MAX_DEPTH);
  for (let i = 0; i < N; ++i) {
    const [fx, fy] = forceOn(tree, tree.root, i);
    ax[i] = fx / PARTICLE_MASS;
    ay[i] = fy / PARTICLE_MASS;
    vx[i] += 0.5 * ax[i] * dt;
    vy[i] += 0.5 * ay[i] * dt;
  }

  dt = getTimestep();
  return tree;
}