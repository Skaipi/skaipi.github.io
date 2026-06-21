import { Quadtree } from "./quadtree.js";

export const DEFAULT_SIMULATION_CONFIG = Object.freeze({
  particleCount: 600,
  gravity: 28.0,
  theta: 0.45,
  softening: 10,
  particleMass: 1.0,
  initialDt: 0.005,
  minDt: 0.001,
  maxDt: 0.012,
  treeCapacity: 4,
  spiralArms: 3,
  spiralWinding: 5.2,
  armFraction: 0.7,
  armSpread: 0.32,
  diskRadiusRatio: 0.42,
  coreRadiusRatio: 0.12,
  haloMass: 12000,
  velocityNoise: 0.08,
  radialVelocityNoise: 0.035,
  boundaryRadiusRatio: 0.58,
  boundaryForce: 18,
  boundaryDamping: 0.995,
});

const TAU = Math.PI * 2;

class Particle {
  constructor(x, y, mass) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.ax = 0;
    this.ay = 0;
    this.m = mass;
  }
}

export function createBarnesHutSimulation(options = {}) {
  const config = { ...DEFAULT_SIMULATION_CONFIG, ...options };
  const particles = [];
  const rotationDirection = Math.random() < 0.5 ? 1 : -1;
  let dt = config.initialDt;

  const getState = () => particles;

  function generateCluster(width, height) {
    particles.length = 0;
    dt = config.initialDt;

    const minSize = Math.min(width, height);
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const diskRadius = config.diskRadiusRatio * minSize;

    for (let i = 0; i < config.particleCount; ++i) {
      const radius = sampleDiskRadius(diskRadius);
      const arm = Math.floor(Math.random() * config.spiralArms);
      const armAngle = (arm * TAU) / config.spiralArms + config.spiralWinding * (radius / diskRadius);
      const angle =
        Math.random() < config.armFraction
          ? armAngle + randomGaussian() * config.armSpread * (0.4 + radius / diskRadius)
          : Math.random() * TAU;
      const jitter = 0.015 * diskRadius * randomGaussian();
      const x = centerX + (radius + jitter) * Math.cos(angle);
      const y = centerY + (radius + jitter) * Math.sin(angle);
      const particle = new Particle(x, y, config.particleMass);

      initializeOrbitalVelocity(particle, centerX, centerY, diskRadius);
      particles.push(particle);
    }

    updateAccelerations(width, height);
    return particles;
  }

  function step(width, height) {
    for (const particle of particles) {
      particle.vx += 0.5 * particle.ax * dt;
      particle.vy += 0.5 * particle.ay * dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }

    const tree = updateAccelerations(width, height);

    for (const particle of particles) {
      particle.vx += 0.5 * particle.ax * dt;
      particle.vy += 0.5 * particle.ay * dt;
    }

    dt = getTimestep();
    return tree;
  }

  function sampleDiskRadius(diskRadius) {
    const diskScale = diskRadius * 0.32;
    const truncated = 1 - Math.exp(-diskRadius / diskScale);
    return -diskScale * Math.log(1 - Math.random() * truncated) + config.softening;
  }

  function randomGaussian() {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  function getTimestep() {
    let maxAcceleration = 0;
    let maxVelocity = 0;

    for (const particle of particles) {
      maxAcceleration = Math.max(maxAcceleration, Math.hypot(particle.ax, particle.ay));
      maxVelocity = Math.max(maxVelocity, Math.hypot(particle.vx, particle.vy));
    }

    const safetyFactor = 0.2;
    const accelerationDt = safetyFactor * Math.sqrt(config.softening / (maxAcceleration + 1e-30));
    const velocityDt = (safetyFactor * config.softening) / (maxVelocity + 1e-30);

    return Math.min(config.maxDt, Math.max(config.minDt, Math.min(accelerationDt, velocityDt)));
  }

  function initializeOrbitalVelocity(particle, centerX, centerY, diskRadius) {
    const dx = particle.x - centerX;
    const dy = particle.y - centerY;
    const radius = Math.hypot(dx, dy) + 1e-9;
    const angle = Math.atan2(dy, dx);
    const tangent = angle + rotationDirection * Math.PI * 0.5;
    const speed = Math.max(0, circularSpeed(radius, diskRadius) * (1 + config.velocityNoise * randomGaussian()));
    const radialSpeed = speed * config.radialVelocityNoise * randomGaussian();

    particle.vx = speed * Math.cos(tangent) + radialSpeed * Math.cos(angle);
    particle.vy = speed * Math.sin(tangent) + radialSpeed * Math.sin(angle);
  }

  function circularSpeed(radius, diskRadius) {
    const coreRadius = config.coreRadiusRatio * diskRadius;
    const softenedRadiusSq = radius * radius + coreRadius * coreRadius;
    const haloV2 = (config.gravity * config.haloMass * radius * radius) / Math.pow(softenedRadiusSq, 1.5);
    const diskScale = diskRadius * 0.32;
    const enclosedDiskMass =
      config.particleCount *
      config.particleMass *
      (1 - Math.exp(-radius / diskScale) * (1 + radius / diskScale));
    const diskV2 =
      (config.gravity * enclosedDiskMass * radius * radius) /
      Math.pow(radius * radius + config.softening * config.softening, 1.5);

    return Math.sqrt(Math.max(haloV2 + diskV2, 0));
  }

  function updateAccelerations(width, height) {
    const tree = new Quadtree(particles, config.treeCapacity);

    for (const particle of particles) {
      const [fx, fy] = computeForceOnParticle(tree.root, particle);
      particle.ax = fx / particle.m;
      particle.ay = fy / particle.m;
      addCentralHaloAcceleration(particle, width, height);
      addBoundaryAcceleration(particle, width, height);
    }

    return tree;
  }

  function computeForceOnParticle(node, particle) {
    if (node.mass === 0) return [0, 0];

    if (node.children.length === 0) {
      return computeLeafForce(node, particle);
    }

    const dx = node.comX - particle.x;
    const dy = node.comY - particle.y;
    const distSq = dx * dx + dy * dy + config.softening * config.softening;
    const cellWidth = node.boundary.x1 - node.boundary.x0;
    const cellHeight = node.boundary.y1 - node.boundary.y0;
    const canApproximate =
      !node.contains(particle) && Math.hypot(cellWidth, cellHeight) / Math.sqrt(distSq) < config.theta;

    if (canApproximate) {
      const invDist3 = 1 / (distSq * Math.sqrt(distSq));
      const force = config.gravity * node.mass * invDist3;
      return [force * dx, force * dy];
    }

    let fx = 0;
    let fy = 0;

    for (const child of node.children) {
      const [childFx, childFy] = computeForceOnParticle(child, particle);
      fx += childFx;
      fy += childFy;
    }

    return [fx, fy];
  }

  function computeLeafForce(node, particle) {
    let fx = 0;
    let fy = 0;

    for (const source of node.points) {
      if (source === particle) continue;

      const [sourceFx, sourceFy] = computePairForce(source, particle);
      fx += sourceFx;
      fy += sourceFy;
    }

    return [fx, fy];
  }

  function computePairForce(source, particle) {
    const dx = source.x - particle.x;
    const dy = source.y - particle.y;
    const distSq = dx * dx + dy * dy + config.softening * config.softening;
    const invDist3 = 1 / (distSq * Math.sqrt(distSq));
    const force = config.gravity * source.m * invDist3;

    return [force * dx, force * dy];
  }

  function addCentralHaloAcceleration(particle, width, height) {
    const diskRadius = config.diskRadiusRatio * Math.min(width, height);
    const coreRadius = config.coreRadiusRatio * diskRadius;
    const dx = width * 0.5 - particle.x;
    const dy = height * 0.5 - particle.y;
    const distSq = dx * dx + dy * dy + coreRadius * coreRadius;
    const invDist3 = 1 / (distSq * Math.sqrt(distSq));

    particle.ax += config.gravity * config.haloMass * dx * invDist3;
    particle.ay += config.gravity * config.haloMass * dy * invDist3;
  }

  function addBoundaryAcceleration(particle, width, height) {
    const maxRadius = config.boundaryRadiusRatio * Math.min(width, height);
    const dx = width * 0.5 - particle.x;
    const dy = height * 0.5 - particle.y;
    const radius = Math.hypot(dx, dy);

    if (radius <= maxRadius) return;

    const pull = (config.boundaryForce * (radius - maxRadius)) / maxRadius;
    particle.ax += (dx / radius) * pull;
    particle.ay += (dy / radius) * pull;
    particle.vx *= config.boundaryDamping;
    particle.vy *= config.boundaryDamping;
  }

  return {
    generateCluster,
    getState,
    step,
  };
}
