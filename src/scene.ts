import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { phase, yieldTask } from "./performance";

export type Season = "spring" | "summer" | "autumn" | "winter";

export interface Garden {
  /** Whisperbook pavilion reacts while the widget narrates. */
  setNarrating: (on: boolean) => void;
  /** Highlight one step of the path: 0 ground (startup), 1 terrace (research), 2 observatory (energy), 3 roof (atelier); null clears. */
  highlightPath: (step: number | null) => void;
  /** Contact postbox: flag up while writing, a letter drop on send. */
  setPostbox: (state: "idle" | "writing" | "sent") => void;
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
  /** Cloud cover and rain or snow, both 0–1. Clouds soften the sun and its shadows. */
  setWeather: (cloud: number, precip: number) => void;
  /** Glide the camera to a named spot, or back to the whole garden. Shift moves the garden on screen as a fraction of the view. */
  focus: (spot: string | null, shiftX?: number, shiftY?: number) => void;
  /** The band of the view the garden is framed in, top and bottom as fractions of the container's height (0–1). The camera eases to a new frame. */
  frame: (top: number, bottom: number) => void;
  /** `ms` is the smoothed CPU time to submit a frame; the totals cover every frame drawn so far. `gpuMs` is null without GPU timers. */
  stats: () => { triangles: number; calls: number; ms: number; gpuFrameMs: number | null; cpuMs: number; gpuMs: number | null; frames: number };
  /** Recolours foliage, flowers, fallen leaves, and drifting petals for the season. */
  setSeason: (season: Season) => void;
  /** 0–1 mist that hides the far side of the garden, in the page's paper colour. */
  setFog: (amount: number, color: number) => void;
  dispose: () => void;
}
const smooth = (a: number, b: number, v: number) =>
  T.MathUtils.smoothstep(v, a, b);
const lerp = T.MathUtils.lerp;
// Fades a material in or out, only paying for transparency while it is partial.
function fade(material: T.Material, opacity: number) {
  material.opacity = opacity;
  const transparent = opacity < 0.995;
  if (material.transparent !== transparent) {
    material.transparent = transparent;
    material.needsUpdate = true;
  }
  material.depthWrite = opacity > 0.92;
  material.visible = opacity > 0.003;
}
let seed = 73;
function random() {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
}

