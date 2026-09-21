// 3D Stickman & Car Test
// Simple, clean prototype

// 1. T5S 2-second splash screen
window.addEventListener('DOMContentLoaded', () => {
  const splash = document.getElementById('t5s-splash');
  if (!splash) return;
  const dismiss = () => {
    if (splash.classList.contains('fade-out')) return;
    splash.classList.add('fade-out');
    setTimeout(() => splash.classList.add('hidden'), 500);
  };
  const timer = setTimeout(dismiss, 2000);
  window.addEventListener('keydown', () => { clearTimeout(timer); dismiss(); }, { once: true });
  splash.addEventListener('click', () => { clearTimeout(timer); dismiss(); }, { once: true });
});

// 2. Input
const keys = { forward: false, backward: false, left: false, right: false, jump: false, interact: false };
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = true;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = true;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = true;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = true;
  if (e.code === 'Space') keys.jump = true;
  if (e.code === 'KeyE') keys.interact = true;
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW' || e.code === 'ArrowUp') keys.forward = false;
  if (e.code === 'KeyS' || e.code === 'ArrowDown') keys.backward = false;
  if (e.code === 'KeyA' || e.code === 'ArrowLeft') keys.left = false;
  if (e.code === 'KeyD' || e.code === 'ArrowRight') keys.right = false;
  if (e.code === 'Space') keys.jump = false;
  if (e.code === 'KeyE') keys.interact = false;
});

// 3. Simple Stickman Class
class Stickman {
  constructor() {
    this.mesh = new THREE.Group();
    this.x = 0;
    this.y = 0;
    this.z = 3;
    this.vy = 0;
    this.rotY = 0;
    this.walkCycle = 0;
    this.isGrounded = true;

    const black = new THREE.MeshBasicMaterial({ color: 0x111111 });

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), black);
    head.position.y = 1.9;
    this.mesh.add(head);

    // Torso (Stick)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.8, 8), black);
    torso.position.y = 1.35;
    this.mesh.add(torso);

    // Arms
    const armGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    armGeom.translate(0, -0.3, 0);
    this.leftArm = new THREE.Mesh(armGeom, black);
    this.leftArm.position.set(-0.25, 1.65, 0);
    this.leftArm.rotation.z = 0.2;
    this.rightArm = new THREE.Mesh(armGeom, black);
    this.rightArm.position.set(0.25, 1.65, 0);
    this.rightArm.rotation.z = -0.2;
    this.mesh.add(this.leftArm, this.rightArm);

    // Legs
    const legGeom = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8);
    legGeom.translate(0, -0.45, 0);
    this.leftLeg = new THREE.Mesh(legGeom, black);
    this.leftLeg.position.set(-0.15, 0.95, 0);
    this.rightLeg = new THREE.Mesh(legGeom, black);
    this.rightLeg.position.set(0.15, 0.95, 0);
    this.mesh.add(this.leftLeg, this.rightLeg);
  }

  update(delta) {
    let dx = 0;
    let dz = 0;
    if (keys.forward) dz -= 1;
    if (keys.backward) dz += 1;
    if (keys.left) dx -= 1;
    if (keys.right) dx += 1;

    const moving = dx !== 0 || dz !== 0;
    if (moving) {
      const len = Math.hypot(dx, dz);
      dx /= len;
      dz /= len;
      const speed = 7 * delta;
      this.x += dx * speed;
      this.z += dz * speed;
      this.rotY = Math.atan2(dx, dz);

      // Walk swing
      this.walkCycle += 10 * delta;
      const swing = Math.sin(this.walkCycle) * 0.6;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing;
      this.rightArm.rotation.x = swing;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
      this.leftArm.rotation.x *= 0.8;
      this.rightArm.rotation.x *= 0.8;
    }

    // Jump
    if (keys.jump && this.isGrounded) {
      this.vy = 8.5;
      this.isGrounded = false;
    }
    if (!this.isGrounded) {
      this.y += this.vy * delta;
      this.vy -= 22 * delta;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.isGrounded = true;
      }
    }

    this.mesh.position.set(this.x, this.y, this.z);
    this.mesh.rotation.y = this.rotY;
  }
}

