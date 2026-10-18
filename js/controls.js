/**
 * controls.js
 * Multi-modal control system:
 * - Dual touch/mouse virtual joysticks (Translation + Rotation)
 * - Keyboard listeners (WASD + Q/E, Arrow keys, Space for brake)
 * - Gamepad API controller support
 * - Auto-choreographed maneuvers
 */

export class InputController {
  constructor(canvasContainer) {
    this.container = canvasContainer;

    // Current normalized input values [-1.0, 1.0]
    this.transX = 0; // +right, -left
    this.transY = 0; // +forward, -backward
    this.rot = 0;    // +clockwise, -counter-clockwise

    // Key states
    this.keys = {};

    // Virtual Joysticks DOM elements
    this.leftJoystick = null;
    this.leftKnob = null;
    this.rightJoystick = null;
    this.rightKnob = null;

    // Joystick state tracking
    this.leftTouchId = null;
    this.rightTouchId = null;
    this.leftDragging = false;
    this.rightDragging = false;
    this.leftCenter = { x: 0, y: 0 };
    this.rightCenter = { x: 0, y: 0 };
    this.joystickRadius = 45;

    // Active auto-maneuver state
    this.activeManeuver = null;
    this.maneuverStartTime = 0;

    // Speed multiplier from UI
    this.speedScale = 1.0;

    // Handbrake flag
    this.isBraking = false;

    this.initKeyboard();
  }

  setupJoysticks(leftBaseEl, leftKnobEl, rightBaseEl, rightKnobEl) {
    this.leftJoystick = leftBaseEl;
    this.leftKnob = leftKnobEl;
    this.rightJoystick = rightBaseEl;
    this.rightKnob = rightKnobEl;

    this.initJoystickEvents();
  }

  initKeyboard() {
    window.addEventListener('keydown', (e) => {
      // Avoid intercepting input fields
      if (['input', 'textarea', 'select'].includes(e.target.tagName.toLowerCase())) return;

      this.keys[e.code] = true;

      // Prevent page scrolling on arrow keys and space
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'Space') {
        this.isBraking = true;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (e.code === 'Space') {
        this.isBraking = false;
      }
    });
  }

