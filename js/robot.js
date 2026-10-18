/**
 * robot.js
 * 2D Robot entity with physics simulation, skid marks, collision detection,
 * field-centric translation, and wheel telemetry tracking.
 */

import { KinematicsEngine, DRIVE_SYSTEMS } from './kinematics.js';

export class Robot2D {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;

    // Chassis dimensions in screen pixels (scaled up for high educational visibility)
    this.scale = 1.0;
    this.baseWidth = 140;
    this.baseHeight = 160;
    this.width = this.baseWidth * this.scale;
    this.height = this.baseHeight * this.scale;
    this.radius = 78 * this.scale; // collision bounding circle

    // Pose: position (x, y) and heading angle (radians, 0 = pointing upwards)
    this.x = arenaWidth / 2;
    this.y = arenaHeight / 2;
    this.heading = 0; // 0 = UP (towards negative Y in screen space)

    // Velocities
    this.vx = 0;
    this.vy = 0;
    this.omega = 0;

    // Current drive system
    this.driveSystemId = 'mecanum';
    this.kinematics = new KinematicsEngine({
      length: this.height,
      width: this.width,
      wheelRadius: 28 * this.scale
    });

    // Driving configuration
    this.fieldCentric = false;
    this.maxSpeed = 260; // px/s
    this.maxOmega = 4.2; // rad/s
    this.acceleration = 12.0; // responsiveness
    this.friction = 0.88; // inertia dampening

    // Telemetry & Wheel states
    this.wheelOutputs = null;
    this.wheelRotations = [0, 0, 0, 0]; // cumulative spin angle for animation
    this.rollerRotations = [0, 0, 0, 0]; // individual passive roller spin around 45° pin
    this.timeScale = 1.0; // Slow motion multiplier (0.25x, 0.5x, 1.0x)
    this.totalDistance = 0;

    // Skid marks & tire tracks
    this.trails = [];
    this.maxTrails = 400;
    this.trailTimer = 0;

