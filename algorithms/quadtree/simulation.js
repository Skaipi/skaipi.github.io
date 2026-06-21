import { Quadtree } from "./quadtree.js";

export const DEFAULT_SIMULATION_CONFIG = Object.freeze({
  particleCount: 600,
  gravity: 28.0,
  theta: 0.45,
  softening: 10,
  timeStep: 0.012,
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
const createParticle = (x, y) => ({ x, y, vx: 0, vy: 0, ax: 0, ay: 0 });

export function createBarnesHutSimulation(options = {}) {
  const cfg = { ...DEFAULT_SIMULATION_CONFIG, ...options };
  const particles = [];
  const rotationDirection = Math.random() < 0.5 ? 1 : -1;
  const dt = cfg.timeStep;

  function generateCluster(width, height) {
    particles.length = 0;

    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const diskRadius = cfg.diskRadiusRatio * Math.min(width, height);
    const diskScale = diskRadius * 0.32;
    const truncatedDisk = 1 - Math.exp(-diskRadius / diskScale);

    for (let i = 0; i < cfg.particleCount; ++i) {
      const radius = -diskScale * Math.log(1 - Math.random() * truncatedDisk) + cfg.softening;
      const armAngle =
        (Math.floor(Math.random() * cfg.spiralArms) * TAU) / cfg.spiralArms +
        cfg.spiralWinding * (radius / diskRadius);
      const angle =
        Math.random() < cfg.armFraction
          ? armAngle + randomGaussian() * cfg.armSpread * (0.4 + radius / diskRadius)
          : Math.random() * TAU;
      const jitter = 0.015 * diskRadius * randomGaussian();
      const particle = createParticle(
        centerX + (radius + jitter) * Math.cos(angle),
        centerY + (radius + jitter) * Math.sin(angle),
      );

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

    return tree;
  }

  function updateAccelerations(width, height) {
    const tree = new Quadtree(particles, cfg.treeCapacity);

    for (const particle of particles) {
      const [fx, fy] = forceOn(particle, tree.root);
      particle.ax = fx;
      particle.ay = fy;
      addExternalAcceleration(particle, width, height);
    }

    return tree;
  }

  function forceOn(particle, node) {
    if (node.mass === 0) return [0, 0];

    if (node.children.length === 0) {
      let fx = 0;
      let fy = 0;

      for (const source of node.points) {
        if (source === particle) continue;

        const [sourceFx, sourceFy] = softenedForce(1, source.x - particle.x, source.y - particle.y);
        fx += sourceFx;
        fy += sourceFy;
      }

      return [fx, fy];
    }

    const dx = node.comX - particle.x;
    const dy = node.comY - particle.y;
    const [fx, fy, distSq] = softenedForce(node.mass, dx, dy);
    const cellWidth = node.boundary.x1 - node.boundary.x0;
    const cellHeight = node.boundary.y1 - node.boundary.y0;
    const shouldApproximate =
      !node.contains(particle) && Math.hypot(cellWidth, cellHeight) / Math.sqrt(distSq) < cfg.theta;

    if (shouldApproximate) return [fx, fy];

    let childFx = 0;
    let childFy = 0;
    for (const child of node.children) {
      const [cx, cy] = forceOn(particle, child);
      childFx += cx;
      childFy += cy;
    }

    return [childFx, childFy];
  }

  function softenedForce(mass, dx, dy, softening = cfg.softening) {
    const distSq = dx * dx + dy * dy + softening * softening;
    const force = (cfg.gravity * mass) / (distSq * Math.sqrt(distSq));
    return [force * dx, force * dy, distSq];
  }

  function addExternalAcceleration(particle, width, height) {
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const size = Math.min(width, height);
    const dx = centerX - particle.x;
    const dy = centerY - particle.y;
    const [haloAx, haloAy] = softenedForce(cfg.haloMass, dx, dy, cfg.coreRadiusRatio * cfg.diskRadiusRatio * size);
    const radius = Math.hypot(dx, dy);
    const maxRadius = cfg.boundaryRadiusRatio * size;

    particle.ax += haloAx;
    particle.ay += haloAy;

    if (radius <= maxRadius) return;

    const pull = (cfg.boundaryForce * (radius - maxRadius)) / maxRadius;
    particle.ax += (dx / radius) * pull;
    particle.ay += (dy / radius) * pull;
    particle.vx *= cfg.boundaryDamping;
    particle.vy *= cfg.boundaryDamping;
  }

  function initializeOrbitalVelocity(particle, centerX, centerY, diskRadius) {
    const dx = particle.x - centerX;
    const dy = particle.y - centerY;
    const radius = Math.hypot(dx, dy) + 1e-9;
    const angle = Math.atan2(dy, dx);
    const tangent = angle + rotationDirection * Math.PI * 0.5;
    const speed = Math.max(0, circularSpeed(radius, diskRadius) * (1 + cfg.velocityNoise * randomGaussian()));
    const radialSpeed = speed * cfg.radialVelocityNoise * randomGaussian();

    particle.vx = speed * Math.cos(tangent) + radialSpeed * Math.cos(angle);
    particle.vy = speed * Math.sin(tangent) + radialSpeed * Math.sin(angle);
  }

  function circularSpeed(radius, diskRadius) {
    const coreRadius = cfg.coreRadiusRatio * diskRadius;
    return Math.sqrt(
      (cfg.gravity * cfg.haloMass * radius * radius) / Math.pow(radius * radius + coreRadius * coreRadius, 1.5),
    );
  }

  function randomGaussian() {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }

  return {
    generateCluster,
    getState: () => particles,
    step,
  };
}
