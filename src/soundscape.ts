import type { Spot } from "./content";
import type { Season } from "./scene";
import type { Weather } from "./weather";

/* The garden's sound, made in the browser rather than downloaded: water from
   the falls and the canal, wind, rain, birds by day (a chorus on sunny
   mornings), crickets by night, distant thunder in a storm, and piano: a slow
   piece for the rain and the falling leaves, a brighter one for sunny
   mornings. Nothing plays until the visitor asks,
   and the audio engine sleeps whenever the garden is silent. */

export type SoundState = {
  /** The garden's growth, 0–1 (see stageProgress). */
  growth: number;
  /** Local hour, 5–23. */
  hour: number;
  /** 0 by day, 1 by night. */
  night: number;
  weather: Pick<Weather, "kind" | "cloud" | "precip" | "wind">;
  season: Season;
  /** Where the camera looks; null for the whole garden. */
  spot: Spot | null;
  /** Whisperbook is reading aloud. */
  narrating: boolean;
};
/** How present each layer is, 0–1; `level` is the whole garden's. */
export type SoundMix = {
  water: number;
  wind: number;
  rain: number;
  birds: number;
  /** A sunny morning's extra voices among the birds. */
  chorus: number;
  crickets: number;
  thunder: number;
  /** The slow piece, for the rain and the falling leaves. */
  rainPiano: number;
  /** The brighter piece, for sunny mornings. */
  morningPiano: number;
  level: number;
};

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// How close the camera is to the falls and the canal: the canal's branch
// reaches the observatory steps and runs past the greenhouse to the front
// edge; the reading pavilion is on the far side.
const nearWater: Record<Spot | "garden", number> = {
  garden: 0.75,
  about: 0.7,
  whisperbook: 0.45,
  wattch: 0.9,
  contact: 0.95,
};

/** Follows the garden as it is drawn: water arrives with the stone at Build
    and life at Bloom, on the same curves as the scene. */
export function soundMix(s: SoundState): SoundMix {
  const { kind, cloud, precip, wind } = s.weather;
  const life = smooth(0.69, 0.96, s.growth);
  const wet = kind === "snow" ? 0 : precip;
  const cold = s.season === "winter" || kind === "snow";
  const sunny = kind === "clear" || kind === "partly" ? 1 - smooth(0.5, 0.85, cloud) : 0;
  const morning = smooth(5.5, 7, s.hour) * (1 - smooth(9.5, 11.5, s.hour));
  // Leaves fall in autumn once the garden has life, as in the scene.
  const leaves = s.season === "autumn" ? life : 0;
  // Only one piece plays at a time: a sunny morning's takes over from the
  // leaves'. Rain is never sunny, so it never meets the morning's.
  const morningPiano = morning * sunny * (1 - s.night);
  return {
    water: smooth(0.46, 0.63, s.growth) * nearWater[s.spot ?? "garden"],
    wind: clamp(0.2 + wind / 40) * (kind === "snow" ? 0.7 : 1),
    rain: wet,
    birds:
      life * (1 - s.night) * (1 - 0.8 * wet) * (0.6 + 0.4 * morning * sunny) *
      (kind === "storm" ? 0 : kind === "fog" ? 0.6 : 1) *
      (s.season === "winter" ? 0.4 : 1),
    chorus: life * (1 - s.night) * morning * sunny * (s.season === "winter" ? 0.4 : 1),
    crickets: life * s.night * (cold ? 0 : 1 - wet),
    thunder: kind === "storm" ? 1 : 0,
    // A gentle piano under the rain or the leaves; softer under a storm.
    rainPiano: Math.max(wet > 0 ? 0.7 + 0.3 * wet : 0, leaves * (1 - morningPiano)) * (kind === "storm" ? 0.6 : 1),
    morningPiano,
    // The garden steps back under the narration, as music does under a voice.
    level: s.narrating ? 0.25 : 1,
  };
}

/* Loudness of each layer at full presence. These are the only numbers to
   tune by ear. */
const LOUD = { water: 0.28, babble: 0.07, wind: 0.3, rain: 0.26, birds: 0.16, crickets: 0.025, thunder: 0.55, piano: 0.13, room: 0.05 };
/* The piano's two pieces, as MIDI notes. Each bar is a bass note and its
   chord broken beneath a melody: either a tune, as [beat, note], or a walk
   a step at a time through `wander`, so no two passes are quite alike. */
