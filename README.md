# Drive Systems Kinematics Lab 🤖

An interactive 2D robotics drivetrain simulator showcasing multiple mobile robot drive systems, with real-time vector kinematics, 45° roller force decomposition, dynamic wheel moving animations, and educational telemetry.

Inspired by Dawson Bowhay and Team Seamonsters 2605's Mecanum drive tutorial.

---

## 🚀 Quick Start

Run the local web server:

```bash
# Using Python 3
python3 -m http.server 4173

# Or using any static file server:
# npx serve .
```

Then open your web browser at:
**`http://localhost:4173`**

---

## 🕹️ Controls

- **Drive / Translate**: `W` `A` `S` `D` or Arrow Keys (`↑` `←` `↓` `→`)
- **Rotate In-Place**: `Q` / `E`
- **Emergency Handbrake**: `Spacebar`
- **Touch / Mouse Dual Joysticks**:
  - **Left Joystick**: 2D Translation ($X/Y$ strafe & forward/backward)
  - **Right Joystick**: 360° Rotation ($CW/CCW$)
- **Gamepad Support**: Auto-detects connected game controllers (Xbox, PlayStation, etc.)

---

## ⚙️ Supported Drive Systems

1. **Mecanum Drive (45° Rollers)**:
   - 4 wheels with 45° angled passive rollers.
   - Combines diagonal contact force vectors ($F_i$) into pure sideways strafing, forward/reverse, diagonal slides, and rotation.
   - Shows active roller surface rotation and cascading motion chevrons.

2. **Coaxial Swerve Drive**:
   - 4 independent steering pods with 360° azimuth rotation and rolling tire treads.
   - Shortest-path angle optimization ($\le 90^\circ$ flip with motor reversal).

3. **Tank / Differential Drive (Skid-Steer)**:
   - Continuous caterpillar tracks with rotating drive sprockets and cycling track cleats.
   - Differential wheel speeds for turning.

4. **Holonomic X-Drive**:
   - 4 dual-row omni-wheels angled at 45° for ultra-smooth planar drift.

5. **Ackermann Steering**:
   - Real-world automotive steering geometry with visible mechanical tie-rod linkage.
   - Inner wheel turns sharper than outer wheel around the Instantaneous Center of Curvature (ICC).

6. **Kiwi 3-Wheel Omni**:
   - Equilateral triangular chassis with 3 omni-wheels spaced 120° apart.

---

## 🎓 Classroom Teaching Features

- **⚡ Open Track (No Obstacles)**: Clean open floor with concentric distance reference rings and compass markers for unobstructed driving.
- **Slow Motion Mode (`1.0x` → `0.5x` → `0.25x`)**: Slow down physics to observe roller rotation and swerve pod pivots in slow motion.
- **Pause / Freeze (`Pause ⏸` / `Resume ▶`)**: Freeze the robot in mid-maneuver to discuss vector triangles with students.
- **`Expand Track ⛶`**: Expand the driving floor to 100% full screen width for presentation displays.
- **Force Decomposition (`Decomp Fx/Fy`)**: Dashed right-triangles displaying $F_x$ (lateral) and $F_y$ (forward) components.
