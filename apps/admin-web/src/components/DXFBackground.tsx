import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";

export default function DXFBackground() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const w = mount.clientWidth;
    const h = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x080808);
    scene.fog = new THREE.Fog(0x080808, 20, 50);

    const camera = new THREE.PerspectiveCamera(40, w / h, 0.1, 100);
    camera.position.set(18, 12, 22);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.8;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.6;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 3;
    controls.target.set(0, -0.5, 0);
    controls.update();

    const ambient = new THREE.AmbientLight(0x222244, 0.5);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0x6688cc, 2.0);
    dirLight.position.set(15, 25, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xcc8844, 0.5);
    fillLight.position.set(-10, 8, -15);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0x4488ff, 1.0);
    rimLight.position.set(-12, 5, 14);
    scene.add(rimLight);

    const pulsePoint = new THREE.PointLight(0x4488ff, 0.4, 30);
    pulsePoint.position.set(0, 0, 0);
    scene.add(pulsePoint);

    const grid = new THREE.GridHelper(26, 28, 0x1a3a5a, 0x0f1f3f);
    grid.position.y = -1.6;
    scene.add(grid);

    const terrS = 16;
    const terrDiv = 60;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array((terrDiv + 1) * (terrDiv + 1) * 3);
    const idx: number[] = [];
    let pi = 0;
    for (let r = 0; r <= terrDiv; r++) {
      for (let c = 0; c <= terrDiv; c++) {
        const x = (c / terrDiv - 0.5) * terrS;
        const z = (r / terrDiv - 0.5) * terrS;
        let y = 0;
        y += Math.sin(x * 0.5) * Math.cos(z * 0.4) * 0.6;
        y += Math.sin(x * 1.2 + z * 0.9) * 0.3;
        y += Math.cos(x * 0.7 - z * 0.5) * 0.4;
        const d = Math.sqrt(x * x + z * z);
        y += Math.sin(d * 0.8) * 0.2;
        y += Math.exp(-d * 0.15) * 0.8;
        y *= 1.2;
        pos[pi] = x;
        pos[pi + 1] = y;
        pos[pi + 2] = z;
        pi += 3;
      }
    }
    for (let r = 0; r < terrDiv; r++) {
      for (let c = 0; c < terrDiv; c++) {
        const a = r * (terrDiv + 1) + c;
        const b = r * (terrDiv + 1) + c + 1;
        const cc = (r + 1) * (terrDiv + 1) + c;
        const d = (r + 1) * (terrDiv + 1) + c + 1;
        idx.push(a, b, cc, b, d, cc);
      }
    }
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();

    const terrain = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({
      color: 0x1a2a4a,
      metalness: 0.1,
      roughness: 0.8,
      flatShading: false,
      transparent: true,
      opacity: 0.55,
      emissive: 0x0a0a1a,
      emissiveIntensity: 0.3,
    }));
    terrain.receiveShadow = true;
    terrain.position.y = -1.5;
    scene.add(terrain);

    const wireT = new THREE.LineSegments(
      new THREE.WireframeGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x2a4a6a, transparent: true, opacity: 0.12 })
    );
    wireT.position.y = -1.5;
    scene.add(wireT);

    const bldgData: { x: number; z: number; w: number; d: number; h: number }[] = [];
    for (let i = 0; i < 45; i++) {
      const angle = Math.random() * Math.PI * 2;
      const rad = 2 + Math.random() * 6;
      const x = Math.cos(angle) * rad;
      const z = Math.sin(angle) * rad;
      bldgData.push({ x, z, w: 0.15 + Math.random() * 0.35, d: 0.15 + Math.random() * 0.35, h: 0.2 + Math.random() * 1.2 });
    }
    bldgData.forEach(b => {
      const bg = new THREE.BoxGeometry(b.w, b.h, b.d);
      const bm = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color().setHSL(0.55 + Math.random() * 0.1, 0.2, 0.15 + Math.random() * 0.15),
        metalness: 0.4,
        roughness: 0.5,
      });
      const mesh = new THREE.Mesh(bg, bm);
      mesh.position.set(b.x, -1.5 + b.h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    });

    function addRoad(path: [number, number, number, number][]) {
      const pts = path.map(([x, , z, h]) => new THREE.Vector3(x, h, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.06, 4, false);
      const tube = new THREE.Mesh(tubeGeo, new THREE.MeshPhysicalMaterial({
        color: 0x2a3a5a, metalness: 0.5, roughness: 0.3,
        emissive: 0x0f1f3f, emissiveIntensity: 0.2,
        transparent: true, opacity: 0.4,
      }));
      tube.position.y = -1.5;
      scene.add(tube);
    }
    addRoad([[-6, 0, -5, -1.5], [-3, 0, -3, -1.2], [0, 0, 0, -1.0], [3, 0, 3, -1.2], [6, 0, 5, -1.5]]);
    addRoad([[5, 0, -5, -1.5], [3, 0, -3, -1.2], [0, 0, 0, -1.0], [-3, 0, 3, -1.2], [-5, 0, 5, -1.5]]);
    addRoad([[-6, 0, 6, -1.5], [-4, 0, 3, -1.2], [-2, 0, 1, -1.0], [2, 0, -1, -1.2], [4, 0, -3, -1.3], [6, 0, -5, -1.5]]);

    function addRiver(path: [number, number, number, number][]) {
      const pts = path.map(([x, , z, h]) => new THREE.Vector3(x, 0.05, z));
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 42, 0.1, 6, false);
      const mesh = new THREE.Mesh(tube, new THREE.MeshPhysicalMaterial({
        color: 0x1a3a5a, emissive: 0x1a3a5a, emissiveIntensity: 0.2,
        transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0.7,
      }));
      mesh.position.y = -1.5;
      scene.add(mesh);
    }
    addRiver([[-7, 0, 8, -0.5], [-4, 0, 5, -0.3], [-2, 0, 2, -0.2], [0, 0, 0, -0.2], [2, 0, -2, -0.3], [5, 0, -5, -0.5]]);
    addRiver([[4, 0, 7, -0.5], [3, 0, 4, -0.3], [1, 0, 1, -0.2], [-1, 0, -1, -0.3], [-3, 0, -4, -0.5]]);

    for (let r = 0; r < 20; r++) {
      const ang = r * 7.3;
      const rad = 2 + r * 0.35;
      const pts: THREE.Vector3[] = [];
      for (let a = 0; a <= 64; a++) {
        const theta = (a / 64) * Math.PI * 2;
        const x = Math.cos(theta) * rad;
        const z = Math.sin(theta) * rad;
        const d = Math.sqrt(x * x + z * z);
        const yOff = Math.sin(x * 0.5 + z * 0.3) * 0.3 + Math.cos(x * 0.7) * 0.2 + Math.sin(d * 0.6 + ang) * 0.1;
        pts.push(new THREE.Vector3(x, yOff * 0.2 + 0.02, z));
      }
      const curve = new THREE.CatmullRomCurve3(pts, true);
      const pts2 = curve.getPoints(54);
      const lgeo = new THREE.BufferGeometry().setFromPoints(pts2);
      const line = new THREE.Line(lgeo, new THREE.LineBasicMaterial({
        color: 0x3a5a7a, transparent: true, opacity: 0.15 + Math.random() * 0.1,
      }));
      line.position.y = -1.5;
      scene.add(line);
    }

    const pCount = 2500;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount * 3; i++) pPos[i] = (Math.random() - 0.5) * 70;
    pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x4488cc, size: 0.045, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    const dCount = 800;
    const dGeo = new THREE.BufferGeometry();
    const dPos = new Float32Array(dCount * 3);
    for (let i = 0; i < dCount * 3; i++) {
      dPos[i] = (Math.random() - 0.5) * 50;
    }
    dGeo.setAttribute("position", new THREE.BufferAttribute(dPos, 3));
    const dMat = new THREE.PointsMaterial({
      color: 0x88aadd, size: 0.08, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending,
    });
    const dots = new THREE.Points(dGeo, dMat);
    scene.add(dots);

    let time = 0;
    function animate() {
      requestAnimationFrame(animate);
      time += 0.005;
      terrain.rotation.y = time * 0.0008;
      wireT.rotation.y = time * 0.0008;
      pulsePoint.intensity = 0.3 + Math.sin(time * 2) * 0.15;
      controls.update();
      renderer.render(scene, camera);
    }
    animate();

    function resize() {
      const w2 = mount.clientWidth;
      const h2 = mount.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    }
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "auto" }}
    />
  );
}