type Piece = {
  /** Seconds a beat. */
  beat: number;
  beats: number;
  bars: { bass: number; notes: number[]; tune?: [number, number][] }[];
  /** [beat, chord note]; beat 0 always sounds, the rest mostly. */
  arpeggio: [number, number][];
  wander?: number[];
};
// For the rain and the leaves: four slow bars in D major, Dmaj9, Bm7, Gmaj7,
// Asus; the melody wanders the pentatonic above. The last half beat breathes.
const RAIN: Piece = {
  beat: 0.8,
  beats: 4,
  bars: [
    { bass: 38, notes: [57, 64, 66, 69] },
    { bass: 47, notes: [54, 62, 66, 69] },
    { bass: 43, notes: [55, 62, 66, 69] },
    { bass: 45, notes: [57, 64, 69, 71] },
  ],
  arpeggio: [[0, 0], [1, 1], [1.5, 2], [2.5, 3], [3, 1]],
  wander: [74, 76, 78, 81, 83, 86],
};
// For sunny mornings: a lilting waltz in G major, G, D/F#, Em, C, G, C, D, G,
// whose tune climbs to a held high G.
const MORNING: Piece = {
  beat: 0.65,
  beats: 3,
  bars: [
    { bass: 43, notes: [59, 62], tune: [[0, 74], [2, 76]] },
    { bass: 42, notes: [57, 62], tune: [[0, 78], [1, 76], [2, 74]] },
    { bass: 40, notes: [59, 64], tune: [[0, 76], [2, 79]] },
    { bass: 48, notes: [60, 64], tune: [[0, 79], [1.5, 76]] },
    { bass: 43, notes: [59, 62], tune: [[0, 74], [2, 71]] },
    { bass: 48, notes: [60, 64], tune: [[0, 72], [1, 76], [2, 79]] },
    { bass: 50, notes: [57, 66], tune: [[0, 78], [2, 81]] },
    { bass: 43, notes: [59, 62], tune: [[0, 79]] },
  ],
  arpeggio: [[1, 0], [1.5, 1], [2, 0]],
};
// G major's notes, as pitch classes: the morning's grace notes are the scale
// step below a melody note.
const G_MAJOR = [0, 2, 4, 6, 7, 9, 11];
const stepBelow = (note: number) => (G_MAJOR.includes((note - 1) % 12) ? note - 1 : note - 2);
// Fades are exponential: a time constant of 0.6 s is about two seconds to silence.
const FADE = 0.6;
const DRIFT = 1.2;

export type Soundscape = {
  /** Plays or stops the garden. Browsers hold sound back until a click, tap
      or key press, so asking to play again from a later gesture retries. */
  setAudible: (on: boolean) => void;
  dispose: () => void;
};

export const soundSupported = () => typeof AudioContext !== "undefined";

