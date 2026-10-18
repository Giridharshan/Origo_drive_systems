/**
 * scenarios.js
 * Interactive playground arenas and driving challenges:
 * - Free Sandbox
 * - Parallel Parking Challenge (highlights strafing advantage of Mecanum/Swerve)
 * - Slalom Course
 * - Precision Docking
 */

export class ScenarioManager {
  constructor(arenaWidth, arenaHeight) {
    this.arenaWidth = arenaWidth;
    this.arenaHeight = arenaHeight;
    this.activeScenario = 'open';

    // Challenge state
    this.statusMessage = 'Open Track (Zero Obstacles). Unrestricted space to test acceleration, pure strafing, and high-speed donuts.';
    this.isCompleted = false;
    this.timer = 0;
    this.inZoneTime = 0;
  }

  resize(w, h) {
    this.arenaWidth = w;
    this.arenaHeight = h;
  }

  setScenario(name, robot) {
    this.activeScenario = name;
    this.isCompleted = false;
    this.timer = 0;
    this.inZoneTime = 0;

    switch (name) {
      case 'open':
        robot.resetPosition(this.arenaWidth / 2, this.arenaHeight / 2, 0);
        this.statusMessage = 'Open Track (Zero Obstacles). Unrestricted space to test acceleration, pure strafing, and high-speed donuts.';
        break;
      case 'sandbox':
        robot.resetPosition(this.arenaWidth / 2, this.arenaHeight / 2, 0);
        this.statusMessage = 'Free testbed. Drive around, test maneuvers, and observe wheel vectors.';
        break;
      case 'parking':
        robot.resetPosition(this.arenaWidth / 2 - 120, this.arenaHeight / 2 - 80, 0);
        this.statusMessage = 'Parallel park between the obstacles! Notice how Mecanum/Swerve can strafe directly in.';
        break;
      case 'slalom':
        robot.resetPosition(80, this.arenaHeight / 2, Math.PI / 2);
        this.statusMessage = 'Slalom through the gate pylons from left to right.';
        break;
      case 'docking':
        robot.resetPosition(100, 100, Math.PI / 4);
        this.statusMessage = 'Align robot with the glowing target docking bay and hold still for 2s.';
        break;
    }
  }

  getObstacles() {
    const w = this.arenaWidth;
    const h = this.arenaHeight;

    switch (this.activeScenario) {
      case 'open':
        return []; // Zero obstacles

      case 'sandbox':
        return [
          { type: 'circle', x: w * 0.28, y: h * 0.35, radius: 18 },
          { type: 'circle', x: w * 0.72, y: h * 0.35, radius: 18 },
          { type: 'box', x: w * 0.5, y: h * 0.72, width: 90, height: 28 }
        ];

      case 'parking': {
        const bayY = h / 2 + 50;
        const bayX = w / 2;
        return [
          // Front parked vehicle / obstacle
          { type: 'box', x: bayX - 110, y: bayY, width: 80, height: 100 },
          // Rear parked vehicle / obstacle
          { type: 'box', x: bayX + 110, y: bayY, width: 80, height: 100 },
          // Back curb
          { type: 'box', x: bayX, y: bayY + 65, width: 320, height: 16 },
          // Marker cones
          { type: 'circle', x: bayX - 60, y: bayY - 45, radius: 12 },
          { type: 'circle', x: bayX + 60, y: bayY - 45, radius: 12 }
        ];
      }

      case 'slalom': {
        const midY = h / 2;
        const step = w / 5;
        return [
          { type: 'circle', x: step * 1.5, y: midY - 60, radius: 16 },
          { type: 'circle', x: step * 2.5, y: midY + 60, radius: 16 },
          { type: 'circle', x: step * 3.5, y: midY - 60, radius: 16 },
          { type: 'circle', x: step * 4.2, y: midY + 60, radius: 16 }
        ];
      }

      case 'docking':
        return [
          { type: 'circle', x: w * 0.45, y: h * 0.5, radius: 16 },
          { type: 'box', x: w * 0.5, y: h * 0.25, width: 70, height: 24 }
        ];

      default:
        return [];
    }
  }

