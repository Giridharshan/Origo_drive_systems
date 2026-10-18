/**
 * renderer.js
 * High-fidelity Canvas rendering engine for 2D robotic drive systems:
 * - Mecanum (45° rollers revolving + spinning on own axis + motion chevrons)
 * - Coaxial Swerve (360° azimuth steering pod + rolling tread + steer angle badge)
 * - Tank / Differential (Continuous caterpillar tracks + spinning sprockets)
 * - Holonomic X-Drive (45° omni-wheels + revolving barrel rollers)
 * - Ackermann (Visible mechanical tie-rod steering linkage + differential rear)
 * - Kiwi (3-wheel 120° radial omni-wheels)
 *
 * Specially designed so students can immediately understand the physics and kinematics!
 */

export class ArenaRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    // Rendering toggles
    this.showForceVectors = true;
    this.showVectorComponents = true; // Shows dashed Fx and Fy right-triangle decomposition
    this.showVelocityVector = true;
    this.showTorqueArrow = true;
    this.showGrid = true;
    this.showTrails = true;
    this.showWheelLabels = true;
    this.showSpinIndicators = true; // Shows FWD/REV spin badges directly on wheels
    this.showMotionChevrons = true; // Shows animated flowing chevrons on wheels

    // Vector visual scale
    this.forceVectorScale = 90;
    this.velocityVectorScale = 0.35;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(rect.width * dpr);
    this.canvas.height = Math.floor(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { width: rect.width, height: rect.height };
  }

  render(robot, obstacles = [], challenge = null) {
    const ctx = this.ctx;
    const width = this.canvas.width / (window.devicePixelRatio || 1);
    const height = this.canvas.height / (window.devicePixelRatio || 1);

    // Clear background
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, width, height);

    // 1. Grid
    if (this.showGrid) {
      this.drawGrid(ctx, width, height);
    }

    // 2. Arena Boundaries & Safety Strips
    this.drawBoundaries(ctx, width, height);

    // 3. Challenge elements (parking bay, slalom gates, docking zone)
    if (challenge && challenge.render) {
      challenge.render(ctx);
    }

    // 4. Obstacles
    this.drawObstacles(ctx, obstacles);

    // 5. Tire Skid Trails
    if (this.showTrails) {
      this.drawTrails(ctx, robot.trails);
    }

    // 6. Particles / Sparks
    this.drawParticles(ctx, robot.particles);

    // 7. Robot Body, Mechanisms & Wheels
    this.drawRobot(ctx, robot);

    // 8. Resultant Force & Velocity Vectors
    if (this.showVelocityVector || this.showTorqueArrow) {
      this.drawResultantVectors(ctx, robot);
    }
  }

  drawGrid(ctx, width, height) {
    const gridSize = 40;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';

    ctx.beginPath();
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Major 200px grid lines
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = 'rgba(0, 242, 254, 0.08)';
    ctx.beginPath();
    for (let x = 0; x <= width; x += 200) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += 200) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawBoundaries(ctx, width, height) {
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
    ctx.strokeRect(3, 3, width - 6, height - 6);

    const cornerSize = 24;
    ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
    ctx.lineWidth = 2;

    const corners = [
      [6, 6, cornerSize, cornerSize],
      [width - 6 - cornerSize, 6, cornerSize, cornerSize],
      [6, height - 6 - cornerSize, cornerSize, cornerSize],
      [width - 6 - cornerSize, height - 6 - cornerSize, cornerSize, cornerSize]
    ];
    for (const [cx, cy, cw, ch] of corners) {
      ctx.strokeRect(cx, cy, cw, ch);
    }
    ctx.restore();
  }

  drawObstacles(ctx, obstacles) {
    for (const obs of obstacles) {
      ctx.save();
      if (obs.type === 'circle') {
        const grad = ctx.createRadialGradient(obs.x, obs.y, 4, obs.x, obs.y, obs.radius);
        grad.addColorStop(0, '#f97316');
        grad.addColorStop(0.7, '#ea580c');
        grad.addColorStop(1, '#9a3412');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(obs.x, obs.y, obs.radius * 0.55, 0, Math.PI * 2);
        ctx.stroke();

        ctx.shadowColor = '#f97316';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (obs.type === 'box') {
        ctx.fillStyle = '#1e293b';
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 2;
        ctx.fillRect(obs.x - obs.width / 2, obs.y - obs.height / 2, obs.width, obs.height);
        ctx.strokeRect(obs.x - obs.width / 2, obs.y - obs.height / 2, obs.width, obs.height);

        ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        const startX = obs.x - obs.width / 2;
        const endX = obs.x + obs.width / 2;
        const topY = obs.y - obs.height / 2;
        const botY = obs.y + obs.height / 2;
        for (let ix = startX; ix <= endX + obs.height; ix += 16) {
          ctx.moveTo(ix, topY);
          ctx.lineTo(ix - obs.height, botY);
        }
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawTrails(ctx, trails) {
    ctx.save();
    for (const t of trails) {
      ctx.fillStyle = `rgba(0, 242, 254, ${t.alpha * 0.45})`;
      for (const pos of t.positions) {
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  drawParticles(ctx, particles) {
    ctx.save();
    for (const p of particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /**
   * Main Robot Drawing Routine
   */
  drawRobot(ctx, robot) {
    ctx.save();
    ctx.translate(robot.x, robot.y);
    ctx.rotate(robot.heading);

    const isKiwi = robot.driveSystemId === 'kiwi';

    if (isKiwi) {
      this.drawKiwiChassis(ctx, robot);
    } else {
      this.drawRectangularChassis(ctx, robot);
    }

    // Draw mechanical linkages (e.g. Ackermann tie-rod or steel axle shafts)
    this.drawMechanicalLinkages(ctx, robot);

    // Draw each wheel mechanism, educational rollers, spin chevrons & force vectors
    this.drawWheelAssemblies(ctx, robot);

    ctx.restore();
  }

  drawRectangularChassis(ctx, robot) {
    const w = robot.width;
    const h = robot.height;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;

    // Outer carbon-fiber base plate
    const r = 12;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, r);
    ctx.fillStyle = '#111827';
    ctx.fill();
    ctx.restore();

    // Chassis stroke
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#38bdf8';
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, r);
    ctx.stroke();

    // Internal electronics bay with transparent acrylic look
    ctx.fillStyle = '#0a0f1d';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 10, -h / 2 + 14, w - 20, h - 28, 8);
    ctx.fill();
    ctx.stroke();

    // roboRIO / Industrial controller module
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-22, -14, 44, 30);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-22, -14, 44, 30);

    // Heartbeat Status LED
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.008);
    ctx.fillStyle = `rgba(16, 185, 129, ${0.4 + 0.6 * pulse})`;
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, 2, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Directional Front Nose Arrow (Prominent Cyan pointer)
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 + 6);
    ctx.lineTo(14, -h / 2 + 28);
    ctx.lineTo(-14, -h / 2 + 28);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // System badge text on chassis plate
    ctx.font = '800 11px "JetBrains Mono", monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.fillText(robot.driveSystemId.toUpperCase(), 0, -h / 2 + 46);

    ctx.font = '700 9px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('FRONT ▲', 0, -h / 2 + 60);
  }

  drawKiwiChassis(ctx, robot) {
    const r = robot.radius * 0.95;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;

    ctx.beginPath();
    const p1 = { x: 0, y: -r };
    const p2 = { x: r * Math.sin(2 * Math.PI / 3), y: r * 0.5 };
    const p3 = { x: -r * Math.sin(2 * Math.PI / 3), y: r * 0.5 };

    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.lineTo(p3.x, p3.y);
    ctx.closePath();
    ctx.fillStyle = '#111827';
    ctx.fill();
    ctx.restore();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#ec4899';
    ctx.stroke();

    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(0, -r + 20, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.font = '800 10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ec4899';
    ctx.textAlign = 'center';
    ctx.fillText('KIWI 120°', 0, 10);
  }

  /**
   * Draw mechanical tie-rod steering linkage or steel axle bars
   */
  drawMechanicalLinkages(ctx, robot) {
    const halfW = robot.width / 2;
    const halfL = robot.height / 2;
    const scale = robot.scale || 1.0;
    const wheelDims = { width: 36 * scale, height: 86 * scale };
    const bracketX = halfW + wheelDims.width / 2 + 4 * scale;
    const bracketY = halfL - 36 * scale;

    ctx.save();
    if (robot.driveSystemId === 'ackermann') {
      // Front Ackermann Steering Linkage:
      // Front tie-rod bar visibly shifts left and right with front steering angle!
      const steer = robot.kinematics?.ackermannSteerAngle || 0;
      const rackShift = Math.sin(steer) * 22 * scale;

      // Fixed front rack guide
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      ctx.fillRect(-bracketX + 10, -bracketY - 6 * scale, (bracketX - 10) * 2, 12 * scale);
      ctx.strokeRect(-bracketX + 10, -bracketY - 6 * scale, (bracketX - 10) * 2, 12 * scale);

      // Moving Tie-Rod Bar (metallic silver with amber pivot joints)
      ctx.fillStyle = '#cbd5e1';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.fillRect(-bracketX + rackShift, -bracketY - 3 * scale, bracketX * 2, 6 * scale);
      ctx.strokeRect(-bracketX + rackShift, -bracketY - 3 * scale, bracketX * 2, 6 * scale);

      // Pitman arm / steering motor pinion
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(rackShift, -bracketY, 5 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Rear Differential Axle Housing
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.fillRect(-bracketX, bracketY - 4 * scale, bracketX * 2, 8 * scale);
      ctx.strokeRect(-bracketX, bracketY - 4 * scale, bracketX * 2, 8 * scale);
      // Rear differential pumpkin (center sphere)
      ctx.fillStyle = '#334155';
      ctx.beginPath();
      ctx.arc(0, bracketY, 12 * scale, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    } else if (robot.driveSystemId !== 'kiwi') {
      // Heavy-duty steel axle bars extending from chassis to wheel hubs
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 1.5;
      // Front axle
      ctx.fillRect(-bracketX, -bracketY - 4 * scale, bracketX * 2, 8 * scale);
      ctx.strokeRect(-bracketX, -bracketY - 4 * scale, bracketX * 2, 8 * scale);
      // Rear axle
      ctx.fillRect(-bracketX, bracketY - 4 * scale, bracketX * 2, 8 * scale);
      ctx.strokeRect(-bracketX, bracketY - 4 * scale, bracketX * 2, 8 * scale);
    }
    ctx.restore();
  }

  /**
   * Draw Wheel Assemblies:
   * Sized large and mounted externally so students can clearly distinguish every wheel!
   */
  drawWheelAssemblies(ctx, robot) {
    const wheels = robot.wheelOutputs ? robot.wheelOutputs.wheels : [];
    const halfW = robot.width / 2;
    const halfL = robot.height / 2;
    const scale = robot.scale || 1.0;

    const wheelDims = { width: 36 * scale, height: 86 * scale };
    const bracketX = halfW + wheelDims.width / 2 + 4 * scale;
    const bracketY = halfL - 36 * scale;

    let wheelPositions = [
      { id: 'FL', x: -bracketX, y: -bracketY, signX: -1, signY: -1, label: 'FL' },
      { id: 'FR', x: bracketX, y: -bracketY, signX: 1, signY: -1, label: 'FR' },
      { id: 'RL', x: -bracketX, y: bracketY, signX: -1, signY: 1, label: 'RL' },
      { id: 'RR', x: bracketX, y: bracketY, signX: 1, signY: 1, label: 'RR' }
    ];

    if (robot.driveSystemId === 'kiwi') {
      const r = robot.radius * 0.95;
      wheelPositions = [
        { id: 'W1', x: 0, y: -r, angle: Math.PI / 2, signX: 0, signY: -1, label: 'W1 (90°)' },
        { id: 'W2', x: r * Math.sin(2 * Math.PI / 3), y: r * 0.5, angle: 7 * Math.PI / 6, signX: 1, signY: 1, label: 'W2 (210°)' },
        { id: 'W3', x: -r * Math.sin(2 * Math.PI / 3), y: r * 0.5, angle: 11 * Math.PI / 6, signX: -1, signY: 1, label: 'W3 (330°)' }
      ];
    }

    wheels.forEach((wheel, idx) => {
      const pos = wheelPositions[idx];
      if (!pos) return;

      ctx.save();
      ctx.translate(pos.x, pos.y);

      const spinPhase = robot.wheelRotations[idx] || 0;
      const rollerPhase = robot.rollerRotations?.[idx] || 0;

      switch (robot.driveSystemId) {
        case 'mecanum':
          this.drawMecanumWheel(ctx, wheel, wheelDims, spinPhase, rollerPhase, pos);
          break;
        case 'swerve':
          this.drawSwerveModule(ctx, wheel, wheelDims, spinPhase, pos);
          break;
        case 'tank':
          this.drawTankWheel(ctx, wheel, wheelDims, spinPhase, pos);
          break;
        case 'xdrive':
          this.drawXDriveWheel(ctx, wheel, wheelDims, spinPhase, pos);
          break;
        case 'ackermann':
          this.drawAckermannWheel(ctx, wheel, wheelDims, spinPhase, pos);
          break;
        case 'kiwi':
          this.drawKiwiWheel(ctx, wheel, wheelDims, spinPhase, pos);
          break;
      }

      // Flowing Motion Chevrons (▲▲▲ / ▼▼▼) directly on the wheel face!
      if (this.showMotionChevrons && robot.driveSystemId !== 'tank') {
        this.drawMotionChevrons(ctx, wheel, wheelDims, spinPhase);
      }

      // Live Wheel Spin Indicator (FWD ▲ / REV ▼ badge)
      if (this.showSpinIndicators) {
        this.drawWheelSpinIndicator(ctx, wheel, wheelDims, pos, robot.driveSystemId);
      }

      // Draw Force Vector for this wheel
      if (this.showForceVectors && wheel.force) {
        this.drawWheelForceVector(ctx, wheel.force, robot.driveSystemId, pos);
      }

      ctx.restore();
    });
  }

  /**
   * Draw Mecanum Wheel with:
   * 1. 45° cylindrical rollers that revolve around the rim with spinPhase
   * 2. Rollers that spin on their OWN 45° axis with rollerPhase (showing surface rotation)
   */
  drawMecanumWheel(ctx, wheel, dims, spinPhase, rollerPhase, pos) {
    const w = dims.width;
    const h = dims.height;

    ctx.save();

    // Wheel outer rim housing
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 6);
    ctx.fill();
    ctx.stroke();

    // Metallic side flanges
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-w / 2, -h / 2, 5, h);
    ctx.fillRect(w / 2 - 5, -h / 2, 5, h);

    // Rollers:
    // FL & RR: rollers slanted at +45° (slash /)
    // FR & RL: rollers slanted at -45° (backslash \)
    const isSlash = (pos.id === 'FL' || pos.id === 'RR');
    const rollerCount = 6;
    const rollerSpacing = h / rollerCount;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4, 4);
    ctx.clip();

    // Roller animation offset derived from spinPhase
    const offset = (spinPhase * 9) % rollerSpacing;

    // Draw high-contrast 3D cylindrical rollers
    for (let y = -h - rollerSpacing; y <= h + rollerSpacing; y += rollerSpacing) {
      const curY = y + offset;
      const x1 = -w / 2 + 3;
      const x2 = w / 2 - 3;
      const y1 = isSlash ? curY + w * 0.75 : curY - w * 0.75;
      const y2 = isSlash ? curY - w * 0.75 : curY + w * 0.75;

      // Roller outer border / dark groove
      ctx.lineWidth = 13;
      ctx.strokeStyle = '#090d16';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Roller body: bright high-contrast metallic white/silver
      ctx.lineWidth = 9;
      ctx.strokeStyle = '#f8fafc';
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // Individual roller surface rotation marks:
      // Small tick stripes along the roller that shift with rollerPhase!
      // This visually shows the roller spinning on its own 45° pin!
      const rollerLen = Math.hypot(x2 - x1, y2 - y1);
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const markCount = 3;
      const markSpacing = rollerLen / markCount;
      const markOffset = (rollerPhase * 4) % markSpacing;

      ctx.save();
      ctx.translate((x1 + x2) / 2, (y1 + y2) / 2);
      ctx.rotate(angle);
      ctx.fillStyle = '#475569';
      for (let mx = -rollerLen / 2 + markOffset; mx <= rollerLen / 2; mx += markSpacing) {
        ctx.fillRect(mx - 1.5, -4.5, 3, 9);
      }
      ctx.restore();

      // Roller mounting pins
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(x1 - 2.5, y1 - 2.5, 5, 5);
      ctx.fillRect(x2 - 2.5, y2 - 2.5, 5, 5);
    }
    ctx.restore(); // clip

    // Active wheel spin glow outline
    if (Math.abs(wheel.speed) > 0.04) {
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = wheel.speed > 0 ? '#10b981' : '#f59e0b';
      ctx.strokeRect(-w / 2 - 1, -h / 2 - 1, w + 2, h + 2);
    }

    ctx.restore();
  }

  /**
   * Flowing Motion Chevrons:
   * Dynamic cascading arrows down the wheel center showing direction and speed of motor spin!
   */
  drawMotionChevrons(ctx, wheel, dims, spinPhase) {
    const speed = wheel.speed;
    const absSpeed = Math.abs(speed);
    if (absSpeed < 0.04) return;

    const w = dims.width;
    const h = dims.height;
    const isFwd = speed > 0;
    const chevronColor = isFwd ? '#10b981' : '#f59e0b';

    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2 + 5, -h / 2 + 5, w - 10, h - 10);
    ctx.clip();

    ctx.lineWidth = 2.5;
    ctx.strokeStyle = chevronColor;
    ctx.shadowColor = chevronColor;
    ctx.shadowBlur = 6;

    const spacing = 18;
    const flow = (spinPhase * 12) % spacing;
    const dir = isFwd ? -1 : 1; // -1 is forward (up)

    for (let y = -h; y <= h; y += spacing) {
      const cy = y + flow * dir;
      ctx.beginPath();
      if (isFwd) {
        // Pointing UP
        ctx.moveTo(-6, cy + 4);
        ctx.lineTo(0, cy - 4);
        ctx.lineTo(6, cy + 4);
      } else {
        // Pointing DOWN
        ctx.moveTo(-6, cy - 4);
        ctx.lineTo(0, cy + 4);
        ctx.lineTo(6, cy - 4);
      }
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw Coaxial Swerve Module
   * Shows 360° steering pod rotation + rotating drive wheel treads
   */
  drawSwerveModule(ctx, wheel, dims, spinPhase, pos) {
    const moduleRadius = dims.width * 0.95;

    ctx.save();
    // Outer coaxial azimuth ring
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.arc(0, 0, moduleRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Degree markings around ring
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (moduleRadius - 4), Math.sin(a) * (moduleRadius - 4));
      ctx.lineTo(Math.cos(a) * moduleRadius, Math.sin(a) * moduleRadius);
      ctx.stroke();
    }

    // Rotate module to current steer azimuth angle
    ctx.save();
    ctx.rotate(wheel.angle);

    // Bevel gear housing / steering yoke
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-dims.width * 0.45, -dims.height * 0.45, dims.width * 0.9, dims.height * 0.9);
    ctx.strokeRect(-dims.width * 0.45, -dims.height * 0.45, dims.width * 0.9, dims.height * 0.9);

    // Steer angle pointer (Prominent Cyan arrow)
    ctx.fillStyle = '#00f2fe';
    ctx.shadowColor = '#00f2fe';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(0, -moduleRadius - 6);
    ctx.lineTo(7, -moduleRadius + 10);
    ctx.lineTo(-7, -moduleRadius + 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Wheel tire inside pod
    const tw = dims.width * 0.6;
    const th = dims.height * 0.8;
    ctx.fillStyle = '#090d16';
    ctx.fillRect(-tw / 2, -th / 2, tw, th);
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-tw / 2, -th / 2, tw, th);

    // Rolling tire tread animation
    ctx.save();
    ctx.beginPath();
    ctx.rect(-tw / 2, -th / 2, tw, th);
    ctx.clip();
    const treadSpacing = 10;
    const offset = (spinPhase * 9) % treadSpacing;
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 2.5;
    for (let y = -th - treadSpacing; y <= th + treadSpacing; y += treadSpacing) {
      ctx.beginPath();
      ctx.moveTo(-tw / 2, y + offset);
      ctx.lineTo(tw / 2, y + offset);
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore(); // module rotation
    ctx.restore();
  }

  /**
   * Draw Tank / Differential Drive:
   * Continuous caterpillar tracks with rotating sprockets and cycling track cleats!
   */
  drawTankWheel(ctx, wheel, dims, spinPhase, pos) {
    const w = dims.width + 4;
    const h = dims.height + 16;

    ctx.save();
    // Track outer housing
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fill();
    ctx.stroke();

    // Front Drive Sprocket Wheel
    const sprocketRadius = w * 0.42;
    const frontSprocketY = -h / 2 + sprocketRadius + 4;
    const rearSprocketY = h / 2 - sprocketRadius - 4;

    this.drawSprocket(ctx, 0, frontSprocketY, sprocketRadius, spinPhase);
    this.drawSprocket(ctx, 0, rearSprocketY, sprocketRadius, spinPhase);

    // Continuous caterpillar track cleats cycling around track
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 8);
    ctx.clip();

    const cleatSpacing = 14;
    const offset = (spinPhase * 10) % cleatSpacing;

    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 1.5;
    for (let y = -h - cleatSpacing; y <= h + cleatSpacing; y += cleatSpacing) {
      const cy = y + offset;
      ctx.fillRect(-w / 2 + 2, cy - 3, w - 4, 6);
      ctx.strokeRect(-w / 2 + 2, cy - 3, w - 4, 6);
    }
    ctx.restore(); // clip

    // Flowing motion chevrons on track
    this.drawMotionChevrons(ctx, wheel, { width: w, height: h }, spinPhase);

    ctx.restore();
  }

  drawSprocket(ctx, x, y, radius, spinPhase) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spinPhase * 1.5);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sprocket cog teeth
    const teeth = 8;
    ctx.fillStyle = '#94a3b8';
    for (let i = 0; i < teeth; i++) {
      const a = (i * Math.PI * 2) / teeth;
      ctx.save();
      ctx.rotate(a);
      ctx.fillRect(-2, -radius - 3, 4, 5);
      ctx.restore();
    }

    ctx.restore();
  }

  /**
   * Draw X-Drive Wheel (45° angled omni wheel)
   */
  drawXDriveWheel(ctx, wheel, dims, spinPhase, pos) {
    ctx.save();
    ctx.rotate(wheel.angle);

    const w = dims.width * 0.8;
    const h = dims.height * 0.9;

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Large omni barrel rollers along rim that revolve with spinPhase
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();

    const rollerSpacing = 16;
    const offset = (spinPhase * 9) % rollerSpacing;

    for (let y = -h - rollerSpacing; y <= h + rollerSpacing; y += rollerSpacing) {
      const cy = y + offset;
      ctx.fillStyle = '#f1f5f9';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, cy, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /**
   * Draw Ackermann Wheel (Front steering knuckle or rear drive)
   */
  drawAckermannWheel(ctx, wheel, dims, spinPhase, pos) {
    ctx.save();
    if (wheel.isSteered) {
      ctx.rotate(wheel.angle);
    }

    const w = dims.width * 0.85;
    const h = dims.height * 0.85;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = wheel.isSteered ? '#f59e0b' : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Rolling tire tread lugs
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();
    const treadSpacing = 10;
    const offset = (spinPhase * 9) % treadSpacing;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    for (let y = -h - treadSpacing; y <= h + treadSpacing; y += treadSpacing) {
      ctx.beginPath();
      ctx.moveTo(-w / 2, y + offset);
      ctx.lineTo(w / 2, y + offset);
      ctx.stroke();
    }
    ctx.restore();

    // Axle pivot pin & steering knuckle
    if (wheel.isSteered) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(0, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw Kiwi Omni Wheel (120° radial symmetry)
   */
  drawKiwiWheel(ctx, wheel, dims, spinPhase, pos) {
    ctx.save();
    ctx.rotate(pos.angle || 0);

    const w = dims.width * 0.85;
    const h = dims.height * 0.9;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-w / 2, -h / 2, w, h);
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-w / 2, -h / 2, w, h);

    // Barrel rollers
    ctx.save();
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.clip();

    const rollerSpacing = 16;
    const offset = (spinPhase * 9) % rollerSpacing;

    for (let y = -h - rollerSpacing; y <= h + rollerSpacing; y += rollerSpacing) {
      const cy = y + offset;
      ctx.fillStyle = '#f8fafc';
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, cy, 7, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    ctx.restore();
  }

  /**
   * Live Wheel Spin Indicator (▲ FWD / ▼ REV badge + tire directional arrow)
   */
  drawWheelSpinIndicator(ctx, wheel, dims, pos, driveSystemId) {
    const w = dims.width;
    const h = dims.height;
    const speed = wheel.speed;
    const absSpeed = Math.abs(speed);
    const pct = Math.round(absSpeed * 100);

    ctx.save();
    const isFwd = speed >= 0;
    const tagY = pos.signY < 0 ? -h / 2 - 20 : h / 2 + 20;

    // Box badge
    const badgeW = 78;
    const badgeH = 22;
    ctx.fillStyle = absSpeed > 0.05
      ? (isFwd ? 'rgba(16, 185, 129, 0.95)' : 'rgba(245, 158, 11, 0.95)')
      : 'rgba(30, 41, 59, 0.9)';
    ctx.strokeStyle = absSpeed > 0.05
      ? (isFwd ? '#34d399' : '#fbbf24')
      : '#475569';
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.roundRect(-badgeW / 2, tagY - badgeH / 2, badgeW, badgeH, 4);
    ctx.fill();
    ctx.stroke();

    // Arrow + Text
    ctx.fillStyle = absSpeed > 0.05 ? '#060a12' : '#94a3b8';
    ctx.font = '800 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let label = `${pos.id} 0%`;
    if (absSpeed > 0.05) {
      label = isFwd ? `${pos.id} ▲ +${pct}%` : `${pos.id} ▼ -${pct}%`;
    }
    ctx.fillText(label, 0, tagY);

    ctx.restore();
  }

  /**
   * Draw Individual Wheel Force Vectors (Green / Amber arrows)
   * Enhanced with dashed Fx/Fy vector decomposition right-triangle!
   */
  drawWheelForceVector(ctx, force, driveSystemId, pos) {
    if (Math.abs(force.speed) < 0.04) return;

    ctx.save();
    let fx = 0;
    let fy = 0;

    if (driveSystemId === 'mecanum') {
      const rollerDir = (pos.id === 'FL' || pos.id === 'RR') ? 1 : -1;
      const angle = Math.PI / 4;
      const length = force.speed * this.forceVectorScale;
      // In local robot coords: nose is -Y, right is +X
      fx = length * Math.sin(angle) * rollerDir;
      fy = -length * Math.cos(angle);
    } else if (driveSystemId === 'swerve') {
      const length = force.speed * this.forceVectorScale;
      fx = length * Math.sin(force.angle);
      fy = -length * Math.cos(force.angle);
    } else if (driveSystemId === 'tank') {
      const length = force.speed * this.forceVectorScale;
      fx = 0;
      fy = -length;
    } else if (driveSystemId === 'xdrive') {
      const length = force.speed * this.forceVectorScale;
      fx = length * Math.sin(force.angle);
      fy = -length * Math.cos(force.angle);
    } else if (driveSystemId === 'ackermann') {
      const length = force.speed * this.forceVectorScale;
      fx = length * Math.sin(force.angle || 0);
      fy = -length * Math.cos(force.angle || 0);
    } else if (driveSystemId === 'kiwi') {
      const length = force.speed * this.forceVectorScale;
      fx = length * Math.sin(force.angle || 0);
      fy = -length * Math.cos(force.angle || 0);
    }

    const vectorMag = Math.hypot(fx, fy);
    if (vectorMag > 3) {
      const arrowColor = force.speed >= 0 ? '#10b981' : '#f59e0b';

      // 1. Draw dashed vector decomposition (Fx and Fy right-triangle) for students!
      if (this.showVectorComponents && (driveSystemId === 'mecanum' || driveSystemId === 'swerve' || driveSystemId === 'xdrive')) {
        ctx.save();
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.5;
        // Horizontal component Fx
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(fx, 0);
        ctx.lineTo(fx, fy);
        ctx.stroke();

        // Right-angle corner marker
        const cornerSize = 8 * Math.sign(fx);
        const cornerH = -8 * Math.sign(-fy || 1);
        ctx.beginPath();
        ctx.moveTo(fx - cornerSize, 0);
        ctx.lineTo(fx - cornerSize, cornerH);
        ctx.lineTo(fx, cornerH);
        ctx.stroke();

        // Labels for components
        ctx.font = '700 9px "JetBrains Mono", monospace';
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(`Fx`, fx / 2, -6);
        ctx.fillText(`Fy`, fx + (fx >= 0 ? 6 : -20), fy / 2);
        ctx.restore();
      }

      // 2. Main contact force vector arrow
      const angleTag = (pos.id === 'FL' || pos.id === 'RR') ? '+45°' : '-45°';
      const vectorLabel = driveSystemId === 'mecanum'
        ? `F_${pos.id} (${angleTag})`
        : `F_${pos.id}`;

      this.drawArrow(ctx, 0, 0, fx, fy, arrowColor, 4.5, vectorLabel);
    }

    ctx.restore();
  }

  /**
   * Draw Resultant Translation & Torque Vectors from Center of Mass
   */
  drawResultantVectors(ctx, robot) {
    ctx.save();
    ctx.translate(robot.x, robot.y);

    const speedMag = Math.hypot(robot.vx, robot.vy);

    // 1. Resultant Linear Velocity Vector (Cyan)
    if (this.showVelocityVector && speedMag > 5) {
      const vx = robot.vx * this.velocityVectorScale;
      const vy = robot.vy * this.velocityVectorScale;
      this.drawArrow(ctx, 0, 0, vx, vy, '#00f2fe', 4, 'V_res');
    }

    // 2. Resultant Angular Velocity (Torque / Spin Arc)
    if (this.showTorqueArrow && Math.abs(robot.omega) > 0.15) {
      const arcRadius = 55 * (robot.scale || 1);
      const startAngle = -Math.PI / 2;
      const arcSweep = Math.min(Math.PI * 0.85, Math.abs(robot.omega) * 0.5);
      const isCW = robot.omega > 0;

      ctx.save();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#c084fc';
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, arcRadius, startAngle, startAngle + (isCW ? arcSweep : -arcSweep), !isCW);
      ctx.stroke();

      // Arc arrowhead
      const endAngle = startAngle + (isCW ? arcSweep : -arcSweep);
      const endX = arcRadius * Math.cos(endAngle);
      const endY = arcRadius * Math.sin(endAngle);
      const tangent = endAngle + (isCW ? Math.PI / 2 : -Math.PI / 2);

      ctx.fillStyle = '#c084fc';
      ctx.beginPath();
      ctx.moveTo(endX, endY);
      ctx.lineTo(endX - 10 * Math.cos(tangent - 0.5), endY - 10 * Math.sin(tangent - 0.5));
      ctx.lineTo(endX - 10 * Math.cos(tangent + 0.5), endY - 10 * Math.sin(tangent + 0.5));
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.restore();
  }

  drawArrow(ctx, fromX, fromY, toX, toY, color, width = 2, label = '') {
    const headLen = 10;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);
    const mag = Math.hypot(dx, dy);

    if (mag < 4) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;

    // Line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    if (label) {
      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = color;
      ctx.fillText(label, toX + 8, toY - 4);
    }
    ctx.restore();
  }
}