/** `onHeard` is called once, when the browser first lets the garden play. */
export function createSoundscape(read: () => SoundState, onHeard?: () => void): Soundscape {
  let engine: ReturnType<typeof build> | undefined;
  let timer = 0;
  let sleep = 0;
  let audible = false;

  function build() {
    const ctx = new AudioContext();
    const heard = () => {
      if (ctx.state !== "running") return;
      ctx.removeEventListener("statechange", heard);
      onHeard?.();
    };
    ctx.addEventListener("statechange", heard);
    const rate = ctx.sampleRate;
    /* A loop of noise. The tail crossfades into the head, so the loop has no
       seam to click on. Brown noise is white noise, gently integrated. */
    function noise(seconds: number, brown: boolean) {
      const n = Math.floor(rate * seconds),
        overlap = Math.floor(rate * 0.25);
      const raw = new Float32Array(n + overlap);
      let b = 0;
      for (let i = 0; i < raw.length; i++) {
        const w = Math.random() * 2 - 1;
        b = (b + 0.02 * w) / 1.02;
        raw[i] = brown ? b * 3.5 : w;
      }
      const buffer = ctx.createBuffer(1, n, rate);
      const data = buffer.getChannelData(0);
      data.set(raw.subarray(0, n));
      for (let i = 0; i < overlap; i++) {
        const t = i / overlap;
        data[i] = raw[i] * t + raw[n + i] * (1 - t);
      }
      return buffer;
    }
    const white = noise(5, false),
      brown = noise(5, true);

    // master fades on and off; duck follows the narration; a soft ceiling
    // keeps layers that swell together from clipping.
    const master = ctx.createGain();
    master.gain.value = 0;
    const duck = ctx.createGain();
    const ceiling = ctx.createDynamicsCompressor();
    ceiling.threshold.value = -14;
    ceiling.ratio.value = 4;
    master.connect(duck).connect(ceiling).connect(ctx.destination);
    const bus = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      return g;
    };

    // A noise bed, wide: the same loop at two offsets, one in each ear.
    function bed(buffer: AudioBuffer, ...chain: AudioNode[]) {
      const merge = ctx.createChannelMerger(2);
      [0, 0.5].forEach((offset, ear) => {
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;
        source.connect(merge, 0, ear);
        source.start(0, offset * buffer.duration);
      });
      let to: AudioNode = merge;
      for (const node of chain) to = to.connect(node);
      return to;
    }
    const filter = (type: BiquadFilterType, frequency: number, Q = 0.7) => {
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = frequency;
      f.Q.value = Q;
      return f;
    };
    // A slow wave added to a parameter.
    const sway = (param: AudioParam, hz: number, depth: number) => {
      const lfo = ctx.createOscillator(),
        amount = ctx.createGain();
      lfo.frequency.value = hz;
      amount.gain.value = depth;
      lfo.connect(amount).connect(param);
      lfo.start();
    };

    // Water: the fall's low rush, and a brighter babble whose pitch wanders.
    const water = bus();
    bed(brown, filter("bandpass", 520, 0.6)).connect(water);
    const babble = filter("bandpass", 1400, 2.2);
    const babbleLevel = ctx.createGain();
    babbleLevel.gain.value = LOUD.babble / LOUD.water;
    bed(white, babble, babbleLevel).connect(water);

    // Wind: a low hiss that opens and closes, in gusts.
    const wind = bus();
    const windFilter = filter("lowpass", 420, 0.9);
    sway(windFilter.frequency, 0.05, 220);
    const gust = ctx.createGain();
    gust.gain.value = 0.7;
    sway(gust.gain, 0.11, 0.3);
    bed(brown, windFilter, gust).connect(wind);

    // Rain: bright noise, with the lowest and highest hiss taken off.
    const rain = bus();
    bed(white, filter("highpass", 1200), filter("lowpass", 6500)).connect(rain);

    const birds = bus(),
      crickets = bus(),
      thunder = bus();
    const random = (a: number, b: number) => a + Math.random() * (b - a);
    function panned(to: AudioNode, pan: number) {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      p.connect(to);
      return p;
    }

    // One whistled note, sliding from f to `to` over d seconds.
    function whistle(out: AudioNode, t: number, f: number, to: number, d: number, last: boolean) {
      const tone = ctx.createOscillator(),
        envelope = ctx.createGain();
      tone.frequency.setValueAtTime(f, t);
      tone.frequency.exponentialRampToValueAtTime(to, t + d);
      envelope.gain.setValueAtTime(0.0001, t);
      envelope.gain.exponentialRampToValueAtTime(1, t + Math.min(0.012, d / 3));
      envelope.gain.exponentialRampToValueAtTime(0.0001, t + d);
      tone.connect(envelope).connect(out);
      tone.start(t);
      tone.stop(t + d + 0.02);
      if (last) tone.onended = () => out.disconnect();
    }
    // A bird: a short phrase of whistled notes, each sliding up or down.
    function phrase(at: number) {
      const out = panned(birds, random(-0.8, 0.8));
      const base = random(2300, 4200);
      let t = at;
      const notes = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < notes; i++) {
        const d = random(0.05, 0.14),
          f = base * random(0.85, 1.2);
        whistle(out, t, f, f * (Math.random() < 0.5 ? 1.35 : 0.75), d, i === notes - 1);
        t += d + random(0.03, 0.11);
      }
    }
    // A morning trill: a quick run of one note, falling a little.
    function trill(at: number) {
      const out = panned(birds, random(-0.8, 0.8));
      const f = random(3500, 5000);
      const notes = 8 + Math.floor(Math.random() * 7);
      for (let i = 0; i < notes; i++) {
        const g = f * (1 - (0.15 * i) / notes);
        whistle(out, at + i * 0.06, g * 1.05, g * 0.95, 0.035, i === notes - 1);
      }
    }
    // A morning call: two clear held notes, the second lower.
    function call(at: number) {
      const out = panned(birds, random(-0.8, 0.8));
      const f = random(3000, 3800);
      whistle(out, at, f, f * 0.98, 0.26, false);
      whistle(out, at + 0.34, f * 0.84, f * 0.8, 0.3, true);
    }
    // A cricket: three quick pulses of one high tone.
    function chirp(at: number) {
      const out = panned(crickets, random(-0.9, 0.9));
      const tone = ctx.createOscillator(),
        envelope = ctx.createGain();
      tone.frequency.value = random(4300, 4800);
      envelope.gain.value = 0;
      for (let k = 0; k < 3; k++) {
        const s = at + k * 0.055;
        envelope.gain.setValueAtTime(0, s);
        envelope.gain.linearRampToValueAtTime(1, s + 0.006);
        envelope.gain.linearRampToValueAtTime(0, s + 0.03);
      }
      tone.connect(envelope).connect(out);
      tone.start(at);
      tone.stop(at + 0.2);
      tone.onended = () => out.disconnect();
    }
    // Thunder: a far, slow swell of the lowest rumble.
    function rumble(at: number) {
      const source = ctx.createBufferSource(),
        envelope = ctx.createGain();
      source.buffer = brown;
      source.loop = true;
      envelope.gain.setValueAtTime(0.0001, at);
      envelope.gain.exponentialRampToValueAtTime(1, at + random(0.4, 1));
      envelope.gain.setTargetAtTime(0, at + 1.2, 1.2);
      source.connect(filter("lowpass", random(140, 260))).connect(envelope).connect(thunder);
      source.start(at, random(0, 2));
      source.stop(at + 7);
      source.onended = () => envelope.disconnect();
    }

    /* The piano: the first few partials of a struck string in one wave,
       with a second string a hair sharp for the slow beat of a unison.
       Struck harder, it sounds brighter; it mellows as it rings, low notes
       longest. Each note is damped when its bar ends, as a pianist changes
       the pedal with the chord, so the chords never blur into a drone. It
       plays in a small room, whose tail darkens as it fades. */
    const piano = bus();
    function roomImpulse(seconds: number) {
      const n = Math.floor(rate * seconds);
      const buffer = ctx.createBuffer(2, n, rate);
      for (let ear = 0; ear < 2; ear++) {
        const data = buffer.getChannelData(ear);
        let dark = 0;
        for (let i = 0; i < n; i++) {
          // A one-pole lowpass that closes as the tail goes on.
          dark += (0.6 - 0.55 * (i / n)) * (Math.random() * 2 - 1 - dark);
          data[i] = dark * Math.exp((-6.9 * i) / n);
        }
      }
      return buffer;
    }
    const room = ctx.createConvolver();
    room.buffer = roomImpulse(2.2);
    const roomLevel = ctx.createGain();
    roomLevel.gain.value = LOUD.room;
    piano.connect(room).connect(roomLevel).connect(master);
    const string = ctx.createPeriodicWave(new Float32Array(6), new Float32Array([0, 1, 0.45, 0.22, 0.12, 0.06]), { disableNormalization: true });
    /** Strikes a key at `at` and lets it go `hold` seconds later. */
    function key(at: number, midi: number, velocity: number, hold: number) {
      const f = 440 * 2 ** ((midi - 69) / 12);
      const ring = 1.2 + 2.6 * Math.min(1, Math.max(0, (72 - midi) / 36));
      const out = ctx.createGain();
      out.gain.setValueAtTime(0, at);
      out.gain.linearRampToValueAtTime(velocity, at + 0.006);
      out.gain.setTargetAtTime(0, at + 0.006, ring);
      out.gain.setTargetAtTime(0, at + hold, 0.12);
      const tone = filter("lowpass", Math.min(f * (4 + 10 * velocity), 12000), 0.5);
      tone.frequency.setTargetAtTime(f * 1.5, at, ring * 0.5);
      tone.connect(out).connect(piano);
      const end = at + hold + 0.8;
      [f, f * 1.0007].forEach((hz, i) => {
        const wave = ctx.createOscillator();
        wave.setPeriodicWave(string);
        wave.frequency.value = hz;
        if (i) {
          const level = ctx.createGain();
          level.gain.value = 0.5;
          wave.connect(level).connect(tone);
          wave.onended = () => out.disconnect();
        } else wave.connect(tone);
        wave.start(at);
        wave.stop(end);
      });
    }
    let melody = 2;
    function bar(piece: Piece, at: number, b: number) {
      const { beat: length, beats, bars, arpeggio, wander } = piece;
      const chord = bars[b];
      const loose = () => random(-0.015, 0.015);
      // Each note holds to the bar line and a moment past it, for legato.
      const barEnd = at + beats * length + 0.12;
      const play = (t: number, midi: number, velocity: number) => key(t, midi, velocity, barEnd - t);
      play(at, chord.bass, random(0.3, 0.38));
      for (const [beat, i] of arpeggio)
        if (beat === 0 || Math.random() < 0.85) play(at + beat * length + loose(), chord.notes[i], random(0.13, 0.22));
      for (const [beat, note] of chord.tune ?? []) {
        const t = at + beat * length + loose();
        // Now and then a grace note, the scale step below, for sparkle.
        if (Math.random() < 0.2) key(t - 0.07, stepBelow(note), random(0.1, 0.15), 0.1);
        play(t, note, random(0.22, 0.3));
      }
      if (wander)
        for (const beat of [0.5, 2])
          if (Math.random() < 0.6) {
            melody = Math.min(wander.length - 1, Math.max(0, melody + (Math.random() < 0.5 ? -1 : 1)));
            play(at + beat * length + loose(), wander[melody], random(0.2, 0.3));
          }
    }

    let nextBird = 0,
      nextCricket = 0,
      nextThunder = 0,
      nextBar = 0,
      barIndex = 0,
      playing: Piece = RAIN;
    function tick() {
      const mix = soundMix(read());
      const now = ctx.currentTime;
      const drift = (param: AudioParam, value: number) => param.setTargetAtTime(value, now, DRIFT);
      // The water and the wind give the piano a little room.
      const music = Math.max(mix.rainPiano, mix.morningPiano);
      drift(water.gain, mix.water * LOUD.water * (1 - 0.25 * music));
      drift(wind.gain, mix.wind * LOUD.wind * (1 - 0.25 * music));
      drift(rain.gain, mix.rain * LOUD.rain);
      drift(birds.gain, mix.birds * LOUD.birds);
      drift(crickets.gain, mix.crickets * LOUD.crickets);
      drift(thunder.gain, mix.thunder * LOUD.thunder);
      drift(piano.gain, music * LOUD.piano);
      duck.gain.setTargetAtTime(mix.level, now, 0.4);
      babble.frequency.setTargetAtTime(random(1000, 1900), now, 0.15);
      // Fewer calls as a layer quietens, none when it is silent.
      if (now >= nextBird) {
        // Sunny mornings bring more voices: trills and calls among the phrases.
        const r = Math.random();
        if (mix.birds > 0.02) (r < mix.chorus * 0.3 ? trill : r < mix.chorus * 0.55 ? call : phrase)(now + random(0.05, 0.25));
        nextBird = now + random(1.5, 6) / Math.max(0.3, mix.birds) / (1 + 2 * mix.chorus);
      }
      // A bar at a time, scheduled just ahead; after a silence, or on
      // changing pieces at a bar line, from the top.
      if (music > 0.02) {
        const piece = mix.morningPiano > mix.rainPiano ? MORNING : RAIN;
        if (nextBar < now) {
          nextBar = now + 0.3;
          barIndex = 0;
        }
        while (nextBar < now + 1) {
          if (piece !== playing) {
            playing = piece;
            barIndex = 0;
          }
          bar(playing, nextBar, barIndex);
          nextBar += playing.beats * playing.beat;
          barIndex = (barIndex + 1) % playing.bars.length;
        }
      }
      if (now >= nextCricket) {
        if (mix.crickets > 0.02) chirp(now + random(0.05, 0.2));
        nextCricket = now + random(0.35, 0.9) / Math.max(0.3, mix.crickets);
      }
      if (now >= nextThunder) {
        if (mix.thunder > 0) rumble(now + 0.1);
        nextThunder = now + random(18, 45);
      }
    }
    return { ctx, master, tick };
  }

  function setAudible(on: boolean) {
    if (on === audible) {
      if (on && engine?.ctx.state === "suspended") void engine.ctx.resume();
      return;
    }
    if (on && !engine) {
      if (!soundSupported()) return;
      engine = build();
    }
    if (!engine) return;
    audible = on;
    const { ctx, master, tick } = engine;
    clearTimeout(sleep);
    clearInterval(timer);
    if (on) {
      void ctx.resume();
      tick();
      timer = window.setInterval(tick, 250);
      master.gain.setTargetAtTime(1, ctx.currentTime, FADE);
    } else {
      master.gain.setTargetAtTime(0, ctx.currentTime, FADE);
      // Once faded, the engine sleeps and costs nothing.
      sleep = window.setTimeout(() => void ctx.suspend(), FADE * 5000);
    }
  }

  return {
    setAudible,
    dispose() {
      clearTimeout(sleep);
      clearInterval(timer);
      void engine?.ctx.close();
      engine = undefined;
      audible = false;
    },
  };
}