// 4. Simple Car Class
class Car {
  constructor() {
    this.mesh = new THREE.Group();
    this.x = 0;
    this.z = -3;
    this.rotY = 0;
    this.speed = 0;

    // Body (Red Box)
    const redMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 3.2), redMat);
    body.position.y = 0.55;
    this.mesh.add(body);

    // Cabin (White/Gray Box)
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.55, 1.6), cabinMat);
    cabin.position.set(0, 1.05, -0.2);
    this.mesh.add(cabin);

    // 4 Wheels
    const tireMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
    const wheelGeom = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 16);
    wheelGeom.rotateZ(Math.PI / 2);

    this.wheels = [];
    const positions = [
      [-0.95, 0.35, 1.0],  // front left
      [0.95, 0.35, 1.0],   // front right
      [-0.95, 0.35, -1.0], // rear left
      [0.95, 0.35, -1.0],  // rear right
    ];
    positions.forEach(([wx, wy, wz]) => {
      const wheel = new THREE.Mesh(wheelGeom, tireMat);
      wheel.position.set(wx, wy, wz);
      this.mesh.add(wheel);
      this.wheels.push(wheel);
    });

    this.mesh.position.set(this.x, 0, this.z);
  }

  update(delta, driving) {
    if (driving) {
      if (keys.forward) this.speed += 18 * delta;
      else if (keys.backward) this.speed -= 14 * delta;
      else this.speed *= 0.96; // coast

      this.speed = Math.max(-8, Math.min(22, this.speed));

      if (Math.abs(this.speed) > 0.1) {
        const turnDir = this.speed > 0 ? 1 : -1;
        if (keys.left) this.rotY += 2.4 * delta * turnDir;
        if (keys.right) this.rotY -= 2.4 * delta * turnDir;
      }
    } else {
      this.speed *= 0.9;
    }

    this.x += Math.sin(this.rotY) * this.speed * delta;
    this.z += Math.cos(this.rotY) * this.speed * delta;

    // Roll wheels
    const roll = (this.speed * delta) / 0.35;
    this.wheels.forEach(w => w.rotation.x += roll);

    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.rotY;
  }
}

// 5. Main Game Setup
window.addEventListener('load', () => {
  const canvas = document.getElementById('gameCanvas');
  const promptEl = document.getElementById('prompt');
  const controlsEl = document.getElementById('controls');

  // Scene & Camera
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // Light sky blue

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(0, 6, 12);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffffff, 0.6);
  sun.position.set(10, 20, 10);
  scene.add(sun);

  // Ground: Simple Green Yard with Grid
  const groundGeom = new THREE.PlaneGeometry(120, 120);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x48bb78 });
  const ground = new THREE.Mesh(groundGeom, groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const grid = new THREE.GridHelper(120, 40, 0x38a169, 0x38a169);
  grid.position.y = 0.01;
  scene.add(grid);

  // A couple simple colored toy blocks
  const colors = [0x3b82f6, 0xf59e0b, 0x8b5cf6, 0x10b981];
  [
    [-6, 0, -8], [6, 0, -8], [-10, 0, 4], [10, 0, 4]
  ].forEach(([bx, by, bz], i) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(2, 2, 2),
      new THREE.MeshStandardMaterial({ color: colors[i % colors.length] })
    );
    box.position.set(bx, 1, bz);
    scene.add(box);
  });

  // Spawn Player & Car
  const stickman = new Stickman();
  scene.add(stickman.mesh);

  const car = new Car();
  scene.add(car.mesh);

  let mode = 'foot'; // 'foot' | 'driving'
  let prevInteract = false;

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();

  function loop() {
    requestAnimationFrame(loop);
    const delta = Math.min(clock.getDelta(), 0.1);

    const distToCar = Math.hypot(stickman.x - car.x, stickman.z - car.z);

    // Handle enter / exit car
    const justPressedInteract = keys.interact && !prevInteract;
    prevInteract = keys.interact;

    if (mode === 'foot') {
      stickman.update(delta);
      car.update(delta, false);

      if (distToCar < 3.0) {
        promptEl.style.display = 'block';
        promptEl.innerHTML = 'Press <b>E</b> to Drive';
        if (justPressedInteract) {
          mode = 'driving';
          stickman.mesh.visible = false;
          promptEl.innerHTML = 'Press <b>E</b> to Exit';
          controlsEl.textContent = 'WASD / Arrows to Drive &bull; E to Exit Car';
        }
      } else {
        promptEl.style.display = 'none';
      }

      // Camera follows stickman
      const targetPos = new THREE.Vector3(stickman.x, stickman.y + 1.2, stickman.z);
      const camPos = new THREE.Vector3(stickman.x, stickman.y + 5, stickman.z + 9);
      camera.position.lerp(camPos, 0.1);
      camera.lookAt(targetPos);

    } else if (mode === 'driving') {
      car.update(delta, true);
      stickman.x = car.x;
      stickman.z = car.z;

      promptEl.style.display = 'block';
      promptEl.innerHTML = 'Press <b>E</b> to Exit';

      if (justPressedInteract) {
        mode = 'foot';
        stickman.mesh.visible = true;
        stickman.x = car.x + 2.0;
        stickman.z = car.z;
        controlsEl.textContent = 'WASD / Arrows to Move • Space to Jump • E to Drive Car';
      }

      // Camera follows car from behind
      const carBack = new THREE.Vector3(
        car.x - Math.sin(car.rotY) * 7.5,
        car.y + 3.8,
        car.z - Math.cos(car.rotY) * 7.5
      );
      camera.position.lerp(carBack, 0.12);
      camera.lookAt(car.x, car.y + 1, car.z);
    }

    renderer.render(scene, camera);
  }

  loop();
});