  initJoystickEvents() {
    if (!this.leftJoystick || !this.rightJoystick) return;

    // Mouse handlers for Left Joystick
    this.leftJoystick.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.cancelManeuver();
      this.leftDragging = true;
      const rect = this.leftJoystick.getBoundingClientRect();
      this.leftCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.handleJoystickMove(e.clientX, e.clientY, 'left');
    });

    // Mouse handlers for Right Joystick
    this.rightJoystick.addEventListener('mousedown', (e) => {
      e.preventDefault();
      this.cancelManeuver();
      this.rightDragging = true;
      const rect = this.rightJoystick.getBoundingClientRect();
      this.rightCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      this.handleJoystickMove(e.clientX, e.clientY, 'right');
    });

    window.addEventListener('mousemove', (e) => {
      if (this.leftDragging) {
        this.handleJoystickMove(e.clientX, e.clientY, 'left');
      }
      if (this.rightDragging) {
        this.handleJoystickMove(e.clientX, e.clientY, 'right');
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.leftDragging) {
        this.leftDragging = false;
        this.resetJoystick('left');
      }
      if (this.rightDragging) {
        this.rightDragging = false;
        this.resetJoystick('right');
      }
    });

    // Touch events
    const onTouchStart = (e) => {
      e.preventDefault();
      this.cancelManeuver();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        const leftRect = this.leftJoystick.getBoundingClientRect();
        const rightRect = this.rightJoystick.getBoundingClientRect();

        if (this.isInsideRect(touch.clientX, touch.clientY, leftRect) && this.leftTouchId === null) {
          this.leftTouchId = touch.identifier;
          this.leftCenter = { x: leftRect.left + leftRect.width / 2, y: leftRect.top + leftRect.height / 2 };
          this.handleJoystickMove(touch.clientX, touch.clientY, 'left');
        } else if (this.isInsideRect(touch.clientX, touch.clientY, rightRect) && this.rightTouchId === null) {
          this.rightTouchId = touch.identifier;
          this.rightCenter = { x: rightRect.left + rightRect.width / 2, y: rightRect.top + rightRect.height / 2 };
          this.handleJoystickMove(touch.clientX, touch.clientY, 'right');
        }
      }
    };

    const onTouchMove = (e) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.leftTouchId) {
          this.handleJoystickMove(touch.clientX, touch.clientY, 'left');
        } else if (touch.identifier === this.rightTouchId) {
          this.handleJoystickMove(touch.clientX, touch.clientY, 'right');
        }
      }
    };

    const onTouchEnd = (e) => {
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === this.leftTouchId) {
          this.leftTouchId = null;
          this.resetJoystick('left');
        } else if (touch.identifier === this.rightTouchId) {
          this.rightTouchId = null;
          this.resetJoystick('right');
        }
      }
    };

    this.leftJoystick.addEventListener('touchstart', onTouchStart, { passive: false });
    this.rightJoystick.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd);
    window.addEventListener('touchcancel', onTouchEnd);
  }

  isInsideRect(x, y, rect) {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  handleJoystickMove(clientX, clientY, which) {
    const center = which === 'left' ? this.leftCenter : this.rightCenter;
    const knob = which === 'left' ? this.leftKnob : this.rightKnob;
    const dx = clientX - center.x;
    const dy = clientY - center.y;
    const dist = Math.hypot(dx, dy);
    const clampedDist = Math.min(this.joystickRadius, dist);
    const angle = Math.atan2(dy, dx);

    const knobX = Math.cos(angle) * clampedDist;
    const knobY = Math.sin(angle) * clampedDist;

    if (knob) {
      knob.style.transform = `translate(${knobX}px, ${knobY}px)`;
    }

    const normX = (clampedDist / this.joystickRadius) * Math.cos(angle);
    const normY = (clampedDist / this.joystickRadius) * Math.sin(angle);

    if (which === 'left') {
      this.transX = normX;
      this.transY = -normY; // joystick up is positive forward
    } else {
      this.rot = normX; // right turns clockwise
    }
  }

  resetJoystick(which) {
    if (which === 'left') {
      this.transX = 0;
      this.transY = 0;
      if (this.leftKnob) this.leftKnob.style.transform = 'translate(0px, 0px)';
    } else {
      this.rot = 0;
      if (this.rightKnob) this.rightKnob.style.transform = 'translate(0px, 0px)';
    }
  }

  /**
   * Start automated maneuver demonstration
   */
  startManeuver(name) {
    this.activeManeuver = name;
    this.maneuverStartTime = performance.now() / 1000;
  }

  cancelManeuver() {
    this.activeManeuver = null;
  }

  /**
   * Process all inputs and poll gamepad
   */
  getInput(nowSeconds) {
    if (this.isBraking) {
      return { transX: 0, transY: 0, rot: 0 };
    }

    // Check auto-maneuver
    if (this.activeManeuver) {
      const elapsed = nowSeconds - this.maneuverStartTime;
      const maneuverInput = this.computeManeuver(this.activeManeuver, elapsed);
      if (maneuverInput) {
        return {
          transX: maneuverInput.transX * this.speedScale,
          transY: maneuverInput.transY * this.speedScale,
          rot: maneuverInput.rot * this.speedScale
        };
      } else {
        this.activeManeuver = null;
      }
    }

    let finalTransX = this.transX;
    let finalTransY = this.transY;
    let finalRot = this.rot;

    // Keyboard bindings
    let keyX = 0;
    let keyY = 0;
    let keyRot = 0;

    if (this.keys['KeyW'] || this.keys['ArrowUp']) keyY += 1;
    if (this.keys['KeyS'] || this.keys['ArrowDown']) keyY -= 1;
    if (this.keys['KeyD'] || this.keys['ArrowRight']) keyX += 1;
    if (this.keys['KeyA'] || this.keys['ArrowLeft']) keyX -= 1;

    if (this.keys['KeyE'] || this.keys['KeyL']) keyRot += 1;
    if (this.keys['KeyQ'] || this.keys['KeyJ']) keyRot -= 1;

    // If keyboard is pressed, override or blend with joystick
    if (keyX !== 0 || keyY !== 0) {
      const mag = Math.hypot(keyX, keyY);
      finalTransX = (keyX / mag);
      finalTransY = (keyY / mag);
    }
    if (keyRot !== 0) {
      finalRot = keyRot;
    }

    // Gamepad API check
    const gamepad = this.pollGamepad();
    if (gamepad) {
      if (Math.abs(gamepad.transX) > 0.1 || Math.abs(gamepad.transY) > 0.1) {
        finalTransX = gamepad.transX;
        finalTransY = gamepad.transY;
      }
      if (Math.abs(gamepad.rot) > 0.1) {
        finalRot = gamepad.rot;
      }
    }

    return {
      transX: Math.max(-1, Math.min(1, finalTransX * this.speedScale)),
      transY: Math.max(-1, Math.min(1, finalTransY * this.speedScale)),
      rot: Math.max(-1, Math.min(1, finalRot * this.speedScale))
    };
  }

  pollGamepad() {
    if (!navigator.getGamepads) return null;
    const gamepads = navigator.getGamepads();
    for (const gp of gamepads) {
      if (gp && gp.connected) {
        const lx = gp.axes[0] || 0;
        const ly = -(gp.axes[1] || 0); // up is negative on stick
        const rx = gp.axes[2] || 0;
        return {
          transX: Math.abs(lx) > 0.12 ? lx : 0,
          transY: Math.abs(ly) > 0.12 ? ly : 0,
          rot: Math.abs(rx) > 0.12 ? rx : 0
        };
      }
    }
    return null;
  }

  computeManeuver(type, t) {
    switch (type) {
      case 'strafe': {
        // Pure horizontal strafe back and forth
        if (t > 7.0) return null;
        const phase = Math.sin(t * 1.8);
        return { transX: phase * 0.9, transY: 0, rot: 0 };
      }
      case 'spin': {
        // Pure rotation in place
        if (t > 5.0) return null;
        return { transX: 0, transY: 0, rot: 0.85 };
      }
      case 'diagonal': {
        // 45 degree diagonal translation
        if (t > 6.0) return null;
        const dir = Math.sin(t * 1.5) > 0 ? 0.75 : -0.75;
        return { transX: dir, transY: dir, rot: 0 };
      }
      case 'orbit': {
        // Orbit around a point while keeping nose facing inwards
        if (t > 10.0) return null;
        const orbitSpeed = 0.8;
        return { transX: orbitSpeed, transY: 0, rot: orbitSpeed * 0.9 };
      }
      case 'figure8': {
        // Smooth figure 8 path
        if (t > 12.0) return null;
        const angle = t * 1.2;
        const tx = Math.sin(angle);
        const ty = Math.sin(2 * angle);
        return { transX: tx * 0.7, transY: ty * 0.7, rot: Math.cos(angle) * 0.4 };
      }
      default:
        return null;
    }
  }
}
