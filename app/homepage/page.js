'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { BufferGeometryUtils } from 'three/examples/jsm/utils/BufferGeometryUtils.js'; // if needed

// Directions: 0 = right, 1 = up, 2 = left, 3 = down.
const DIRECTIONS = [
  new THREE.Vector2(1, 0),    // right
  new THREE.Vector2(0, 1),    // up
  new THREE.Vector2(-1, 0),   // left
  new THREE.Vector2(0, -1),   // down
];

export default function HomePage() {
  const mountRef = useRef(null);

  useEffect(() => {
    // === Scene Setup ===
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xffffff); // White background

    // Camera setup using an OrthographicCamera.
    const aspect = window.innerWidth / window.innerHeight;
    const d = 20;
    const camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 1, 1000
    );
    camera.position.set(0, 20, 40);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    scene.rotation.order = 'YXZ';
    scene.rotation.y = Math.PI / 4;
    scene.rotation.x = 0;

    // Renderer with full device pixel ratio for sharpness.
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Grid helper (light grey)
    const gridHelper = new THREE.GridHelper(20, 20, 0xcccccc, 0xcccccc);
    scene.add(gridHelper);

    // === Movement & Trail Parameters ===
    const UNITS_PER_SECOND = 5;   // speed (grid units per second)
    const TRAIL_LENGTH = 7;       // fixed trail length

    // Arrays for per-particle data.
    const startPositions = [];    // starting point of current segment
    const currentTargets = [];    // target of current segment
    const progresses = [];        // progress (0-1) along segment
    let currentDirections = [];   // current direction indices
    const trails = [];            // each particle's trail as an array of THREE.Vector3

    const numParticles = 20;
    const lines = [];             // THREE.Line objects
    const geometries = [];        // BufferGeometry objects for trails

    // === Material Setup ===
    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 1,
      linewidth: 2,
    });
    // Force lines to render on top.
    lineMaterial.depthTest = false;
    lineMaterial.polygonOffset = true;
    lineMaterial.polygonOffsetFactor = -1;
    lineMaterial.polygonOffsetUnits = -1;

    // === Helper Functions ===
    const clampGrid = (val) => Math.min(Math.max(val, -10), 10);

    const pickNewDirection = (currentDirection) => {
      const opposite = (currentDirection + 2) % 4;
      const possible = [0, 1, 2, 3].filter((dir) => dir !== opposite);
      return possible[Math.floor(Math.random() * possible.length)];
    };

    function getNewTarget(dot, currentDirection) {
      let tries = 0;
      while (true) {
        currentDirection = pickNewDirection(currentDirection);
        const dx = DIRECTIONS[currentDirection].x;
        const dz = DIRECTIONS[currentDirection].y; // use y as Z axis
        const distance = Math.floor(Math.random() * 5) + 1;
        const newX = clampGrid(dot.position.x + dx * distance);
        const newZ = clampGrid(dot.position.z + dz * distance);
        if (newX !== dot.position.x || newZ !== dot.position.z) {
          return { target: new THREE.Vector3(newX, 0, newZ), direction: currentDirection };
        }
        if (++tries > 10) {
          return { target: new THREE.Vector3(dot.position.x, 0, dot.position.z), direction: currentDirection };
        }
      }
    }

    // === Gradient Color Function ===
    // Returns a Float32Array of length (numPoints * 3) where the gradient goes from grid grey to blue to grid grey.
    const gridGrey = new THREE.Color(0xcccccc);
    const blue = new THREE.Color(0x0066ff);
    function computeGradientColors(numPoints) {
      const colors = new Float32Array(numPoints * 3);
      for (let j = 0; j < numPoints; j++) {
        const t = numPoints > 1 ? j / (numPoints - 1) : 0;
        const col = new THREE.Color();
        if (t <= 0.5) {
          col.copy(gridGrey).lerp(blue, t * 2);
        } else {
          col.copy(blue).lerp(gridGrey, (t - 0.5) * 2);
        }
        colors[j * 3] = col.r;
        colors[j * 3 + 1] = col.g;
        colors[j * 3 + 2] = col.b;
      }
      return colors;
    }

    // === Trail Management Functions ===
    function computeTrailLength(trail) {
      let length = 0;
      for (let i = 0; i < trail.length - 1; i++) {
        length += trail[i].distanceTo(trail[i + 1]);
      }
      return length;
    }

    function trimTrail(trail) {
      let total = computeTrailLength(trail);
      while (total > TRAIL_LENGTH && trail.length > 1) {
        const seg = trail[0].distanceTo(trail[1]);
        if (total - seg >= TRAIL_LENGTH) {
          trail.shift();
          total -= seg;
        } else {
          const excess = total - TRAIL_LENGTH;
          const t = excess / seg;
          trail[0].lerp(trail[1], t);
          break;
        }
      }
    }

    // === Create Particles and Their Trails ===
    for (let i = 0; i < numParticles; i++) {
      const startX = Math.floor(Math.random() * 21 - 10);
      const startZ = Math.floor(Math.random() * 21 - 10);
      const startPos = new THREE.Vector3(startX, 0, startZ);
      startPositions.push(startPos.clone());

      const initialDir = Math.floor(Math.random() * 4);
      currentDirections.push(initialDir);
      const { target, direction } = getNewTarget({ position: startPos }, initialDir);
      currentTargets.push(target);
      currentDirections[i] = direction;
      progresses.push(0);

      trails.push([startPos.clone()]);

      // Create a BufferGeometry with an initial 1-point array.
      const geometry = new THREE.BufferGeometry();
      const posArray = new Float32Array([startPos.x, startPos.y, startPos.z]);
      geometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(computeGradientColors(1), 3));

      const line = new THREE.Line(geometry, lineMaterial);
      scene.add(line);
      lines.push(line);
      geometries.push(geometry);
    }

    let lastTime = performance.now();

    // === Main Animation Loop ===
    function animate(now) {
      requestAnimationFrame(animate);
      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      for (let i = 0; i < numParticles; i++) {
        const startPos = startPositions[i];
        const targetPos = currentTargets[i];
        const totalDistance = startPos.distanceTo(targetPos);
        let p = progresses[i] + (UNITS_PER_SECOND * deltaTime) / totalDistance;
        if (p >= 1) p = 1;
        progresses[i] = p;

        const head = new THREE.Vector3().lerpVectors(startPos, targetPos, p);
        trails[i].push(head.clone());
        trimTrail(trails[i]);

        const numPoints = trails[i].length;
        // Reuse a temporary array for positions.
        const posArray = new Float32Array(numPoints * 3);
        for (let j = 0; j < numPoints; j++) {
          const point = trails[i][j];
          posArray[j * 3] = point.x;
          posArray[j * 3 + 1] = point.y;
          posArray[j * 3 + 2] = point.z;
        }
        const geom = geometries[i];
        // Instead of recreating the attribute each time, update its array.
        geom.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
        geom.setAttribute('color', new THREE.BufferAttribute(computeGradientColors(numPoints), 3));
        geom.computeBoundingSphere();
        geom.needsUpdate = true;

        if (p >= 1) {
          progresses[i] = 0;
          startPositions[i] = targetPos.clone();
          const { target: newTarget, direction } = getNewTarget({ position: startPositions[i] }, currentDirections[i]);
          currentTargets[i] = newTarget;
          currentDirections[i] = direction;
        }
      }

      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);

    // === Resize Handler ===
    function handleResize() {
      const newAspect = window.innerWidth / window.innerHeight;
      camera.left = -d * newAspect;
      camera.right = d * newAspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(window.devicePixelRatio);
    }
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      mountRef.current.removeChild(renderer.domElement);
      lineMaterial.dispose();
    };
  }, []);

  return <div ref={mountRef} />;
}