import { moonPhase, presets, type Weather } from "./weather";

/* The sky behind (and, for rain and snow, in front of) the garden. Like the
   garden it is drawn first in pencil, then in blueprint ink, then filled in:
   `growth` uses the same 0–1 scale as the scene. */

export interface Sky {
  /** Eases toward `g` at the garden's rate, or jumps there when `immediate`. */
  setGrowth: (g: number, immediate?: boolean) => void;
  setHour: (h: number) => void;
  setWeather: (w: Weather) => void;
  setMotion: (paused: boolean) => void;
  /** Re-read colours from CSS after a theme or stage change. */
  refresh: (dark: boolean) => void;
  /** Main-thread milliseconds spent drawing the sky, and the frames drawn. */
  stats: () => { cpuMs: number; frames: number };
  dispose: () => void;
}

type RGB = [number, number, number];
const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b);
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const rgba = (c: RGB, a = 1) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;
function hex(value: string, fallback: RGB): RGB {
  const m = value.trim().match(/^#([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
let seed = 11;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

interface Cloud {
  threshold: number;
  depth: number;
  x: number;
  y: number;
  alpha: number;
  puffs: { x: number; y: number; r: number }[];
  fill?: HTMLCanvasElement;
  line?: HTMLCanvasElement;
  tintFill?: HTMLCanvasElement;
  tintShade?: HTMLCanvasElement;
  tintLine?: HTMLCanvasElement;
  keys: string[];
}

const palettes = {
  light: {
    day: [176, 207, 236] as RGB,
    golden: [244, 193, 148] as RGB,
    night: [20, 33, 66] as RGB,
    greyDay: [192, 199, 207] as RGB,
    greyNight: [38, 45, 60] as RGB,
    rain: [146, 157, 171] as RGB,
    cloudDay: [253, 253, 251] as RGB,
    cloudGrey: [234, 237, 241] as RGB,
    cloudStorm: [150, 158, 172] as RGB,
    cloudNight: [74, 86, 114] as RGB,
    drop: [96, 120, 156] as RGB,
  },
  dark: {
    day: [36, 92, 148] as RGB,
    golden: [138, 92, 98] as RGB,
    night: [4, 12, 28] as RGB,
    greyDay: [52, 72, 96] as RGB,
    greyNight: [16, 24, 36] as RGB,
    rain: [38, 52, 70] as RGB,
    cloudDay: [210, 226, 240] as RGB,
    cloudGrey: [128, 150, 174] as RGB,
    cloudStorm: [70, 84, 104] as RGB,
    cloudNight: [42, 62, 90] as RGB,
    drop: [170, 205, 235] as RGB,
  },
};

export function createSky(
  back: HTMLCanvasElement,
  front: HTMLCanvasElement,
): Sky {
  const bctx = back.getContext("2d")!;
  const fctx = front.getContext("2d")!;
  let W = 1,
    H = 1,
    dpr = 1;
  let growth = 0,
    growthGoal = 0,
    hour = 13,
    dark = false,
    paused = false,
    time = 0,
    // -1 after the loop has slept: its next frame restarts the clock.
    last = -1,
    frame = 0,
    disposed = false,
    dirty = true,
    flash = 0,
    nextFlash = 4;
  let target: Weather = presets.clear;
  // Eased copies of the weather, so changes drift in rather than snap.
  const now = { cloud: target.cloud, precip: 0, wind: target.wind, fog: 0 };
  let paper: RGB = [241, 242, 238],
    graphite: RGB = [124, 128, 133],
    blueprint: RGB = [42, 92, 154];

  seed = 11;
  const clouds: Cloud[] = Array.from({ length: 11 }, (_, i) => {
    const puffs = [];
    const count = 4 + Math.floor(random() * 4);
    for (let p = 0; p < count; p++) {
      const t = count === 1 ? 0.5 : p / (count - 1);
      const r = 0.16 + Math.sin(t * Math.PI) * 0.17 + random() * 0.07;
      puffs.push({ x: 0.12 + t * 0.76, y: 0.62 - r * 0.55, r });
    }
    return {
      threshold: (i + 0.6) / 11,
      depth: 0.55 + random() * 0.7,
      x: random(),
      y: 0.06 + random() * 0.24,
      alpha: 0,
      puffs,
      keys: ["", "", ""],
    };
  });
  const stars = Array.from({ length: 160 }, () => ({
    x: random(),
    y: random() * 0.62,
    r: 0.5 + random() * 1.2,
    phase: random() * Math.PI * 2,
    speed: 0.6 + random() * 1.8,
  }));
  const drops = Array.from({ length: 280 }, () => ({
    x: random(),
    y: random(),
    len: 0.6 + random() * 0.8,
    speed: 0.8 + random() * 0.5,
  }));
  const banks = Array.from({ length: 7 }, (_, i) => ({
    x: random(),
    y: 0.3 + (i / 6) * 0.62 + (random() - 0.5) * 0.06,
    w: 0.45 + random() * 0.35,
    h: 0.1 + random() * 0.08,
    speed: 0.006 + random() * 0.01,
  }));
  const flakes = Array.from({ length: 200 }, () => ({
    x: random(),
    y: random(),
    r: 1.3 + random() * 2.1,
    speed: 0.6 + random() * 0.8,
    phase: random() * Math.PI * 2,
  }));

  /* Each cloud is a row of puffs with a flat base, rendered once to a white
     sprite. The outline sprite is the same shape grown by a pixel in every
     direction, minus the shape: a pencil contour of the whole cloud. */
  function buildCloud(c: Cloud) {
    const w = Math.round(Math.max(W, 700) * 0.15 * c.depth * dpr),
      h = Math.round(w * 0.5);
    const pad = Math.round(4 * dpr);
    const fill = document.createElement("canvas");
    fill.width = w + pad * 2;
    fill.height = h + pad * 2;
    const f = fill.getContext("2d")!;
    f.save();
    f.beginPath();
    f.rect(0, 0, fill.width, pad + h * 0.78);
    f.clip();
    f.fillStyle = "#fff";
    for (const p of c.puffs) {
      f.beginPath();
      f.arc(pad + p.x * w, pad + p.y * h * 1.6, p.r * w * 0.5, 0, Math.PI * 2);
      f.fill();
    }
    f.restore();
    const line = document.createElement("canvas");
    line.width = fill.width;
    line.height = fill.height;
    const l = line.getContext("2d")!;
    const lw = 1.1 * dpr;
    for (let a = 0; a < 8; a++)
      l.drawImage(
        fill,
        Math.cos((a / 8) * Math.PI * 2) * lw,
        Math.sin((a / 8) * Math.PI * 2) * lw,
      );
    l.globalCompositeOperation = "destination-out";
    l.drawImage(fill, 0, 0);
    c.fill = fill;
    c.line = line;
    c.keys = ["", "", ""];
  }
  function tint(
    sprite: HTMLCanvasElement,
    existing: HTMLCanvasElement | undefined,
    color: RGB,
  ) {
    const out = existing ?? document.createElement("canvas");
    out.width = sprite.width;
    out.height = sprite.height;
    const o = out.getContext("2d")!;
    o.clearRect(0, 0, out.width, out.height);
    o.drawImage(sprite, 0, 0);
    o.globalCompositeOperation = "source-in";
    o.fillStyle = rgba(color);
    o.fillRect(0, 0, out.width, out.height);
    o.globalCompositeOperation = "source-over";
    return out;
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    W = back.clientWidth || innerWidth;
    H = back.clientHeight || innerHeight;
    for (const c of [back, front]) {
      c.width = Math.round(W * dpr);
      c.height = Math.round(H * dpr);
    }
    clouds.forEach(buildCloud);
    invalidate();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(back);
  resize();

  function draw(dt: number) {
    const t = time;
    const solid = smooth(0.35, 0.6, growth);
    const sketch = 1 - solid;
    const ink = mix(graphite, blueprint, smooth(0.07, 0.3, growth));
    const pal = dark ? palettes.dark : palettes.light;
    const night = clamp(
      smooth(19.2, 21.5, hour) + (1 - smooth(5, 6.6, hour)),
    );
    const golden = Math.max(
      0,
      1 - Math.abs(hour - 7) / 1.6,
      1 - Math.abs(hour - 19) / 1.6,
    );
    const storm = target.kind === "storm";
    const snowing = target.kind === "snow";
    const ease = Math.min(dt * 0.8, 1);
    now.cloud += (target.cloud - now.cloud) * ease;
    now.precip += (target.precip - now.precip) * ease;
    now.wind += (target.wind - now.wind) * ease;
    now.fog += ((target.kind === "fog" ? 1 : 0) - now.fog) * ease;

    const S = dpr;
    bctx.setTransform(S, 0, 0, S, 0, 0);
    fctx.setTransform(S, 0, 0, S, 0, 0);
    bctx.clearRect(0, 0, W, H);
    fctx.clearRect(0, 0, W, H);

    /* Sky wash. */
    let top = mix(mix(pal.day, pal.golden, golden), pal.night, night);
    top = mix(top, mix(pal.greyDay, pal.greyNight, night), now.cloud * 0.75);
    top = mix(top, pal.rain, now.precip * 0.35 * (1 - night));
    if (storm) top = mix(top, dark ? [10, 18, 30] : [104, 114, 130], 0.4);
    if (solid > 0.01) {
      const ground = mix(paper, mix(top, paper, 0.45), night);
      const g = bctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, rgba(top, solid));
      g.addColorStop(0.45, rgba(mix(top, ground, 0.45), solid));
      g.addColorStop(0.9, rgba(ground, solid));
      bctx.fillStyle = g;
      bctx.fillRect(0, 0, W, H);
    }

    /* Stars: dots once built, small pencil crosses before. */
    const starA = night * (1 - now.cloud * 0.95) * (1 - now.fog * 0.85);
    if (starA > 0.01)
      for (const s of stars) {
        const tw = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
        const x = s.x * W,
          y = s.y * H;
        if (solid > 0.01) {
          bctx.fillStyle = `rgba(255,250,232,${starA * tw * solid})`;
          bctx.beginPath();
          bctx.arc(x, y, s.r, 0, Math.PI * 2);
          bctx.fill();
        }
        if (sketch > 0.01) {
          const k = 1.5 + s.r;
          bctx.strokeStyle = rgba(ink, starA * tw * sketch * 0.8);
          bctx.lineWidth = 1;
          bctx.beginPath();
          bctx.moveTo(x - k, y);
          bctx.lineTo(x + k, y);
          bctx.moveTo(x, y - k);
          bctx.lineTo(x, y + k);
          bctx.stroke();
        }
      }

    /* On portrait phones the garden and its labels occupy the centre of the
       upper frame. Keep the celestial arc in the open sky to its right. */
    const R = clamp(W * 0.022, 20, 40);
    const portraitPhone = W <= 760 && H > 520;
    const arcPos = (a: number): [number, number] => [
      W * (portraitPhone ? 0.84 + 0.03 * a : 0.1 + 0.8 * a),
      H * (portraitPhone
        ? 0.225 - 0.085 * Math.sin(a * Math.PI)
        : 0.46 - 0.36 * Math.sin(a * Math.PI)),
    ];
    const sunArc = clamp((hour - 6) / 14);
    const sunA = (1 - night) * (1 - now.cloud * 0.8) * (1 - now.fog * 0.75);
    if (sunA > 0.01 && hour > 5.5 && hour < 20.6) {
      const [x, y] = arcPos(sunArc);
      const height = Math.sin(sunArc * Math.PI);
      if (solid > 0.01) {
        const glow = bctx.createRadialGradient(x, y, R * 0.6, x, y, R * 4.5);
        glow.addColorStop(0, `rgba(255,214,140,${0.5 * sunA * solid})`);
        glow.addColorStop(1, "rgba(255,214,140,0)");
        bctx.fillStyle = glow;
        bctx.fillRect(x - R * 5, y - R * 5, R * 10, R * 10);
        bctx.fillStyle = rgba(
          mix([255, 176, 96], [255, 230, 170], smooth(0, 0.6, height)),
          sunA * solid,
        );
        bctx.beginPath();
        bctx.arc(x, y, R, 0, Math.PI * 2);
        bctx.fill();
      }
      if (sketch > 0.01) {
        bctx.strokeStyle = rgba(ink, sunA * sketch);
        bctx.lineWidth = 1.3;
        bctx.beginPath();
        bctx.arc(x, y, R, 0, Math.PI * 2);
        bctx.stroke();
        bctx.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + t * 0.05;
          bctx.moveTo(x + Math.cos(a) * R * 1.35, y + Math.sin(a) * R * 1.35);
          bctx.lineTo(x + Math.cos(a) * R * 1.8, y + Math.sin(a) * R * 1.8);
        }
        bctx.stroke();
      }
    }
    const moonA = night * (1 - now.cloud * 0.75);
    if (moonA > 0.01) {
      const [x, y] = arcPos(clamp((((hour - 19 + 24) % 24) + 0.5) / 11));
      const r = R * 0.8;
      const p = moonPhase();
      const k = Math.cos(2 * Math.PI * p);
      const lit = () => {
        bctx.beginPath();
        if (p < 0.5) {
          bctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, false);
          bctx.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
        } else {
          bctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, true);
          bctx.ellipse(x, y, r * Math.abs(k), r, 0, Math.PI / 2, -Math.PI / 2, k < 0);
        }
        bctx.closePath();
      };
      if (solid > 0.01) {
        const glow = bctx.createRadialGradient(x, y, r, x, y, r * 4);
        glow.addColorStop(0, `rgba(220,230,255,${0.22 * moonA * solid})`);
        glow.addColorStop(1, "rgba(220,230,255,0)");
        bctx.fillStyle = glow;
        bctx.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
        bctx.fillStyle = `rgba(200,210,232,${0.16 * moonA * solid})`;
        bctx.beginPath();
        bctx.arc(x, y, r, 0, Math.PI * 2);
        bctx.fill();
        bctx.fillStyle = `rgba(248,243,224,${moonA * solid})`;
        lit();
        bctx.fill();
      }
      if (sketch > 0.01) {
        bctx.strokeStyle = rgba(ink, moonA * sketch);
        bctx.lineWidth = 1.3;
        bctx.beginPath();
        bctx.arc(x, y, r, 0, Math.PI * 2);
        bctx.stroke();
        bctx.setLineDash([3, 3]);
        lit();
        bctx.stroke();
        bctx.setLineDash([]);
      }
    }

    /* Clouds drift with the wind and fade in as the sky fills. */
    let cloudFill = mix(pal.cloudDay, pal.cloudGrey, smooth(0.6, 1, now.cloud));
    cloudFill = mix(cloudFill, pal.cloudStorm, now.precip * 0.6);
    cloudFill = mix(cloudFill, [250, 210, 186], golden * 0.45 * (1 - now.cloud));
    cloudFill = mix(cloudFill, pal.cloudNight, night);
    const cloudShade = mix(cloudFill, dark ? [6, 16, 32] : [96, 108, 126], 0.2);
    const fillKey = cloudFill.map(Math.round).join();
    const shadeKey = cloudShade.map(Math.round).join();
    const lineKey = ink.map(Math.round).join();
    for (const c of clouds) {
      const want = now.cloud > c.threshold * 0.95 ? 1 : 0;
      c.alpha += (want - c.alpha) * Math.min(dt * 0.9, 1);
      c.x += (dt * (5 + now.wind * 0.7) * c.depth) / W;
      const w = c.fill!.width / dpr;
      if (c.x * W > W + w * 0.2) c.x = -(w * 1.1) / W;
      if (c.alpha < 0.01) continue;
      const x = c.x * W,
        y = c.y * H;
      const h = c.fill!.height / dpr;
      if (solid > 0.01) {
        if (c.keys[0] !== fillKey) {
          c.tintFill = tint(c.fill!, c.tintFill, cloudFill);
          c.keys[0] = fillKey;
        }
        if (c.keys[1] !== shadeKey) {
          c.tintShade = tint(c.fill!, c.tintShade, cloudShade);
          c.keys[1] = shadeKey;
        }
        const a = c.alpha * solid * 0.95;
        bctx.globalAlpha = a;
        bctx.drawImage(c.tintShade!, x, y + h * 0.035, w, h);
        bctx.drawImage(c.tintFill!, x, y, w, h);
      }
      if (sketch > 0.01) {
        if (c.keys[2] !== lineKey) {
          c.tintLine = tint(c.line!, c.tintLine, ink);
          c.keys[2] = lineKey;
        }
        bctx.globalAlpha = c.alpha * sketch * 0.5;
        bctx.drawImage(c.tintLine!, x, y, w, h);
      }
      bctx.globalAlpha = 1;
    }

    /* Rain and snow fall in front of the garden. */
    const fall = now.precip;
    if (fall > 0.01 && !snowing) {
      const n = Math.round(drops.length * fall);
      const slant = 0.12 + now.wind * 0.012;
      const color =
        solid > 0.5 ? rgba(pal.drop, 0.45) : rgba(ink, 0.55);
      fctx.strokeStyle = color;
      fctx.lineWidth = 1;
      fctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = drops[i];
        d.y += (dt * d.speed * (storm ? 1.6 : 1.1) * 900) / H;
        d.x += (dt * slant * 900 * d.speed) / W;
        if (d.y > 1.05) {
          d.y = -0.05;
          d.x = random() * 1.2 - 0.2;
        }
        if (d.x > 1.05) d.x -= 1.1;
        const len = 10 + d.len * 12;
        const x = d.x * W,
          y = d.y * H;
        fctx.moveTo(x, y);
        fctx.lineTo(x - slant * len, y - len);
      }
      fctx.stroke();
    }
    if (fall > 0.01 && snowing) {
      const n = Math.round(flakes.length * fall);
      for (let i = 0; i < n; i++) {
        const f = flakes[i];
        f.y += (dt * f.speed * 55) / H;
        f.x += (dt * (now.wind * 0.6 + Math.sin(t + f.phase) * 14)) / W;
        if (f.y > 1.03) {
          f.y = -0.03;
          f.x = random();
        }
        if (f.x > 1.02) f.x -= 1.04;
        const x = f.x * W,
          y = f.y * H;
        if (solid > 0.5) {
          fctx.fillStyle = dark
            ? "rgba(235,245,255,0.85)"
            : "rgba(255,255,255,0.95)";
          fctx.beginPath();
          fctx.arc(x, y, f.r, 0, Math.PI * 2);
          fctx.fill();
          fctx.strokeStyle = rgba(pal.drop, 0.55);
          fctx.lineWidth = 0.8;
          fctx.stroke();
        } else {
          fctx.strokeStyle = rgba(ink, 0.6);
          fctx.lineWidth = 1;
          fctx.beginPath();
          fctx.arc(x, y, f.r + 0.5, 0, Math.PI * 2);
          fctx.stroke();
        }
      }
    }

    /* Fog: a veil over everything, thicker near the ground, with banks of
       mist drifting across. In pencil it is a set of dashed bands. */
    if (now.fog > 0.01) {
      const haze = dark ? mix(paper, [120, 150, 180], 0.25) : mix(paper, [226, 230, 233], 0.5);
      if (solid > 0.01) {
        const a = now.fog * solid;
        const g = fctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, rgba(haze, 0.22 * a));
        g.addColorStop(0.55, rgba(haze, 0.5 * a));
        g.addColorStop(1, rgba(haze, 0.78 * a));
        fctx.fillStyle = g;
        fctx.fillRect(0, 0, W, H);
        for (const b of banks) {
          b.x += (dt * b.speed * (1 + now.wind * 0.05)) / 1;
          if (b.x > 1 + b.w) b.x = -b.w;
          const cx = b.x * W,
            cy = b.y * H,
            rx = b.w * W,
            ry = b.h * H;
          fctx.save();
          fctx.translate(cx, cy);
          fctx.scale(rx / ry, 1);
          const m = fctx.createRadialGradient(0, 0, 0, 0, 0, ry);
          m.addColorStop(0, rgba(haze, 0.6 * a));
          m.addColorStop(1, rgba(haze, 0));
          fctx.fillStyle = m;
          fctx.fillRect(-ry, -ry, ry * 2, ry * 2);
          fctx.restore();
        }
      }
      if (sketch > 0.01) {
        fctx.strokeStyle = rgba(ink, 0.35 * now.fog * sketch);
        fctx.setLineDash([14, 10]);
        fctx.beginPath();
        for (let i = 0; i < 7; i++) {
          const y = H * (0.42 + i * 0.075);
          const off = ((t * (8 + i * 2)) % 24) - 24;
          fctx.moveTo(off, y);
          fctx.lineTo(W, y);
        }
        fctx.stroke();
        fctx.setLineDash([]);
      }
    }

    /* Lightning: the sky blinks white now and then during a storm. */
    if (storm && !paused) {
      nextFlash -= dt;
      if (nextFlash <= 0) {
        flash = 1;
        nextFlash = 5 + random() * 9;
      }
    }
    if (flash > 0.01) {
      fctx.fillStyle = `rgba(255,255,250,${flash * 0.45})`;
      fctx.fillRect(0, 0, W, H);
      flash *= Math.pow(0.02, dt);
    }
  }

  function needsMotion() {
    return (
      clouds.some((c) => c.alpha > 0.01) ||
      now.precip > 0.01 ||
      now.fog > 0.01 ||
      night() > 0.01
    );
  }
  const night = () =>
    clamp(smooth(19.2, 21.5, hour) + (1 - smooth(5, 6.6, hour)));
  // The weather and the clouds are still easing toward where they are going.
  function settling() {
    return (
      Math.abs(growthGoal - growth) > 0.0005 ||
      Math.abs(target.cloud - now.cloud) > 0.002 ||
      Math.abs(target.precip - now.precip) > 0.002 ||
      Math.abs(target.wind - now.wind) > 0.05 ||
      Math.abs((target.kind === "fog" ? 1 : 0) - now.fog) > 0.002 ||
      flash > 0.01 ||
      clouds.some((c) => Math.abs((now.cloud > c.threshold * 0.95 ? 1 : 0) - c.alpha) > 0.01)
    );
  }
  /* Like the garden's, the loop runs only while there is something to draw:
     it sleeps in a hidden tab, while paused, and in a still, clear sky, and
     any change wakes it. */
  function wake() {
    if (!frame && !disposed) frame = requestAnimationFrame(loop);
  }
  function invalidate() {
    dirty = true;
    wake();
  }
  const onVisibility = () => {
    if (!document.hidden) wake();
  };
  document.addEventListener("visibilitychange", onVisibility);
  function loop(ts: number) {
    frame = 0;
    if (document.hidden) {
      last = -1;
      return;
    }
    // The first frame after a sleep starts the clock again instead of jumping.
    const dt = last < 0 ? 0 : Math.min((ts - last) / 1000, 0.05);
    last = ts;
    if (paused) {
      last = -1;
      if (!dirty) return;
      dirty = false;
      // Still frames: settle the growth and the weather immediately.
      growth = growthGoal;
      now.cloud = target.cloud;
      now.precip = target.precip;
      now.wind = target.wind;
      now.fog = target.kind === "fog" ? 1 : 0;
      clouds.forEach(
        (c) => (c.alpha = now.cloud > c.threshold * 0.95 ? 1 : 0),
      );
      timed(0);
      return;
    }
    if (!dirty && !needsMotion() && !settling()) {
      last = -1;
      return;
    }
    wake();
    dirty = false;
    time += dt;
    // Growth eases at the garden's rate, so the sky and the garden fill in
    // together rather than the sky stepping with each notch of a wheel.
    growth += (growthGoal - growth) * Math.min(dt * 7, 1);
    timed(dt);
  }
  let workMs = 0,
    framesDrawn = 0;
  function timed(dt: number) {
    const start = performance.now();
    draw(dt);
    workMs += performance.now() - start;
    framesDrawn++;
  }
  wake();

  return {
    setGrowth(g, immediate = false) {
      // Against what is drawn, so a sleeping sky still wakes for many small steps.
      const moved = Math.abs(g - growth) > 0.0005;
      growthGoal = g;
      if (immediate) growth = g;
      if (moved) invalidate();
    },
    setHour(h) {
      hour = h;
      invalidate();
    },
    setWeather(w) {
      target = w;
      invalidate();
    },
    setMotion(value) {
      paused = value;
      invalidate();
    },
    refresh(isDark) {
      dark = isDark;
      const css = getComputedStyle(document.documentElement);
      paper = hex(css.getPropertyValue("--paper"), paper);
      graphite = hex(css.getPropertyValue("--graphite"), graphite);
      blueprint = hex(css.getPropertyValue("--blueprint"), blueprint);
      invalidate();
    },
    stats() {
      return { cpuMs: workMs, frames: framesDrawn };
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      frame = 0;
      document.removeEventListener("visibilitychange", onVisibility);
      observer.disconnect();
    },
  };
}
