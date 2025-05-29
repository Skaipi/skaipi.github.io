import { Quadtree } from "./quadtree.js";

// ===== TUNABLE CONSTANTS ======================================================
const G              = 20.0;   // grav. constant in screen units
const THETA          = 0.55;  // Barnes–Hut opening angle (smaller = better ≈ slower)
const EPS            = 4;   // Plummer softening (px) – prevents ejections
const DT             = 0.002;   // timestep (px frame⁻¹  √(px / G·m)) – adjust to taste
const PARTICLE_MASS  = 1.0;   // mass of every star (can vary, but unnecessary here)
const SPLIT_PROB     = 0.55;  // P(split) at each recursion level when making the fractal
const MAX_DEPTH      = 6;     // deeper → snowflakier clusters, ≈ 2^depth cells


class Particle {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.m  = PARTICLE_MASS;
  }
}

// force applied on particle by the node
export const forceOn = (node, particle) => {
  const {mass, comX, comY} = accumulate(node);
  
  // if mass is zero or node represents the particle itself, return zero force
  if (mass === 0 || (node.points.length === 1 && node.points[0].x === particle.x && node.points[0].y === particle.y))
    return [0, 0];

  const dx = comX - particle.x;
  const dy = comY - particle.y;
  const distSq = dx*dx + dy*dy + EPS*EPS;

  // Width of node
  const cellWidth = node.boundary.x1 - node.boundary.x0;

  if (node.children.length === 0 || (cellWidth*cellWidth) / distSq < THETA*THETA) {
    // Treat entire node as one mass
    const invDist3 = 1 / (distSq * Math.sqrt(distSq));
    const force = G * mass * invDist3;
    return [force*dx, force*dy];
  } else {
    // Resolve children
    let fx = 0, fy = 0;
    for (const c of node.children) {
      const [cx, cy] = forceOn(c, particle);
      fx += cx;  fy += cy;
    }
    return [fx, fy];
  }
}

// Get properties of the node
export const accumulate = (node) => {
  // Leaf node
  if (node.children.length === 0) {
    // Empty leaf node
    if (node.points.length === 0) return {mass: 0, comX: 0, comY: 0};

    const p = node.points[0];
    return {
      mass: PARTICLE_MASS,
      comX: p.x,
      comY: p.y
    };
  }

  // Internal node
  let m = 0, cx = 0, cy = 0;
  for (const c of node.children) {
    const {mass, comX, comY} = accumulate(c);
    m  += mass;
    cx += mass * comX;
    cy += mass * comY;
  }

  if (m <= 0) return {mass: 0, comX: 0, comY: 0};

  return {
    mass: m,
    comX: cx / m,
    comY: cy / m
  };
}

// ===== FRACTAL CLUSTER GENERATOR ============================================
export function generateHierarchicalCluster(n, w, h, depth = MAX_DEPTH, splitProb = SPLIT_PROB) {
  const rootSize = 0.6 * Math.min(w, h);                    // keep a margin
  const x0 = w/2 - rootSize/2;
  const y0 = h/2 - rootSize/2;
  const pts = [];

  // Each particle individually walks a random path down the quad‑tree. Much
  // simpler than bookkeeping cell occupancies, and statistically identical.
  for (let i = 0; i < n; ++i) {
    let cx = x0, cy = y0, size = rootSize;
    for (let d = 0; d < depth; ++d) {
      if (Math.random() >= splitProb) break;  // stop splitting here
      size /= 2;
      const quad = Math.floor(Math.random() * 4);
      if (quad & 1) cx += size;              // East
      if (quad & 2) cy += size;              // South
    }
    // Uniform position within final cell + tiny jitter so no two overlap exactly
    const x = cx + Math.random() * size;
    const y = cy + Math.random() * size;
    pts.push(new Particle(x, y));
  }

  pts.forEach(p => virialKick(p, w, h, pts));
  virialise(pts);
  return pts;
}

function timestep(particles) {
  let aMax = 0;
  for (const p of particles) {
    const a = Math.hypot(p.ax, p.ay);
    if (a > aMax) aMax = a;
  }
  const eta = 0.2; // safety factor
  return eta * Math.sqrt(EPS / (aMax + 1e-30));
}

let dt = 0.2;

function virialKick(p, w, h, particles) {
  // circular speed in the global potential
  const dx = p.x - w*0.5;
  const dy = p.y - h*0.5;
  const r  = Math.hypot(dx,dy) + 1e-9;
  const v  = Math.sqrt(G*particles.length*PARTICLE_MASS / (2*r));
  const phi = Math.atan2(dy,dx) + (Math.random()<0.5?Math.PI/2:-Math.PI/2); // random pro/retro
  p.vx = v*Math.cos(phi);
  p.vy = v*Math.sin(phi);
}

function virialise(particles) {
  let U = 0, K = 0;
  for (let i = 0; i < particles.length; ++i) {
    const pi = particles[i];
    K += 0.5 * pi.m * (pi.vx*pi.vx + pi.vy*pi.vy);
    for (let j = i+1; j < particles.length; ++j) {
      const pj = particles[j];
      const dx = pi.x - pj.x, dy = pi.y - pj.y;
      U -= G * pi.m * pj.m /
           Math.sqrt(dx*dx + dy*dy + EPS*EPS);
    }
  }
  const scale = Math.sqrt((-0.5*U) / K);   // want 2 K + U = 0
  for (const p of particles) {
    p.vx *= scale;
    p.vy *= scale;
  }
}

export function step(particles, width, height) {
  for (const p of particles) {
    p.vx += 0.5 * p.ax * DT;
    p.vy += 0.5 * p.ay * DT;
  }

  for (const p of particles) {
    p.x += p.vx * DT;
    p.y += p.vy * DT;
  }

  const tree = new Quadtree(particles, width, height);
  for (const p of particles) {
    const [fx, fy] = forceOn(tree.root, p);
    p.ax = fx / p.m;
    p.ay = fy / p.m;
  }

  for (const p of particles) {
    p.vx += 0.5 * p.ax * DT;
    p.vy += 0.5 * p.ay * DT;
  }

  dt = timestep(particles);
  return tree;
}