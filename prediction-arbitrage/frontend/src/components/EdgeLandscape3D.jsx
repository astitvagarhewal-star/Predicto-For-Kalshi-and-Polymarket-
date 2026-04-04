import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { formatPercent } from "../utils/priceFormatter";

function edgeToColor(edge) {
  if (edge >= 30) {
    return new THREE.Color(0xf59e0b);
  }

  if (edge >= 10) {
    return new THREE.Color(0x10b981);
  }

  return new THREE.Color(0x3b82f6);
}

function EdgeLandscape3D({ opportunities, onSelectOpportunity }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const hoveredRef = useRef(null);
  const [hovered, setHovered] = useState(null);

  const topOpportunities = useMemo(() => opportunities.slice(0, 49), [opportunities]);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) {
      return undefined;
    }

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.Fog(0x0f172a, 40, 190);

    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        uTime: { value: 0 },
        uTop: { value: new THREE.Color(0x1e3a8a) },
        uBottom: { value: new THREE.Color(0x020617) },
        uBand: { value: new THREE.Color(0x22d3ee) },
      },
      vertexShader: `
        varying vec3 vWorld;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorld = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform float uTime;
        uniform vec3 uTop;
        uniform vec3 uBottom;
        uniform vec3 uBand;
        varying vec3 vWorld;

        void main() {
          float h = clamp((vWorld.y + 120.0) / 240.0, 0.0, 1.0);
          float wave = sin(vWorld.x * 0.03 + uTime * 0.35) * 0.25 + sin(vWorld.z * 0.02 - uTime * 0.28) * 0.25;
          float band = smoothstep(0.45, 0.7, h + wave * 0.15);
          vec3 base = mix(uBottom, uTop, h);
          vec3 color = mix(base, uBand, band * 0.35);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });

    const skyDome = new THREE.Mesh(new THREE.SphereGeometry(230, 42, 42), skyMaterial);
    scene.add(skyDome);

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 55, 75);

    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);

    const gridSize = 7;
    const terrainSize = 84;
    const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, gridSize - 1, gridSize - 1);
    const positions = geometry.attributes.position;
    const colors = [];
    const baseHeights = new Float32Array(positions.count);

    const markers = [];
    const beamMeshes = [];
    const auraRings = [];
    const cometBodies = [];
    const markerGeometry = new THREE.SphereGeometry(0.9, 12, 12);

    for (let index = 0; index < positions.count; index += 1) {
      const opportunity = topOpportunities[index];
      const edge = opportunity ? Number(opportunity.edge || 0) : 0;
      const heightScale = Math.min(35, edge * 0.85);

      positions.setZ(index, heightScale);
      baseHeights[index] = heightScale;
      const color = edgeToColor(edge);
      colors.push(color.r, color.g, color.b);

      if (opportunity) {
        const markerMaterial = new THREE.MeshStandardMaterial({ color });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        const localX = positions.getX(index);
        const localY = positions.getY(index);
        marker.position.set(
          localX,
          positions.getZ(index) + 1.2,
          -localY
        );
        marker.userData = {
          ...opportunity,
          edge,
          baseHeight: heightScale,
        };
        markers.push(marker);
      }
    }

    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    positions.needsUpdate = true;
    geometry.computeVertexNormals();

    const terrainMaterial = new THREE.MeshPhongMaterial({
      vertexColors: true,
      shininess: 50,
      specular: new THREE.Color(0x334155),
      emissive: new THREE.Color(0x0b1324),
      side: THREE.DoubleSide,
    });

    const terrain = new THREE.Mesh(geometry, terrainMaterial);
    terrain.rotation.x = -Math.PI / 2;
    scene.add(terrain);

    const wireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(geometry),
      new THREE.LineBasicMaterial({ color: 0x1d4f91, transparent: true, opacity: 0.25 })
    );
    wireframe.rotation.x = -Math.PI / 2;
    scene.add(wireframe);

    markers.forEach((marker) => {
      scene.add(marker);
    });

    markers
      .filter((marker) => Number(marker.userData.edge || 0) >= 18)
      .slice(0, 8)
      .forEach((marker) => {
        const beamGeometry = new THREE.CylinderGeometry(0.25, 0.65, 9, 10, 1, true);
        const beamMaterial = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.35,
          emissive: new THREE.Color(0xf59e0b),
          emissiveIntensity: 0.5,
          side: THREE.DoubleSide,
        });
        const beam = new THREE.Mesh(beamGeometry, beamMaterial);
        beam.position.set(marker.position.x, marker.position.y + 4.5, marker.position.z);
        beam.userData = { phase: marker.userData.edge / 10 };
        beamMeshes.push(beam);
        scene.add(beam);
      });

    markers
      .sort((a, b) => Number(b.userData.edge || 0) - Number(a.userData.edge || 0))
      .slice(0, 6)
      .forEach((marker, rank) => {
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: rank < 2 ? 0xf59e0b : rank < 4 ? 0x10b981 : 0x38bdf8,
          transparent: true,
          opacity: 0.35,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        });

        const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.1, 10, 42), ringMaterial);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(marker.position.x, marker.position.y + 0.7, marker.position.z);
        ring.userData = {
          phase: rank * 0.75,
          baseScale: 1 + rank * 0.14,
        };
        auraRings.push(ring);
        scene.add(ring);
      });

    const scanner = new THREE.Mesh(
      new THREE.TorusGeometry(6, 0.16, 10, 70),
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7 })
    );
    scanner.rotation.x = Math.PI / 2;
    scanner.position.set(0, 0.1, 0);
    scene.add(scanner);

    const starGeometry = new THREE.BufferGeometry();
    const starCount = 260;
    const starPositions = new Float32Array(starCount * 3);
    for (let star = 0; star < starCount; star += 1) {
      const index = star * 3;
      starPositions[index] = (Math.random() - 0.5) * 220;
      starPositions[index + 1] = 30 + Math.random() * 120;
      starPositions[index + 2] = (Math.random() - 0.5) * 220;
    }
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(
      starGeometry,
      new THREE.PointsMaterial({ color: 0x93c5fd, size: 0.75, sizeAttenuation: true, transparent: true, opacity: 0.9 })
    );
    scene.add(stars);

    const cometGroup = new THREE.Group();
    const cometHeadGeometry = new THREE.SphereGeometry(0.35, 10, 10);
    const cometTailGeometry = new THREE.ConeGeometry(0.28, 4.2, 10);

    for (let cometIndex = 0; cometIndex < 9; cometIndex += 1) {
      const phase = (Math.PI * 2 * cometIndex) / 9;
      const speed = 0.35 + cometIndex * 0.04;
      const radius = 92 + cometIndex * 4;

      const headMaterial = new THREE.MeshBasicMaterial({ color: cometIndex % 2 === 0 ? 0x67e8f9 : 0xf59e0b });
      const tailMaterial = new THREE.MeshBasicMaterial({
        color: cometIndex % 2 === 0 ? 0x22d3ee : 0xf59e0b,
        transparent: true,
        opacity: 0.55,
      });

      const head = new THREE.Mesh(cometHeadGeometry, headMaterial);
      const tail = new THREE.Mesh(cometTailGeometry, tailMaterial);

      cometBodies.push({ head, tail, phase, speed, radius, vertical: 26 + cometIndex * 2.4 });
      cometGroup.add(head);
      cometGroup.add(tail);
    }

    scene.add(cometGroup);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.9);
    directionalLight.position.set(45, 70, 45);
    scene.add(directionalLight);
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));

    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let animationId;

    const animate = () => {
      animationId = requestAnimationFrame(animate);
      const now = Date.now();
      const orbit = now / 5000;
      const elapsed = now / 1000;

      skyMaterial.uniforms.uTime.value = elapsed;

      for (let index = 0; index < positions.count; index += 1) {
        const opportunity = topOpportunities[index];
        const edge = Number(opportunity?.edge || 0);
        const ripple = Math.sin(now / 850 + index * 0.7) * 0.5;
        const pulse = edge > 20 ? Math.sin(now / 520 + index) * (edge / 85) : 0;
        positions.setZ(index, baseHeights[index] + ripple + pulse);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();

      markers.forEach((marker) => {
        const markerPulse = 1 + Math.sin(now / 450 + marker.userData.edge) * 0.08;
        marker.scale.setScalar(markerPulse);
      });

      beamMeshes.forEach((beam) => {
        const beamPulse = 0.55 + (Math.sin(now / 420 + beam.userData.phase) + 1) * 0.25;
        beam.material.opacity = Math.max(0.2, Math.min(0.75, beamPulse));
      });

      auraRings.forEach((ring) => {
        const ringWave = (Math.sin(elapsed * 2.6 + ring.userData.phase) + 1) * 0.5;
        const scale = ring.userData.baseScale + ringWave * 0.24;
        ring.scale.set(scale, scale, scale);
        ring.material.opacity = 0.16 + ringWave * 0.36;
      });

      cometBodies.forEach((comet) => {
        const angle = elapsed * comet.speed + comet.phase;
        const x = Math.cos(angle) * comet.radius;
        const z = Math.sin(angle) * comet.radius;
        const y = comet.vertical + Math.sin(angle * 1.7 + comet.phase) * 6;

        comet.head.position.set(x, y, z);

        const tangent = new THREE.Vector3(
          -Math.sin(angle),
          Math.cos(angle * 1.7 + comet.phase) * 0.2,
          Math.cos(angle)
        ).normalize();

        comet.tail.position.set(
          x - tangent.x * 1.9,
          y - tangent.y * 1.9,
          z - tangent.z * 1.9
        );
        comet.tail.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tangent);
      });

      const scanProgress = ((now / 1400) % 1) * 1.6 + 0.2;
      scanner.scale.setScalar(scanProgress);
      scanner.material.opacity = 1 - (scanProgress - 0.2) / 1.6;
      scanner.rotation.z = elapsed * 0.85;

      camera.position.x = Math.sin(orbit) * 72;
      camera.position.z = Math.cos(orbit) * 72;
      camera.position.y = 42 + Math.sin(orbit * 0.7) * 7;
      camera.lookAt(0, 9, 0);

      stars.rotation.y += 0.0006;
      stars.material.opacity = 0.58 + (Math.sin(elapsed * 0.6) + 1) * 0.2;
      renderer.render(scene, camera);
    };

    const handlePointerMove = (event) => {
      const bounds = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
      mouse.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(markers);

      if (intersects.length > 0) {
        renderer.domElement.style.cursor = "pointer";
        const data = intersects[0].object.userData;
        const nextHovered = {
          ...data,
          x: event.clientX - bounds.left,
          y: event.clientY - bounds.top,
        };
        hoveredRef.current = nextHovered;
        setHovered(nextHovered);
      } else {
        renderer.domElement.style.cursor = "default";
        hoveredRef.current = null;
        setHovered(null);
      }
    };

    const handleClick = () => {
      if (!hoveredRef.current) {
        return;
      }

      if (onSelectOpportunity) {
        onSelectOpportunity(hoveredRef.current);
      }
    };

    const handleResize = () => {
      const nextWidth = containerRef.current.clientWidth;
      const nextHeight = containerRef.current.clientHeight;
      camera.aspect = nextWidth / nextHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(nextWidth, nextHeight);
    };

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("click", handleClick);
    window.addEventListener("resize", handleResize);
    animate();

    return () => {
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("click", handleClick);
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationId);

      markers.forEach((marker) => {
        marker.material.dispose();
      });

      beamMeshes.forEach((beam) => {
        beam.geometry.dispose();
        beam.material.dispose();
      });

      auraRings.forEach((ring) => {
        ring.geometry.dispose();
        ring.material.dispose();
      });

      cometBodies.forEach((comet) => {
        comet.head.material.dispose();
        comet.tail.material.dispose();
      });

      geometry.dispose();
      terrainMaterial.dispose();
      wireframe.geometry.dispose();
      wireframe.material.dispose();
      markerGeometry.dispose();
      cometHeadGeometry.dispose();
      cometTailGeometry.dispose();
      scanner.geometry.dispose();
      scanner.material.dispose();
      starGeometry.dispose();
      stars.material.dispose();
      skyDome.geometry.dispose();
      skyMaterial.dispose();
      renderer.dispose();
    };
  }, [onSelectOpportunity, topOpportunities]);

  return (
    <section className="rounded-2xl border border-slate-700 bg-pa-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-pa-muted">3D Edge Landscape</p>
        <span className="rounded-full border border-pa-gold/50 bg-pa-gold/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-pa-gold">
          Hyper Mode
        </span>
      </div>
      <div ref={containerRef} className="relative h-72 overflow-hidden rounded-xl border border-slate-700">
        <canvas ref={canvasRef} className="h-full w-full" />

        {hovered ? (
          <div
            className="pointer-events-none absolute z-10 min-w-[180px] rounded-lg border border-slate-600 bg-[#0b1324]/95 px-3 py-2 text-xs"
            style={{ left: hovered.x + 10, top: hovered.y + 10 }}
          >
            <p className="line-clamp-2 font-semibold text-pa-text">{hovered.name}</p>
            <p className="text-pa-muted">Edge: {formatPercent(hovered.edge)}</p>
            <p className="text-pa-muted">Profit: {formatPercent(hovered.profitPotential)}</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default EdgeLandscape3D;