export async function createGarden(
  container: HTMLElement,
  hotspots: HTMLElement[],
  quality: "full" | "low" = "full",
): Promise<Garden> {
  const constructionDone = phase("scene-construction");
  let batchDone = phase("construction:renderer");
  const checkpoint = async (name: string) => {
    batchDone();
    await yieldTask();
    batchDone = phase(`construction:${name}`);
  };
  seed = 73;
  const scene = new T.Scene();
  const renderer = new T.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "low-power",
  });
  renderer.debug.checkShaderErrors = true;
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality === "low" ? 1.25 : 1.6));
  container.dataset.quality = quality;
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
  sun.shadow.mapSize.set(quality === "low" ? 1024 : 2048, quality === "low" ? 1024 : 2048);
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
    // Props painted in the flower and coral tones. Not foliage, so they keep
    // their colour all year and don't sway.
    ochre: 0xe7b763,
    terracotta: 0xce8265,
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
  // Fixed per-prop variation that leaves the shared random sequence alone.
  const vary = (i: number, k = 0) => {
    const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
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

  await checkpoint("terraces");
  // Individual notebook plots become connected stone terraces.
  box(0, -0.03, 0, 10.8, 0.38, 8.7, "stone");
  box(-3.85, 0.23, 0.2, 3.2, 0.28, 5.3, "light");
  box(3.5, 0.32, -0.3, 3.2, 0.46, 5.2, "light");
  box(0.05, 0.24, -2.1, 3.2, 0.46, 3.9, "light");
  box(0.4, 0.25, 3.05, 4.9, 0.42, 1.8, "light");
  for (let x = -5; x < 5.3; x += 0.44) {
    box(x, 0.172, 4.3, 0.025, 0.014, 0.18, "trim", false);
  }
  // The top of the ground at a point, so loose props stand on it instead of floating.
  const levels: [number, number, number, number, number][] = [
    [-5.4, 5.4, -4.35, 4.35, 0.16],
    [-5.45, -2.25, -2.45, 2.85, 0.37],
    [1.9, 5.1, -2.9, 2.3, 0.55],
    [-1.55, 1.65, -4.05, -0.15, 0.47],
    [-2.05, 2.85, 2.15, 3.95, 0.46],
  ];
  const groundAt = (x: number, z: number) =>
    Math.max(
      ...levels
        .filter(([x0, x1, z0, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1)
        .map((l) => l[4]),
    );
  // The canal runs from the foot of the waterfall to the front edge, with a
  // branch that stops short of the observatory steps. A stone bed and curbs
  // hold the water, which sits at 0.495.
  box(0.01, 0.315, 1.965, 1.25, 0.31, 3.93, "light");
  box(-1.7075, 0.315, 2.61, 2.185, 0.31, 0.8, "light");
  box(0.675, 0.355, 1.965, 0.08, 0.39, 4.01, "stone");
  box(-0.655, 0.355, 1.065, 0.08, 0.39, 2.21, "stone");
  box(-0.655, 0.355, 3.51, 0.08, 0.39, 0.92, "stone");
  for (const z of [-0.04, 3.97]) box(0.01, 0.355, z, 1.41, 0.39, 0.08, "stone");
  for (const z of [2.17, 3.05]) box(-1.7475, 0.355, z, 2.185, 0.39, 0.08, "stone");
  box(-2.84, 0.355, 2.61, 0.08, 0.39, 0.96, "stone");
  // Stepping stones across the branch.
  for (const z of [2.37, 2.61, 2.85]) box(-1.9, 0.5, z, 0.22, 0.06, 0.18, "light");
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
  // The tower reads from the ground up, one level per step of the path.
  // Ground, the startup: a game table standing in the left arch, beside the canal.
  box(-0.78, 0.75, -0.42, 0.4, 0.04, 0.5, "wood");
  for (const x of [-0.95, -0.61])
    for (const z of [-0.64, -0.2]) box(x, 0.6, z, 0.03, 0.27, 0.03, "wood");
  box(-0.78, 0.78, -0.47, 0.36, 0.02, 0.36, "light");
  for (let i = 0; i < 4; i++)
    for (let j = 0; j < 4; j++)
      if ((i + j) % 2)
        box(-0.915 + i * 0.09, 0.792, -0.605 + j * 0.09, 0.09, 0.006, 0.09, "dark", false);
  for (const [x, z, c] of [
    [-0.87, -0.56, "ochre"],
    [-0.69, -0.56, "ochre"],
    [-0.78, -0.38, "terracotta"],
    [-0.69, -0.38, "terracotta"],
  ] as const)
    cylinder(x, 0.815, z, 0.026, 0.045, c);
  add(new T.BoxGeometry(0.045, 0.045, 0.045), -0.88, 0.792, -0.23, "light", [0, 0.4, 0]);
  add(new T.BoxGeometry(0.045, 0.045, 0.045), -0.74, 0.792, -0.22, "light", [0, -0.3, 0]);
  // Terrace, the research: a chalkboard, a desk with papers, a reading lamp.
  box(0.08, 4.12, -2.77, 1.4, 0.8, 0.02, "dark");
  for (const y of [3.7, 4.54]) box(0.08, y, -2.76, 1.5, 0.05, 0.04, "wood");
  for (const x of [-0.65, 0.81]) box(x, 4.12, -2.76, 0.05, 0.89, 0.04, "wood");
  box(0.25, 3.63, -2.42, 0.72, 0.04, 0.34, "wood");
  for (const x of [-0.08, 0.58]) box(x, 3.41, -2.42, 0.03, 0.4, 0.3, "dark");
  for (let i = 0; i < 5; i++)
    add(
      new T.BoxGeometry(0.17, 0.007, 0.23),
      0.42,
      3.655 + i * 0.008,
      -2.42,
      "light",
      [0, (vary(i, 9) - 0.5) * 0.35, 0],
      i === 4,
    );
  cylinder(0.02, 3.66, -2.5, 0.05, 0.02, "dark");
  beam(new T.Vector3(0.02, 3.66, -2.5), new T.Vector3(0.06, 3.92, -2.45), 0.012, "dark");
  cylinder(0.08, 3.9, -2.42, 0.1, 0.09, "ochre", 0.04);
  // Roof, the atelier: the planter keeps the back half; a drafting corner takes the front.
  planter(0.08, 5.19, -2.4, 2.1, 0.95);
  tree(0.02, 5.47, -2.38, 1.42);
  add(new T.BoxGeometry(0.82, 0.03, 0.58), 0.2, 5.95, -1.2, "wood", [0.5, 0, 0]);
  for (const x of [-0.12, 0.52])
    beam(new T.Vector3(x, 5.16, -1.2), new T.Vector3(x, 5.93, -1.2), 0.03, "dark");
  cylinder(0.24, 5.54, -0.8, 0.11, 0.04, "wood");
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    beam(
      new T.Vector3(0.24 + Math.cos(a) * 0.1, 5.16, -0.8 + Math.sin(a) * 0.1),
      new T.Vector3(0.24 + Math.cos(a) * 0.06, 5.52, -0.8 + Math.sin(a) * 0.06),
      0.016,
      "dark",
    );
  }
  cylinder(0.88, 5.3, -1.05, 0.12, 0.28, "trim", 0.13);
  for (let i = 0; i < 4; i++) {
    const a = i * 1.7 + 0.4;
    beam(
      new T.Vector3(0.88 + Math.cos(a) * 0.04, 5.2, -1.05 + Math.sin(a) * 0.04),
      new T.Vector3(0.88 + Math.cos(a) * 0.15, 5.68 + vary(i, 4) * 0.08, -1.05 + Math.sin(a) * 0.15),
      0.024,
      "light",
    );
  }
  // A rill crosses the terrace from a small basin to the spout over the canal.
  // The rail opens around the spout; the right planter opens for the bridge.
  rail(-0.91, 3.12, -0.46, 0.58);
  rail(1.02, 3.12, -0.46, 0.76);
  cylinder(0.01, 3.27, -1.95, 0.2, 0.13, "light");
  for (const x of [-0.18, 0.2]) box(x, 3.23, -1.09, 0.04, 0.05, 1.32, "light");
  planter(-1.19, 3.15, -1.65, 0.42, 1.7);
  planter(1.26, 3.15, -2.25, 0.4, 0.5);
  planter(1.3, 3.15, -0.85, 0.32, 0.5);
  await checkpoint("observatory");
  // Pavilion 02: circular energy observatory around a drum recorder.
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
  // Wattch Core's measuring station. A drum recorder on a plinth keeps the raw
  // trace on paper (the paper and pen come with the build); a cable runs from
  // it through the daemon (with its two clients) to a meter post and dial.
  const drumY = 1.53,
    drumRadius = 0.36,
    paperHeight = 0.56;
  cylinder(ringX, 1.06, ringZ, 0.44, 0.22, "light");
  cylinder(ringX, 1.195, ringZ, 0.42, 0.05, "wood");
  cylinder(ringX, drumY, ringZ, drumRadius - 0.07, paperHeight, "dark");
  for (const y of [drumY - 0.295, drumY + 0.295])
    cylinder(ringX, y, ringZ, drumRadius + 0.02, 0.03, "dark");
  cylinder(ringX, drumY + 0.335, ringZ, 0.07, 0.05, "ochre", 0.05);
  // The pen arm pivots on a post beside the drum and rests on the paper.
  const penAngle = 2.0,
    penLength = 0.48,
    pivot = new T.Vector3(
      ringX + Math.sin(penAngle) * (drumRadius + penLength),
      drumY - 0.06,
      ringZ + Math.cos(penAngle) * (drumRadius + penLength),
    );
  box(pivot.x, (0.95 + pivot.y) / 2, pivot.z, 0.05, pivot.y - 0.95, 0.05, "dark");
  box(pivot.x, pivot.y, pivot.z, 0.07, 0.07, 0.07, "ochre");
  const daemon = new T.Vector3(-3.2, 1.03, 0.8);
  box(daemon.x, daemon.y, daemon.z, 0.26, 0.16, 0.2, "dark");
  box(daemon.x, 1.07, daemon.z + 0.102, 0.18, 0.025, 0.006, "glass", false);
  const dialCenter = new T.Vector3(-2.92, 1.52, 1.07);
  const cable = [
    new T.Vector3(ringX + 0.22, 0.97, ringZ + 0.37),
    new T.Vector3(daemon.x - 0.05, 0.97, daemon.z - 0.1),
    new T.Vector3(daemon.x + 0.13, 0.97, daemon.z + 0.02),
    new T.Vector3(-2.97, 0.9, 1.0),
    new T.Vector3(dialCenter.x, 0.9, dialCenter.z),
  ];
  for (let i = 0; i < cable.length - 1; i++)
    beam(cable[i], cable[i + 1], 0.016, "dark", false);
  box(dialCenter.x, 1.1, dialCenter.z, 0.05, 0.44, 0.05, "dark");
  add(
    new T.CylinderGeometry(0.2, 0.2, 0.035, 24).rotateX(Math.PI / 2).rotateY(0.75),
    dialCenter.x,
    dialCenter.y,
    dialCenter.z,
    "light",
  );
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI / 2 + (i / 6) * Math.PI;
    add(
      new T.BoxGeometry(0.012, i % 3 ? 0.035 : 0.055, 0.008)
        .rotateZ(-a)
        .translate(Math.sin(a) * 0.15, Math.cos(a) * 0.15, 0.021)
        .rotateY(0.75),
      dialCenter.x,
      dialCenter.y,
      dialCenter.z,
      "dark",
      [0, 0, 0],
      false,
    );
  }
  // Two client screens on low stands, wired to the daemon.
  for (const [x, z] of [
    [-3.52, 0.86],
    [-3.78, 0.7],
  ]) {
    box(x, 1.01, z, 0.025, 0.12, 0.025, "dark");
    add(new T.BoxGeometry(0.17, 0.11, 0.015), x, 1.12, z, "dark", [0, 0.75, 0]);
    add(
      new T.PlaneGeometry(0.14, 0.085),
      x + Math.sin(0.75) * 0.009,
      1.12,
      z + Math.cos(0.75) * 0.009,
      "glass",
      [0, 0.75, 0],
      false,
    );
    beam(
      new T.Vector3(daemon.x - 0.13, 0.97, daemon.z),
      new T.Vector3(x, 0.97, z),
      0.01,
      "dark",
      false,
    );
  }
  tree(-4.4, groundAt(-4.4, -1.9), -1.9, 0.8);
  planter(-5.0, groundAt(-5.0, 1.7), 1.7, 0.55, 1.1);
  steps(-3.55, 0.3, 2.24, 1.3, 4);
  await checkpoint("reading-room");
  // Pavilion 01: Whisperbook's reading room. The roof is a book lying open,
  // its pages lined with text and a ribbon left in; the side wall is a
  // bookcase, and the back wall a shelf of spines.
  box(3.33, 0.73, -0.75, 2.6, 0.28, 3.3, "trim");
  // The spine runs along x at z = -0.75; u is the distance from it.
  const spineY = 2.84,
    coverSlope = Math.tan(0.09),
    pageW = 1.69;
  const coverUnder = (u: number) => spineY + Math.abs(u) * coverSlope;
  const pageBase = (u: number) => coverUnder(u) + 0.07;
  const pageTop = (u: number) =>
    pageBase(u) + 0.04 + 0.2 * (1 - (1 - Math.min(u / 0.6, 1)) ** 2);
  // An outline in the (u, y) plane, run along x.
  function profile(
    pts: [number, number][],
    length: number,
    x: number,
    color: ColorName,
    outline = true,
  ) {
    const shape = new T.Shape(pts.map(([u, y]) => new T.Vector2(u, y)));
    add(
      new T.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false }).translate(
        0,
        0,
        -length / 2,
      ),
      x,
      0,
      -0.75,
      color,
      [0, -Math.PI / 2, 0],
      outline,
    );
  }
  const along = (from: number, to: number, f: (u: number) => number, n = 16) =>
    Array.from({ length: n + 1 }, (_, i): [number, number] => {
      const u = from + ((to - from) * i) / n;
      return [u, f(Math.abs(u))];
    });
  for (const side of [-1, 1]) {
    profile(
      [
        [0, spineY],
        [side * 1.75, coverUnder(1.75)],
        [side * 1.75, coverUnder(1.75) + 0.07],
        [0, spineY + 0.07],
      ],
      2.9,
      3.33,
      "terracotta",
    );
    profile(
      [...along(0, side * pageW, pageBase, 1), ...along(side * pageW, 0, pageTop)],
      2.76,
      3.33,
      "light",
    );
    // Lines of text on the flat of each page, ragged at the end. Each is also
    // a single pencil line, so the open book reads in the drawing stages.
    const segment = (a: T.Vector3, b: T.Vector3) =>
      edgeParts.push(
        new T.BufferGeometry().setAttribute(
          "position",
          new T.Float32BufferAttribute([...a.toArray(), ...b.toArray()], 3),
        ),
      );
    segment(
      new T.Vector3(1.95, pageTop(0.6), -0.75 + side * 0.6),
      new T.Vector3(4.71, pageTop(0.6), -0.75 + side * 0.6),
    );
    for (let i = 0; i < 21; i++) {
      if (vary(i, side + 20) < 0.12) continue;
      const len = 0.5 + vary(i, side + 21) * 0.3,
        u = 0.72 + len / 2,
        x = 2.13 + i * 0.12;
      segment(
        new T.Vector3(x, pageTop(0.72) + 0.007, -0.75 + side * 0.72),
        new T.Vector3(x, pageTop(0.72 + len) + 0.007, -0.75 + side * (0.72 + len)),
      );
      add(
        new T.BoxGeometry(0.024, 0.006, len),
        x,
        pageTop(u) + 0.004,
        -0.75 + side * u,
        "dark",
        [-side * 0.09, 0, 0],
        false,
      );
    }
  }
  add(
    new T.CylinderGeometry(0.08, 0.08, 2.9, 12).rotateZ(Math.PI / 2),
    3.33,
    spineY + 0.02,
    -0.75,
    "terracotta",
  );
  // A ribbon marks the place and hangs over the front edge.
  const ribbonEnd = pageTop(pageW);
  profile(
    [
      ...along(0.04, pageW, (u) => pageTop(u) + 0.002),
      [1.756, ribbonEnd + 0.002],
      [1.756, ribbonEnd + 0.01],
      ...along(pageW, 0.04, (u) => pageTop(u) + 0.01),
    ],
    0.06,
    3.87,
    "ochre",
    false,
  );
  box(3.87, ribbonEnd - 0.17, 1.01, 0.06, 0.36, 0.008, "ochre", false);
  // Pillars and the back wall rise to meet the covers.
  for (const x of [2.18, 4.48])
    for (const z of [-2.18, 0.62]) {
      const top = coverUnder(z + 0.75);
      box(x, (0.7 + top) / 2, z, 0.22, top - 0.7, 0.22, "stone");
    }
  const wallTop = coverUnder(1.45);
  box(3.33, (0.75 + wallTop) / 2, -2.2, 2.5, wallTop - 0.75, 0.17, "stone");
  for (const y of [0.92, 2.47]) box(3.33, y, -1.985, 2.34, 0.05, 0.26, "wood");
  for (let i = 0, x = 2.2; x < 4.38; i++) {
    const w = Math.min(0.11 + vary(i) * 0.1, 4.44 - x),
      h = 1.0 + vary(i, 1) * 0.47,
      d = 0.17 + vary(i, 2) * 0.07;
    box(x + w / 2, 0.945 + h / 2, -2.115 + d / 2, w, h, d, (["wood", "trim", "dark"] as const)[i % 3]);
    x += w + 0.012;
  }
  // The side wall is a bookcase, its spines turned to the garden.
  box(4.39, 1.78, -0.78, 0.04, 1.82, 2.54, "stone");
  for (const z of [-2.04, 0.48]) box(4.515, 1.78, z, 0.25, 1.82, 0.04, "wood");
  for (const y of [0.9, 1.79, 2.67]) box(4.515, y, -0.78, 0.25, 0.04, 2.5, "wood");
  for (const [shelf, y0] of [
    [0, 0.92],
    [1, 1.81],
  ]) {
    for (let i = 0, z = -2.02; z < 0.42; i++) {
      const k = i + shelf * 50;
      if (vary(k, 8) > 0.9) {
        z += 0.1;
        continue;
      }
      const w = Math.min(0.07 + vary(k, 5) * 0.08, 0.46 - z),
        h = 0.5 + vary(k, 6) * 0.3,
        d = 0.17 + vary(k, 7) * 0.05;
      box(
        4.62 - d / 2,
        y0 + h / 2,
        z + w / 2,
        d,
        h,
        w,
        (["wood", "trim", "dark", "terracotta", "light", "ochre"] as const)[i % 6],
      );
      z += w + 0.008;
    }
  }
  // The reading table stands at the open front, where it can be seen under the roof.
  box(3.25, 1.36, 0.05, 1.7, 0.1, 0.7, "wood");
  for (const x of [2.7, 3.8]) box(x, 1.03, 0.05, 0.07, 0.65, 0.55, "dark");
  // On the table: a phone on its stand between two small speakers, the two narrators.
  box(3.25, 1.43, -0.03, 0.14, 0.04, 0.11, "dark");
  add(new T.BoxGeometry(0.15, 0.28, 0.022), 3.25, 1.58, -0.07, "dark", [-0.22, 0, 0]);
  add(
    new T.PlaneGeometry(0.12, 0.24),
    3.25,
    1.58 + 0.013 * Math.sin(0.22),
    -0.07 + 0.013 * Math.cos(0.22),
    "glass",
    [-0.22, 0, 0],
    false,
  );
  for (const [x, c] of [
    [2.8, "ochre"],
    [3.7, "terracotta"],
  ] as const) {
    cylinder(x, 1.43, 0.02, 0.07, 0.04, "dark");
    add(new T.SphereGeometry(0.075, 14, 10).scale(1, 0.85, 1), x, 1.5, 0.02, c, [0, 0, 0], false);
  }
  steps(3.35, 0.34, 1.6, 1.8, 4);
  await checkpoint("greenhouse");
  // Bridges connect the plots; slatted surfaces catch moving light. A footbridge
  // runs from the observatory's plinth to the atelier's arcade, on two posts.
  box(-1.9, 0.65, -0.3, 0.8, 0.14, 0.6, "wood");
  for (let i = 0; i < 8; i++)
    box(-2.25 + i * 0.1, 0.74, -0.3, 0.065, 0.04, 0.58, "light");
  rail(-1.9, 0.74, -0.62, 0.8);
  rail(-1.9, 0.74, 0.02, 0.8);
  for (const z of [-0.55, -0.05]) box(-1.6, 0.37, z, 0.06, 0.42, 0.06, "dark");
  // From the atelier terrace, a walkway out onto the open book.
  box(1.82, 3.15, -1.6, 0.74, 0.12, 0.62, "wood");
  rail(1.82, 3.2, -1.93, 0.74);
  rail(1.82, 3.2, -1.28, 0.74);
  // A small greenhouse in the foreground.
  box(2.02, 0.585, 3.11, 1.75, 0.25, 1.8, "light");
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
  // A post office for seeds: one planter, a potting bench, and a postbox outside.
  planter(1.55, 0.72, 3.12, 0.43, 1.28);
  box(2.43, 1.1, 3.12, 0.46, 0.04, 1.3, "wood");
  for (const x of [2.24, 2.62])
    for (const z of [2.52, 3.72]) box(x, 0.895, z, 0.035, 0.37, 0.035, "dark");
  for (const z of [2.72, 3.12]) {
    box(2.43, 1.145, z, 0.34, 0.05, 0.34, "dark");
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        add(
          new T.ConeGeometry(0.02, 0.07, 4),
          2.33 + i * 0.1,
          1.2,
          z - 0.1 + j * 0.1,
          "grass",
          [0, vary(i * 3 + j, z) * 3, 0],
          false,
        );
  }
  cylinder(2.43, 1.195, 3.5, 0.065, 0.15, "trim");
  beam(new T.Vector3(2.48, 1.17, 3.5), new T.Vector3(2.62, 1.3, 3.5), 0.015, "trim");
  add(new T.TorusGeometry(0.05, 0.009, 4, 12, Math.PI), 2.4, 1.27, 3.5, "trim");
  (["light", "ochre", "terracotta", "light"] as const).forEach((c, k) =>
    add(new T.BoxGeometry(0.07, 0.1, 0.012), 2.28 + k * 0.1, 1.17, 3.72, c, [-0.12, 0, 0]),
  );
  box(3.05, 0.47, 3.95, 0.05, 0.62, 0.05, "dark");
  box(3.05, 0.88, 3.95, 0.26, 0.2, 0.2, "terracotta");
  add(new T.CylinderGeometry(0.1, 0.1, 0.26, 14).rotateZ(Math.PI / 2), 3.05, 0.98, 3.95, "terracotta");
  box(3.05, 0.93, 4.052, 0.13, 0.016, 0.006, "dark", false);
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
  await checkpoint("planting");
  // Banks, pocket gardens, stone paths, and warm little flowers.
  // Each planter sits wholly on one level, clear of the water and the buildings.
  const trees: [number, number, number][] = [
    [-4.45, 3.25, 1.15],
    [-2.95, 3.5, 0.75],
    [-1.66, 3.5, 1.0],
    [4.4, 1.72, 1.1],
    [4.62, 3.42, 0.83],
    [-1.08, 1.73, 0.9],
    [-3.5, -3.4, 0.83],
    [2.08, -3.53, 0.8],
  ];
  trees.forEach(([x, z, size]) => {
    const g = groundAt(x, z);
    planter(x, g, z, 0.75, 0.72);
    tree(x, g + 0.29, z, size);
  });
  for (const [x, z, w, d] of [
    [0.22, -3.85, 2.4, 0.37],
    [4.7, -2.65, 0.4, 0.45],
    [-5.1, -0.95, 0.42, 0.9],
    [1.2, 1.45, 0.6, 0.7],
  ])
    planter(x, groundAt(x, z), z, w, d);
  // Grass keeps off the canal, the floors and the steps.
  const bare = (x: number, z: number) =>
    Math.hypot(x - ringX, z - ringZ) < 1.6 ||
    (
      [
        [-0.85, 0.87, -0.3, 4.15],
        [-3.05, -0.6, 2.0, 3.25],
        [2.0, 4.7, -2.45, 0.95],
        [2.4, 4.3, 0.8, 1.75],
        [1.1, 2.95, 2.15, 4.05],
        [-4.25, -2.85, 1.45, 2.4],
      ] as const
    ).some(([x0, x1, z0, z1]) => x > x0 && x < x1 && z > z0 && z < z1);
  for (let i = 0; i < 90; i++) {
    const x = (random() - 0.5) * 10,
      z = (random() - 0.5) * 8;
    if (Math.abs(x) < 1.25 || Math.abs(z) < 0.8 || bare(x, z)) continue;
    const y = groundAt(x, z) + 0.1;
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
  // Small terrace bench and a lamp.
  box(-0.98, 0.92, 3.525, 0.3, 0.07, 0.75, "wood");
  for (const z of [3.25, 3.8]) box(-0.98, 0.68, z, 0.24, 0.48, 0.05, "dark");
  cylinder(4.36, 1.4, 0.75, 0.027, 1.6, "dark");
  cylinder(4.36, 2.21, 0.75, 0.13, 0.19, "flower");

  await checkpoint("geometry-batches");
  const solidMeshes: T.Mesh[] = [];
  const materials: {
    material: T.MeshStandardMaterial;
    flora: boolean;
    glass: boolean;
    key: ColorName;
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
    await checkpoint(`merge-${color}`);
    const geometry = mergeGeometries(geometries)!;
    geometries.forEach((g) => g.dispose());
    const mesh = new T.Mesh(geometry, material);
    mesh.castShadow = color !== "glass";
    mesh.receiveShadow = true;
    world.add(mesh);
    if (color !== "glass") solidMeshes.push(mesh);
    materials.push({ material, flora, glass: color === "glass", key: color });
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
  water(0.01, 0.495, 1.965, 1.25, 3.93);
  water(-1.7075, 0.495, 2.61, 2.185, 0.8);
  // The rill on the atelier terrace.
  water(0.01, 3.213, -1.09, 0.34, 1.32);
  const basin = new T.Mesh(new T.CircleGeometry(0.17, 20), waterMaterial);
  basin.rotation.x = -Math.PI / 2;
  basin.position.set(0.01, 3.34, -1.95);
  world.add(basin);
  // A broad, front-facing cascade falls from the atelier terrace into the
  // head of the canal; its centre line is the canal's.
  const waterfallLip = new T.Mesh(
    new T.BoxGeometry(1.18, 0.3, 0.78),
    new T.MeshStandardMaterial({
      color: colors.light,
      transparent: true,
      opacity: 0,
    }),
  );
  waterfallLip.position.set(0.01, 3.06, -0.04);
  world.add(waterfallLip);
  water(0.01, 3.216, -0.04, 0.96, 0.8);
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
    new T.PlaneGeometry(1.03, 2.72, 12, 36),
    waterfallMaterial,
  );
  waterfall.position.set(0.01, 1.855, 0.37);
  world.add(waterfall);
  const rippleMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uTime: timeUniform, uOpacity: waterfallOpacity },
    vertexShader:
      "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `uniform float uTime;uniform float uOpacity;varying vec2 vUv;void main(){float r=length((vUv-.5)*vec2(1.,1.35));float rings=smoothstep(.77,1.,sin(r*58.-uTime*3.));float fade=(1.-smoothstep(.23,.49,r));gl_FragColor=vec4(.86,.97,.92,(rings*.6+.12)*fade*uOpacity);}`,
  });
  const ripples = new T.Mesh(new T.PlaneGeometry(1.22, 1.1), rippleMaterial);
  ripples.rotation.x = -Math.PI / 2;
  ripples.position.set(0.01, 0.505, 0.85);
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
    vertexShader: `uniform float uTime;void main(){float t=fract(position.y+uTime*.5);vec3 p=vec3(.01+position.x*(1.+t*.25),.55+sin(t*3.14159)*.32,.39+position.z*.52+t*.25);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=2.4;}`,
    fragmentShader:
      "uniform float uOpacity;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;gl_FragColor=vec4(.9,.99,.95,(1.-d*2.)*uOpacity*.8);}",
  });
  world.add(new T.Points(sprayGeometry, sprayMaterial));
  await checkpoint("drones");
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
  await checkpoint("room-details");
  /* The rooms' moving parts. They fade in with the build. */
  // Whisperbook: rings of sound spread over the table while the widget reads.
  const ringGeometry = new T.TorusGeometry(1, 0.045, 3, 48);
  const ringMaterials = [0, 1, 2].map(
    () =>
      new T.MeshBasicMaterial({
        color: 0xfff0c4,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
  );
  const soundRings = ringMaterials.map((m) => {
    const ring = new T.Mesh(ringGeometry, m);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(3.25, 1.418, -0.02);
    world.add(ring);
    return ring;
  });
  const readingLight = new T.PointLight(0xffc27a, 0, 2.6, 1.6);
  readingLight.position.set(3.25, 2.1, 0.1);
  world.add(readingLight);
  // Wattch: the dial's needle follows the page's own render cost.
  const needleMaterial = new T.MeshStandardMaterial({
    color: 0x2f3b38,
    roughness: 0.6,
    transparent: true,
    opacity: 0,
  });
  const dial = new T.Group();
  dial.position.copy(dialCenter);
  dial.rotation.y = 0.75;
  world.add(dial);
  const needle = new T.Group();
  needle.position.z = 0.024;
  needle.add(
    new T.Mesh(
      new T.BoxGeometry(0.014, 0.15, 0.008).translate(0, 0.065, 0),
      needleMaterial,
    ),
  );
  dial.add(
    needle,
    new T.Mesh(
      new T.CylinderGeometry(0.022, 0.022, 0.02, 10)
        .rotateX(Math.PI / 2)
        .translate(0, 0, 0.025),
      needleMaterial,
    ),
  );
  let needleAngle = -Math.PI / 2;
  // ...and the drum recorder writes the same cost on paper as the drum turns.
  // The paper keeps most of a turn, so the last half-minute can be read back.
  const paperCanvas = document.createElement("canvas");
  paperCanvas.width = 1024;
  paperCanvas.height = 256;
  const paperContext = paperCanvas.getContext("2d")!;
  const paperTexture = new T.CanvasTexture(paperCanvas);
  paperTexture.colorSpace = T.SRGBColorSpace;
  paperTexture.anisotropy = 4;
  const paperMaterial = new T.MeshStandardMaterial({
    map: paperTexture,
    roughness: 0.9,
    transparent: true,
    opacity: 0,
  });
  const drum = new T.Group();
  drum.position.set(ringX, drumY, ringZ);
  world.add(drum);
  drum.add(
    new T.Mesh(
      new T.CylinderGeometry(drumRadius, drumRadius, paperHeight, 40, 1, true),
      paperMaterial,
    ),
    // The clip that holds the paper, so the drum reads as turning before any ink.
    new T.Mesh(
      new T.BoxGeometry(0.02, paperHeight, 0.012).translate(0, 0, drumRadius + 0.004),
      needleMaterial,
    ),
  );
  const pen = new T.Group();
  pen.position.copy(pivot);
  pen.rotation.y = penAngle - Math.PI / 2;
  pen.add(
    new T.Mesh(
      new T.BoxGeometry(penLength, 0.014, 0.014).translate(-penLength / 2, 0, 0),
      needleMaterial,
    ),
    new T.Mesh(
      new T.BoxGeometry(0.022, 0.045, 0.022).translate(-penLength + 0.011, 0, 0),
      needleMaterial,
    ),
  );
  world.add(pen);
  // Drum angle at each sample, and the pen's height above the drum's centre.
  const paperSamples: { angle: number; level: number }[] = [];
  let drumAngle = 0,
    penLevel = -0.2;
  function drawPaper() {
    const c = paperContext,
      w = paperCanvas.width,
      h = paperCanvas.height;
    c.fillStyle = "#f6efdf";
    c.fillRect(0, 0, w, h);
    c.strokeStyle = "rgba(206, 130, 101, 0.35)";
    c.lineWidth = 4;
    c.beginPath();
    for (let x = 0; x < w; x += 64) c.moveTo(x, 0), c.lineTo(x, h);
    for (let y = 32; y < h; y += 32) c.moveTo(0, y), c.lineTo(w, y);
    c.stroke();
    // The pen touches the paper at u = (penAngle - drumAngle) / 2π, so the line
    // wraps past the clip at u = 0.
    // Thick enough to read at garden scale, where the drum is a few dozen pixels.
    c.strokeStyle = "#2f3b38";
    c.lineWidth = 14;
    c.lineJoin = "round";
    c.beginPath();
    let lastX = 0,
      lastY = 0;
    paperSamples.forEach((s, i) => {
      const u = (penAngle - s.angle) / (Math.PI * 2);
      const x = (u - Math.floor(u)) * w,
        y = h / 2 - (s.level / paperHeight) * h;
      if (i === 0) c.moveTo(x, y);
      else if (x < lastX) {
        c.lineTo(x + w, y);
        c.moveTo(lastX - w, lastY);
        c.lineTo(x, y);
      } else c.lineTo(x, y);
      lastX = x;
      lastY = y;
    });
    c.stroke();
    paperTexture.needsUpdate = true;
  }
  drawPaper();
  // About: the drafting board carries a small drawing of the garden itself.
  const sheetCanvas = document.createElement("canvas");
  sheetCanvas.width = 512;
  sheetCanvas.height = 352;
  const sheetContext = sheetCanvas.getContext("2d")!;
  const sheetTexture = new T.CanvasTexture(sheetCanvas);
  sheetTexture.colorSpace = T.SRGBColorSpace;
  sheetTexture.anisotropy = 4;
  const sheetMaterial = new T.MeshBasicMaterial({
    map: sheetTexture,
    transparent: true,
    opacity: 0,
    toneMapped: false,
  });
  const sheet = new T.Mesh(new T.PlaneGeometry(0.74, 0.5), sheetMaterial);
  sheet.rotation.x = -Math.PI / 2 + 0.5;
  sheet.position.set(0.2, 5.95 + 0.02 * Math.cos(0.5), -1.2 + 0.02 * Math.sin(0.5));
  world.add(sheet);
  let sheetStage = -1;
  // Grey pencil at Sketch, blue at Blueprint, ink with a green wash once built.
  function drawSheet(step: number) {
    sheetStage = step;
    const c = sheetContext,
      w = sheetCanvas.width,
      h = sheetCanvas.height;
    // While drawn, the sheet has no paper of its own: just lines in the
    // scene's pencil and blueprint ink. It only becomes paper once built.
    const ink = ["#8fbcda", "#c0eaff", "#24313b"][step];
    const wash = step === 2 ? "rgba(118, 166, 92, 0.3)" : null;
    c.clearRect(0, 0, w, h);
    if (step === 2) {
      c.fillStyle = "#f7f3e8";
      c.fillRect(0, 0, w, h);
    }
    const s = 24;
    const p = (x: number, y: number, z: number): [number, number] => [
      256 + (x - z) * 0.866 * s,
      188 + (x + z) * 0.5 * s - y * s,
    ];
    c.strokeStyle = ink;
    c.lineJoin = "round";
    c.lineWidth = step === 0 ? 1.4 : 1.8;
    const poly = (pts: [number, number][], fill: string | null) => {
      c.beginPath();
      pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
      c.closePath();
      if (fill) {
        c.fillStyle = fill;
        c.fill();
      }
      c.stroke();
    };
    const prism = (x0: number, x1: number, z0: number, z1: number, y0: number, y1: number) => {
      poly([p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1), p(x0, y1, z1)], wash);
      poly([p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1)], wash);
      poly([p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1), p(x1, y1, z0)], wash);
    };
    const ellipse = (cx: number, cz: number, r: number, y: number) => {
      c.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const [x, yy] = p(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r);
        if (i) c.lineTo(x, yy);
        else c.moveTo(x, yy);
      }
      c.stroke();
    };
    prism(-5.4, 5.4, -4.35, 4.35, 0, 0.3);
    c.beginPath();
    for (const x of [-0.6, 0.62]) {
      c.moveTo(...p(x, 0.3, 0));
      c.lineTo(...p(x, 0.3, 3.93));
    }
    c.stroke();
    // The tower, the pavilion, the ring and the greenhouse.
    prism(-1.3, 1.3, -3.2, -0.5, 0.3, 2.9);
    prism(-1.3, 1.3, -3.2, -0.5, 2.9, 5.1);
    prism(2.05, 4.6, -2.5, 1.0, 0.3, 2.9);
    ellipse(-3.55, 0.2, 1.3, 0.6);
    ellipse(-3.55, 0.2, 1.3, 2.4);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = -3.55 + Math.cos(a) * 1.3,
        z = 0.2 + Math.sin(a) * 1.3;
      c.beginPath();
      c.moveTo(...p(x, 0.6, z));
      c.lineTo(...p(x, 2.4, z));
      c.stroke();
    }
    prism(1.15, 2.9, 2.2, 4.0, 0.3, 1.9);
    poly([p(1.15, 1.9, 4.0), p(2.02, 2.5, 4.0), p(2.9, 1.9, 4.0)], wash);
    c.beginPath();
    c.moveTo(...p(2.02, 2.5, 4.0));
    c.lineTo(...p(2.02, 2.5, 2.2));
    c.lineTo(...p(2.9, 1.9, 2.2));
    c.stroke();
    sheetTexture.needsUpdate = true;
  }
  // The path: one shared outline that moves to the highlighted level.
  const highlight = new T.Group();
  highlight.visible = false;
  world.add(highlight);
  const highlightLineMaterial = new T.LineBasicMaterial({
    color: 0x3b6b3a,
    transparent: true,
    opacity: 0,
    depthTest: false,
  });
  const highlightGlowMaterial = new T.MeshBasicMaterial({
    color: 0x3b6b3a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: T.AdditiveBlending,
  });
  const levelBox = new T.Group();
  levelBox.add(
    new T.LineSegments(
      new T.EdgesGeometry(new T.BoxGeometry(1, 1, 1)),
      highlightLineMaterial,
    ),
    new T.Mesh(new T.BoxGeometry(1, 1, 1), highlightGlowMaterial),
  );
  const ringBox = new T.Group();
  ringBox.add(
    new T.LineSegments(
      new T.EdgesGeometry(new T.CylinderGeometry(1, 1, 1, 48), 30),
      highlightLineMaterial,
    ),
    new T.Mesh(new T.CylinderGeometry(1, 1, 1, 48), highlightGlowMaterial),
  );
  highlight.add(levelBox, ringBox);
  highlight.traverse((o) => (o.renderOrder = 3));
  const pathLevels: [number, number, number, number, number, number][] = [
    [0, 1.66, -1.75, 2.75, 2.4, 2.75],
    [0.08, 4.05, -1.86, 3.0, 1.95, 3.0],
    [ringX, 1.6, ringZ, 2.9, 2.0, 2.9],
    [0.08, 5.85, -1.9, 2.95, 1.5, 2.85],
  ];
  function placeHighlight(step: number) {
    const [x, y, z, w, h, d] = pathLevels[step];
    highlight.position.set(x, y, z);
    levelBox.visible = step !== 2;
    ringBox.visible = step === 2;
    (step === 2 ? ringBox : levelBox).scale.set(
      step === 2 ? w / 2 : w,
      h,
      step === 2 ? d / 2 : d,
    );
  }
  const stageInk = {
    light: [0x7c8085, 0x2a5c9a, 0x8a6f4e, 0x3b6b3a],
    dark: [0x8eaac2, 0x8cc8f2, 0xd8c6a6, 0xa6d79b],
  };
  let pathStep: number | null = null,
    pathGlow = 0;
  // Contact: the postbox flag rises while a note is written; a letter drops in on send.
  const flagMaterial = new T.MeshStandardMaterial({
    color: 0xd9694f,
    roughness: 0.6,
    transparent: true,
    opacity: 0,
  });
  const flag = new T.Group();
  flag.position.set(3.185, 0.9, 3.9);
  flag.add(
    new T.Mesh(
      new T.BoxGeometry(0.012, 0.2, 0.012).translate(0, 0.1, 0),
      needleMaterial,
    ),
    new T.Mesh(
      new T.BoxGeometry(0.008, 0.06, 0.085).translate(0, 0.17, 0.042),
      flagMaterial,
    ),
  );
  world.add(flag);
  const letterMaterial = new T.MeshStandardMaterial({
    color: 0xfaf6ec,
    roughness: 0.8,
    transparent: true,
    opacity: 0,
  });
  const letter = new T.Mesh(new T.BoxGeometry(0.11, 0.075, 0.006), letterMaterial);
  letter.visible = false;
  world.add(letter);
  let postbox: "idle" | "writing" | "sent" = "idle",
    flagLift = 0,
    letterTime = -1;
  let narrating = false,
    narration = 0,
    ringTime = 0,
    built = 0;
  const approach = (value: number, goal: number, step: number) =>
    value < goal ? Math.min(goal, value + step) : Math.max(goal, value - step);
  function roomsSettling() {
    return (
      narration !== (narrating ? 1 : 0) ||
      pathGlow !== (pathStep === null ? 0 : 1) ||
      flagLift !== (postbox === "idle" ? 0 : 1) ||
      letterTime >= 0
    );
  }
  function updateRooms(dt: number, solid: number, drawn: number, blue: number) {
    built = solid;
    const still = paused || reduced;
    narration = approach(narration, narrating ? 1 : 0, reduced ? 1 : dt / 0.3);
    if (!still) ringTime += dt;
    soundRings.forEach((ring, k) => {
      const t = (ringTime * 0.55 + k / 3) % 1;
      const s = 0.06 + t * 0.5;
      ring.scale.set(s, s, 1);
      ringMaterials[k].opacity = (1 - t) * narration * solid * 0.9;
      ringMaterials[k].visible = ringMaterials[k].opacity > 0.01;
    });
    readingLight.intensity = narration * solid * 2.4;
    if (!still) {
      const goal = lerp(-Math.PI / 2, Math.PI / 2, Math.min(renderMs / 8, 1));
      needleAngle = lerp(needleAngle, goal, Math.min(dt * 3, 1));
    }
    needle.rotation.z = -needleAngle;
    needleMaterial.opacity = solid;
    needleMaterial.visible = solid > 0.01;
    paperMaterial.opacity = solid;
    paperMaterial.visible = solid > 0.01;
    if (!still) {
      // The square root spreads the usual few milliseconds over the paper.
      const goal = lerp(-0.2, 0.2, Math.sqrt(Math.min(renderMs / 8, 1)));
      penLevel = lerp(penLevel, goal, Math.min(dt * 3, 1));
      drumAngle -= dt * 0.22 * solid;
    }
    drum.rotation.y = drumAngle;
    pen.rotation.z = -Math.asin((penLevel + drumY - pivot.y) / penLength);
    // A sample for every 0.066 rad of paper (300 ms at full speed); ink older
    // than most of a turn is dropped, leaving clean paper ahead of the pen.
    const last = paperSamples[paperSamples.length - 1];
    if (!last || last.angle - drumAngle >= 0.066) {
      paperSamples.push({ angle: drumAngle, level: penLevel });
      while (paperSamples[0].angle - drumAngle > Math.PI * 1.7) paperSamples.shift();
      drawPaper();
    }
    const step = progress >= 0.6 ? 2 : progress >= 0.28 ? 1 : 0;
    if (step !== sheetStage) drawSheet(step);
    sheetMaterial.opacity = drawn;
    sheetMaterial.visible = drawn > 0.01;
    pathGlow = approach(pathGlow, pathStep === null ? 0 : 1, reduced ? 1 : dt / 0.25);
    // Lit from the blue drawing on, so Blueprint can walk up the tower.
    const lit = Math.max(solid, blue) * drawn;
    highlight.visible = pathGlow * lit > 0.01;
    const ink = (darkTheme ? stageInk.dark : stageInk.light)[
      progress >= 0.96 ? 3 : progress >= 0.6 ? 2 : step
    ];
    highlightLineMaterial.color.setHex(ink);
    highlightGlowMaterial.color.setHex(ink);
    highlightLineMaterial.opacity = pathGlow * lit * 0.95;
    highlightGlowMaterial.opacity = pathGlow * lit * 0.22;
    flagLift = approach(flagLift, postbox === "idle" ? 0 : 1, reduced ? 1 : dt / 0.35);
    flag.rotation.x = lerp(-Math.PI / 2, 0, 1 - (1 - flagLift) ** 2);
    flagMaterial.opacity = solid;
    flagMaterial.visible = solid > 0.01;
    if (letterTime >= 0) {
      letterTime = Math.min(1, letterTime + dt / 0.8);
      const t = letterTime;
      // Falls to the slot, then slides in through it.
      const fall = Math.min(t / 0.7, 1);
      const slide = Math.max(0, (t - 0.7) / 0.3);
      letter.position.set(3.05, lerp(1.45, 0.93, fall * fall), lerp(4.08, 3.98, slide));
      letter.rotation.set(0, 0, (1 - fall) * 0.5);
      letterMaterial.opacity = solid;
      letter.visible = true;
      if (letterTime >= 1) {
        letterTime = -1;
        letter.visible = false;
        postbox = "idle";
      }
    }
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
  await checkpoint("lighting");
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
  // Until the garden is built, a planted tree is only drawn: a bare stick
  // with a few forked branches, in the same ink as the rest of the drawing.
  const stickMaterial = new T.LineBasicMaterial({
    transparent: true,
    depthWrite: false,
  });
  const stickGeometry = new T.BufferGeometry().setFromPoints(
    [
      [0, 0, 0], [0, 0.62, 0],
      [0, 0.3, 0], [-0.14, 0.5, 0.03],
      [0, 0.36, 0], [0.15, 0.56, -0.04],
      [0, 0.44, 0], [0.04, 0.6, 0.13],
      [0, 0.48, 0], [-0.05, 0.62, -0.12],
    ].map(([x, y, z]) => new T.Vector3(x, y, z)),
  );
  function makeTree(local: T.Vector3) {
    const g = new T.Group();
    g.add(new T.LineSegments(stickGeometry, stickMaterial));
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

  await checkpoint("seasons");
  /* Seasons. Foliage colours per batch, how many flowers are out, what lies
     on the terraces, and what drifts down through the garden. */
  const seasonColors: Record<
    Season,
    Partial<Record<ColorName, number>> & { plants: number[] }
  > = {
    spring: {
      leaf: 0x8fb35a,
      leafLight: 0xf2d3de,
      leafDark: 0x5a8a55,
      grass: 0xa9c886,
      flower: 0xf2bfd2,
      coral: 0xf8ecf1,
      plants: [0x9cc062, 0xf0bfd0, 0xbfd77e, 0x5a8a55],
    },
    summer: {
      leaf: 0x6f9448,
      leafLight: 0x97b35e,
      leafDark: 0x3f6b46,
      grass: 0x93ad6e,
      flower: 0xf0b94a,
      coral: 0xd9694f,
      plants: [0x6f9448, 0x97b35e, 0x4e7551, 0x3f6b46],
    },
    autumn: {
      leaf: 0xc9772f,
      leafLight: 0xe0a640,
      leafDark: 0x5d6e3f,
      grass: 0xb5a46a,
      flower: 0xd88a3a,
      coral: 0xb8452f,
      plants: [0xd2812f, 0xe5ad45, 0xa8452b, 0x5d6e3f],
    },
    winter: {
      leaf: 0xdbe3e1,
      leafLight: 0xf2f5f4,
      leafDark: 0x4f6a5c,
      grass: 0xd2d9d1,
      flower: 0xe7eceb,
      coral: 0xe7eceb,
      plants: [0xe3eae8, 0x4f6a5c, 0xf2f5f4, 0x5d7767],
    },
  };
  const flowerAmount: Record<Season, number> = {
    spring: 1,
    summer: 1,
    autumn: 0.45,
    winter: 0,
  };
  const litterColors: Record<Season, number[]> = {
    spring: [0xf6cadb, 0xfbeef3, 0xf2b5ca],
    summer: [],
    autumn: [0xd2812f, 0xe5ad45, 0xa8452b, 0xc25f2a],
    winter: [0xf7f9fa, 0xeef3f5],
  };
  let season: Season = "summer";
  let litter: T.InstancedMesh | null = null;
  const litterMaterial = new T.MeshStandardMaterial({
    roughness: 1,
    transparent: true,
    opacity: 0,
    side: T.DoubleSide,
  });
  // Scatter fallen leaves (or petals, or snow) on the flat tops of the terraces.
  async function buildLitter() {
    const saved = { s: world.scale.clone(), r: world.rotation.y };
    world.scale.set(1, 1, 1);
    world.rotation.y = 0;
    world.updateMatrixWorld(true);
    const down = new T.Vector3(0, -1, 0);
    const spots: T.Vector3[] = [];
    for (let i = 0; i < 260 && spots.length < 170; i++) {
      if (i && i % 8 === 0) await yieldTask();
      raycaster.set(
        new T.Vector3((random() - 0.5) * 10.4, 12, (random() - 0.5) * 8.4),
        down,
      );
      const hit = raycaster.intersectObjects(solidMeshes, false)[0];
      if (hit?.face && hit.face.normal.y > 0.7) spots.push(hit.point.clone());
    }
    world.scale.copy(saved.s);
    world.rotation.y = saved.r;
    world.updateMatrixWorld(true);
    const mesh = new T.InstancedMesh(
      new T.CircleGeometry(0.05, 7).rotateX(-Math.PI / 2),
      litterMaterial,
      spots.length,
    );
    const m = new T.Matrix4();
    spots.forEach((p, i) => {
      temp.position.set(p.x, p.y + 0.012, p.z);
      temp.rotation.set(0, random() * Math.PI, 0);
      const k = 0.7 + random() * 0.8;
      temp.scale.set(k * 1.6, 1, k);
      temp.updateMatrix();
      m.copy(temp.matrix);
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, new T.Color(0xffffff));
    });
    mesh.receiveShadow = true;
    mesh.userData.total = spots.length;
    world.add(mesh);
    litter = mesh;
  }
  function paintLitter() {
    if (!litter) return;
    const colors = litterColors[season];
    const c = new T.Color();
    for (let i = 0; i < litter.count; i++) {
      c.setHex(colors.length ? colors[i % colors.length] : 0xffffff);
      litter.setColorAt(i, c);
    }
    litter.instanceColor!.needsUpdate = true;
    // Petals are sparser than autumn leaves; summer terraces stay swept.
    litter.count = Math.round(
      litter.userData.total *
        (season === "spring" ? 0.45 : season === "summer" ? 0 : 1),
    );
  }
  const fallGeometry = new T.BufferGeometry();
  const fallSeeds: number[] = [];
  for (let i = 0; i < 70; i++)
    fallSeeds.push((random() - 0.5) * 11, random(), (random() - 0.5) * 9);
  fallGeometry.setAttribute(
    "position",
    new T.Float32BufferAttribute(fallSeeds, 3),
  );
  const fallOpacity = { value: 0 },
    fallSize = { value: 12 },
    fallColor = { value: new T.Color(0xd2812f) };
  const fallMaterial = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTime: timeUniform,
      uOpacity: fallOpacity,
      uColor: fallColor,
      uSize: fallSize,
    },
    vertexShader: `uniform float uTime;uniform float uSize;varying float vSpin;void main(){vec3 p=position;float t=fract(p.y+uTime*.045);p.y=6.8-t*6.6;p.x+=sin(uTime*.6+position.z*2.)*.45+t*1.2;p.z+=cos(uTime*.5+position.x)*.3;vSpin=uTime*2.+position.x*3.;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=uSize;}`,
    fragmentShader:
      "uniform float uOpacity;uniform vec3 uColor;varying float vSpin;void main(){vec2 q=gl_PointCoord-.5;float c=cos(vSpin),s=sin(vSpin);q=mat2(c,-s,s,c)*q;q.x*=1.9*(.55+.45*abs(sin(vSpin*.7)));if(length(q)>.5)discard;gl_FragColor=vec4(uColor*(.85+.3*q.y),uOpacity);}",
  });
  world.add(new T.Points(fallGeometry, fallMaterial));

  await checkpoint("animals");
  /* Life on the terraces: bushes, and a few animals going about their day. */
  async function surfaceSpots(count: number, accept: (p: T.Vector3) => boolean) {
    const saved = { s: world.scale.clone(), r: world.rotation.y };
    world.scale.set(1, 1, 1);
    world.rotation.y = 0;
    world.updateMatrixWorld(true);
    const down = new T.Vector3(0, -1, 0);
    const spots: T.Vector3[] = [];
    for (let i = 0; i < count * 8 && spots.length < count; i++) {
      if (i && i % 8 === 0) await yieldTask();
      raycaster.set(
        new T.Vector3((random() - 0.5) * 10.4, 12, (random() - 0.5) * 8.4),
        down,
      );
      const hit = raycaster.intersectObjects(solidMeshes, false)[0];
      if (hit?.face && hit.face.normal.y > 0.7 && accept(hit.point))
        spots.push(world.worldToLocal(hit.point.clone()));
    }
    world.scale.copy(saved.s);
    world.rotation.y = saved.r;
    world.updateMatrixWorld(true);
    return spots;
  }
  const inWater = (p: T.Vector3) =>
    (p.x > -0.8 && p.x < 0.85 && p.z > -2.25 && p.z < 4.35) ||
    (p.x > -3.35 && p.x < 0.25 && p.z > 2.0 && p.z < 3.2);
  const onBridge = (p: T.Vector3) =>
    p.x > -2.4 && p.x < -1.4 && p.z > -0.75 && p.z < 0.15;
  const onGround = (p: T.Vector3) => p.y < 0.75 && !inWater(p) && !onBridge(p);
  // Foliage sways with the same breeze as the trees.
  function sway<M extends T.Material>(material: M): M {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = timeUniform;
      shader.uniforms.uLife = lifeUniform;
      shader.vertexShader =
        "uniform float uTime; uniform float uLife;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.x += sin(position.y*9. + uTime*1.1)*.012*uLife; transformed.z += cos(position.x*7. + uTime*.9)*.01*uLife;",
        );
    };
    return material;
  }
  const lifeMaterials: T.Material[] = [];
  const alive = <M extends T.Material>(m: M) => {
    m.transparent = true;
    m.opacity = 0;
    lifeMaterials.push(m);
    return m;
  };
  const mat = (color: number, roughness = 0.9) =>
    alive(new T.MeshStandardMaterial({ color, roughness }));
  function shape(
    g: T.BufferGeometry,
    x: number,
    y: number,
    z: number,
    sx = 1,
    sy = 1,
    sz = 1,
  ) {
    g.scale(sx, sy, sz).translate(x, y, z);
    return g.index ? g.toNonIndexed() : g;
  }

  // Bushes: a few clumps each, with flowers, berries, or frost by season.
  const bushMaterials = [0x6f9448, 0x3f6b46].map((c) =>
    sway(mat(c, 0.95)),
  );
  const berryMaterial = sway(mat(0xd9694f, 0.6));
  const bushGeometry = mergeGeometries([
    shape(new T.IcosahedronGeometry(0.17, 0), 0, 0.13, 0),
    shape(new T.IcosahedronGeometry(0.13, 0), 0.14, 0.09, 0.05),
    shape(new T.IcosahedronGeometry(0.12, 0), -0.13, 0.08, -0.04),
    shape(new T.IcosahedronGeometry(0.11, 0), 0.03, 0.22, 0.08),
  ])!;
  const berryGeometry = mergeGeometries(
    [
      [0.08, 0.24, 0.12],
      [-0.1, 0.17, 0.08],
      [0.17, 0.15, 0.1],
      [0.0, 0.27, -0.07],
      [-0.16, 0.1, 0.06],
      [0.12, 0.07, -0.12],
    ].map(([x, y, z]) => shape(new T.IcosahedronGeometry(0.03, 0), x, y, z)),
  )!;
  const bushSpots = await surfaceSpots(48, onGround);
  const bushMeshes = bushMaterials.map(
    (m) => new T.InstancedMesh(bushGeometry, m, bushSpots.length),
  );
  const berries = new T.InstancedMesh(
    berryGeometry,
    berryMaterial,
    bushSpots.length,
  );
  const counts = [0, 0];
  bushSpots.forEach((p, i) => {
    temp.position.copy(p);
    temp.rotation.set(0, random() * Math.PI * 2, 0);
    temp.scale.setScalar(0.65 + random() * 0.6);
    temp.updateMatrix();
    const k = i % 2;
    bushMeshes[k].setMatrixAt(counts[k]++, temp.matrix);
    berries.setMatrixAt(i, temp.matrix);
  });
  bushMeshes.forEach((m, k) => {
    m.count = counts[k];
    m.castShadow = true;
    m.receiveShadow = true;
    world.add(m);
  });
  world.add(berries);

  // Birds: a loose flock circling high over the garden.
  const birdMaterial = alive(
    new T.MeshBasicMaterial({ color: 0x3a4150, side: T.DoubleSide }),
  );
  const wingGeometry = new T.BufferGeometry().setFromPoints([
    new T.Vector3(0, 0, 0.05),
    new T.Vector3(0, 0, -0.05),
    new T.Vector3(0.26, 0.02, -0.03),
  ]);
  wingGeometry.computeVertexNormals();
  const birds = Array.from({ length: 7 }, (_, i) => {
    const bird = new T.Group();
    const body = new T.Mesh(
      new T.ConeGeometry(0.035, 0.18, 5).rotateX(Math.PI / 2),
      birdMaterial,
    );
    const left = new T.Mesh(wingGeometry, birdMaterial);
    const right = new T.Mesh(wingGeometry, birdMaterial);
    right.scale.x = -1;
    bird.add(body, left, right);
    bird.userData = {
      phase: i * 0.45 + random() * 0.3,
      radius: 5.2 + random() * 1.4,
      height: 7 + random() * 1.2,
      flap: 8 + random() * 3,
    };
    world.add(bird);
    return bird;
  });

  // Ducks paddle up and down the canal.
  const duckBody = mat(0xf3eee2, 0.8),
    duckHead = mat(0x2f5a45, 0.5),
    duckBeak = mat(0xe39a3b, 0.6);
  const ducks = Array.from({ length: 3 }, (_, i) => {
    const duck = new T.Group();
    const size = i === 2 ? 1 : 1.6;
    const body = new T.Mesh(
      new T.SphereGeometry(0.1, 10, 7).scale(0.85, 0.6, 1.35),
      duckBody,
    );
    const head = new T.Mesh(new T.SphereGeometry(0.055, 9, 7), duckHead);
    head.position.set(0, 0.1, 0.11);
    const beak = new T.Mesh(new T.BoxGeometry(0.035, 0.02, 0.05), duckBeak);
    beak.position.set(0, 0.095, 0.17);
    const tail = new T.Mesh(new T.ConeGeometry(0.035, 0.08, 4), duckBody);
    tail.position.set(0, 0.05, -0.14);
    tail.rotation.x = -1.1;
    duck.add(body, head, beak, tail);
    [body, head].forEach((m) => (m.castShadow = true));
    // Drawn after the transparent canal so the water doesn't cover them.
    duck.children.forEach((m) => (m.renderOrder = 2));
    duck.scale.setScalar(size);
    duck.userData = { phase: i * 1.7, speed: 0.11 + i * 0.015 };
    world.add(duck);
    return duck;
  });

  // Rabbits hop between spots on the same terrace, then sit for a while.
  const rabbitFur = mat(0x9c7a5a),
    rabbitTail = mat(0xf4f1ea);
  const groundSpots = await surfaceSpots(70, onGround);
  const rabbits = Array.from({ length: 3 }, () => {
    const rabbit = new T.Group();
    const body = new T.Mesh(
      new T.SphereGeometry(0.1, 10, 8).scale(0.8, 0.8, 1.1),
      rabbitFur,
    );
    body.position.y = 0.08;
    const head = new T.Mesh(new T.SphereGeometry(0.06, 9, 7), rabbitFur);
    head.position.set(0, 0.17, 0.09);
    const ears = [-1, 1].map((s) => {
      const ear = new T.Mesh(
        new T.CapsuleGeometry(0.014, 0.08, 2, 6),
        rabbitFur,
      );
      ear.position.set(s * 0.025, 0.27, 0.07);
      ear.rotation.set(-0.25, 0, s * 0.18);
      return ear;
    });
    const tail = new T.Mesh(new T.SphereGeometry(0.03, 7, 5), rabbitTail);
    tail.position.set(0, 0.1, -0.11);
    rabbit.add(body, head, ...ears, tail);
    rabbit.scale.setScalar(1.35);
    body.castShadow = true;
    const start = groundSpots[Math.floor(random() * groundSpots.length)];
    rabbit.position.copy(start);
    rabbit.userData = {
      from: start.clone(),
      to: start.clone(),
      t: 1,
      rest: random() * 3,
    };
    world.add(rabbit);
    return rabbit;
  });
  function nextHop(r: T.Group) {
    const here = r.userData.to as T.Vector3;
    const options = groundSpots.filter(
      (p) =>
        Math.abs(p.y - here.y) < 0.03 &&
        p.distanceTo(here) > 0.4 &&
        p.distanceTo(here) < 1.8,
    );
    if (!options.length) return;
    r.userData.from = here.clone();
    r.userData.to = options[Math.floor(random() * options.length)].clone();
    r.userData.t = 0;
  }

  // A ginger cat asleep on the terrace bench.
  const catFur = mat(0xd38b4c, 0.85);
  const cat = new T.Group();
  const catBody = new T.Mesh(
    new T.SphereGeometry(0.1, 12, 8).scale(1.35, 0.7, 1),
    catFur,
  );
  const catHead = new T.Mesh(new T.SphereGeometry(0.06, 10, 8), catFur);
  catHead.position.set(0.13, 0.02, 0.03);
  const catEars = [-1, 1].map((s) => {
    const ear = new T.Mesh(new T.ConeGeometry(0.022, 0.05, 4), catFur);
    ear.position.set(0.14, 0.075, 0.03 + s * 0.03);
    return ear;
  });
  const catTail = new T.Mesh(
    new T.CapsuleGeometry(0.018, 0.16, 2, 6).rotateZ(Math.PI / 2),
    catFur,
  );
  catTail.position.set(-0.12, -0.03, 0.08);
  catTail.rotation.y = 0.6;
  cat.add(catBody, catHead, ...catEars, catTail);
  catBody.castShadow = true;
  cat.position.set(-0.98, 1.02, 3.48);
  cat.rotation.y = -Math.PI / 2 + 0.3;
  world.add(cat);

  const rabbitColors: Record<Season, number> = {
    spring: 0x9c7a5a,
    summer: 0xa07c58,
    autumn: 0x8e6e50,
    winter: 0xeef1f3,
  };
  function updateLife(dt: number, life: number) {
    const day = 1 - night;
    const dry = 1 - Math.min(weatherPrecip * 1.4, 1);
    lifeMaterials.forEach((m) => (m.opacity = life));
    berryMaterial.opacity = life * flowerAmount[season] * (season === "autumn" ? 2 : 1);
    birdMaterial.opacity =
      life * day * dry * (season === "winter" ? 0.6 : 1) * (1 - fogAmount * 0.7);
    rabbitFur.opacity = rabbitTail.opacity = life * day * dry;
    lifeMaterials.forEach((m) => (m.visible = m.opacity > 0.01));
    const t = elapsed;
    birds.forEach((b, i) => {
      const u = b.userData;
      if (season === "winter" && i > 3) b.visible = false;
      else b.visible = birdMaterial.visible;
      const a = t * 0.16 + u.phase;
      b.position.set(
        Math.cos(a) * u.radius,
        u.height + Math.sin(t * 0.7 + i) * 0.25,
        Math.sin(a) * u.radius * 0.8,
      );
      b.rotation.set(0, -a, Math.sin(a) * 0.15);
      const flap = Math.sin(t * u.flap + i) * 0.55;
      b.children[1].rotation.z = flap;
      b.children[2].rotation.z = -flap;
    });
    ducks.forEach((d, i) => {
      const u = d.userData;
      // Ducks keep still at night.
      const s = t * u.speed * (0.25 + 0.75 * day);
      const z = 2.3 + Math.sin(s + u.phase) * 1.4;
      const dz = Math.cos(s + u.phase);
      const x = 0.01 + Math.sin(s * 2.3 + i) * 0.28 + (i - 1) * 0.12;
      d.position.set(x, 0.505 + Math.sin(t * 2.2 + i) * 0.008, z);
      d.rotation.y = dz >= 0 ? 0 : Math.PI;
      d.rotation.z = Math.sin(t * 1.7 + i) * 0.05;
    });
    rabbits.forEach((r) => {
      const u = r.userData;
      if (u.t >= 1) {
        u.rest -= dt;
        if (u.rest <= 0) {
          nextHop(r);
          u.rest = 1.5 + random() * 3.5;
        }
        // An ear twitch while sitting.
        r.children[2].rotation.x = -0.25 + Math.max(0, Math.sin(t * 3 + u.rest)) * 0.25;
        return;
      }
      const from = u.from as T.Vector3,
        to = u.to as T.Vector3;
      const distance = from.distanceTo(to);
      const hops = Math.max(1, Math.round(distance / 0.32));
      u.t = Math.min(1, u.t + dt / (hops * 0.36));
      const k = u.t * hops;
      const frac = k - Math.floor(k);
      r.position.lerpVectors(from, to, u.t);
      r.position.y = from.y + Math.sin(Math.PI * (u.t >= 1 ? 1 : frac)) * 0.13;
      r.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
    });
    // The cat breathes and its tail drifts.
    catBody.scale.y = 1 + Math.sin(t * 1.6) * 0.04;
    catTail.rotation.y = 0.6 + Math.sin(t * 0.7) * 0.35;
  }

  function applySeason() {
    const palette = seasonColors[season];
    materials.forEach(({ material, key }) => {
      const hex = palette[key];
      if (hex !== undefined) material.color.setHex(hex);
    });
    plantLeaves.forEach((m, i) => m.color.setHex(palette.plants[i]));
    bushMaterials[0].color.setHex(palette.leaf!);
    bushMaterials[1].color.setHex(palette.leafDark!);
    berryMaterial.color.setHex(season === "autumn" ? 0xb8302a : palette.flower!);
    rabbitFur.color.setHex(rabbitColors[season]);
    // Litter positions are prepared in yielding batches before the renderer starts.
    paintLitter();
    fallColor.value.setHex(season === "spring" ? 0xf4c3d5 : 0xd2812f);
    dirty = true;
  }
  await checkpoint("renderer-state");
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
  // The band the garden is framed in: top and bottom, as fractions.
  const view = new T.Vector2(0, 1),
    viewGoal = new T.Vector2(0, 1);
  let renderMs = 0;
  /* What drawing costs the visitor's device: main-thread time for every frame
     drawn (animation updates included) and, where the browser exposes GPU
     timer queries, the GPU time of the render itself. Not every frame gets a
     query, so the GPU total scales the measured mean to all frames. */
  let workMs = 0,
    framesDrawn = 0,
    gpuSum = 0,
    gpuSamples = 0,
    gpuFrameMs = 0;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const gpuTimer = gl.getExtension("EXT_disjoint_timer_query_webgl2");
  const gpuPending: WebGLQuery[] = [];
  function readGpuTimers() {
    if (!gpuTimer) return;
    // A disjoint event (power state, context switch) spoils every query in flight.
    const disjoint = gl.getParameter(gpuTimer.GPU_DISJOINT_EXT);
    while (gpuPending.length) {
      const query = gpuPending[0];
      if (!disjoint && !gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) break;
      gpuPending.shift();
      if (!disjoint) {
        const ms = gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6;
        gpuSum += ms;
        gpuSamples++;
        gpuFrameMs = lerp(gpuFrameMs || ms, ms, 0.1);
      }
      gl.deleteQuery(query);
    }
  }
  let shadowStrength = 1;
  let fogAmount = 0,
    fogTarget = 0;
  const mist = new T.Fog(0xf1f2ee, 30, 60);
  let weatherCloud = 0,
    weatherPrecip = 0;
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
    about: new T.Vector3(0.15, 6.2, -1.15),
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
    const overcast = weatherCloud * 0.6 + weatherPrecip * 0.25;
    shadowStrength =
      (0.35 + 0.65 * height) * (1 - night * 0.7) * (1 - overcast * 0.9);
    sunColor.setHex(0xff9d5c).lerp(new T.Color(0xffefd4), smooth(0, 0.55, height));
    sunColor.lerp(new T.Color(0x9fb4e8), night);
    sun.color.copy(sunColor);
    sun.intensity =
      (0.9 + 2.4 * height) * (1 - night * 0.82) * (1 - overcast * 0.7);
    sunColor.lerp(new T.Color(0xdfe5ec), overcast * 0.6);
    sun.color.copy(sunColor);
    sky.intensity = (1.4 + 1.1 * height) * (1 - night * 0.55);
    sky.color.setHex(0xf7fbff).lerp(new T.Color(0x6d84bd), night);
    sky.groundColor.setHex(0x839073).lerp(new T.Color(0x2b3550), night);
    fillLight.intensity = 0.7 * (1 - night * 0.6);
    dirty = true;
  }
  applyLight();
  const onLost = (event: Event) => {
    event.preventDefault();
    // Queries die with the context.
    gpuPending.length = 0;
    container.dispatchEvent(new Event("garden-context-lost"));
    hotspots.forEach((h) => {
      h.style.visibility = "hidden";
      h.tabIndex = -1;
    });
  };
  const onRestored = () => {
    container.dispatchEvent(new Event("garden-context-restored"));
    hotspots.forEach((h) => (h.style.visibility = ""));
  };
  renderer.domElement.addEventListener("webglcontextlost", onLost);
  renderer.domElement.addEventListener("webglcontextrestored", onRestored);
  let firstRender = true;
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
      drawIn = reduced || paused ? 1 : Math.min(1, drawIn + dt / 3.2);
      dirty = true;
    }
    const growing = planted.some((p) => p.age < 1);
    const changed =
      Math.abs(targetProgress - progress) > 0.0001 ||
      Math.abs(rotationTarget - rotation) > 0.0001 ||
      Math.abs(focusGoal - focusAmount) > 0.0005 ||
      Math.abs(fogTarget - fogAmount) > 0.002 ||
      shift.distanceTo(shiftGoal) > 0.0005 ||
      view.distanceTo(viewGoal) > 0.0005 ||
      roomsSettling() ||
      growing;
    if ((paused || progress < 0.5) && !changed && !dirty) return;
    dirty = false;
    const work = performance.now();
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
    view.lerp(viewGoal, ease);
    focusPoint.lerp(focusTarget, ease);
    const drawn = drawIn * drawIn * (3 - 2 * drawIn);
    const count = outlines.geometry.attributes.position.count;
    outlines.geometry.setDrawRange(0, Math.floor((count * drawn) / 2) * 2);
    timeUniform.value = elapsed;
    // The story holds at 0, 0.33, 0.66 and 1. Each stage is complete by its
    // hold: blue lines by 0.3, stone and water by 0.64, and only then life.
    const life = smooth(0.69, 0.96, progress);
    lifeUniform.value = paused ? 0 : life;
    const blueprint = smooth(0.07, 0.3, progress),
      solid = smooth(0.35, 0.6, progress);
    world.scale.setScalar(lerp(0.77, 1, smooth(0, 0.62, progress)));
    world.scale.y *= lerp(0.72, 1, smooth(0.1, 0.55, progress));
    world.rotation.y = rotation;
    materials.forEach(({ material, flora, glass, key }) => {
      const bloom =
        key === "flower" || key === "coral" ? flowerAmount[season] : 1;
      fade(material, flora ? life * bloom : solid * (glass ? 0.38 : 1));
    });
    fade(plantMaterial, solid);
    plantLeaves.forEach((m) => fade(m, life));
    lineMaterial.color
      .copy(pencilColor)
      .lerp(blueColor, blueprint)
      .lerp(finalColor, solid);
    lineMaterial.opacity =
      lerp(darkTheme ? 0.38 : 0.21, darkTheme ? 0.85 : 0.6, blueprint) *
      (1 - solid * 0.92);
    stickMaterial.color.copy(lineMaterial.color);
    stickMaterial.opacity = lineMaterial.opacity * (1 - solid);
    stickMaterial.visible = stickMaterial.opacity > 0.003;
    ghostMaterial.opacity = 0.055 * (1 - blueprint);
    guideMaterial.opacity =
      smooth(0.06, 0.3, progress) * (1 - smooth(0.45, 0.62, progress)) * 0.38;
    shadowMaterial.opacity = solid * 0.15 * shadowStrength;
    waterfallLip.material.opacity = solid;
    waterMaterial.uniforms.uOpacity.value = smooth(0.46, 0.63, progress);
    const glow = night * solid;
    lanternLights.forEach((l) => (l.intensity = glow * 2.6));
    glowMaterial.opacity = glow * 0.95;
    glowMaterial.visible = glow > 0.01;
    fireflyOpacity.value = night * life;
    butterflyMaterial.opacity =
      life * (season === "summer" || season === "spring" ? 1 : 0);
    litterMaterial.opacity = life;
    litterMaterial.visible = life > 0.01;
    fallOpacity.value =
      life *
      (season === "autumn" ? 0.95 : season === "spring" ? 0.85 : 0) *
      (1 - fogAmount * 0.65);
    fogAmount = lerp(fogAmount, fogTarget, reduced ? 1 : Math.min(dt * 1.5, 1));
    if (fogAmount > 0.002) {
      scene.fog = mist;
      mist.near = lerp(30, 9.5, fogAmount);
      mist.far = lerp(60, 27, fogAmount);
    } else scene.fog = null;
    waterfallOpacity.value = smooth(0.52, 0.64, progress);
    droneBodyMaterial.opacity = life;
    droneTrimMaterial.opacity = life;
    rotorMaterial.opacity = life * 0.21;
    droneLineMaterial.opacity =
      smooth(0.15, 0.3, progress) * (1 - life) * 0.46;
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
    updateRooms(dt, solid, drawn, blueprint);
    updateLife(paused || reduced ? 0 : dt, life);
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
    // The garden is fitted to its frame, as if the frame were the whole
    // view; the rest of the view shows more of the same scene around it.
    const band = Math.max(0.05, view.y - view.x);
    const aspect = width / (height * band);
    const stackedMobile = innerWidth <= 760 && innerHeight > 520;
    const span = stackedMobile
      ? Math.max(12.8, 15.2 / aspect)
      : aspect < 0.9
        ? 15.3 / aspect
        : 15.6;
    const half = span / 2 / (1 + focusAmount * 0.4);
    const full = half / band;
    camera.left = -half * aspect - shift.x * half * aspect * 2;
    camera.right = half * aspect - shift.x * half * aspect * 2;
    camera.top = (view.x + view.y) * full - shift.y * half * 2;
    camera.bottom = camera.top - 2 * full;
    // Leaves and petals keep the same size relative to the garden.
    fallSize.value = (height / (2 * full)) * 0.2 * renderer.getPixelRatio();
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
    readGpuTimers();
    const query = gpuTimer && gpuPending.length < 4 ? gl.createQuery() : null;
    if (query) gl.beginQuery(gpuTimer!.TIME_ELAPSED_EXT, query);
    const before = performance.now();
    renderer.render(scene, camera);
    if (query) {
      gl.endQuery(gpuTimer!.TIME_ELAPSED_EXT);
      gpuPending.push(query);
    }
    if (firstRender) { firstRender = false; performance.mark("notebook:first-render"); performance.measure("notebook:scene-to-first-render", "notebook:scene-construction:start", "notebook:first-render"); }
    renderMs = lerp(renderMs || 1, performance.now() - before, 0.1);
    container.dataset.progress = progress.toFixed(3);
    container.dataset.drawCalls = String(renderer.info.render.calls);
    container.dataset.triangles = String(renderer.info.render.triangles);
    container.dataset.waterfall = waterfallOpacity.value.toFixed(2);
    container.dataset.drones = String(drones.length);
    container.dataset.animationTime = elapsed.toFixed(3);
    // 0 is the needle hard left (0 ms), 1 hard right (8 ms or more).
    container.dataset.meter = ((needleAngle + Math.PI / 2) / Math.PI).toFixed(3);
    container.dataset.narrating = narration.toFixed(2);
    container.dataset.path = pathStep === null ? "none" : String(pathStep);
    container.dataset.postbox = postbox;
    container.dataset.flag = flagLift.toFixed(2);
    workMs += performance.now() - work;
    framesDrawn++;
  }
  await checkpoint("ground-litter");
  await buildLitter();
  batchDone();
  constructionDone();
  frame = requestAnimationFrame(render);
  /* Most of the garden's materials are first drawn at Build and Bloom, and
     three compiles a shader program on first draw, blocking the page while
     the driver works. Compile them all in the background while the visitor
     is still on the sketch: every material as it is now, the opaque variants
     the built terraces switch to, and the shadow pass. */
  async function warmShaders() {
    if (disposed) return;
    const done = phase("shader-warmup");
    const pending = [renderer.compileAsync(scene, camera)];
    await yieldTask();
    if (disposed) return;
    const flipping = materials
      .map(({ material }) => material)
      .filter((m) => m.transparent && !m.side);
    flipping.forEach((m) => (m.transparent = false));
    pending.push(renderer.compileAsync(scene, camera));
    flipping.forEach((m) => {
      m.transparent = true;
      m.needsUpdate = true;
    });
    await yieldTask();
    if (disposed) return;
    // Prepare the fog variant too, without changing the visible weather.
    const visibleFog = scene.fog;
    scene.fog = mist;
    pending.push(renderer.compileAsync(scene, camera));
    scene.fog = visibleFog;
    await yieldTask();
    if (disposed) return;
    // The shadow pass draws casters with one shared depth material, back
    // faces, no fog, into a render target (so without tone mapping).
    const depth = new T.MeshDepthMaterial({
      depthPacking: T.RGBADepthPacking,
      side: T.BackSide,
    });
    const box = new T.BoxGeometry();
    const probe = new T.Group();
    probe.add(new T.Mesh(box, depth), new T.InstancedMesh(box, depth, 1));
    const target = new T.WebGLRenderTarget(1, 1);
    const fog = scene.fog;
    scene.fog = null;
    renderer.setRenderTarget(target);
    pending.push(renderer.compileAsync(probe, camera, scene));
    renderer.setRenderTarget(null);
    scene.fog = fog;
    await Promise.all(pending);
    done();
    target.dispose();
    box.dispose();
    // The probe's depth material is kept: disposing it would release the
    // very programs the shadow pass is about to reuse.
    // A program's first use checks it for errors with blocking driver
    // queries. Do that now too, one program per idle moment, so the sketch
    // keeps drawing smoothly.
    const programs = [...(renderer.info.programs ?? [])];
    const next = () => {
      const program = programs.pop();
      if (disposed) return;
      if (!program) { performance.mark("notebook:shader-first-use-complete"); return; }
      const checked = phase("shader-first-use");
      program.getUniforms();
      checked();
      idle(next, { timeout: 1000 });
    };
    next();
  }
  const idle = window.requestIdleCallback ?? ((f: () => void) => setTimeout(f, 200));
  // Compiling runs in parallel in the driver, so start right after the first frame.
  requestAnimationFrame(() => warmShaders().catch(error => console.warn("Garden shader warm-up failed.", error)));
  return {
    setNarrating(on) {
      narrating = on;
      dirty = true;
    },
    highlightPath(step) {
      if (step !== null) placeHighlight(step);
      pathStep = step;
      dirty = true;
    },
    setPostbox(state) {
      if (state === "sent") {
        // No drop without motion, or before the postbox is built.
        if (paused || reduced || built < 0.5) state = "idle";
        else letterTime = 0;
      }
      // A letter already on its way settles the flag itself.
      if (state === "idle" && letterTime >= 0) return;
      postbox = state;
      dirty = true;
    },
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
      const hit = raycaster.intersectObjects(solidMeshes, false)[0];
      if (!hit?.face || hit.face.normal.y < 0.7) return -1;
      return makeTree(world.worldToLocal(hit.point.clone()));
    },
    setSeason(value) {
      season = value;
      applySeason();
    },
    setFog(amount, color) {
      fogTarget = amount;
      mist.color.setHex(color);
      dirty = true;
    },
    setWeather(cloud, precip) {
      weatherCloud = cloud;
      weatherPrecip = precip;
      applyLight();
    },
    setHour(value) {
      hour = value;
      applyLight();
    },
    frame(top, bottom) {
      viewGoal.set(top, bottom);
      dirty = true;
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
        gpuFrameMs: gpuTimer && gpuSamples ? gpuFrameMs : null,
        cpuMs: workMs,
        gpuMs: gpuTimer ? (gpuSamples ? (gpuSum / gpuSamples) * framesDrawn : 0) : null,
        frames: framesDrawn,
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
      gpuPending.forEach((q) => gl.deleteQuery(q));
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
      paperTexture.dispose();
      sheetTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