  update(dt, robot) {
    this.timer += dt;

    if (this.activeScenario === 'docking') {
      const targetX = this.arenaWidth - 110;
      const targetY = this.arenaHeight / 2;
      const dist = Math.hypot(robot.x - targetX, robot.y - targetY);
      const angleDiff = Math.abs(robot.heading - 0);

      if (dist < 32 && angleDiff < 0.2 && Math.hypot(robot.vx, robot.vy) < 15) {
        this.inZoneTime += dt;
        if (this.inZoneTime >= 1.5) {
          this.isCompleted = true;
          this.statusMessage = 'Docking Complete! Precision hold verified.';
        } else {
          this.statusMessage = `Holding in docking zone... ${(1.5 - this.inZoneTime).toFixed(1)}s`;
        }
      } else {
        this.inZoneTime = Math.max(0, this.inZoneTime - dt * 2);
        if (!this.isCompleted) {
          this.statusMessage = 'Align robot inside the docking bay with nose pointing UP.';
        }
      }
    } else if (this.activeScenario === 'parking') {
      const bayX = this.arenaWidth / 2;
      const bayY = this.arenaHeight / 2 + 50;
      const dist = Math.hypot(robot.x - bayX, robot.y - bayY);
      if (dist < 28 && Math.hypot(robot.vx, robot.vy) < 10) {
        this.inZoneTime += dt;
        if (this.inZoneTime >= 1.5) {
          this.isCompleted = true;
          this.statusMessage = 'Parked Successfully! Notice how omnidirectional drives glide in effortlessly.';
        }
      }
    }
  }

  render(ctx) {
    const w = this.arenaWidth;
    const h = this.arenaHeight;

    if (this.activeScenario === 'open') {
      const centerX = w / 2;
      const centerY = h / 2;

      ctx.save();
      // Concentric distance reference rings
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 6]);

      const maxR = Math.min(w, h) * 0.44;
      const step = Math.max(90, Math.floor(maxR / 3));
      for (let r = step; r <= maxR + 10; r += step) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();

        ctx.font = '600 8.5px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
        ctx.fillText(`R: ${r}px`, centerX + r + 4, centerY - 4);
      }

      // Center crosshair
      ctx.strokeStyle = 'rgba(0, 242, 254, 0.25)';
      ctx.setLineDash([]);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(centerX - 30, centerY);
      ctx.lineTo(centerX + 30, centerY);
      ctx.moveTo(centerX, centerY - 30);
      ctx.lineTo(centerX, centerY + 30);
      ctx.stroke();

      ctx.fillStyle = 'rgba(0, 242, 254, 0.5)';
      ctx.beginPath();
      ctx.arc(centerX, centerY, 3.5, 0, Math.PI * 2);
      ctx.fill();

      // Cardinal direction labels
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.textAlign = 'center';
      const labelDist = Math.min(maxR + 15, h / 2 - 18);
      ctx.fillText('N (0°)', centerX, centerY - labelDist);
      ctx.fillText('S (180°)', centerX, centerY + labelDist);
      ctx.fillText('E (90°)', centerX + Math.min(maxR + 35, w / 2 - 35), centerY + 3);
      ctx.fillText('W (270°)', centerX - Math.min(maxR + 35, w / 2 - 35), centerY + 3);

      ctx.restore();
    } else if (this.activeScenario === 'parking') {
      const bayX = w / 2;
      const bayY = h / 2 + 50;

      // Parking bay markings
      ctx.save();
      ctx.strokeStyle = this.isCompleted ? '#10b981' : 'rgba(56, 189, 248, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(bayX - 55, bayY - 45, 110, 90);

      ctx.fillStyle = this.isCompleted ? 'rgba(16, 185, 129, 0.15)' : 'rgba(56, 189, 248, 0.08)';
      ctx.fillRect(bayX - 55, bayY - 45, 110, 90);

      ctx.font = '700 10px "JetBrains Mono", monospace';
      ctx.fillStyle = this.isCompleted ? '#10b981' : '#38bdf8';
      ctx.textAlign = 'center';
      ctx.fillText('PARKING BAY', bayX, bayY);
      ctx.restore();
    } else if (this.activeScenario === 'docking') {
      const targetX = w - 110;
      const targetY = h / 2;

      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = this.isCompleted ? '#10b981' : '#38bdf8';
      ctx.shadowColor = this.isCompleted ? '#10b981' : '#38bdf8';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(targetX, targetY, 36, 0, Math.PI * 2);
      ctx.stroke();

      // Heading target cross
      ctx.beginPath();
      ctx.moveTo(targetX, targetY - 45);
      ctx.lineTo(targetX, targetY + 45);
      ctx.moveTo(targetX - 45, targetY);
      ctx.lineTo(targetX + 45, targetY);
      ctx.stroke();

      ctx.fillStyle = this.isCompleted ? '#10b981' : '#38bdf8';
      ctx.font = '700 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('DOCK TARGET', targetX, targetY + 56);
      ctx.restore();
    }
  }
}