    // Sparks / collision particles
    this.particles = [];
  }

  setScale(newScale) {
    this.scale = Math.max(0.7, Math.min(2.0, newScale));
    this.width = this.baseWidth * this.scale;
    this.height = this.baseHeight * this.scale;
    this.radius = 78 * this.scale;
    this.kinematics = new KinematicsEngine({
      length: this.height,
      width: this.width,
      wheelRadius: 28 * this.scale
    });
  }

  setDriveSystem(systemId) {
    if (DRIVE_SYSTEMS[systemId]) {
      this.driveSystemId = systemId;
      // Reset wheel rotation phases
      this.wheelRotations = [0, 0, 0, 0];
      this.kinematics = new KinematicsEngine({
        length: this.height,
        width: this.width,
        wheelRadius: 28 * this.scale
      });
    }
  }

  resetPosition(x = this.arenaWidth / 2, y = this.arenaHeight / 2, heading = 0) {
    this.x = x;
    this.y = y;
    this.heading = heading;
    this.vx = 0;
    this.vy = 0;
    this.omega = 0;
    this.wheelRotations = [0, 0, 0, 0];
    this.trails = [];
  }

  clearTrails() {
    this.trails = [];
  }

  /**
   * Main physics & kinematics update loop
   * @param {Object} input - { transX, transY, rot } normalized [-1, 1]
   * @param {number} dt - delta time in seconds
   * @param {Array} obstacles - list of obstacle objects
   */
  update(input, dt, obstacles = []) {
    // 1. Convert input based on Field-Centric vs Robot-Centric
    let targetLocalVx = input.transX;
    let targetLocalVy = input.transY;
    const targetOmega = input.rot;

    if (this.fieldCentric) {
      // In field-centric:
      // input.transY is along screen Y (positive is up, negative is down)
      // input.transX is along screen X (positive is right, negative is left)
      // Rotate by -heading to get robot local frame
      const cosH = Math.cos(this.heading);
      const sinH = Math.sin(this.heading);

      // In robot local: +vy is nose forward, +vx is right
      targetLocalVx = input.transX * cosH - input.transY * sinH;
      targetLocalVy = input.transX * sinH + input.transY * cosH;
    }

    // 2. Solve kinematics
    this.wheelOutputs = this.kinematics.computeWheelOutputs(
      this.driveSystemId,
      targetLocalVx,
      targetLocalVy,
      targetOmega,
      dt
    );

    // 3. Update wheel animation rotations & individual roller spins
    this.wheelOutputs.wheels.forEach((w, i) => {
      // Main wheel rotation around drive axle
      const spinDelta = (w.speed * this.maxSpeed * dt) / 22;
      this.wheelRotations[i] = (this.wheelRotations[i] + spinDelta);

      // Passive roller rotation around its own 45° pin (for Mecanum and Omni)
      // Component of ground slip velocity along the roller axis causes the roller to spin!
      let rollerSlip = 0;
      if (this.driveSystemId === 'mecanum') {
        const isSlash = (w.id === 'FL' || w.id === 'RR');
        const angle45 = Math.PI / 4;
        // Roller axis direction
        const rax = isSlash ? Math.cos(angle45) : -Math.cos(angle45);
        const ray = Math.sin(angle45);
        // Ground slip relative to contact patch
        rollerSlip = targetLocalVx * rax + targetLocalVy * ray;
      } else if (this.driveSystemId === 'xdrive' || this.driveSystemId === 'kiwi') {
        rollerSlip = targetLocalVx * 0.7 - targetLocalVy * 0.7;
      }
      this.rollerRotations[i] = (this.rollerRotations[i] + rollerSlip * this.maxSpeed * dt * 0.08);
    });

    // 4. Translate resultant local robot velocity into world coordinates
    // Robot heading 0 means forward is -Y in screen coords
    // Local forward (+vy) translates to: dx = +vy * sin(heading), dy = -vy * cos(heading)
    // Local right (+vx) translates to: dx = +vx * cos(heading), dy = +vx * sin(heading)
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);

    const resultant = this.wheelOutputs.resultant;
    const worldTargetVx = (resultant.vy * sinH + resultant.vx * cosH) * this.maxSpeed;
    const worldTargetVy = (-resultant.vy * cosH + resultant.vx * sinH) * this.maxSpeed;
    const worldTargetOmega = resultant.omega * this.maxOmega;

    // Smooth physics acceleration
    this.vx += (worldTargetVx - this.vx) * Math.min(1.0, this.acceleration * dt);
    this.vy += (worldTargetVy - this.vy) * Math.min(1.0, this.acceleration * dt);
    this.omega += (worldTargetOmega - this.omega) * Math.min(1.0, this.acceleration * dt);

    // Apply friction dampening when no input
    if (Math.abs(input.transX) < 0.05 && Math.abs(input.transY) < 0.05) {
      this.vx *= Math.pow(this.friction, dt * 60);
      this.vy *= Math.pow(this.friction, dt * 60);
    }
    if (Math.abs(input.rot) < 0.05) {
      this.omega *= Math.pow(this.friction, dt * 60);
    }

    // 5. Integrate Pose
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.heading += this.omega * dt;

    // Wrap heading to [-PI, PI]
    while (this.heading > Math.PI) this.heading -= Math.PI * 2;
    while (this.heading < -Math.PI) this.heading += Math.PI * 2;

    const speedMagnitude = Math.hypot(this.vx, this.vy);
    this.totalDistance += speedMagnitude * dt;

    // 6. Handle Arena Boundary Collisions
    const margin = this.radius;
    if (this.x < margin) {
      this.x = margin;
      this.vx = -this.vx * 0.3;
      this.spawnSparks(this.x, this.y);
    } else if (this.x > this.arenaWidth - margin) {
      this.x = this.arenaWidth - margin;
      this.vx = -this.vx * 0.3;
      this.spawnSparks(this.x, this.y);
    }

    if (this.y < margin) {
      this.y = margin;
      this.vy = -this.vy * 0.3;
      this.spawnSparks(this.x, this.y);
    } else if (this.y > this.arenaHeight - margin) {
      this.y = this.arenaHeight - margin;
      this.vy = -this.vy * 0.3;
      this.spawnSparks(this.x, this.y);
    }

    // 7. Handle Obstacle Collisions
    for (const obs of obstacles) {
      if (obs.type === 'circle') {
        const dx = this.x - obs.x;
        const dy = this.y - obs.y;
        const dist = Math.hypot(dx, dy);
        const minDist = this.radius + obs.radius;
        if (dist < minDist) {
          const overlap = minDist - dist;
          const nx = dist > 0.001 ? dx / dist : 1;
          const ny = dist > 0.001 ? dy / dist : 0;
          this.x += nx * overlap;
          this.y += ny * overlap;
          // Bounce slightly
          const dot = this.vx * nx + this.vy * ny;
          this.vx = (this.vx - 2 * dot * nx) * 0.4;
          this.vy = (this.vy - 2 * dot * ny) * 0.4;
          this.spawnSparks(this.x - nx * this.radius, this.y - ny * this.radius);
        }
      } else if (obs.type === 'box') {
        // Simple AABB / clamp circle collision
        const closestX = Math.max(obs.x - obs.width / 2, Math.min(this.x, obs.x + obs.width / 2));
        const closestY = Math.max(obs.y - obs.height / 2, Math.min(this.y, obs.y + obs.height / 2));
        const dx = this.x - closestX;
        const dy = this.y - closestY;
        const dist = Math.hypot(dx, dy);
        if (dist < this.radius && dist > 0.001) {
          const nx = dx / dist;
          const ny = dy / dist;
          this.x = closestX + nx * this.radius;
          this.y = closestY + ny * this.radius;
          const dot = this.vx * nx + this.vy * ny;
          this.vx = (this.vx - 2 * dot * nx) * 0.3;
          this.vy = (this.vy - 2 * dot * ny) * 0.3;
          this.spawnSparks(closestX, closestY);
        }
      }
    }

    // 8. Record tire tracks / skid trails
    this.trailTimer += dt;
    if (this.trailTimer > 0.035) {
      this.trailTimer = 0;
      if (speedMagnitude > 8 || Math.abs(this.omega) > 0.15) {
        // Get wheel contact positions in world coordinates
        const wheelPositions = this.getWheelWorldPositions();
        this.trails.push({
          positions: wheelPositions,
          heading: this.heading,
          alpha: 0.65,
          speed: speedMagnitude
        });
        if (this.trails.length > this.maxTrails) {
          this.trails.shift();
        }
      }
    }

    // Fade existing trails
    for (let i = 0; i < this.trails.length; i++) {
      this.trails[i].alpha -= dt * 0.06;
    }
    this.trails = this.trails.filter(t => t.alpha > 0.01);

    // Update sparks
    this.particles = this.particles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.alpha -= dt * 2.5;
      return p.alpha > 0;
    });
  }

  spawnSparks(x, y) {
    for (let i = 0; i < 7; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 1.0,
        color: Math.random() > 0.5 ? '#f59e0b' : '#38bdf8'
      });
    }
  }

  /**
   * Calculate world coordinates of each wheel for drawing and trails
   */
  getWheelWorldPositions() {
    const halfW = this.width / 2;
    const halfL = this.height / 2;
    const sinH = Math.sin(this.heading);
    const cosH = Math.cos(this.heading);

    // Local wheel offsets: FL, FR, RL, RR (or kiwi 3-wheels)
    let localOffsets = [];
    if (this.driveSystemId === 'kiwi') {
      const r = this.radius * 0.95;
      localOffsets = [
        { x: 0, y: r },
        { x: r * Math.sin(2 * Math.PI / 3), y: -r * 0.5 },
        { x: -r * Math.sin(2 * Math.PI / 3), y: -r * 0.5 }
      ];
    } else {
      const wheelOffsetX = halfW + 20 * this.scale;
      const wheelOffsetY = halfL - 35 * this.scale;
      localOffsets = [
        { x: -wheelOffsetX, y: wheelOffsetY }, // FL
        { x: wheelOffsetX, y: wheelOffsetY },  // FR
        { x: -wheelOffsetX, y: -wheelOffsetY },// RL
        { x: wheelOffsetX, y: -wheelOffsetY }  // RR
      ];
    }

    return localOffsets.map(pt => {
      // In local robot frame: +y is nose, +x is right
      // When heading is 0, nose is pointing UP (-screen Y)
      const worldX = this.x + pt.x * cosH + pt.y * sinH;
      const worldY = this.y + pt.x * sinH - pt.y * cosH;
      return { x: worldX, y: worldY };
    });
  }

  getTelemetry() {
    const linearSpeed = Math.hypot(this.vx, this.vy);
    const angularSpeedDeg = (this.omega * 180 / Math.PI);
    const headingDeg = (this.heading * 180 / Math.PI + 360) % 360;

    return {
      x: Math.round(this.x),
      y: Math.round(this.y),
      headingDeg: Math.round(headingDeg),
      speedPx: Math.round(linearSpeed),
      speedMps: (linearSpeed * 0.015).toFixed(2), // virtual scale
      omegaDeg: Math.round(angularSpeedDeg),
      driveSystem: this.driveSystemId,
      wheels: this.wheelOutputs ? this.wheelOutputs.wheels : [],
      fieldCentric: this.fieldCentric
    };
  }
}
