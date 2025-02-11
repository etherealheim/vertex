'use client'

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { TextLoop } from './TextLoop';

export default function Home() {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;

    // Scene
    const scene = new THREE.Scene();

    // Camera
    const camera = new THREE.PerspectiveCamera(75, 400 / 400, 0.1, 500);
    camera.position.z = 5;

    // Renderer with antialiasing enabled
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(400, 400);
    renderer.setClearColor(0x0a0a0a, 1);
    mount.appendChild(renderer.domElement);

    // Create a triangle geometry with wider spacing
    const geometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      0.0,  2.0, 0.0,  // Vertex 1 (top)
     -2.0, -2.0, 0.0,  // Vertex 2 (bottom left)
      2.0, -2.0, 0.0   // Vertex 3 (bottom right)
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    // Material with thicker lines
    const material = new THREE.LineBasicMaterial({ 
      color: 0xffffff,
    });

    // Create multiple overlapping lines for thicker appearance
    const createThickLine = (geometry) => {
      const group = new THREE.Group();
      // Create more overlapping lines for thicker appearance
      for(let i = 0; i < 24; i++) { // Increased from 12 to 24 overlapping lines
        const line = new THREE.LineSegments(geometry, material);
        // Create a spread pattern in both x and y directions
        line.position.x = (i % 4 - 1.5) * 0.003; // Increased spread and grid size
        line.position.y = (Math.floor(i / 4) - 1.5) * 0.003;
        line.position.z = i * 0.001;
        group.add(line);
      }
      return group;
    };

    // Create the triangle edges
    const edges = new THREE.EdgesGeometry(geometry);
    const triangle = createThickLine(edges);
    scene.add(triangle);

    // Create vertex points
    const spheres = [];
    const originalPositions = [
      [0.0, 2.0, 0.0],   // Top vertex
      [-2.0, -2.0, 0.0], // Bottom left
      [2.0, -2.0, 0.0]   // Bottom right
    ];

    originalPositions.forEach(pos => {
      const point = new THREE.Object3D();
      point.position.set(pos[0], pos[1], pos[2]);
      point.velocity = new THREE.Vector3(0, 0, 0);
      point.targetPosition = new THREE.Vector3();
      point.isAnimating = false;
      point.originalPosition = new THREE.Vector3(pos[0], pos[1], pos[2]);
      scene.add(point);
      spheres.push(point);
    });

    // Create center point
    const centerPoint = new THREE.Object3D();
    centerPoint.position.set(-0.5, -1, 0); // Lower center point and move left
    scene.add(centerPoint);

    // Spring animation parameters
    let animationStartTime = 0;
    let startPosition = new THREE.Vector3();
    let targetPosition = new THREE.Vector3();
    const animationDuration = 2000; // 2 seconds
    const springStrength = 0.1;
    const damping = 0.3;
    let animationCounter = 0;
    let isAnimating = true;

    // Create lines from vertices to center
    const lines = [];
    const lineGeometries = []; // Store geometries for disposal
    
    const updateLines = () => {
      // Remove old lines and dispose geometries
      lines.forEach((line, i) => {
        scene.remove(line);
        if (lineGeometries[i]) lineGeometries[i].dispose();
      });
      lines.length = 0;
      lineGeometries.length = 0;

      // Calculate new center
      const center = new THREE.Vector3();
      spheres.forEach(sphere => center.add(sphere.position));
      center.divideScalar(3);
      center.y -= 1; // Adjust center point to be lower
      center.x -= 0.5; // Move center point left
      
      if (!centerPoint.isAnimating) {
        centerPoint.position.copy(center);
      }

      // Create new lines
      spheres.forEach(sphere => {
        const lineGeometry = new THREE.BufferGeometry();
        const lineVertices = new Float32Array([
          sphere.position.x, sphere.position.y, sphere.position.z,
          centerPoint.position.x, centerPoint.position.y, centerPoint.position.z
        ]);
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(lineVertices, 3));
        const line = createThickLine(lineGeometry);
        scene.add(line);
        lines.push(line);
        lineGeometries.push(lineGeometry);
      });

      // Update triangle edges
      const triangleVertices = new Float32Array([
        spheres[0].position.x, spheres[0].position.y, spheres[0].position.z,
        spheres[1].position.x, spheres[1].position.y, spheres[1].position.z,
        spheres[2].position.x, spheres[2].position.y, spheres[2].position.z,
      ]);
      geometry.setAttribute('position', new THREE.BufferAttribute(triangleVertices, 3));
      geometry.attributes.position.needsUpdate = true;
      
      const newEdges = new THREE.EdgesGeometry(geometry);
      triangle.children.forEach(line => line.geometry.dispose());
      triangle.children.forEach(line => line.geometry = newEdges);
    };

    // Initialize lines
    updateLines();

    // Function to start random animation with minimum distance constraint
    const startRandomAnimation = () => {
      if (!isAnimating) return;
      
      centerPoint.isAnimating = true;
      animationStartTime = Date.now();
      startPosition.copy(centerPoint.position);
      
      animationCounter++;
      if (animationCounter > 1000) { // Limit animation cycles
        isAnimating = false;
        return;
      }
      
      const returnToOrigin = animationCounter % 3 === 0;
      
      if (returnToOrigin) {
        spheres.forEach((sphere) => {
          sphere.isAnimating = true;
          sphere.targetPosition.copy(sphere.originalPosition);
        });
        targetPosition.set(-0.5, -1, 0); // Return to left-offset position
      } else {
        const minDistance = 4.0;
        const maxAttempts = 100; // Prevent infinite loops
        
        spheres.forEach((sphere, index) => {
          sphere.isAnimating = true;
          let validPosition = false;
          let attempts = 0;
          
          while (!validPosition && attempts < maxAttempts) {
            attempts++;
            const angle = Math.random() * Math.PI * 2;
            const radius = 2 + Math.random();
            const newPos = new THREE.Vector3(
              Math.cos(angle) * radius,
              Math.sin(angle) * radius,
              0
            );
            
            validPosition = true;
            for (let i = 0; i < index; i++) {
              if (newPos.distanceTo(spheres[i].targetPosition) < minDistance) {
                validPosition = false;
                break;
              }
            }
            
            if (validPosition || attempts === maxAttempts) {
              sphere.targetPosition.copy(newPos);
            }
          }
        });
        
        const angle = Math.random() * Math.PI * 2;
        const radius = 2 + Math.random();
        targetPosition.set(
          Math.cos(angle) * radius - 0.5, // Offset x position
          Math.sin(angle) * radius - 1,
          0
        );
      }
    };

    // Start initial animation
    startRandomAnimation();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = 500 / 500;
      camera.updateProjectionMatrix();
      renderer.setSize(500, 500);
      renderer.setPixelRatio(window.devicePixelRatio);
    };
    window.addEventListener('resize', handleResize);

    // Handle mouse hover
    const handleMouseEnter = () => {
      isAnimating = false;
      
      // Return all points to original positions
      spheres.forEach((sphere) => {
        sphere.isAnimating = true;
        sphere.targetPosition.copy(sphere.originalPosition);
        sphere.velocity.set(0, 0, 0);
      });
      
      centerPoint.isAnimating = true;
      targetPosition.set(-0.5, -1, 0);
      velocity.set(0, 0, 0);
    };

    const handleMouseLeave = () => {
      isAnimating = true;
      animationCounter = 0;
      startRandomAnimation();
    };

    mount.addEventListener('mouseenter', handleMouseEnter);
    mount.addEventListener('mouseleave', handleMouseLeave);

    // Animation loop
    let velocity = new THREE.Vector3(0, 0, 0);
    let animationFrameId;
    
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (centerPoint.isAnimating) {
        const elapsed = Date.now() - animationStartTime;
        const progress = Math.min(elapsed / animationDuration, 1);

        // Spring physics for center point
        const direction = targetPosition.clone().sub(centerPoint.position);
        const springForce = direction.multiplyScalar(springStrength);
        velocity.add(springForce);
        velocity.multiplyScalar(damping);
        centerPoint.position.add(velocity);

        // Spring physics for vertex points
        spheres.forEach(sphere => {
          if (sphere.isAnimating) {
            const direction = sphere.targetPosition.clone().sub(sphere.position);
            const springForce = direction.multiplyScalar(springStrength);
            sphere.velocity = sphere.velocity || new THREE.Vector3(0, 0, 0);
            sphere.velocity.add(springForce);
            sphere.velocity.multiplyScalar(damping);
            sphere.position.add(sphere.velocity);
          }
        });

        updateLines();

        if (progress > 0.95 && isAnimating) {
          startRandomAnimation();
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      isAnimating = false;
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('mouseenter', handleMouseEnter);
      mount.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
      mount.removeChild(renderer.domElement);
      geometry.dispose();
      material.dispose();
      lines.forEach(line => {
        line.children.forEach(child => child.geometry.dispose());
      });
      lineGeometries.forEach(geo => geo.dispose());
      triangle.children.forEach(child => child.geometry.dispose());
    };
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen w-full">
      <div ref={mountRef} className="w-[400px] h-[400px]"></div>
      <div className="mt-4 relative">
        <p className='inline-flex whitespace-pre-wrap text-sm'>
          Actorize{''}
          <span className="inline-block relative" style={{width: '100px'}}> {/* Fixed width container */}
            <TextLoop
              className='absolute left-0 top-0 overflow-hidden'
              transition={{
                type: 'spring',
                stiffness: 900,
                damping: 80,
                mass: 10,
              }}
              variants={{
                initial: {
                  y: 20,
                  rotateX: 90,
                  opacity: 0,
                  filter: 'blur(4px)',
                },
                animate: {
                  y: 0,
                  rotateX: 0,
                  opacity: 1,
                  filter: 'blur(0px)',
                },
                exit: {
                  y: -20,
                  rotateX: -90,
                  opacity: 0,
                  filter: 'blur(4px)',
                },
              }}
            >
              <span className="block">Instagram</span>
              <span className="block">TikTok</span>
              <span className="block">Facebook</span>
              <span className="block">Google Maps</span>
            </TextLoop>
          </span>
          
        </p>
      </div>
    </div>
  )
}
