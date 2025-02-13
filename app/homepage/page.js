'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Directions indexed for convenience: 0=right, 1=up, 2=left, 3=down
const DIRECTIONS = [
  new THREE.Vector2(1, 0),   // right
  new THREE.Vector2(0, 1),   // up
  new THREE.Vector2(-1, 0),  // left
  new THREE.Vector2(0, -1),  // down
];

export default function HomePage() {
  const mountRef = useRef(null);

  useEffect(() => {
    // Basic scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 20;
    const camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(0, 20, 0);
    camera.lookAt(new THREE.Vector3(0, 0, 0));

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    mountRef.current.appendChild(renderer.domElement);

    // Grid
    const size = 20;
    const divisions = 20;
    const gridHelper = new THREE.GridHelper(size, divisions, 0xffffff, 0xffffff);
    scene.add(gridHelper);

    // Dots
    const dotGeometry = new THREE.SphereGeometry(0.3, 16, 16);
    const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 });
    const dots = [];

    for (let i = 0; i < 10; i++) { // Add 5 dots
      const dot = new THREE.Mesh(dotGeometry, dotMaterial);
      // Random starting position on integer grid lines
      dot.position.set(
        Math.floor(Math.random() * 21 - 10),
        0,
        Math.floor(Math.random() * 21 - 10)
      );
      scene.add(dot);
      dots.push(dot);
    }

    // Movement parameters
    const currentDirections = dots.map(() => Math.floor(Math.random() * 4)); // pick initial direction 0..3 for each dot
    const UNITS_PER_SECOND = 5; // speed in grid units per second

    // Positions and targets
    const startPositions = dots.map(dot => new THREE.Vector3().copy(dot.position));
    const currentTargets = dots.map(() => new THREE.Vector3());
    const progresses = dots.map(() => 0); // 0..1 interpolation from start -> target

    // Opacity/fade parameters
    let fadeStartTime = performance.now();
    let fadeEndTime   = fadeStartTime + (Math.random() * 5000 + 5000);
    let isFadingOut   = true;
    let isTransitioning = false;
    const fadeDuration = 1000; // ms
    const easeInOutSine = (x) => -(Math.cos(Math.PI * x) - 1) / 2;

    // Helper: clamp between [-10, 10]
    function clampGrid(val) {
      return Math.min(Math.max(val, -10), 10);
    }

    // Picks a new direction that is never the opposite of currentDirection.
    function pickNewDirection(currentDirection) {
      const oppositeDir = (currentDirection + 2) % 4;
      // Exclude the opposite direction from the pool
      const possibleDirs = [0, 1, 2, 3].filter(dir => dir !== oppositeDir);
      // Random choice from the remaining three
      return possibleDirs[Math.floor(Math.random() * possibleDirs.length)];
    }

    // Attempt to get a new target. Re-pick direction if the movement collapses to zero (e.g. out of bounds).
    function getNewTarget(dot, currentDirection) {
      // Keep trying a new direction until we get some valid movement
      let tries = 0;
      while (true) {
        currentDirection = pickNewDirection(currentDirection);
        const [dx, dz] = [DIRECTIONS[currentDirection].x, DIRECTIONS[currentDirection].y];
        const distance = Math.floor(Math.random() * 5) + 1;

        const newX = clampGrid(dot.position.x + dx * distance);
        const newZ = clampGrid(dot.position.z + dz * distance);

        // If the new position is different than the old, we accept it
        if (newX !== dot.position.x || newZ !== dot.position.z) {
          return { target: new THREE.Vector3(newX, 0, newZ), direction: currentDirection };
        }

        // Safety check if we somehow get stuck
        tries++;
        if (tries > 10) {
          // If we can't find anything after many tries, just return the same place
          return { target: new THREE.Vector3(dot.position.x, 0, dot.position.z), direction: currentDirection };
        }
      }
    }

    // Initialize first targets
    dots.forEach((dot, i) => {
      const { target, direction } = getNewTarget(dot, currentDirections[i]);
      currentTargets[i] = target;
      currentDirections[i] = direction;
    });

    // Timing
    let lastTime = performance.now();

    // Main animation loop
    function animate(now) {
      requestAnimationFrame(animate);

      const deltaTime = (now - lastTime) / 1000;
      lastTime = now;

      // Handle fade logic
      const fadeElapsed = now - fadeStartTime;
      if (now >= fadeEndTime && !isTransitioning) {
        fadeStartTime = now;
        fadeEndTime = fadeStartTime + (Math.random() * 5000 + 5000);
        isFadingOut = !isFadingOut;
        isTransitioning = true;
      }

      if (fadeElapsed < fadeDuration && isTransitioning) {
        const fadeProgress = fadeElapsed / fadeDuration;
        const eased = easeInOutSine(fadeProgress);
        dotMaterial.opacity = isFadingOut ? 1 - eased : eased;

        if (fadeProgress >= 1) {
          isTransitioning = false;
        }
      } else if (!isTransitioning) {
        dotMaterial.opacity = isFadingOut ? 0 : 1;
      }

      // Movement
      dots.forEach((dot, i) => {
        const distanceVector = new THREE.Vector3().subVectors(currentTargets[i], startPositions[i]);
        const distanceToTarget = distanceVector.length();

        // If distanceToTarget is 0, pick a new target
        if (distanceToTarget < 0.0001) {
          progresses[i] = 0;
          startPositions[i].copy(dot.position);
          const { target, direction } = getNewTarget(dot, currentDirections[i]);
          currentTargets[i] = target;
          currentDirections[i] = direction;
        } else {
          const progressIncrement = (UNITS_PER_SECOND * deltaTime) / distanceToTarget;
          progresses[i] += progressIncrement;

          if (progresses[i] >= 1) {
            progresses[i] = 0;
            dot.position.copy(currentTargets[i]);
            startPositions[i].copy(dot.position);
            const { target, direction } = getNewTarget(dot, currentDirections[i]);
            currentTargets[i] = target;
            currentDirections[i] = direction;
          } else {
            // Lerp position
            dot.position.x = startPositions[i].x + (currentTargets[i].x - startPositions[i].x) * progresses[i];
            dot.position.z = startPositions[i].z + (currentTargets[i].z - startPositions[i].z) * progresses[i];
          }
        }
      });

      renderer.render(scene, camera);
    }
    requestAnimationFrame(animate);

    // Handle window resize
    function handleResize() {
      const newAspect = window.innerWidth / window.innerHeight;
      camera.left = -d * newAspect;
      camera.right = d * newAspect;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      if (renderer) {
        renderer.dispose();
        mountRef.current.removeChild(renderer.domElement);
      }
      dotGeometry.dispose();
      dotMaterial.dispose();
    };
  }, []);

  return <div ref={mountRef} />;
}