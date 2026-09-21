/**
 * 3D World: Stickman & Drivable Car
 * TYSON Media Group (3dtest-tyson3d-myt5s-app)
 *
 * Full 3D environment featuring:
 * - Animated procedural 3D stickman (walk, sprint, jump, idle)
 * - Drivable 3D sports car (chassis, 4 rotating/steering wheels, headlights, drift physics)
 * - Enter/Exit vehicle mechanic (press E)
 * - Town environment: road track, buildings, trees, stunt ramps, traffic cones
 * - Dynamic chase camera & foot follow camera
 * - Web Audio synthesized engine sound
 */

(function () {
  'use strict';

  // ==========================================
  // 1. T5S INTRO SPLASH SCREEN (2 SECONDS)
  // ==========================================
  window.addEventListener('DOMContentLoaded', () => {
    const splash = document.getElementById('t5s-splash');
    if (!splash) return;

    const dismissSplash = () => {
      if (splash.classList.contains('fade-out')) return;
      splash.classList.add('fade-out');
      setTimeout(() => splash.classList.add('hidden'), 600);
    };

    const timer = setTimeout(dismissSplash, 2000);
    window.addEventListener('keydown', () => {
      clearTimeout(timer);
      dismissSplash();
    }, { once: true });
    splash.addEventListener('click', () => {
      clearTimeout(timer);
      dismissSplash();
    }, { once: true });
  });

  // ==========================================
  // 2. AUDIO SYNTHESIZER (WEB AUDIO API)
  // ==========================================
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.engineOsc = null;
      this.engineGain = null;
      this.isStarted = false;
    }

    init() {
      if (this.isStarted) return;
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();

        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;

        // Lowpass filter to give deep engine rumble
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = 'lowpass';
        this.filter.frequency.value = 400;

        this.engineOsc.connect(this.filter);
        this.filter.connect(this.engineGain);
        this.engineGain.connect(this.ctx.destination);
        this.engineOsc.start();
        this.isStarted = true;
      } catch (e) {
        console.warn('Audio not initialized:', e);
      }
    }

    setEngine(rpmRatio, inCar) {
      if (!this.isStarted) return;
      if (!inCar) {
        this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
        return;
      }
      const freq = 45 + rpmRatio * 160;
      this.engineOsc.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.05);
      this.filter.frequency.setTargetAtTime(300 + rpmRatio * 900, this.ctx.currentTime, 0.05);
      this.engineGain.gain.setTargetAtTime(0.08 + rpmRatio * 0.12, this.ctx.currentTime, 0.05);
    }
  }

  // ==========================================
  // 3. INPUT SYSTEM
  // ==========================================
  class InputHandler {
    constructor(canvas) {
      this.canvas = canvas;
      this.keys = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        interact: false,
      };

      this.orbitAngleX = 0;
      this.orbitAngleY = 0.35;
      this.isDragging = false;
      this.lastMouseX = 0;
      this.lastMouseY = 0;

      this._bind();
    }

    _bind() {
      window.addEventListener('keydown', (e) => {
        if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
          e.preventDefault();
        }
        if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = true;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = true;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = true;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = true;
        if (e.code === 'Space') this.keys.jump = true;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.sprint = true;
        if (e.code === 'KeyE') this.keys.interact = true;
      });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'KeyW' || e.code === 'ArrowUp') this.keys.forward = false;
        if (e.code === 'KeyS' || e.code === 'ArrowDown') this.keys.backward = false;
        if (e.code === 'KeyA' || e.code === 'ArrowLeft') this.keys.left = false;
        if (e.code === 'KeyD' || e.code === 'ArrowRight') this.keys.right = false;
        if (e.code === 'Space') this.keys.jump = false;
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.keys.sprint = false;
        if (e.code === 'KeyE') this.keys.interact = false;
      });

      this.canvas.addEventListener('pointerdown', (e) => {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      });

      window.addEventListener('pointermove', (e) => {
        if (this.isDragging) {
          const dx = e.clientX - this.lastMouseX;
          const dy = e.clientY - this.lastMouseY;
          this.orbitAngleX -= dx * 0.005;
          this.orbitAngleY = Math.max(0.1, Math.min(1.2, this.orbitAngleY + dy * 0.005));
          this.lastMouseX = e.clientX;
          this.lastMouseY = e.clientY;
        }
      });

      window.addEventListener('pointerup', () => {
        this.isDragging = false;
      });
    }
  }

  // ==========================================
  // 4. PROCEDURAL 3D STICKMAN
  // ==========================================
  class Stickman {
    constructor() {
      this.group = new THREE.Group();

      this.position = new THREE.Vector3(0, 0, 5);
      this.velocity = new THREE.Vector3();
      this.rotationY = 0;
      this.targetRotationY = 0;

      // Physics
      this.speedWalk = 6.0;
      this.speedSprint = 11.5;
      this.jumpImpulse = 9.8;
      this.gravity = 24.0;
      this.isGrounded = true;
      this.jumpPressed = false;

      // Animation cycle
      this.animCycle = 0;

      this._buildModel();
      this._buildShadow();
    }

    _buildModel() {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b, // Sleek slate black stickman
        roughness: 0.5,
        metalness: 0.2,
      });

      this.root = new THREE.Group();
      this.group.add(this.root);

      // 1. Head
      const headGeom = new THREE.SphereGeometry(0.32, 24, 24);
      this.head = new THREE.Mesh(headGeom, mat);
      this.head.position.y = 1.95;
      this.head.castShadow = true;
      this.root.add(this.head);

      // Cartoon Eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      [-0.1, 0.1].forEach((xOff) => {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), eyeMat);
        eye.position.set(xOff, 1.98, 0.28);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), pupilMat);
        pupil.position.set(0, 0, 0.04);
        eye.add(pupil);
        this.root.add(eye);
      });

      // 2. Torso
      const torsoGeom = new THREE.CylinderGeometry(0.12, 0.12, 0.75, 16);
      this.torso = new THREE.Mesh(torsoGeom, mat);
      this.torso.position.y = 1.4;
      this.torso.castShadow = true;
      this.root.add(this.torso);

      // 3. Arms
      const armGeom = new THREE.CylinderGeometry(0.06, 0.05, 0.65, 12);
      armGeom.translate(0, -0.325, 0);

      this.leftArm = new THREE.Group();
      this.leftArm.position.set(-0.25, 1.7, 0);
      const lArmMesh = new THREE.Mesh(armGeom, mat);
      lArmMesh.castShadow = true;
      this.leftArm.add(lArmMesh);
      this.root.add(this.leftArm);

      this.rightArm = new THREE.Group();
      this.rightArm.position.set(0.25, 1.7, 0);
      const rArmMesh = new THREE.Mesh(armGeom, mat);
      rArmMesh.castShadow = true;
      this.rightArm.add(rArmMesh);
      this.root.add(this.rightArm);

      // 4. Legs
      const legGeom = new THREE.CylinderGeometry(0.07, 0.06, 0.95, 12);
      legGeom.translate(0, -0.475, 0);

      this.leftLeg = new THREE.Group();
      this.leftLeg.position.set(-0.16, 1.0, 0);
      const lLegMesh = new THREE.Mesh(legGeom, mat);
      lLegMesh.castShadow = true;
      this.leftLeg.add(lLegMesh);
      this.root.add(this.leftLeg);

      this.rightLeg = new THREE.Group();
      this.rightLeg.position.set(0.16, 1.0, 0);
      const rLegMesh = new THREE.Mesh(legGeom, mat);
      rLegMesh.castShadow = true;
      this.rightLeg.add(rLegMesh);
      this.root.add(this.rightLeg);
    }

    _buildShadow() {
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0, 0, 0, 0.45)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);

      const tex = new THREE.CanvasTexture(canvas);
      const geom = new THREE.PlaneGeometry(1.4, 1.4);
      const sMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
      this.shadow = new THREE.Mesh(geom, sMat);
      this.shadow.rotation.x = -Math.PI / 2;
      this.shadow.position.y = 0.02;
      this.group.add(this.shadow);
    }

    update(input, delta, cameraYaw) {
      // Relative movement based on camera orientation
      let moveForward = 0;
      let moveRight = 0;

      if (input.keys.forward) moveForward += 1;
      if (input.keys.backward) moveForward -= 1;
      if (input.keys.left) moveRight -= 1;
      if (input.keys.right) moveRight += 1;

      const currentSpeed = input.keys.sprint ? this.speedSprint : this.speedWalk;
      const moveDir = new THREE.Vector3();

      if (moveForward !== 0 || moveRight !== 0) {
        const forward = new THREE.Vector3(-Math.sin(cameraYaw), 0, -Math.cos(cameraYaw));
        const right = new THREE.Vector3(Math.cos(cameraYaw), 0, -Math.sin(cameraYaw));

        moveDir.addScaledVector(forward, moveForward);
        moveDir.addScaledVector(right, moveRight);
        moveDir.normalize();

        this.velocity.x = moveDir.x * currentSpeed;
        this.velocity.z = moveDir.z * currentSpeed;

        this.targetRotationY = Math.atan2(moveDir.x, moveDir.z);
      } else {
        this.velocity.x *= 0.8;
        this.velocity.z *= 0.8;
      }

      // Smooth rotation
      let diff = this.targetRotationY - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotationY += diff * 0.25;

      // Jump
      if (input.keys.jump && this.isGrounded && !this.jumpPressed) {
        this.velocity.y = this.jumpImpulse;
        this.isGrounded = false;
        this.jumpPressed = true;
      }
      if (!input.keys.jump) this.jumpPressed = false;

      // Gravity
      if (!this.isGrounded) {
        this.velocity.y -= this.gravity * delta;
        this.position.y += this.velocity.y * delta;
        if (this.position.y <= 0) {
          this.position.y = 0;
          this.velocity.y = 0;
          this.isGrounded = true;
        }
      }

      // Apply horizontal position
      this.position.x += this.velocity.x * delta;
      this.position.z += this.velocity.z * delta;

      // Procedural Animations
      const groundSpeed = Math.hypot(this.velocity.x, this.velocity.z);
      if (!this.isGrounded) {
        // Airborne jump pose
        this.leftLeg.rotation.x = 0.5;
        this.rightLeg.rotation.x = -0.3;
        this.leftArm.rotation.x = -1.2;
        this.rightArm.rotation.x = -1.2;
        this.torso.position.y = 1.4;
      } else if (groundSpeed > 0.3) {
        // Walk / Run cycle
        const freq = input.keys.sprint ? 14 : 9;
        this.animCycle += freq * delta;
        const swing = Math.sin(this.animCycle) * 0.85;

        this.leftLeg.rotation.x = swing;
        this.rightLeg.rotation.x = -swing;
        this.leftArm.rotation.x = -swing * 0.9;
        this.rightArm.rotation.x = swing * 0.9;

        // Torso bobbing
        this.torso.position.y = 1.4 + Math.abs(Math.cos(this.animCycle)) * 0.08;
      } else {
        // Idle breathing
        this.animCycle += 2.5 * delta;
        const breath = Math.sin(this.animCycle) * 0.02;
        this.torso.position.y = 1.4 + breath;
        this.leftLeg.rotation.x *= 0.85;
        this.rightLeg.rotation.x *= 0.85;
        this.leftArm.rotation.x = Math.sin(this.animCycle) * 0.05;
        this.rightArm.rotation.x = -Math.sin(this.animCycle) * 0.05;
      }

      // Sync 3D transforms
      this.root.position.copy(this.position);
      this.root.rotation.y = this.rotationY;

      this.shadow.position.x = this.position.x;
      this.shadow.position.z = this.position.z;
      const sFactor = Math.max(0.2, 1 - (this.position.y / 4));
      this.shadow.scale.set(sFactor, sFactor, sFactor);
    }
  }

  // ==========================================
  // 5. DRIVABLE 3D SPORTS CAR
  // ==========================================
  class DrivableCar {
    constructor() {
      this.group = new THREE.Group();

      this.position = new THREE.Vector3(0, 0, 0);
      this.rotationY = 0;
      this.speed = 0;
      this.maxSpeed = 34; // ~76 MPH
      this.maxReverseSpeed = -10;
      this.acceleration = 24.0;
      this.braking = 32.0;
      this.friction = 0.985;
      this.steeringAngle = 0;
      this.maxSteer = 0.55;
      this.isDrifting = false;

      this.wheels = [];
      this.frontWheels = [];

      this._buildCar();
    }

    _buildCar() {
      const bodyMat = new THREE.MeshStandardMaterial({
        color: 0xef4444, // Sporty Red
        roughness: 0.3,
        metalness: 0.6,
      });

      const glassMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        roughness: 0.1,
        metalness: 0.9,
      });

      const trimMat = new THREE.MeshStandardMaterial({
        color: 0x111827,
        roughness: 0.8,
      });

      this.chassis = new THREE.Group();
      this.group.add(this.chassis);

      // Main Lower Body
      const lowerGeom = new THREE.BoxGeometry(2.1, 0.5, 4.4);
      const lower = new THREE.Mesh(lowerGeom, bodyMat);
      lower.position.y = 0.55;
      lower.castShadow = true;
      this.chassis.add(lower);

      // Cabin / Roof
      const cabinGeom = new THREE.BoxGeometry(1.65, 0.55, 2.3);
      const cabin = new THREE.Mesh(cabinGeom, glassMat);
      cabin.position.set(0, 1.0, -0.2);
      cabin.castShadow = true;
      this.chassis.add(cabin);

      // Hood Slope
      const hoodGeom = new THREE.BoxGeometry(1.9, 0.25, 1.3);
      const hood = new THREE.Mesh(hoodGeom, bodyMat);
      hood.position.set(0, 0.7, 1.4);
      this.chassis.add(hood);

      // Rear Spoiler
      const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.08, 0.4), trimMat);
      spoilerWing.position.set(0, 1.15, -1.9);
      const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3), trimMat);
      postL.position.set(-0.7, 1.0, -1.9);
      const postR = postL.clone();
      postR.position.x = 0.7;
      this.chassis.add(spoilerWing, postL, postR);

      // Headlights (Glowing white/yellow)
      const lightGeom = new THREE.BoxGeometry(0.35, 0.15, 0.1);
      const headMat = new THREE.MeshBasicMaterial({ color: 0xfff0b5 });
      const leftHead = new THREE.Mesh(lightGeom, headMat);
      leftHead.position.set(-0.75, 0.6, 2.21);
      const rightHead = leftHead.clone();
      rightHead.position.x = 0.75;
      this.chassis.add(leftHead, rightHead);

      // Tail lights (Bright red)
      const tailMat = new THREE.MeshBasicMaterial({ color: 0xff1e1e });
      const leftTail = new THREE.Mesh(lightGeom, tailMat);
      leftTail.position.set(-0.75, 0.6, -2.21);
      const rightTail = leftTail.clone();
      rightTail.position.x = 0.75;
      this.chassis.add(leftTail, rightTail);

      // Wheels
      const wheelGeom = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24);
      wheelGeom.rotateZ(Math.PI / 2);
      const tireMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
      const rimGeom = new THREE.CylinderGeometry(0.24, 0.24, 0.34, 16);
      rimGeom.rotateZ(Math.PI / 2);
      const rimMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.8 });

      const wheelPositions = [
        { x: -1.05, y: 0.42, z: 1.3, isFront: true },  // Front Left
        { x: 1.05, y: 0.42, z: 1.3, isFront: true },   // Front Right
        { x: -1.05, y: 0.42, z: -1.3, isFront: false }, // Rear Left
        { x: 1.05, y: 0.42, z: -1.3, isFront: false },  // Rear Right
      ];

      wheelPositions.forEach((wp) => {
        const wheelPivot = new THREE.Group();
        wheelPivot.position.set(wp.x, wp.y, wp.z);

        const tire = new THREE.Mesh(wheelGeom, tireMat);
        tire.castShadow = true;
        const rim = new THREE.Mesh(rimGeom, rimMat);
        tire.add(rim);

        wheelPivot.add(tire);
        this.chassis.add(wheelPivot);

        this.wheels.push(tire);
        if (wp.isFront) {
          this.frontWheels.push(wheelPivot);
        }
      });
    }

    update(input, delta, inCar) {
      if (inCar) {
        // Acceleration / Reverse
        if (input.keys.forward) {
          this.speed += this.acceleration * delta;
        } else if (input.keys.backward) {
          if (this.speed > 0) {
            this.speed -= this.braking * delta;
          } else {
            this.speed -= this.acceleration * 0.6 * delta;
          }
        } else {
          this.speed *= this.friction;
        }

        // Handbrake / Drift
        this.isDrifting = input.keys.jump;
        if (this.isDrifting) {
          this.speed *= 0.97;
        }

        // Steer angle
        const steerTarget = (input.keys.left ? 1 : 0) - (input.keys.right ? 1 : 0);
        this.steeringAngle += (steerTarget * this.maxSteer - this.steeringAngle) * 12 * delta;

        // Turn car based on forward motion
        const turnFactor = (this.isDrifting ? 1.7 : 1.0) * (this.speed / this.maxSpeed);
        this.rotationY += this.steeringAngle * turnFactor * 2.5 * delta;

      } else {
        // Car decelerates naturally when unoccupied
        this.speed *= 0.94;
        this.steeringAngle *= 0.9;
      }

      // Cap speed
      this.speed = Math.max(this.maxReverseSpeed, Math.min(this.maxSpeed, this.speed));

      // Move along forward vector
      const forwardX = Math.sin(this.rotationY);
      const forwardZ = Math.cos(this.rotationY);

      this.position.x += forwardX * this.speed * delta;
      this.position.z += forwardZ * this.speed * delta;

      // Rotate wheel meshes
      const rollAngle = (this.speed * delta) / 0.42;
      this.wheels.forEach((w) => {
        w.rotation.x += rollAngle;
      });

      // Steer front wheels
      this.frontWheels.forEach((pivot) => {
        pivot.rotation.y = this.steeringAngle;
      });

      // Body roll/pitch on turns and acceleration
      this.chassis.rotation.z = -this.steeringAngle * (this.speed / this.maxSpeed) * 0.18;
      this.chassis.rotation.x = (input.keys.forward ? -0.04 : (input.keys.backward ? 0.05 : 0));

      this.group.position.copy(this.position);
      this.group.rotation.y = this.rotationY;
    }
  }

  // ==========================================
  // 6. TOWN & 3D ENVIRONMENT BUILDER
  // ==========================================
  function createTownEnvironment(scene) {
    // 1. Vast Ground (Grass & Roads)
    const groundGeom = new THREE.PlaneGeometry(240, 240);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x38a169, // Lush Green
      roughness: 0.8,
    });
    const ground = new THREE.Mesh(groundGeom, grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // 2. Asphalt Race Track / City Loop
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });

    // Outer Loop Road (Ring)
    const trackRadius = 45;
    const trackWidth = 8;
    const roadGeom = new THREE.RingGeometry(trackRadius - trackWidth / 2, trackRadius + trackWidth / 2, 64);
    const roadRing = new THREE.Mesh(roadGeom, roadMat);
    roadRing.rotation.x = -Math.PI / 2;
    roadRing.position.y = 0.01;
    roadRing.receiveShadow = true;
    scene.add(roadRing);

    // Center Dashed Road Stripes
    for (let i = 0; i < 40; i++) {
      const angle = (i / 40) * Math.PI * 2;
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 2.2), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.rotation.z = -angle;
      stripe.position.set(Math.cos(angle) * trackRadius, 0.02, Math.sin(angle) * trackRadius);
      scene.add(stripe);
    }

    // 3. Low-Poly Trees
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
    const foliageMat = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.5 });

    function addTree(x, z, scale = 1.0) {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(x, 0, z);

      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * scale, 0.35 * scale, 1.8 * scale, 8), trunkMat);
      trunk.position.y = 0.9 * scale;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      // Layered foliage cones
      [1.6, 2.4, 3.1].forEach((yOff, idx) => {
        const radius = (1.4 - idx * 0.3) * scale;
        const cone = new THREE.Mesh(new THREE.ConeGeometry(radius, 1.4 * scale, 8), foliageMat);
        cone.position.y = yOff * scale;
        cone.castShadow = true;
        treeGroup.add(cone);
      });

      scene.add(treeGroup);
    }

    // Scatter trees inside and outside track
    for (let i = 0; i < 28; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 12 + Math.random() * 22; // Inside park
      addTree(Math.cos(theta) * r, Math.sin(theta) * r, 0.8 + Math.random() * 0.5);
    }
    for (let i = 0; i < 35; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 54 + Math.random() * 35; // Outside ring
      addTree(Math.cos(theta) * r, Math.sin(theta) * r, 0.9 + Math.random() * 0.6);
    }

    // 4. Low-Poly Colorful Town Buildings
    const buildingColors = [0x3b82f6, 0xf59e0b, 0x8b5cf6, 0xec4899, 0x10b981, 0x64748b];
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    function addBuilding(x, z, w, h, d, color) {
      const bGroup = new THREE.Group();
      bGroup.position.set(x, 0, z);

      const bMesh = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color, roughness: 0.4 })
      );
      bMesh.position.y = h / 2;
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      bGroup.add(bMesh);

      // Roof trim
      const roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.3, 0.3, d + 0.3),
        new THREE.MeshStandardMaterial({ color: 0x1e293b })
      );
      roof.position.y = h + 0.15;
      bGroup.add(roof);

      scene.add(bGroup);
    }

    // Perimeter City Buildings
    const bConfigs = [
      { x: -28, z: -28, w: 9, h: 14, d: 8, c: 0 },
      { x: 28, z: -28, w: 8, h: 18, d: 9, c: 1 },
      { x: -30, z: 28, w: 10, h: 12, d: 10, c: 2 },
      { x: 30, z: 28, w: 8, h: 16, d: 8, c: 3 },
      { x: 0, z: -32, w: 12, h: 22, d: 7, c: 4 },
      { x: -55, z: 0, w: 10, h: 15, d: 10, c: 5 },
      { x: 55, z: 0, w: 11, h: 20, d: 9, c: 0 },
    ];

    bConfigs.forEach((cfg) => {
      addBuilding(cfg.x, cfg.z, cfg.w, cfg.h, cfg.d, buildingColors[cfg.c]);
    });

    // 5. Stunt Jump Ramps for the Car!
    const rampMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 });
    function addRamp(x, z, rotY) {
      const rampGeom = new THREE.BufferGeometry();
      // Triangle wedge ramp
      const w = 4;
      const h = 2.2;
      const l = 6;
      const vertices = new Float32Array([
        // base
        -w/2, 0, 0,    w/2, 0, 0,    w/2, 0, l,
        -w/2, 0, 0,    w/2, 0, l,   -w/2, 0, l,
        // slope
        -w/2, 0, 0,    w/2, 0, 0,    w/2, h, l,
        -w/2, 0, 0,    w/2, h, l,   -w/2, h, l,
        // back
        -w/2, 0, l,    w/2, 0, l,    w/2, h, l,
        -w/2, 0, l,    w/2, h, l,   -w/2, h, l,
      ]);
      rampGeom.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      rampGeom.computeVertexNormals();

      const ramp = new THREE.Mesh(rampGeom, rampMat);
      ramp.position.set(x, 0, z);
      ramp.rotation.y = rotY;
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      scene.add(ramp);
    }

    addRamp(0, 45, Math.PI / 2);
    addRamp(45, 0, 0);
  }

  // ==========================================
  // 7. MAIN GAME CONTROLLER
  // ==========================================
  class GameApp {
    constructor() {
      this.canvas = document.getElementById('gameCanvas');
      this.mode = 'foot'; // 'foot' | 'driving'

      this.sound = new SoundManager();
      this.input = new InputHandler(this.canvas);
      this.clock = new THREE.Clock();

      // UI elements
      this.modeText = document.getElementById('mode-text');
      this.promptCard = document.getElementById('prompt-card');
      this.promptText = document.getElementById('prompt-text');
      this.speedometer = document.getElementById('speedometer');
      this.speedVal = document.getElementById('speed-val');
      this.moveDesc = document.getElementById('move-desc');
      this.spaceDesc = document.getElementById('space-desc');
      this.sprintRow = document.getElementById('sprint-row');

      this._initThree();
      this._bindEvents();
      this._loop();
    }

    _initThree() {
      // Scene & Sky
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x70b5ff); // Clear sky blue
      this.scene.fog = new THREE.Fog(0x70b5ff, 45, 150);

      // Camera
      const aspect = window.innerWidth / window.innerHeight;
      this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 300);
      this.camera.position.set(0, 8, 14);

      // WebGL Renderer with soft shadows
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      // Lights
      const ambient = new THREE.AmbientLight(0xe0f2fe, 0.65);
      this.scene.add(ambient);

      const sun = new THREE.DirectionalLight(0xffffff, 0.95);
      sun.position.set(40, 60, 40);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      const d = 50;
      sun.shadow.camera.left = -d;
      sun.shadow.camera.right = d;
      sun.shadow.camera.top = d;
      sun.shadow.camera.bottom = -d;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 160;
      this.scene.add(sun);
      this.sun = sun;

      // Environment
      createTownEnvironment(this.scene);

      // Spawn Player & Car
      this.stickman = new Stickman();
      this.scene.add(this.stickman.group);

      this.car = new DrivableCar();
      this.car.position.set(0, 0, 10);
      this.scene.add(this.car.group);

      this.cameraTarget = new THREE.Vector3();
    }

    _bindEvents() {
      window.addEventListener('resize', () => {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
      });

      // Unlock audio on first user click
      window.addEventListener('pointerdown', () => this.sound.init(), { once: true });
      window.addEventListener('keydown', () => this.sound.init(), { once: true });
    }

    _handleVehicleInteraction() {
      const distToCar = this.stickman.position.distanceTo(this.car.position);

      if (this.mode === 'foot') {
        if (distToCar < 4.2) {
          this.promptCard.style.display = 'flex';
          this.promptText.textContent = 'Drive Car';

          if (this.input.keys.interact) {
            this.input.keys.interact = false;
            // Enter Car
            this.mode = 'driving';
            this.stickman.root.visible = false;
            this.stickman.shadow.visible = false;
            this.modeText.textContent = '🏎️ Driving (Sports Car)';
            this.speedometer.style.display = 'flex';
            this.moveDesc.textContent = 'Steer & Accelerate';
            this.spaceDesc.textContent = 'Handbrake / Drift';
            this.sprintRow.style.display = 'none';
          }
        } else {
          this.promptCard.style.display = 'none';
        }
      } else if (this.mode === 'driving') {
        this.promptCard.style.display = 'flex';
        this.promptText.textContent = 'Exit Car';

        if (this.input.keys.interact) {
          this.input.keys.interact = false;
          // Exit Car beside driver's door
          this.mode = 'foot';
          const sideOffset = new THREE.Vector3(2.2, 0, 0).applyAxisAngle(
            new THREE.Vector3(0, 1, 0),
            this.car.rotationY
          );
          this.stickman.position.copy(this.car.position).add(sideOffset);
          this.stickman.position.y = 0;
          this.stickman.velocity.set(0, 0, 0);
          this.stickman.root.visible = true;
          this.stickman.shadow.visible = true;

          this.modeText.textContent = '🚶 On Foot (Stickman)';
          this.speedometer.style.display = 'none';
          this.moveDesc.textContent = 'Walk & Turn';
          this.spaceDesc.textContent = 'Jump';
          this.sprintRow.style.display = 'flex';
        }
      }
    }

    _updateCamera(delta) {
      if (this.mode === 'foot') {
        // Third person orbit follow camera
        const target = this.stickman.position;
        const dist = 7.5;
        const cx = target.x + Math.sin(this.input.orbitAngleX) * dist * Math.cos(this.input.orbitAngleY);
        const cz = target.z + Math.cos(this.input.orbitAngleX) * dist * Math.cos(this.input.orbitAngleY);
        const cy = target.y + Math.sin(this.input.orbitAngleY) * dist + 1.2;

        this.camera.position.lerp(new THREE.Vector3(cx, cy, cz), 0.12);
        this.cameraTarget.lerp(new THREE.Vector3(target.x, target.y + 1.4, target.z), 0.15);
        this.camera.lookAt(this.cameraTarget);

      } else if (this.mode === 'driving') {
        // High-octane dynamic chase camera
        const carPos = this.car.position;
        const carYaw = this.car.rotationY;

        // Position camera behind car
        const followDist = 8.5 + (this.car.speed / this.car.maxSpeed) * 3.5;
        const followHeight = 3.8;

        const behindX = carPos.x - Math.sin(carYaw) * followDist;
        const behindZ = carPos.z - Math.cos(carYaw) * followDist;
        const behindY = carPos.y + followHeight;

        this.camera.position.lerp(new THREE.Vector3(behindX, behindY, behindZ), 0.1);
        this.cameraTarget.lerp(new THREE.Vector3(carPos.x, carPos.y + 1.2, carPos.z), 0.14);
        this.camera.lookAt(this.cameraTarget);

        // Update speedometer
        const mph = Math.round(Math.abs(this.car.speed) * 2.4);
        this.speedVal.textContent = mph;

        // Dynamic audio engine RPM
        this.sound.setEngine(Math.abs(this.car.speed) / this.car.maxSpeed, true);
      }
    }

    _loop() {
      requestAnimationFrame(() => this._loop());

      const delta = Math.min(this.clock.getDelta(), 0.08);

      // Handle entering/exiting car
      this._handleVehicleInteraction();

      // Update player
      if (this.mode === 'foot') {
        this.stickman.update(this.input, delta, this.input.orbitAngleX);
        this.car.update(this.input, delta, false);
        this.sound.setEngine(0, false);
      } else {
        this.car.update(this.input, delta, true);
        this.stickman.position.copy(this.car.position);
      }

      // Update camera
      this._updateCamera(delta);

      // Align sun shadow map with current focus
      const activePos = this.mode === 'foot' ? this.stickman.position : this.car.position;
      this.sun.position.set(activePos.x + 40, activePos.y + 60, activePos.z + 40);
      this.sun.target.position.copy(activePos);
      this.sun.target.updateMatrixWorld();

      // Render 3D frame
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Start when DOM is ready
  window.addEventListener('load', () => {
    new GameApp();
  });

})();
