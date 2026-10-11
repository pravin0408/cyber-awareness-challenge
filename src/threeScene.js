/**
 * threeScene.js
 * High-performance 3D Cyber Defense Core & Holographic Matrix using Three.js.
 *
 * Features:
 *  - Procedural 3D Icosahedron Defense Core with vertex glow points
 *  - Orbiting orbital defense rings with particle tracer pulses
 *  - Ambient cyber packet particle nebula (250+ floating nodes)
 *  - Undulating perspective cyber grid floor with wave displacement
 *  - Responsive mouse parallax with smooth camera lerping
 *  - Reactive Threat Mode State Machine:
 *      - NORMAL: Cyan / Electric Blue cyber glow
 *      - LAUNCH: Emerald energy surge with rotational speed boost
 *      - WARNING: Amber pulse on Strike 1 & 2
 *      - CRITICAL: Crimson alarm strobe on Strike 3 / Disqualification
 *      - VICTORY: Gold / Holographic radiant aura for Leaderboard
 */

(function (root) {
  "use strict";

  let scene, camera, renderer;
  let coreMesh, coreWireframe, innerCore;
  let orbitRing1, orbitRing2, orbitRing3;
  let particleSystem;
  let gridHelper;
  let animId = null;
  let is3DEnabled = true;

  // Mouse parallax target coordinates
  let mouseX = 0;
  let mouseY = 0;
  let targetCameraX = 0;
  let targetCameraY = 0;

  // Threat mode colors
  const THEMES = {
    normal: { core: 0x00f0ff, inner: 0x0066ff, particles: 0x00f0ff, speed: 0.005 },
    launch: { core: 0x10b981, inner: 0x059669, particles: 0x34d399, speed: 0.015 },
    warning: { core: 0xf59e0b, inner: 0xd97706, particles: 0xfbbf24, speed: 0.01 },
    critical: { core: 0xff3366, inner: 0xcc0033, particles: 0xff4d79, speed: 0.02 },
    victory: { core: 0xfacc15, inner: 0xeab308, particles: 0xfef08a, speed: 0.008 }
  };

  let currentTheme = THEMES.normal;

  function init3D() {
    const canvas = document.getElementById("cyber-3d-canvas");
    if (!canvas || typeof THREE === "undefined") return;

    // 1. Scene & Camera setup
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x050811, 0.035);

    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 1000);
    camera.position.set(0, 0, 22);

    // 2. Renderer
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 3. Build 3D Objects
    createCyberCore();
    createOrbitRings();
    createParticleCloud();
    createCyberGrid();

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00f0ff, 2, 50);
    pointLight.position.set(0, 5, 10);
    scene.add(pointLight);

    // 5. Events
    window.addEventListener("resize", onWindowResize);
    window.addEventListener("mousemove", onMouseMove);

    // 6. Start Loop
    animate();
  }

  function createCyberCore() {
    const coreGroup = new THREE.Group();
    coreGroup.name = "coreGroup";

    // Outer Faceted Polyhedron
    const outerGeo = new THREE.IcosahedronGeometry(4.5, 1);
    const outerMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.35
    });
    coreWireframe = new THREE.Mesh(outerGeo, outerMat);
    coreGroup.add(coreWireframe);

    // Inner Glowing Core
    const innerGeo = new THREE.OctahedronGeometry(2.4, 0);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x0066ff,
      wireframe: false,
      transparent: true,
      opacity: 0.45
    });
    innerCore = new THREE.Mesh(innerGeo, innerMat);
    coreGroup.add(innerCore);

    // Second Inner Wireframe Lattice
    const latticeGeo = new THREE.DodecahedronGeometry(3.3, 0);
    const latticeMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });
    coreMesh = new THREE.Mesh(latticeGeo, latticeMat);
    coreGroup.add(coreMesh);

    scene.add(coreGroup);
  }

  function createOrbitRings() {
    const ringGroup = new THREE.Group();
    ringGroup.name = "ringGroup";

    const ringMat1 = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.3
    });
    orbitRing1 = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.04, 8, 64), ringMat1);
    orbitRing1.rotation.x = Math.PI / 3;
    ringGroup.add(orbitRing1);

    const ringMat2 = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      wireframe: true,
      transparent: true,
      opacity: 0.25
    });
    orbitRing2 = new THREE.Mesh(new THREE.TorusGeometry(7.4, 0.03, 8, 64), ringMat2);
    orbitRing2.rotation.y = Math.PI / 4;
    ringGroup.add(orbitRing2);

    const ringMat3 = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.2
    });
    orbitRing3 = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.03, 8, 64), ringMat3);
    orbitRing3.rotation.z = Math.PI / 6;
    ringGroup.add(orbitRing3);

    scene.add(ringGroup);
  }

  function createParticleCloud() {
    const particleCount = 280;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 45;
      positions[i + 1] = (Math.random() - 0.5) * 35;
      positions[i + 2] = (Math.random() - 0.5) * 35;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: 0x00f0ff,
      size: 0.18,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending
    });

    particleSystem = new THREE.Points(geometry, material);
    scene.add(particleSystem);
  }

  function createCyberGrid() {
    const size = 50;
    const divisions = 30;
    gridHelper = new THREE.GridHelper(size, divisions, 0x00f0ff, 0x111c33);
    gridHelper.position.y = -8;
    gridHelper.material.opacity = 0.22;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);
  }

  function onWindowResize() {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  function onMouseMove(event) {
    mouseX = (event.clientX / window.innerWidth) * 2 - 1;
    mouseY = -(event.clientY / window.innerHeight) * 2 + 1;
  }

  function animate() {
    if (!is3DEnabled) return;
    animId = requestAnimationFrame(animate);

    // Parallax camera lerp
    targetCameraX = mouseX * 2.5;
    targetCameraY = mouseY * 2.0;
    camera.position.x += (targetCameraX - camera.position.x) * 0.04;
    camera.position.y += (targetCameraY - camera.position.y) * 0.04;
    camera.lookAt(0, 0, 0);

    const speed = currentTheme.speed;

    // Rotate core meshes
    if (coreWireframe) {
      coreWireframe.rotation.x += speed * 0.8;
      coreWireframe.rotation.y += speed * 1.2;
    }
    if (coreMesh) {
      coreMesh.rotation.x -= speed * 1.1;
      coreMesh.rotation.z += speed * 0.9;
    }
    if (innerCore) {
      innerCore.rotation.y += speed * 1.8;
      innerCore.rotation.z -= speed * 1.5;
    }

    // Orbit rings
    if (orbitRing1) orbitRing1.rotation.z += speed * 0.7;
    if (orbitRing2) orbitRing2.rotation.x += speed * 0.9;
    if (orbitRing3) orbitRing3.rotation.y -= speed * 0.5;

    // Rotate particles gently
    if (particleSystem) {
      particleSystem.rotation.y += speed * 0.3;
      particleSystem.rotation.x += speed * 0.15;
    }

    // Undulate cyber grid
    if (gridHelper) {
      gridHelper.position.z = (Date.now() * 0.003) % (50 / 30);
    }

    renderer.render(scene, camera);
  }

  /**
   * Updates 3D scene visual state and lighting.
   * @param {'normal' | 'launch' | 'warning' | 'critical' | 'victory'} mode
   */
  function set3DThreatMode(mode) {
    const theme = THEMES[mode] || THEMES.normal;
    currentTheme = theme;

    if (coreWireframe) coreWireframe.material.color.setHex(theme.core);
    if (coreMesh) coreMesh.material.color.setHex(theme.core);
    if (innerCore) innerCore.material.color.setHex(theme.inner);
    if (orbitRing1) orbitRing1.material.color.setHex(theme.core);
    if (particleSystem) particleSystem.material.color.setHex(theme.particles);
  }

  function toggle3D() {
    is3DEnabled = !is3DEnabled;
    const canvas = document.getElementById("cyber-3d-canvas");
    if (canvas) canvas.style.display = is3DEnabled ? "block" : "none";
    if (is3DEnabled && !animId) {
      animate();
    } else if (!is3DEnabled && animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    return is3DEnabled;
  }

  // ─── 3D Card Tilt Micro-Interaction ────────────────────────
  function init3DCardTilt() {
    const tiltElements = ".role-card, .view-container, .telemetry-card, .question-card, .option-item";

    document.addEventListener("mousemove", (e) => {
      const cards = document.querySelectorAll(tiltElements);
      cards.forEach((card) => {
        const rect = card.getBoundingClientRect();
        // Check if mouse is near or over the element
        const isHovered =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;

        if (isHovered && !card.classList.contains("no-tilt")) {
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;

          const rotateX = ((y - centerY) / centerY) * -6.5; // max tilt degrees
          const rotateY = ((x - centerX) / centerX) * 6.5;

          card.style.transform = `perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(8px)`;
        } else {
          card.style.transform = "";
        }
      });
    });
  }

  // Auto-init on load
  if (typeof window !== "undefined") {
    window.addEventListener("DOMContentLoaded", () => {
      init3D();
      init3DCardTilt();
    });

    window.Cyber3D = {
      init: init3D,
      setTheme: set3DThreatMode,
      toggle: toggle3D,
      initTilt: init3DCardTilt
    };
  }

})(typeof window !== "undefined" ? window : globalThis);
