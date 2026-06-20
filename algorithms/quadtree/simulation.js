import { Quadtree } from "./quadtree.js";

// ===== TUNABLE CONSTANTS ======================================================
const N = 600;
const G = 28.0; // grav. constant in screen units
const THETA = 0.45; // Barnes–Hut opening angle (smaller = better ≈ slower)
const EPS = 10; // Plummer softening (px) – prevents close-encounter ejections
const PARTICLE_MASS = 1.0; // mass of every star (can vary, but unnecessary here)
const DT_MIN = 0.001;
const DT_MAX = 0.012;
const ROTATION_DIRECTION = Math.random() < 0.5 ? 1 : -1;
const SPIRAL_ARMS = 3;
const SPIRAL_WINDING = 5.2;
const ARM_FRACTION = 0.7;
const ARM_SPREAD = 0.32;
const DISK_RADIUS_RATIO = 0.42;
const CORE_RADIUS_RATIO = 0.12;
const HALO_MASS = 12000;
const VELOCITY_NOISE = 0.08;
const RADIAL_VELOCITY_NOISE = 0.035;
const BOUNDARY_RADIUS_RATIO = 0.58;
const BOUNDARY_FORCE = 18;
const BOUNDARY_DAMPING = 0.995;
const TAU = Math.PI * 2;
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

function pairForce(source, particle) {
  const dx = source.x - particle.x;
  const dy = source.y - particle.y;
  const distSq = dx * dx + dy * dy + EPS * EPS;
  const invDist3 = 1 / (distSq * Math.sqrt(distSq));
  const force = G * source.m * invDist3;
  return [force * dx, force * dy];
}

// force applied on particle by the node
export const forceOn = (node, particle) => {
  const { mass, comX, comY } = accumulate(node);

  if (mass === 0) return [0, 0];

  if (node.children.length === 0) {
    let fx = 0,
      fy = 0;

    for (const source of node.points) {
      if (source === particle) continue;

      const [cx, cy] = pairForce(source, particle);
      fx += cx;
      fy += cy;
    }

    return [fx, fy];
  }

  const dx = comX - particle.x;
  const dy = comY - particle.y;
  const distSq = dx * dx + dy * dy + EPS * EPS;

  // Width of node
  const cellWidth = node.boundary.x1 - node.boundary.x0;
  const cellHeight = node.boundary.y1 - node.boundary.y0;

  if (!node.contains(particle) && Math.hypot(cellWidth, cellHeight) / Math.sqrt(distSq) < THETA) {
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
    if (node.points.length === 0) {
      node._payload = {
        mass: 0,
        comX: 0,
        comY: 0,
      };
      return node._payload;
    }

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

export function generateCluster(width, height) {
  particles.length = 0;

  const minSize = Math.min(width, height);
  const centerX = width * 0.5;
  const centerY = height * 0.5;
  const diskRadius = DISK_RADIUS_RATIO * minSize;

  for (let i = 0; i < N; ++i) {
    const radius = sampleDiskRadius(diskRadius);
    const arm = Math.floor(Math.random() * SPIRAL_ARMS);
    const armAngle = (arm * TAU) / SPIRAL_ARMS + SPIRAL_WINDING * (radius / diskRadius);
    const angle =
      Math.random() < ARM_FRACTION
        ? armAngle + randomGaussian() * ARM_SPREAD * (0.4 + radius / diskRadius)
        : Math.random() * TAU;
    const jitter = 0.015 * diskRadius * randomGaussian();
    const x = centerX + (radius + jitter) * Math.cos(angle);
    const y = centerY + (radius + jitter) * Math.sin(angle);
    const particle = new Particle(x, y);

    giveCircularVelocity(particle, centerX, centerY, diskRadius);
    particles.push(particle);
  }

  updateAccelerations(width, height);
  return particles;
}

function sampleDiskRadius(diskRadius) {
  const diskScale = diskRadius * 0.32;
  const truncated = 1 - Math.exp(-diskRadius / diskScale);
  return -diskScale * Math.log(1 - Math.random() * truncated) + EPS;
}

function randomGaussian() {
  const u = 1 - Math.random();
  const v = 1 - Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
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

function giveCircularVelocity(p, centerX, centerY, diskRadius) {
  const dx = p.x - centerX;
  const dy = p.y - centerY;
  const radius = Math.hypot(dx, dy) + 1e-9;
  const angle = Math.atan2(dy, dx);
  const tangent = angle + ROTATION_DIRECTION * Math.PI * 0.5;
  const speed = Math.max(0, circularSpeed(radius, diskRadius) * (1 + VELOCITY_NOISE * randomGaussian()));
  const radialSpeed = speed * RADIAL_VELOCITY_NOISE * randomGaussian();

  p.vx = speed * Math.cos(tangent) + radialSpeed * Math.cos(angle);
  p.vy = speed * Math.sin(tangent) + radialSpeed * Math.sin(angle);
}

function circularSpeed(radius, diskRadius) {
  const coreRadius = CORE_RADIUS_RATIO * diskRadius;
  const softenedRadiusSq = radius * radius + coreRadius * coreRadius;
  const haloV2 = (G * HALO_MASS * radius * radius) / Math.pow(softenedRadiusSq, 1.5);
  const diskScale = diskRadius * 0.32;
  const enclosedDiskMass = N * PARTICLE_MASS * (1 - Math.exp(-radius / diskScale) * (1 + radius / diskScale));
  const diskV2 =
    (G * enclosedDiskMass * radius * radius) / Math.pow(radius * radius + EPS * EPS, 1.5);

  return Math.sqrt(Math.max(haloV2 + diskV2, 0));
}

function addCentralHaloAcceleration(p, width, height) {
  const diskRadius = DISK_RADIUS_RATIO * Math.min(width, height);
  const coreRadius = CORE_RADIUS_RATIO * diskRadius;
  const dx = width * 0.5 - p.x;
  const dy = height * 0.5 - p.y;
  const distSq = dx * dx + dy * dy + coreRadius * coreRadius;
  const invDist3 = 1 / (distSq * Math.sqrt(distSq));

  p.ax += G * HALO_MASS * dx * invDist3;
  p.ay += G * HALO_MASS * dy * invDist3;
}

function addBoundaryAcceleration(p, width, height) {
  const maxRadius = BOUNDARY_RADIUS_RATIO * Math.min(width, height);
  const dx = width * 0.5 - p.x;
  const dy = height * 0.5 - p.y;
  const radius = Math.hypot(dx, dy);

  if (radius <= maxRadius) return;

  const pull = BOUNDARY_FORCE * (radius - maxRadius) / maxRadius;
  p.ax += (dx / radius) * pull;
  p.ay += (dy / radius) * pull;
  p.vx *= BOUNDARY_DAMPING;
  p.vy *= BOUNDARY_DAMPING;
}

function updateAccelerations(width, height) {
  const treeCapacity = 4;
  const tree = new Quadtree(particles, treeCapacity);

  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    const [fx, fy] = forceOn(tree.root, p);
    p.ax = fx / p.m;
    p.ay = fy / p.m;
    addCentralHaloAcceleration(p, width, height);
    addBoundaryAcceleration(p, width, height);
  }

  return tree;
}

export function step(width, height) {
  // Update positions
  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    p.vx += 0.5 * p.ax * dt;
    p.vy += 0.5 * p.ay * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }

  // Update forces
  const tree = updateAccelerations(width, height);
  for (let i = 0; i < particles.length; ++i) {
    const p = particles[i];
    p.vx += 0.5 * p.ax * dt;
    p.vy += 0.5 * p.ay * dt;
  }

  dt = getTimestep(particles);
  return tree;
}
