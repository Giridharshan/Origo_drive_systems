/**
 * app.js
 * Main application coordinator:
 * Connects Canvas rendering, Kinematics, 2D Robot physics, Multi-modal inputs,
 * UI Telemetry feeds, Scenario manager, and Audio synthesizer.
 */

import { DRIVE_SYSTEMS } from './kinematics.js';
import { Robot2D } from './robot.js';
import { ArenaRenderer } from './renderer.js';
import { InputController } from './controls.js';
import { SoundEngine } from './sound.js';
import { ScenarioManager } from './scenarios.js';

class DriveSystemsApp {
  constructor() {
    this.canvas = document.getElementById('arenaCanvas');
    this.renderer = new ArenaRenderer(this.canvas);
    this.robot = new Robot2D(800, 600);
    this.controls = new InputController(document.getElementById('arenaContainer'));
    this.sound = new SoundEngine();
    this.scenarios = new ScenarioManager(800, 600);

    this.lastTime = performance.now();
    this.currentSystemId = 'mecanum';

    this.initDOM();
    this.handleResize();
    window.addEventListener('resize', () => this.handleResize());

    // Setup initial system
    this.selectDriveSystem('mecanum');

    // Start 60fps simulation loop
    requestAnimationFrame((t) => this.loop(t));
  }

  handleResize() {
    const size = this.renderer.resize();
    this.robot.arenaWidth = size.width;
    this.robot.arenaHeight = size.height;
    this.scenarios.resize(size.width, size.height);
  }

