import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface Garden {
  setProgress: (p: number, immediate?: boolean) => void;
  setMotion: (paused: boolean) => void;
  setTheme: (dark: boolean) => void;
  rotate: () => void;
  rotateBy: (radians: number) => void;
  plant: () => number;
  /** Plants a tree where a viewport point (relative to the container) meets a terrace. Returns the tree count, or -1 on a miss. */
  plantAt: (x: number, y: number) => number;
  /** Local hour, 5–23. Moves the sun; lanterns and fireflies come out after dusk. */
  setHour: (hour: number) => void;
  /** Glide the camera to a named spot, or back to the whole garden. Shift moves the garden on screen as a fraction of the view. */
  focus: (spot: string | null, shiftX?: number, shiftY?: number) => void;
  stats: () => { triangles: number; calls: number; ms: number };
  dispose: () => void;
}
const smooth = (a: number, b: number, v: number) =>
  T.MathUtils.smoothstep(v, a, b);
const lerp = T.MathUtils.lerp;
let seed = 73;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

export function createGarden(
  container: HTMLElement,
  hotspots: HTMLButtonElement[],
): Garden {
  seed = 73;
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.6));
  renderer.setClearColor(0xfafbf8, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement);
  const camera = new T.OrthographicCamera(-10, 10, 10, -10, 0.1, 100);
  const world = new T.Group();
  scene.add(world);
  const sky = new T.HemisphereLight(0xf7fbff, 0x839073, 2.5);
  scene.add(sky);
  const sun = new T.DirectionalLight(0xffefd4, 3.3);
  sun.position.set(-6, 15, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -12;
  sun.shadow.normalBias = 0.025;
  sun.shadow.bias = -0.00015;
  sun.shadow.radius = 4;
  sun.shadow.camera.far = 50;
  scene.add(sun);
  const fillLight = new T.DirectionalLight(0xd6e8ff, 0.7);
  fillLight.position.set(8, 6, -6);
  scene.add(fillLight);
  const shadowMaterial = new T.ShadowMaterial({ opacity: 0 });
  const ground = new T.Mesh(new T.PlaneGeometry(80, 80), shadowMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.27;
  ground.receiveShadow = true;
  scene.add(ground);

  const colors = {
    stone: 0xe6ddc7,
    light: 0xf1e9d7,
    trim: 0xc9baa0,
    wood: 0xa8794e,
    dark: 0x4c6861,
    soil: 0x6e7050,
    leaf: 0x819953,
    leafLight: 0xa6b970,
    leafDark: 0x4e7551,
    grass: 0xa2b782,
    flower: 0xe7b763,
    coral: 0xce8265,
    glass: 0xa7cac1,
  };
  type ColorName = keyof typeof colors;
  const batches = new Map<ColorName, T.BufferGeometry[]>();
  const edgeParts: T.BufferGeometry[] = [];
  const foliageKeys: ColorName[] = [
    "leaf",
    "leafLight",
    "leafDark",
    "grass",
    "flower",
    "coral",
  ];
  const temp = new T.Object3D();
  function add(
    geometry: T.BufferGeometry,
    x: number,
    y: number,
    z: number,
    color: ColorName,
    rot: [number, number, number] = [0, 0, 0],
    outline = true,
  ) {
    temp.position.set(x, y, z);
    temp.rotation.set(...rot);
    temp.scale.set(1, 1, 1);
    temp.updateMatrix();
    geometry.applyMatrix4(temp.matrix);
    if (outline) edgeParts.push(new T.EdgesGeometry(geometry, 26));
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    if (g !== geometry) geometry.dispose();
    if (!batches.has(color)) batches.set(color, []);
    batches.get(color)!.push(g);
  }
  function box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: ColorName = "stone",
    outline = true,
  ) {
    add(new T.BoxGeometry(w, h, d), x, y, z, c, [0, 0, 0], outline);
  }
  function cylinder(
    x: number,
    y: number,
    z: number,
    r: number,
    h: number,
    c: ColorName = "stone",
    rTop = r,
    outline = true,
  ) {
    add(new T.CylinderGeometry(rTop, r, h, 12), x, y, z, c, [0, 0, 0], outline);
  }
  function beam(
    a: T.Vector3,
    b: T.Vector3,
    r: number,
    c: ColorName = "wood",
    outline = true,
  ) {
    const d = b.clone().sub(a);
    const g = new T.CylinderGeometry(r * 0.68, r, d.length(), 7);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      ),
    );
    const m = a.clone().add(b).multiplyScalar(0.5);
    add(g, m.x, m.y, m.z, c, [0, 0, 0], outline);
  }
  function rail(
    x: number,
    y: number,
    z: number,
    w: number,
    axis: "x" | "z" = "x",
  ) {
    const n = Math.ceil(w / 0.5);
    for (let i = 0; i <= n; i++) {
      const d = -w / 2 + (w * i) / n;
      box(
        x + (axis === "x" ? d : 0),
        y + 0.28,
        z + (axis === "z" ? d : 0),
        0.035,
        0.55,
        0.035,
        "dark",
      );
    }
    box(
      x,
      y + 0.56,
      z,
      axis === "x" ? w : 0.045,
      0.045,
      axis === "z" ? w : 0.045,
      "wood",
    );
  }
  function planter(x: number, y: number, z: number, w: number, d: number) {
    box(x, y + 0.13, z, w, 0.26, d, "light");
    box(x, y + 0.27, z, w - 0.1, 0.035, d - 0.1, "soil", false);
    for (let i = 0; i < Math.ceil(w * d * 11); i++) {
      const px = x + (random() - 0.5) * (w - 0.14),
        pz = z + (random() - 0.5) * (d - 0.14);
      add(
        new T.IcosahedronGeometry(0.1 + random() * 0.12, 0),
        px,
        y + 0.34 + random() * 0.09,
        pz,
        random() > 0.5 ? "leaf" : "leafLight",
        [random(), random(), 0],
        false,
      );
    }
  }
  function tree(x: number, y: number, z: number, size: number) {
    beam(
      new T.Vector3(x, y, z),
      new T.Vector3(x + 0.05 * size, y + size * 1.05, z),
      size * 0.055,
    );
    for (let j = 0; j < 5; j++) {
      const angle = j * 2.4;
      const dx = Math.cos(angle) * size * 0.35,
        dz = Math.sin(angle) * size * 0.35;
      beam(
        new T.Vector3(x, y + size * 0.55, z),
        new T.Vector3(x + dx, y + size * (1.02 + j * 0.04), z + dz),
        size * 0.023,
      );
    }
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4;
      const r = size * (0.12 + random() * 0.38);
      const px = x + Math.cos(a) * r,
        pz = z + Math.sin(a) * r,
        py = y + size * (1.02 + random() * 0.43);
      const g = new T.IcosahedronGeometry(size * (0.25 + random() * 0.16), 1);
      g.scale(1, 0.75 + random() * 0.35, 1);
      add(
        g,
        px,
        py,
        pz,
        ["leaf", "leafLight", "leafDark"][i % 3] as ColorName,
        [random(), random(), random()],
        false,
      );
    }
    // Three quiet contours keep the tree visible in the pencil and blueprint phases.
    for (let j = 0; j < 3; j++) {
      const points = [];
      for (let k = 0; k <= 30; k++) {
        const a = (k / 30) * Math.PI * 2;
        const rr = size * (0.47 + Math.sin(a * 7 + j) * 0.03);
        points.push(
          new T.Vector3(
            x + Math.cos(a) * rr,
            y + size * 1.2 + Math.sin(a) * rr * (j === 2 ? 0.5 : 1),
            z + (j - 1) * size * 0.18,
          ),
        );
      }
      const geo = new T.BufferGeometry().setFromPoints(points);
      const positions = geo.getAttribute("position");
      const segments = [];
      for (let k = 0; k < positions.count - 1; k++)
        segments.push(
          positions.getX(k),
          positions.getY(k),
          positions.getZ(k),
          positions.getX(k + 1),
          positions.getY(k + 1),
          positions.getZ(k + 1),
        );
      edgeParts.push(
        new T.BufferGeometry().setAttribute(
          "position",
          new T.Float32BufferAttribute(segments, 3),
        ),
      );
      geo.dispose();
    }
  }
  function arch(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    depth: number,
    rotation = 0,
  ) {
    const shape = new T.Shape();
    const r = w / 2;
    shape.moveTo(-r, 0);
    shape.lineTo(-r, h - r);
    shape.absarc(0, h - r, r, Math.PI, 0, true);
    shape.lineTo(r, 0);
    shape.lineTo(r - 0.18, 0);
    shape.lineTo(r - 0.18, h - r);
    shape.absarc(0, h - r, r - 0.18, 0, Math.PI, false);
    shape.lineTo(-r + 0.18, 0);
    shape.closePath();
    add(
      new T.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 12,
      }),
      x,
      y,
      z,
      "light",
      [0, rotation, 0],
    );
  }
  function steps(
    x: number,
    y: number,
    z: number,
    w: number,
    count: number,
    dir = 1,
  ) {
    for (let i = 0; i < count; i++)
      box(x, y + i * 0.13, z - i * 0.22 * dir, w, 0.14, 0.26, "light");
  }

  // Individual notebook plots become connected stone terraces.
  box(0, -0.03, 0, 10.8, 0.38, 8.7, "stone");
  box(-3.85, 0.23, 0.2, 3.2, 0.28, 5.3, "light");
  box(3.5, 0.32, -0.3, 3.2, 0.46, 5.2, "light");
  box(0.05, 0.24, -2.1, 3.2, 0.46, 3.9, "light");
  box(0.4, 0.25, 3.05, 4.9, 0.42, 1.8, "light");
  for (let x = -5; x < 5.3; x += 0.44) {
    box(x, 0.172, 4.3, 0.025, 0.014, 0.18, "trim", false);
  }
  // Central atelier: open arches, successive terraces, a rooftop tree.
  for (const x of [-1.13, 1.13])
    for (const z of [-2.9, -0.7]) box(x, 1.57, z, 0.3, 2.55, 0.3, "stone");
  for (const x of [-0.74, 0.74]) arch(x, 0.36, -0.5, 1.38, 2.55, 0.18);
  box(0, 2.92, -1.8, 3.1, 0.26, 3.1, "light");
  box(0.13, 3.14, -1.86, 2.85, 0.13, 2.85, "trim");
  for (const x of [-0.92, 1.02])
    for (const z of [-2.75, -1.05]) box(x, 4.05, z, 0.2, 1.9, 0.2, "stone");
  box(0.08, 5.04, -1.9, 2.75, 0.23, 2.65, "light");
  box(0.08, 3.95, -2.85, 1.8, 1.8, 0.13, "stone");
  for (const x of [-0.5, 0.2, 0.8])
    box(x, 4.12, -2.765, 0.32, 0.92, 0.015, "wood");
  planter(0.08, 5.19, -1.85, 2.1, 2.05);
  tree(0.02, 5.47, -1.92, 1.42);
  rail(0.1, 3.12, -0.46, 2.6);
  planter(-1.19, 3.15, -1.65, 0.42, 1.7);
  planter(1.26, 3.15, -1.65, 0.4, 1.65);
  // Pavilion 02: circular energy observatory with a moving water wheel.
  const ringX = -3.55,
    ringZ = 0.2;
  cylinder(ringX, 0.62, ringZ, 1.47, 0.2, "light");
  add(new T.TorusGeometry(1.25, 0.15, 5, 52), ringX, 2.42, ringZ, "light", [
    Math.PI / 2,
    0,
    0,
  ]);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = ringX + Math.cos(a) * 1.25,
      z = ringZ + Math.sin(a) * 1.25;
    cylinder(x, 1.5, z, 0.09, 1.8, "stone");
  }
  cylinder(ringX, 0.81, ringZ, 1.09, 0.13, "dark");
  cylinder(ringX, 0.9, ringZ, 0.87, 0.1, "glass");
  tree(-4.4, 0.55, -1.9, 0.8);
  planter(-4.9, 0.5, 1.7, 0.55, 1.1);
  steps(-3.55, 0.3, 2.24, 1.3, 4);
  // Pavilion 01: reading rooms, book-like vertical screens, and a roof garden.
  box(3.33, 0.73, -0.75, 2.6, 0.28, 3.3, "trim");
  for (const x of [2.18, 4.48])
    for (const z of [-2.18, 0.62]) box(x, 1.75, z, 0.22, 2.1, 0.22, "stone");
  box(3.33, 2.9, -0.75, 2.9, 0.24, 3.5, "light");
  box(3.33, 1.8, -2.2, 2.5, 2.1, 0.17, "stone");
  for (let i = 0; i < 9; i++) {
    box(
      2.25 + i * 0.25,
      1.75,
      -2.09,
      0.1,
      1.47,
      0.035,
      i % 3 === 0 ? "wood" : "trim",
    );
  }
  for (let i = 0; i < 6; i++)
    box(4.51, 1.84, -1.87 + i * 0.43, 0.1, 1.65, 0.07, "wood");
  box(3.25, 1.36, -1.35, 1.7, 0.1, 0.7, "wood");
  for (const x of [2.7, 3.8]) box(x, 1.03, -1.35, 0.07, 0.65, 0.55, "dark");
  planter(3.32, 3.04, -1.56, 2.25, 1.0);
  tree(3.48, 3.31, -1.65, 1.18);
  rail(3.3, 3.03, 1, 2.65);
  planter(4.55, 3.04, 0.0, 0.4, 1.65);
  steps(3.35, 0.34, 1.6, 1.8, 4);
  // Bridges connect the plots; slatted surfaces catch moving light.
  box(-1.89, 1.24, 0.24, 1.4, 0.14, 0.74, "wood");
  for (let i = 0; i < 13; i++)
    box(-2.52 + i * 0.105, 1.33, 0.24, 0.065, 0.04, 0.72, "light");
  rail(-1.89, 1.33, -0.12, 1.4);
  rail(-1.89, 1.33, 0.6, 1.4);
  box(1.72, 2.62, -1.6, 1.32, 0.14, 0.62, "wood");
  rail(1.72, 2.7, -1.93, 1.4);
  rail(1.72, 2.7, -1.28, 1.4);
  // A small greenhouse in the foreground.
  box(2.02, 0.61, 3.11, 1.75, 0.2, 1.8, "light");
  for (const x of [1.26, 2.78])
    for (const z of [2.34, 3.88]) box(x, 1.28, z, 0.045, 1.2, 0.045, "dark");
  for (const z of [2.34, 3.88]) {
    beam(
      new T.Vector3(1.26, 1.9, z),
      new T.Vector3(2.02, 2.47, z),
      0.035,
      "dark",
    );
    beam(
      new T.Vector3(2.78, 1.9, z),
      new T.Vector3(2.02, 2.47, z),
      0.035,
      "dark",
    );
  }
  box(2.02, 2.47, 3.11, 0.055, 0.05, 1.6, "dark");
  for (const x of [1.26, 2.78]) {
    box(x, 1.91, 3.11, 0.04, 0.04, 1.6, "dark");
    box(x, 1.2, 3.11, 0.025, 0.025, 1.6, "dark");
  }
  for (const x of [1.55, 2.43]) planter(x, 0.72, 3.12, 0.43, 1.28);
  const roofGlass = new T.PlaneGeometry(0.95, 1.54);
  add(roofGlass, 1.64, 2.185, 3.11, "glass", [-Math.PI / 2, 0, -0.643], false);
  add(
    new T.PlaneGeometry(0.95, 1.54),
    2.4,
    2.185,
    3.11,
    "glass",
    [-Math.PI / 2, 0, 0.643],
    false,
  );
  // Banks, pocket gardens, stone paths, and warm little flowers.
  const trees: [number, number, number, number][] = [
    [-4.45, 0.49, 2.9, 1.15],
    [-2.95, 0.44, 3.35, 0.75],
    [-0.4, 0.5, 3.26, 1.0],
    [4.4, 0.56, 1.72, 1.1],
    [4.62, 0.51, 3.42, 0.83],
    [-1.08, 0.35, 1.73, 0.9],
    [-3.5, 0.4, -3.4, 0.83],
    [2.08, 0.48, -3.53, 0.8],
  ];
  trees.forEach((t) => {
    planter(t[0], t[1] - 0.05, t[2], 0.75, 0.72);
    tree(t[0], t[1] + 0.24, t[2], t[3]);
  });
  for (const [x, z, w, d] of [
    [-1.85, 3.65, 1.1, 0.45],
    [0.22, -3.85, 2.4, 0.37],
    [4.7, -2.85, 0.4, 1.0],
    [-4.75, -0.6, 0.42, 1.3],
    [0.2, 1.6, 0.6, 0.7],
  ])
    planter(x, 0.32, z, w, d);
  for (let i = 0; i < 90; i++) {
    const x = (random() - 0.5) * 10,
      z = (random() - 0.5) * 8;
    if (Math.abs(x) < 1.25 || Math.abs(z) < 0.8) continue;
    const y = 0.4;
    add(
      new T.ConeGeometry(0.05, 0.22, 4),
      x,
      y,
      z,
      "grass",
      [0, random() * 4, 0.2],
      false,
    );
    if (i % 3 === 0)
      add(
        new T.IcosahedronGeometry(0.065, 0),
        x,
        y + 0.15,
        z,
        i % 2 ? "flower" : "coral",
        [0, 0, 0],
        false,
      );
  }
  for (let i = 0; i < 7; i++) {
    box(-0.55 + i * 0.29, 0.27, 2.38, 0.2, 0.08, 0.35, "light");
  }
  // Small terrace bench and a lamp.
  box(-0.43, 0.92, 3.65, 0.85, 0.07, 0.3, "wood");
  for (const x of [-0.73, -0.14]) box(x, 0.68, 3.65, 0.05, 0.48, 0.24, "dark");
  cylinder(4.36, 1.4, 0.75, 0.027, 1.6, "dark");
  cylinder(4.36, 2.21, 0.75, 0.13, 0.19, "flower");

  const solidMeshes: T.Mesh[] = [];
  const materials: {
    material: T.MeshStandardMaterial;
    flora: boolean;
    glass: boolean;
  }[] = [];
  for (const [color, geometries] of batches) {
    const material = new T.MeshStandardMaterial({
      color: colors[color],
      roughness: 0.86,
      metalness: 0,
      transparent: true,
      opacity: 0,
      side: color === "glass" ? T.DoubleSide : T.FrontSide,
    });
    const flora = foliageKeys.includes(color);
    if (flora)
      material.onBeforeCompile = (shader) => {
        shader.uniforms.uTime = timeUniform;
        shader.uniforms.uLife = lifeUniform;
        shader.vertexShader =
          "uniform float uTime; uniform float uLife;\n" + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.x += sin(position.y*2.1 + position.z + uTime*.85)*.022*uLife; transformed.z += cos(position.x*1.6 + uTime*.7)*.018*uLife;",
        );
      };
    const geometry = mergeGeometries(geometries)!;
    geometries.forEach((g) => g.dispose());
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = color !== "glass";
    mesh.receiveShadow = true;
    world.add(mesh);
    if (color !== "glass") solidMeshes.push(mesh);
    materials.push({ material, flora, glass: color === "glass" });
  }
  const lineMaterial = new T.LineBasicMaterial({
    color: 0x777b7d,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
  });
  const outlines = new T.LineSegments(
    mergeGeometries(edgeParts)!,
    lineMaterial,
  );
  edgeParts.forEach((g) => g.dispose());
  world.add(outlines);
  const ghostMaterial = lineMaterial.clone();
  ghostMaterial.opacity = 0.06;
  const ghost = new T.LineSegments(outlines.geometry, ghostMaterial);
  ghost.position.set(0.019, 0.008, -0.013);
  world.add(ghost);
  // Dashed measured construction axes stay on the same sheet as the scene.
  const guides = new T.Group();
  world.add(guides);
  const guideMaterial = new T.LineDashedMaterial({
    color: 0x698bb5,
    transparent: true,
    opacity: 0,
    dashSize: 0.16,
    gapSize: 0.12,
    depthWrite: false,
  });
  for (let i = -6; i <= 6; i++) {
    for (const axis of ["x", "z"]) {
      const points =
        axis === "x"
          ? [new T.Vector3(-6, 0.04, i), new T.Vector3(6, 0.04, i)]
          : [new T.Vector3(i, 0.04, -5), new T.Vector3(i, 0.04, 5)];
      const l = new T.Line(
        new T.BufferGeometry().setFromPoints(points),
        guideMaterial,
      );
      l.computeLineDistances();
      guides.add(l);
    }
  }
  for (const [x, z] of [
    [-1.55, -3.35],
    [1.55, -3.35],
    [-1.55, -0.25],
    [1.55, -0.25],
  ]) {
    const l = new T.Line(
      new T.BufferGeometry().setFromPoints([
        new T.Vector3(x, 0, z),
        new T.Vector3(x, 7.6, z),
      ]),
      guideMaterial,
    );
    l.computeLineDistances();
    guides.add(l);
  }
  const timeUniform = { value: 0 },
    lifeUniform = { value: 0 };
  const waterMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: timeUniform, uOpacity: { value: 0 } },
    vertexShader:
      "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform float uTime;uniform float uOpacity;varying vec2 vUv;void main(){float w=sin(vUv.y*92.-uTime*1.6+sin(vUv.x*24.)*1.4);float line=smoothstep(.9,1.,w);vec3 c=mix(vec3(.29,.56,.58),vec3(.70,.84,.77),vUv.x*.45+line*.4);gl_FragColor=vec4(c,uOpacity*.88);}`,
  });
  function water(
    x: number,
    y: number,
    z: number,
    w: number,
    d: number,
    vertical = false,
  ) {
    const mesh = new T.Mesh(new T.PlaneGeometry(w, d), waterMaterial);
    mesh.position.set(x, y, z);
    if (!vertical) mesh.rotation.x = -Math.PI / 2;
    world.add(mesh);
  }
  water(0.01, 0.495, 1.1, 1.25, 6.2);
  water(-1.55, 0.495, 2.61, 3.2, 0.8);
  // A broad, front-facing cascade connects the atelier terrace to the river.
  const waterfallLip = new T.Mesh(
    new T.BoxGeometry(1.18, 0.12, 0.78),
    new T.MeshStandardMaterial({
      color: colors.light,
      transparent: true,
      opacity: 0,
    }),
  );
  waterfallLip.position.set(0.68, 2.9, -0.04);
  world.add(waterfallLip);
  water(0.68, 2.966, -0.04, 0.96, 0.8);
  const waterfallOpacity = { value: 0 };
  const waterfallMaterial = new T.ShaderMaterial({
    transparent: true,
    side: T.DoubleSide,
    depthWrite: false,
    uniforms: { uTime: timeUniform, uOpacity: waterfallOpacity },
    vertexShader: `uniform float uTime;varying vec2 vUv;void main(){vUv=uv;vec3 p=position;p.z+=sin(uv.y*13.+uTime*3.+uv.x*9.)*.014;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uTime;uniform float uOpacity;varying vec2 vUv;void main(){float streams=sin(vUv.x*58.+sin(vUv.y*8.+uTime*2.)*.7);float drops=sin(vUv.y*39.+uTime*5.8+sin(vUv.x*16.)*3.);float streak=smoothstep(.20,1.,streams)*.45+smoothstep(.65,1.,drops)*.22;vec3 water=mix(vec3(.27,.59,.63),vec3(.91,.98,.93),streak+pow(1.-vUv.y,7.)*.5);float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x);gl_FragColor=vec4(water,uOpacity*edge*.92);}`,
  });
  const waterfall = new T.Mesh(
    new T.PlaneGeometry(1.03, 2.45, 12, 36),
    waterfallMaterial,
  );
  waterfall.position.set(0.68, 1.74, 0.37);
  world.add(waterfall);
  const rippleMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: timeUniform, uOpacity: waterfallOpacity },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform float uTime;uniform float uOpacity;varying vec2 vUv;void main(){float r=length((vUv-.5)*vec2(1.,1.35));float rings=smoothstep(.77,1.,sin(r*58.-uTime*3.));float fade=(1.-smoothstep(.23,.49,r));gl_FragColor=vec4(.86,.97,.92,(rings*.6+.12)*fade*uOpacity);}`,
  });
  const ripples = new T.Mesh(new T.PlaneGeometry(2, 1.8), rippleMaterial);
  ripples.rotation.x = -Math.PI / 2;
  ripples.position.set(0.63, 0.515, 0.62);
  world.add(ripples);
  const sprayGeometry = new T.BufferGeometry();
  const sprayPositions = [];
  for (let i = 0; i < 44; i++)
    sprayPositions.push((random() - 0.5) * 0.95, random(), random());
  sprayGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(sprayPositions, 3),
  );
  const sprayMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: timeUniform, uOpacity: waterfallOpacity },
    vertexShader: `uniform float uTime;void main(){float t=fract(position.y+uTime*.5);vec3 p=vec3(.68+position.x*(1.+t*.8),.55+sin(t*3.14159)*.32,.39+position.z*.52+t*.25);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.4;}`,
    fragmentShader:
      "uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.9,.99,.95,(1.-d*2.)*uOpacity*.8);}",
  });
  world.add(new T.Points(sprayGeometry, sprayMaterial));
  // Three quiet survey drones. Shared geometry keeps the flight detail inexpensive.
  const droneBodyGeometries: T.BufferGeometry[] = [],
    droneTrimGeometries: T.BufferGeometry[] = [],
    droneRotorGeometries: T.BufferGeometry[] = [];
  function dronePart(
    g: T.BufferGeometry,
    x: number,
    y: number,
    z: number,
    batch: T.BufferGeometry[],
  ) {
    g.translate(x, y, z);
    batch.push(g.index ? g.toNonIndexed() : g);
    if (g.index) g.dispose();
  }
  dronePart(
    new T.SphereGeometry(0.21, 12, 7).scale(1, 0.42, 1.2),
    0,
    0,
    0,
    droneBodyGeometries,
  );
  dronePart(
    new T.BoxGeometry(0.12, 0.045, 0.13),
    0,
    0.065,
    0.04,
    droneTrimGeometries,
  );
  dronePart(
    new T.SphereGeometry(0.055, 8, 6),
    0,
    -0.02,
    0.22,
    droneTrimGeometries,
  );
  for (const x of [-0.31, 0.31])
    for (const z of [-0.29, 0.29]) {
      const arm = new T.BoxGeometry(0.4, 0.025, 0.035);
      arm.rotateY(-Math.atan2(z, x));
      dronePart(arm, x * 0.5, 0, z * 0.5, droneTrimGeometries);
      const cage = new T.TorusGeometry(0.15, 0.016, 5, 20);
      cage.rotateX(Math.PI / 2);
      dronePart(cage, x, 0.016, z, droneBodyGeometries);
      dronePart(
        new T.CylinderGeometry(0.028, 0.028, 0.065, 7),
        x,
        0.025,
        z,
        droneTrimGeometries,
      );
      dronePart(
        new T.CircleGeometry(0.125, 16).rotateX(-Math.PI / 2),
        x,
        0.051,
        z,
        droneRotorGeometries,
      );
    }
  const bodyGeo = mergeGeometries(droneBodyGeometries)!,
    trimGeo = mergeGeometries(droneTrimGeometries)!,
    rotorGeo = mergeGeometries(droneRotorGeometries)!;
  [
    ...droneBodyGeometries,
    ...droneTrimGeometries,
    ...droneRotorGeometries,
  ].forEach((g) => g.dispose());
  const droneBodyMaterial = new T.MeshStandardMaterial({
    color: 0xf2e9d3,
    roughness: 0.7,
    transparent: true,
    opacity: 0,
  });
  const droneTrimMaterial = new T.MeshStandardMaterial({
    color: 0x496c67,
    roughness: 0.55,
    transparent: true,
    opacity: 0,
  });
  const rotorMaterial = new T.MeshBasicMaterial({
    color: 0x778778,
    side: T.DoubleSide,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const droneLineMaterial = new T.LineBasicMaterial({
    color: 0x5983ad,
    transparent: true,
    opacity: 0,
  });
  const droneEdges = new T.EdgesGeometry(bodyGeo, 28);
  const drones: T.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const drone = new T.Group();
    drone.add(
      new T.Mesh(bodyGeo, droneBodyMaterial),
      new T.Mesh(trimGeo, droneTrimMaterial),
      new T.Mesh(rotorGeo, rotorMaterial),
      new T.LineSegments(droneEdges, droneLineMaterial),
    );
    world.add(drone);
    drones.push(drone);
  }
  // A moving wheel supplies a readable, calm animation at garden scale.
  const wheel = new T.Group();
  wheel.position.set(-3.55, 1.65, 0.21);
  wheel.rotation.y = 0.15;
  world.add(wheel);
  const wheelMaterial = new T.MeshStandardMaterial({
    color: colors.wood,
    roughness: 0.75,
    transparent: true,
    opacity: 0,
  });
  const hoop = new T.Mesh(new T.TorusGeometry(0.7, 0.05, 6, 40), wheelMaterial);
  wheel.add(hoop);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const spoke = new T.Mesh(
      new T.BoxGeometry(0.055, 1.4, 0.065),
      wheelMaterial,
    );
    spoke.rotation.z = a;
    wheel.add(spoke);
    const paddle = new T.Mesh(
      new T.BoxGeometry(0.26, 0.09, 0.32),
      wheelMaterial,
    );
    paddle.position.set(Math.sin(a) * 0.7, Math.cos(a) * 0.7, 0);
    paddle.rotation.z = -a;
    wheel.add(paddle);
  }
  const butterflies: T.Group[] = [];
  const butterflyMaterial = new T.MeshBasicMaterial({
    color: 0xcfa254,
    side: T.DoubleSide,
    transparent: true,
    opacity: 0,
  });
  for (let i = 0; i < 5; i++) {
    const butterfly = new T.Group();
    for (const sign of [-1, 1]) {
      const wing = new T.Mesh(new T.CircleGeometry(0.09, 4), butterflyMaterial);
      wing.position.x = sign * 0.065;
      wing.rotation.y = sign * 0.3;
      butterfly.add(wing);
    }
    world.add(butterfly);
    butterflies.push(butterfly);
  }
  // After dusk: warm lanterns in the buildings and a few fireflies.
  const lanternSpots: [number, number, number][] = [
    [4.36, 2.21, 0.75],
    [3.3, 1.7, -1.2],
    [-3.55, 1.25, 0.2],
    [0.05, 1.6, -1.8],
    [2.02, 1.3, 3.11],
  ];
  const lanternLights = lanternSpots.map(([x, y, z]) => {
    const light = new T.PointLight(0xffb565, 0, 3.4, 1.6);
    light.position.set(x, y, z);
    world.add(light);
    return light;
  });
  const glowMaterial = new T.MeshBasicMaterial({
    color: 0xffd28a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const glowGeometry = new T.SphereGeometry(0.075, 10, 8);
  lanternSpots.forEach(([x, y, z]) => {
    const glow = new T.Mesh(glowGeometry, glowMaterial);
    glow.position.set(x, y + (x === 4.36 ? 0 : 0.35), z);
    world.add(glow);
  });
  const fireflyGeometry = new T.BufferGeometry();
  const fireflySeeds: number[] = [];
  for (let i = 0; i < 70; i++)
    fireflySeeds.push(
      (random() - 0.5) * 10,
      0.7 + random() * 2.6,
      (random() - 0.5) * 8,
    );
  fireflyGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(fireflySeeds, 3),
  );
  const fireflyOpacity = { value: 0 };
  const fireflyMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uTime: timeUniform, uOpacity: fireflyOpacity },
    vertexShader: `uniform float uTime;varying float vBlink;void main(){vec3 p=position;float s=position.x*1.7+position.z*2.3;p.x+=sin(uTime*.45+s)*.35;p.y+=sin(uTime*.7+s*1.3)*.22;p.z+=cos(uTime*.38+s)*.35;vBlink=smoothstep(.15,1.,sin(uTime*1.6+s*4.)*.5+.5);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=7.;}`,
    fragmentShader:
      "uniform float uOpacity;varying float vBlink;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=pow(1.-d*2.,2.);gl_FragColor=vec4(1.,.86,.48,a*vBlink*uOpacity);}",
  });
  world.add(new T.Points(fireflyGeometry, fireflyMaterial));

  const planted: { group: T.Group; age: number }[] = [];
  const plantMaterial = new T.MeshStandardMaterial({
    color: 0x8ca360,
    roughness: 1,
  });
  const plantLeaves = [0x8ca360, 0x6f9455, 0xa6b970, 0x4e7551].map(
    (color) => new T.MeshStandardMaterial({ color, roughness: 1 }),
  );
  const trunkGeometry = new T.CylinderGeometry(0.025, 0.035, 0.45, 6);
  const leafGeometry = new T.IcosahedronGeometry(0.19, 1);
  function makeTree(local: T.Vector3) {
    const g = new T.Group();
    const trunk = new T.Mesh(trunkGeometry, plantMaterial);
    trunk.position.y = 0.23;
    trunk.castShadow = true;
    g.add(trunk);
    const leaves = plantLeaves[Math.floor(random() * plantLeaves.length)];
    const clumps = 2 + Math.floor(random() * 3);
    for (let i = 0; i < clumps; i++) {
      const m = new T.Mesh(leafGeometry, leaves);
      m.position.set(
        (random() - 0.5) * 0.28,
        0.42 + random() * 0.18,
        (random() - 0.5) * 0.22,
      );
      m.scale.setScalar(0.75 + random() * 0.5);
      m.castShadow = true;
      g.add(m);
    }
    g.position.copy(local);
    g.rotation.y = random() * Math.PI * 2;
    g.userData.size = 1.15 + random() * 0.6;
    g.scale.setScalar(reduced || paused ? g.userData.size : 0.001);
    world.add(g);
    planted.push({ group: g, age: reduced || paused ? 1 : 0 });
    dirty = true;
    return planted.length;
  }
  const raycaster = new T.Raycaster();
  const pointer = new T.Vector2();
  const MAX_TREES = 24;
  let targetProgress = 0,
    progress = 0,
    paused = false,
    reduced = false,
    visible = true,
    rotation = 0,
    rotationTarget = 0,
    frame = 0,
    last = 0,
    elapsed = 0,
    disposed = false,
    dirty = true;
  let darkTheme = false;
  let drawIn = 0;
  let hour = 13;
  let night = 0;
  const focusPoint = new T.Vector3(0, 2.4, 0);
  const focusTarget = new T.Vector3(0, 2.4, 0);
  let focusAmount = 0,
    focusGoal = 0,
    shift = new T.Vector2(),
    shiftGoal = new T.Vector2();
  let renderMs = 0;
  let shadowStrength = 1;
  const observer = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      dirty = true;
    },
    { rootMargin: "80px" },
  );
  observer.observe(container);
  let width = 1,
    height = 1;
  const resize = () => {
    width = container.clientWidth;
    height = container.clientHeight;
    renderer.setSize(width, height);
    dirty = true;
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();
  const pencilColor = new T.Color(0x85898b),
    blueColor = new T.Color(0x447cba),
    finalColor = new T.Color(0x7b8277);
  const projected = new T.Vector3();
  const points: Record<string, T.Vector3> = {
    wattch: new T.Vector3(-3.65, 2.65, 0.2),
    whisperbook: new T.Vector3(3.35, 3.55, -0.65),
    about: new T.Vector3(0.08, 5.3, -1.1),
    contact: new T.Vector3(2.02, 2.5, 3.11),
  };
  const lookDefault = new T.Vector3(0, 2.4, 0);
  const sunColor = new T.Color();
  function applyLight() {
    // 6:00 sunrise, 13:00 high sun, 20:00 sunset.
    const arc = T.MathUtils.clamp((hour - 6) / 14, 0, 1);
    const height = Math.sin(arc * Math.PI);
    night = smooth(19.2, 21.5, hour) + (1 - smooth(5, 6.6, hour));
    night = T.MathUtils.clamp(night, 0, 1);
    // The sun never drops low enough to throw shadows off the sheet.
    sun.position.set(lerp(-9, 9, arc), 8 + height * 8, lerp(9, 6, height));
    shadowStrength = (0.35 + 0.65 * height) * (1 - night * 0.7);
    sunColor.setHex(0xff9d5c).lerp(new T.Color(0xffefd4), smooth(0, 0.55, height));
    sunColor.lerp(new T.Color(0x9fb4e8), night);
    sun.color.copy(sunColor);
    sun.intensity = (0.9 + 2.4 * height) * (1 - night * 0.82);
    sky.intensity = (1.4 + 1.1 * height) * (1 - night * 0.55);
    sky.color.setHex(0xf7fbff).lerp(new T.Color(0x6d84bd), night);
    sky.groundColor.setHex(0x839073).lerp(new T.Color(0x2b3550), night);
    fillLight.intensity = 0.7 * (1 - night * 0.6);
    dirty = true;
  }
  applyLight();
  const onLost = (event: Event) => {
    event.preventDefault();
    container.parentElement!.querySelector<HTMLElement>(
      ".scene-fallback",
    )!.hidden = false;
    hotspots.forEach((h) => {
      h.style.visibility = "hidden";
      h.tabIndex = -1;
    });
  };
  const onRestored = () => {
    container.parentElement!.querySelector<HTMLElement>(
      ".scene-fallback",
    )!.hidden = true;
    hotspots.forEach((h) => (h.style.visibility = ""));
  };
  renderer.domElement.addEventListener("webglcontextlost", onLost);
  renderer.domElement.addEventListener("webglcontextrestored", onRestored);
  function render(now: number) {
    if (disposed) return;
    frame = requestAnimationFrame(render);
    if (!visible || document.hidden) {
      last = now;
      return;
    }
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    if (drawIn < 1) {
      drawIn = reduced ? 1 : Math.min(1, drawIn + dt / 3.2);
      dirty = true;
    }
    const growing = planted.some((p) => p.age < 1);
    const changed =
      Math.abs(targetProgress - progress) > 0.0001 ||
      Math.abs(rotationTarget - rotation) > 0.0001 ||
      Math.abs(focusGoal - focusAmount) > 0.0005 ||
      shift.distanceTo(shiftGoal) > 0.0005 ||
      growing;
    if ((paused || progress < 0.5) && !changed && !dirty) return;
    dirty = false;
    progress = lerp(
      progress,
      targetProgress,
      reduced ? 1 : Math.min(dt * 7, 1),
    );
    rotation = lerp(
      rotation,
      rotationTarget,
      reduced ? 1 : Math.min(dt * 4, 1),
    );
    if (!paused) elapsed += dt;
    const ease = reduced ? 1 : Math.min(dt * 3.2, 1);
    focusAmount = lerp(focusAmount, focusGoal, ease);
    shift.lerp(shiftGoal, ease);
    focusPoint.lerp(focusTarget, ease);
    const drawn = drawIn * drawIn * (3 - 2 * drawIn);
    const count = outlines.geometry.attributes.position.count;
    outlines.geometry.setDrawRange(0, Math.floor((count * drawn) / 2) * 2);
    timeUniform.value = elapsed;
    const life = smooth(0.62, 0.91, progress);
    lifeUniform.value = paused ? 0 : life;
    const blueprint = smooth(0.07, 0.3, progress),
      solid = smooth(0.34, 0.72, progress);
    world.scale.setScalar(lerp(0.77, 1, smooth(0, 0.72, progress)));
    world.scale.y *= lerp(0.72, 1, smooth(0.1, 0.55, progress));
    world.rotation.y = rotation;
    materials.forEach(({ material, flora, glass }) => {
      material.opacity = flora ? life : solid * (glass ? 0.38 : 1);
      const transparent = material.opacity < 0.995;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.depthWrite = material.opacity > 0.92;
      material.visible = material.opacity > 0.003;
    });
    lineMaterial.color
      .copy(pencilColor)
      .lerp(blueColor, blueprint)
      .lerp(finalColor, solid);
    lineMaterial.opacity =
      lerp(darkTheme ? 0.38 : 0.21, darkTheme ? 0.85 : 0.6, blueprint) *
      (1 - solid * 0.92);
    ghostMaterial.opacity = 0.055 * (1 - blueprint);
    guideMaterial.opacity =
      smooth(0.06, 0.32, progress) * (1 - smooth(0.5, 0.83, progress)) * 0.38;
    shadowMaterial.opacity = solid * 0.15 * shadowStrength;
    wheelMaterial.opacity = solid;
    waterfallLip.material.opacity = solid;
    waterMaterial.uniforms.uOpacity.value = smooth(0.5, 0.79, progress);
    const glow = night * solid;
    lanternLights.forEach((l) => (l.intensity = glow * 2.6));
    glowMaterial.opacity = glow * 0.95;
    glowMaterial.visible = glow > 0.01;
    fireflyOpacity.value = night * life;
    butterflyMaterial.opacity = life;
    waterfallOpacity.value = smooth(0.59, 0.85, progress);
    droneBodyMaterial.opacity = life;
    droneTrimMaterial.opacity = life;
    rotorMaterial.opacity = life * 0.21;
    droneLineMaterial.opacity =
      smooth(0.15, 0.33, progress) * (1 - life) * 0.46;
    drones.forEach((drone, i) => {
      const phase = elapsed * 0.105 * life + i * 2.08;
      drone.position.set(
        Math.cos(phase) * (3.6 + i * 0.22),
        3.35 + i * 0.62 + Math.sin(phase * 2 + i) * 0.22,
        Math.sin(phase) * (2.95 + i * 0.2),
      );
      drone.rotation.set(
        Math.sin(phase * 2) * 0.055 * life,
        -phase + 0.5,
        Math.cos(phase) * 0.075 * life,
      );
    });
    wheel.rotation.z = -elapsed * 0.22 * life;
    butterflies.forEach((b, i) => {
      b.position.set(
        Math.cos(elapsed * 0.2 + i * 1.9) * (2 + i * 0.25),
        1.5 + Math.sin(elapsed * 0.4 + i) * 0.35 + i * 0.4,
        Math.sin(elapsed * 0.2 + i * 1.9) * 2,
      );
      b.rotation.y = elapsed * 0.2 + i;
      b.children.forEach(
        (wing, j) =>
          (wing.rotation.y =
            Math.sin(elapsed * 8 + i) * 0.7 * (j === 0 ? 1 : -1)),
      );
    });
    planted.forEach((p) => {
      p.age = reduced ? 1 : Math.min(1, p.age + dt * 1.6);
      // A small overshoot, as if the tree springs up.
      const t = p.age,
        back = 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
      p.group.scale.setScalar(Math.max(0.001, back * p.group.userData.size));
    });
    const aspect = width / height;
    const stackedMobile = innerWidth <= 760 && innerHeight > 520;
    const span = stackedMobile
      ? Math.max(12.8, 15.2 / aspect)
      : aspect < 0.9
        ? 15.3 / aspect
        : 15.6;
    const half = span / 2 / (1 + focusAmount * 0.4);
    camera.left = -half * aspect - shift.x * half * aspect * 2;
    camera.right = half * aspect - shift.x * half * aspect * 2;
    camera.top = half - shift.y * half * 2;
    camera.bottom = -half - shift.y * half * 2;
    const angle =
      lerp(0.69, 0.78, smooth(0.3, 1, progress)) - (1 - drawn) * 0.45;
    const look = lookDefault.clone().lerp(focusPoint, focusAmount);
    camera.position.set(
      look.x + Math.sin(angle) * 15,
      look.y - 2.4 + lerp(14, 12, solid),
      look.z + Math.cos(angle) * 15,
    );
    camera.lookAt(look);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    world.updateMatrixWorld();
    for (const h of hotspots) {
      projected
        .copy(points[h.dataset.spot!])
        .applyMatrix4(world.matrixWorld)
        .project(camera);
      h.style.left = `${(projected.x * 0.5 + 0.5) * width}px`;
      h.style.top = `${(-projected.y * 0.5 + 0.5) * height}px`;
    }
    const before = performance.now();
    renderer.render(scene, camera);
    renderMs = lerp(renderMs || 1, performance.now() - before, 0.1);
    container.dataset.progress = progress.toFixed(3);
    container.dataset.drawCalls = String(renderer.info.render.calls);
    container.dataset.triangles = String(renderer.info.render.triangles);
    container.dataset.waterfall = waterfallOpacity.value.toFixed(2);
    container.dataset.drones = String(drones.length);
    container.dataset.animationTime = elapsed.toFixed(3);
  }
  frame = requestAnimationFrame(render);
  return {
    setProgress(p, immediate = false) {
      targetProgress = p;
      reduced = immediate;
      dirty = true;
      if (immediate) progress = p;
    },
    setTheme(dark) {
      darkTheme = dark;
      pencilColor.setHex(dark ? 0x8fbcda : 0x85898b);
      blueColor.setHex(dark ? 0xc0eaff : 0x447cba);
      guideMaterial.color.setHex(dark ? 0x71b3e4 : 0x698bb5);
      ghostMaterial.color.setHex(dark ? 0x94c8e9 : 0x777b7d);
      droneLineMaterial.color.setHex(dark ? 0xc0eaff : 0x5983ad);
      renderer.toneMappingExposure = dark ? 0.95 : 1.2;
      dirty = true;
    },
    setMotion(value) {
      paused = value;
      dirty = true;
    },
    rotate() {
      rotationTarget += Math.PI / 6;
    },
    rotateBy(radians) {
      rotationTarget += radians;
      dirty = true;
    },
    plantAt(x, y) {
      if (planted.length >= MAX_TREES) return MAX_TREES;
      pointer.set((x / width) * 2 - 1, -(y / height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster
        .intersectObjects(solidMeshes, false)
        .find((h) => h.face && h.face.normal.y > 0.7);
      if (!hit) return -1;
      return makeTree(world.worldToLocal(hit.point.clone()));
    },
    setHour(value) {
      hour = value;
      applyLight();
    },
    focus(spot, shiftX = 0, shiftY = 0) {
      if (spot && points[spot]) {
        focusTarget
          .copy(points[spot])
          .multiply(world.scale)
          .applyAxisAngle(new T.Vector3(0, 1, 0), rotation);
        focusGoal = 1;
        shiftGoal.set(shiftX, shiftY);
      } else {
        focusGoal = 0;
        shiftGoal.set(0, 0);
      }
      dirty = true;
    },
    stats() {
      return {
        triangles: renderer.info.render.triangles,
        calls: renderer.info.render.calls,
        ms: renderMs,
      };
    },
    plant() {
      if (planted.length >= MAX_TREES) return MAX_TREES;
      // Keyboard planting fills the front terrace from left to right.
      const i = planted.length % 12;
      return makeTree(
        new T.Vector3(-4.3 + i * 0.78 + (random() - 0.5) * 0.2, 0.36, 3.95),
      );
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", onLost);
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        onRestored,
      );
      const geometries = new Set<T.BufferGeometry>(),
        mats = new Set<T.Material>();
      scene.traverse((o) => {
        if (
          o instanceof T.Mesh ||
          o instanceof T.Line ||
          o instanceof T.Points
        ) {
          geometries.add(o.geometry);
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) =>
            mats.add(m),
          );
        }
      });
      geometries.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