  initDOM() {
    // 1. Virtual Joysticks
    this.controls.setupJoysticks(
      document.getElementById('leftJoystick'),
      document.getElementById('leftJoystickKnob'),
      document.getElementById('rightJoystick'),
      document.getElementById('rightJoystickKnob')
    );

    // 2. Drive System Tabs
    const systemTabs = document.querySelectorAll('.system-tab');
    systemTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const sysId = tab.dataset.system;
        this.selectDriveSystem(sysId);
        this.sound.playClick();
      });
    });

    // 3. Drive Mode (Field vs Robot Centric)
    const modeBtn = document.getElementById('fieldCentricToggle');
    if (modeBtn) {
      modeBtn.addEventListener('click', () => {
        this.robot.fieldCentric = !this.robot.fieldCentric;
        modeBtn.classList.toggle('active', this.robot.fieldCentric);
        modeBtn.querySelector('.mode-label').textContent = this.robot.fieldCentric
          ? 'Field-Centric'
          : 'Robot-Centric';
        this.sound.playClick();
      });
    }

    // 4. Arena action buttons
    document.getElementById('resetBtn')?.addEventListener('click', () => {
      this.robot.resetPosition(this.canvas.width / 2, this.canvas.height / 2, 0);
      this.sound.playClick();
    });

    document.getElementById('clearTrailsBtn')?.addEventListener('click', () => {
      this.robot.clearTrails();
      this.sound.playClick();
    });

    // Expand / Maximize Track View Toggle
    const expandTrackBtn = document.getElementById('expandTrackToggle');
    if (expandTrackBtn) {
      expandTrackBtn.addEventListener('click', () => {
        const dashboard = document.querySelector('.main-dashboard');
        dashboard.classList.toggle('full-track-mode');
        const isFull = dashboard.classList.contains('full-track-mode');
        expandTrackBtn.classList.toggle('active', isFull);
        expandTrackBtn.querySelector('.expand-label').textContent = isFull ? 'Split View ◫' : 'Expand Track ⛶';
        // Re-calculate canvas dimensions after CSS transition
        setTimeout(() => this.handleResize(), 320);
        this.sound.playClick();
      });
    }

    // 5. Vector Toggles
    const toggleVectors = document.getElementById('toggleVectors');
    if (toggleVectors) {
      toggleVectors.addEventListener('click', () => {
        this.renderer.showForceVectors = !this.renderer.showForceVectors;
        toggleVectors.classList.toggle('active', this.renderer.showForceVectors);
        this.sound.playClick();
      });
    }

    const toggleComponents = document.getElementById('toggleComponents');
    if (toggleComponents) {
      toggleComponents.addEventListener('click', () => {
        this.renderer.showVectorComponents = !this.renderer.showVectorComponents;
        toggleComponents.classList.toggle('active', this.renderer.showVectorComponents);
        this.sound.playClick();
      });
    }

    const toggleVelocity = document.getElementById('toggleVelocity');
    if (toggleVelocity) {
      toggleVelocity.addEventListener('click', () => {
        this.renderer.showVelocityVector = !this.renderer.showVelocityVector;
        toggleVelocity.classList.toggle('active', this.renderer.showVelocityVector);
        this.sound.playClick();
      });
    }

    // Robot Size Zoom Toggle (1.0x -> 1.35x -> 1.7x)
    const scaleToggle = document.getElementById('scaleToggle');
    const scales = [1.0, 1.35, 1.7];
    let scaleIndex = 0;
    if (scaleToggle) {
      scaleToggle.addEventListener('click', () => {
        scaleIndex = (scaleIndex + 1) % scales.length;
        const newScale = scales[scaleIndex];
        this.robot.setScale(newScale);
        scaleToggle.querySelector('.scale-label').textContent = `Size: ${newScale}x`;
        this.sound.playClick();
      });
    }

    // 6. Sound Toggle
    const soundBtn = document.getElementById('soundToggle');
    if (soundBtn) {
      soundBtn.addEventListener('click', () => {
        const unmuted = this.sound.toggleMute();
        soundBtn.classList.toggle('active', unmuted);
        soundBtn.querySelector('.sound-label').textContent = unmuted ? 'Audio ON' : 'Audio OFF';
      });
    }

    // Slow Motion Toggle (1.0x -> 0.5x -> 0.25x)
    this.timeScale = 1.0;
    this.isPaused = false;
    const timeScaleBtn = document.getElementById('timeScaleToggle');
    const timeScales = [1.0, 0.5, 0.25];
    let timeScaleIdx = 0;
    if (timeScaleBtn) {
      timeScaleBtn.addEventListener('click', () => {
        timeScaleIdx = (timeScaleIdx + 1) % timeScales.length;
        this.timeScale = timeScales[timeScaleIdx];
        this.robot.timeScale = this.timeScale;
        timeScaleBtn.querySelector('.timescale-label').textContent = `${this.timeScale}x Speed`;
        timeScaleBtn.classList.toggle('active', this.timeScale < 1.0);
        this.sound.playClick();
      });
    }

    // Pause / Resume Simulation Toggle
    const pauseBtn = document.getElementById('pauseToggle');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        this.isPaused = !this.isPaused;
        pauseBtn.classList.toggle('active', this.isPaused);
        pauseBtn.querySelector('.pause-label').textContent = this.isPaused ? 'Resume ▶' : 'Pause ⏸';
        this.sound.playClick();
      });
    }

    // 7. Speed Slider
    const speedSlider = document.getElementById('speedSlider');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        this.controls.speedScale = parseFloat(e.target.value);
        document.getElementById('speedVal').textContent = `${Math.round(this.controls.speedScale * 100)}%`;
      });
    }

    // 8. Choreographed Maneuver Buttons
    const maneuverBtns = document.querySelectorAll('.maneuver-btn');
    maneuverBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.maneuver;
        maneuverBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.controls.startManeuver(type);
        this.sound.playClick();

        setTimeout(() => {
          btn.classList.remove('active');
        }, 5000);
      });
    });

    // 9. Scenario Switcher
    const scenarioBtns = document.querySelectorAll('.scenario-chip');
    scenarioBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        scenarioBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const scenarioId = btn.dataset.scenario;
        this.scenarios.setScenario(scenarioId, this.robot);
        this.sound.playClick();
      });
    });

    // 10. Help modal
    const helpModal = document.getElementById('helpModal');
    const helpBtn = document.getElementById('helpBtn');
    const closeHelp = document.getElementById('closeHelp');
    if (helpBtn && helpModal && closeHelp) {
      helpBtn.addEventListener('click', () => {
        helpModal.classList.add('show');
        this.sound.playClick();
      });
      closeHelp.addEventListener('click', () => {
        helpModal.classList.remove('show');
      });
      helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) helpModal.classList.remove('show');
      });
    }
  }

  selectDriveSystem(systemId) {
    if (!DRIVE_SYSTEMS[systemId]) return;
    this.currentSystemId = systemId;
    this.robot.setDriveSystem(systemId);

    // Update Tab UI
    document.querySelectorAll('.system-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.system === systemId);
    });

    // Update Profile Information
    const sys = DRIVE_SYSTEMS[systemId];
    document.getElementById('profileTitle').textContent = sys.name;
    document.getElementById('profileBadge').textContent = sys.badge;
    document.getElementById('profileTagline').textContent = sys.tagline;
    document.getElementById('profileDesc').textContent = sys.description;

    // Pros & Cons
    const prosList = document.getElementById('profilePros');
    prosList.innerHTML = sys.pros.map(p => `<li><span class="bullet-plus">+</span> ${p}</li>`).join('');

    const consList = document.getElementById('profileCons');
    consList.innerHTML = sys.cons.map(c => `<li><span class="bullet-minus">−</span> ${c}</li>`).join('');

    // Equations
    const eqBlock = document.getElementById('equationsContent');
    eqBlock.textContent = sys.equations.forward;

    // Specs
    document.getElementById('specManeuver').textContent = sys.specs.maneuverability;
    document.getElementById('specTraction').textContent = sys.specs.pushingForce;
    document.getElementById('specMech').textContent = sys.specs.mechComplexity;
    document.getElementById('specCode').textContent = sys.specs.codeComplexity;

    // Reset Wheel Telemetry Grid cards
    this.renderWheelCardTemplates(sys);
  }

  renderWheelCardTemplates(sys) {
    const container = document.getElementById('wheelTelemetryGrid');
    if (!container) return;

    let wheelLabels = ['Front Left (FL)', 'Front Right (FR)', 'Rear Left (RL)', 'Rear Right (RR)'];
    if (sys.id === 'kiwi') {
      wheelLabels = ['Front Omni (W1)', 'Rear Right (W2)', 'Rear Left (W3)'];
    }

    container.innerHTML = wheelLabels.map((lbl, idx) => `
      <div class="wheel-telemetry-card" id="wheelCard_${idx}">
        <div class="card-header">
          <span class="wheel-title">${lbl}</span>
          <span class="wheel-speed-val" id="wheelSpeedVal_${idx}">0%</span>
        </div>
        <div class="meter-bar-track">
          <div class="meter-bar-fill" id="wheelBar_${idx}"></div>
        </div>
        <div class="wheel-sub-info">
          <span class="sub-label" id="wheelSubLabel_${idx}">Vector: 0°</span>
          <span class="sub-status" id="wheelStatus_${idx}">IDLE</span>
        </div>
        <div class="wheel-vector-breakdown" id="wheelBreakdown_${idx}">Fx: 0% | Fy: 0%</div>
      </div>
    `).join('');
  }

  updateWheelTelemetryUI(wheels) {
    if (!wheels) return;
    wheels.forEach((w, idx) => {
      const valEl = document.getElementById(`wheelSpeedVal_${idx}`);
      const barEl = document.getElementById(`wheelBar_${idx}`);
      const subEl = document.getElementById(`wheelSubLabel_${idx}`);
      const statusEl = document.getElementById(`wheelStatus_${idx}`);
      const breakEl = document.getElementById(`wheelBreakdown_${idx}`);

      if (!valEl || !barEl) return;

      const pct = Math.round(w.speed * 100);
      valEl.textContent = `${pct > 0 ? '+' : ''}${pct}%`;

      const barWidth = Math.abs(pct);
      barEl.style.width = `${Math.min(100, barWidth)}%`;
      barEl.style.backgroundColor = pct >= 0 ? '#10b981' : '#f59e0b';

      if (subEl) {
        if (w.isSteered || this.currentSystemId === 'swerve') {
          const deg = Math.round((w.angle * 180 / Math.PI));
          subEl.textContent = `Azimuth: ${deg}°`;
        } else if (this.currentSystemId === 'mecanum') {
          const slant = (w.id === 'FL' || w.id === 'RR') ? 'Roller / (+45°)' : 'Roller \\ (-45°)';
          subEl.textContent = slant;
        } else {
          subEl.textContent = `Drive: ${(w.id.startsWith('F') ? 'Front' : 'Rear')}`;
        }
      }

      if (breakEl && w.force) {
        const fx = Math.round(w.force.x * 100);
        const fy = Math.round(w.force.y * 100);
        breakEl.textContent = `Force: Fx = ${fx > 0 ? '+' : ''}${fx}% | Fy = ${fy > 0 ? '+' : ''}${fy}%`;
      }

      if (statusEl) {
        if (Math.abs(pct) < 3) {
          statusEl.textContent = 'IDLE';
          statusEl.className = 'sub-status';
        } else if (pct > 0) {
          statusEl.textContent = 'FWD';
          statusEl.className = 'sub-status fwd';
        } else {
          statusEl.textContent = 'REV';
          statusEl.className = 'sub-status rev';
        }
      }
    });
  }

  updateRobotTelemetryUI(telemetry) {
    document.getElementById('telSpeed').textContent = `${telemetry.speedMps} m/s`;
    document.getElementById('telHeading').textContent = `${telemetry.headingDeg}°`;
    document.getElementById('telOmega').textContent = `${telemetry.omegaDeg}°/s`;
    document.getElementById('telCoord').textContent = `X: ${telemetry.x}, Y: ${telemetry.y}`;

    // Update scenario notification if applicable
    const notif = document.getElementById('scenarioStatus');
    if (notif) {
      notif.textContent = this.scenarios.statusMessage;
      notif.classList.toggle('success', this.scenarios.isCompleted);
    }
  }

  loop(currentTime) {
    const rawDt = Math.min(0.05, (currentTime - this.lastTime) / 1000);
    this.lastTime = currentTime;
    const dt = this.isPaused ? 0 : rawDt * this.timeScale;

    // 1. Fetch input
    const input = this.isPaused ? { transX: 0, transY: 0, rot: 0 } : this.controls.getInput(currentTime / 1000);

    // 2. Fetch obstacles
    const obstacles = this.scenarios.getObstacles();

    // 3. Update 2D robot physics & kinematics
    this.robot.update(input, dt, obstacles);

    // 4. Update scenarios
    this.scenarios.update(dt, this.robot);

    // 5. Update synthesized audio
    const linearSpeed = Math.hypot(this.robot.vx, this.robot.vy);
    this.sound.updateMotorSound(linearSpeed, this.robot.omega);

    // 6. Render canvas
    this.renderer.render(this.robot, obstacles, this.scenarios);

    // 7. Update UI telemetry
    const telemetry = this.robot.getTelemetry();
    this.updateRobotTelemetryUI(telemetry);
    this.updateWheelTelemetryUI(telemetry.wheels);

    requestAnimationFrame((t) => this.loop(t));
  }
}

// Bootstrap on DOM content loaded
window.addEventListener('DOMContentLoaded', () => {
  new DriveSystemsApp();
});
