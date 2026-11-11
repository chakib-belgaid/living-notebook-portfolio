/* The narrative's hold on the garden (P1 motion study, driven from document
   scroll in P4). A narrow layer over `Garden` that keeps apart what the scene
   conflates: a navigation snap is not a reduced-motion preference, and a
   guided reading hold is not the visitor's pause. No DOM of its own: the
   garden's container is the only element involved, through the garden. */
import type { Garden } from "../scene";
import type { ChapterId, MotionPreference, Phase, SceneSpot } from "./model";

/* Vocabulary shared with the narrative model (src/narrative/model.ts):
   chapter ids, construction phases, named places and the motion preference
   are the model's; this module adds only the scene's pose for each chapter. */
export type { ChapterId, MotionPreference } from "./model";
/** Named points of the model (scene.ts `points`; four also have a `rooms` interior). */
export type FocusSpot = SceneSpot;
/** The story's four held stages (the model's phases). */
export type Stage = Phase;
/** The stages' resting construction progress. */
export const stageProgress: Readonly<Record<Stage, number>> = {
  sketch: 0,
  blueprint: 0.33,
  build: 0.66,
  bloom: 1,
};

/** Where the scene is posed for a chapter. */
export interface ScenePose {
  /** Construction progress 0–1 (sketch → blueprint → build → bloom). */
  progress: number;
  /** A named point of the model to approach, or null for the whole world. */
  focus: FocusSpot | null;
  /** Moves the garden on screen, as fractions of the view (Garden.focus shiftX/shiftY). */
  shift: readonly [number, number];
  /** Below 1 draws the garden smaller (Garden.focus room). */
  room: number;
  /** A ring of lantern light on the ground around a named point
      (Garden.hover), for a subject that framing alone cannot make evident. */
  mark?: FocusSpot | null;
}

/** A chapter's pose cue. Named apart from the model's `SceneCue` (phase,
    focus, progress, framing, poster: what the page shows); the progress
    values of both are the same P1-tuned numbers. */
export interface ScenePoseCue extends ScenePose {
  chapter: ChapterId;
  /** The stage this cue is read as (for labels; derived from the progress). */
  stage: Stage;
  /** What the cue changes in a portrait host (the ~45vh slot on phones). */
  portrait: Partial<ScenePose>;
  /** What the cue changes in the wide host, where the scene fills the
      viewport behind the text card (G2 layout): the focused rooms are drawn
      smaller than in the P1 rail so the house stays whole around them. */
  wide: Partial<ScenePose>;
}

export type HostKind = "wide" | "portrait";

/** Where the host's free area is: on wide layouts the chapter card covers
 * the left third of the viewport, so every pose is carried right by this
 * fraction of the view; a portrait slot is all scene. */
export const HOST_SHIFT: Readonly<Record<HostKind, readonly [number, number]>> = { wide: [0.17, 0], portrait: [0, 0] };

const cue = (chapter: ChapterId, stage: Stage, pose: ScenePose, portrait: Partial<ScenePose> = {}, wide: Partial<ScenePose> = {}): ScenePoseCue => ({
  chapter,
  stage,
  ...pose,
  portrait,
  wide,
});

/* Chapter → scene (implementation plan §3), on the model's named points.
   Global construction progress carries the drawing-to-volume change; the
   focus carries "which room this chapter is about". Values from the P1 study
   (docs/handoff/sketchbook-to-house/motion-study/P1-MOTION-STUDY.md). */
export const sceneCues: Readonly<Record<ChapterId, ScenePoseCue>> = {
  // Pencil on paper, faint guides, nothing built yet. The sketch's world is
  // drawn smaller and flatter, so it is lifted to sit in the middle.
  intro: cue("intro", "sketch", { progress: 0, focus: null, shift: [0, 0.07], room: 1.04 }, { shift: [0, 0.1], room: 1.08 }),
  // Blueprint lines, with the first foundation planes just appearing.
  work: cue("work", "blueprint", { progress: 0.4, focus: null, shift: [0, 0.04], room: 0.96 }, { shift: [0, 0.06], room: 1.02 }),
  /* Focused cues. Garden.focus zooms into a room by 1 + rooms[spot].zoom
     (2.6x Whisperbook, 2.8x Wattch, 3x the workshop and BP Log); `room`
     takes most of that back so the whole house stays recognizable around
     the room (about 1.3x overall), and a small downward shift keeps the
     taller building behind each room inside the frame. */
  /* The heart garden: the first useful built area, restrained. It sits on
     the model's front corner under the much larger pavilion, so it is drawn
     closer (about 2x) and centre-low, and marked with the hover ring; framing
     alone left the pavilion reading as the subject (P1 review, fix round 1). */
  bplog: cue("bplog", "build", { progress: 0.52, focus: "bplog", shift: [-0.02, -0.16], room: 0.7, mark: "bplog" }, { shift: [0, -0.22], room: 0.7 }, { shift: [0.02, -0.12], room: 0.3 }),
  // The reading pavilion becomes dimensional; the camera approaches it.
  whisperbook: cue("whisperbook", "build", { progress: 0.66, focus: "whisperbook", shift: [0, -0.06], room: 0.5 }, { shift: [0, -0.04], room: 0.56 }, { shift: [0, -0.08], room: 0.4 }),
  // The observatory ring gains presence.
  "energy-tools": cue("energy-tools", "build", { progress: 0.76, focus: "wattch", shift: [0.02, -0.06], room: 0.46 }, { shift: [0.02, -0.04], room: 0.5 }, { shift: [0, -0.02], room: 0.34 }),
  // The workshop as the setting for the work at MCQ Scan: its gate (AgentDiet)
  // and its clothes rail (Store Chat) are small, so it is drawn as close as
  // the heart garden and marked with the hover ring.
  "mcq-scan": cue("mcq-scan", "build", { progress: 0.84, focus: "workshop", shift: [0.02, -0.1], room: 0.7, mark: "workshop" }, { shift: [0.02, -0.12], room: 0.7 }, { shift: [0.08, -0.1], room: 0.36 }),
  // The tower and terraces, framed wider (about has no room: 1.4x focus).
  // Still Build: the final foliage and light (Bloom) are held back for Contact.
  about: cue("about", "build", { progress: 0.93, focus: "about", shift: [0.08, 0], room: 0.78 }, { shift: [0.06, 0], room: 0.78 }, { shift: [0.12, -0.04], room: 0.5 }),
  // Final foliage, light and the whole composition.
  contact: cue("contact", "bloom", { progress: 1, focus: null, shift: [-0.02, 0.03], room: 0.92 }, { shift: [-0.02, 0.04], room: 0.9 }),
};

/** A chapter by id, or a cue (possibly adjusted by the caller). */
export type CueRef = ChapterId | ScenePoseCue;

export interface SceneAdapterState {
  chapter: ChapterId | null;
  progress: number;
  focus: FocusSpot | null;
  held: boolean;
  preference: MotionPreference;
  host: HostKind;
}

export interface SceneAdapter {
  /** Construction progress (0–1), eased by the scene; immediate under a still preference. */
  setPhase(progress: number): void;
  /** Direct destination: progress and pose drawn at once, once. Sets no reduced-motion state. */
  snapTo(target: { progress: number; focus?: CueRef | null }): void;
  /** Approach a chapter's named point (with the host's overrides), or the whole world. */
  focus(target: CueRef | null): void;
  /** The band of the container the garden is framed in (fractions of its height). */
  frame(top: number, bottom: number): void;
  /** Guided reading hold: ambient life off; nothing is drawn once settled. */
  hold(): void;
  /** Ends a hold: ambient life on again (exploration, or a chapter that wants it). */
  release(): void;
  setMotionPreference(preference: MotionPreference): void;
  /** Which overrides the cues use. */
  setHost(host: HostKind): void;
  /** A chapter's whole cue: eased by default, snapped when `immediate` or under a still preference. */
  go(chapter: ChapterId, options?: { immediate?: boolean }): void;
  /** True when progress and pose have reached their goals (ambient life aside). */
  isSettled(): boolean;
  /** Runs each time the scene comes to rest after a change. Returns an unsubscribe. */
  onSettled(callback: () => void): () => void;
  state(): SceneAdapterState;
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The cue as a host draws it: the host's overrides applied. */
export function poseFor(ref: CueRef, host: HostKind): ScenePoseCue {
  const base = typeof ref === "string" ? sceneCues[ref] : ref;
  return { ...base, ...(host === "portrait" ? base.portrait : base.wide) };
}

export function createSceneAdapter(garden: Garden, host: HostKind = "wide"): SceneAdapter {
  let preference: MotionPreference = "normal";
  let held = false;
  let chapter: ChapterId | null = null;
  let progress = 0;
  let focusRef: CueRef | null = null;
  // A still preference: changes land at once and nothing moves on its own.
  const still = () => preference !== "normal";
  // The scene's own pause stands for the visitor's (or the system's) wish;
  // the hold is ambient only, so the pencil draw-in and transitions still run.
  const applyMotion = () => {
    garden.setMotion(still());
    garden.setAmbient(!held && !still());
  };
  const applyFocus = (ref: CueRef | null) => {
    focusRef = ref;
    // No cue: the whole world, centred, at its usual size.
    const [dx, dy] = HOST_SHIFT[host];
    if (!ref) {
      garden.focus(null, dx, dy, 1);
      garden.hover(null);
      return;
    }
    // A cue without a spot still carries its shift and room (whole-world views).
    const pose = poseFor(ref, host);
    garden.focus(pose.focus, pose.shift[0] + dx, pose.shift[1] + dy, pose.room);
    // Each cue sets its mark, or clears the previous one.
    garden.hover(pose.mark ?? null);
  };
  const applyProgress = (p: number) => {
    progress = clamp01(p);
    // Never `immediate`: that would set the scene's reduced flag for every
    // later change. Snapping is done with garden.snap() instead.
    garden.setProgress(progress, false);
  };
  applyMotion();
  return {
    setPhase(p) {
      applyProgress(p);
      if (still()) garden.snap();
    },
    snapTo({ progress: p, focus }) {
      applyProgress(p);
      if (focus !== undefined) applyFocus(focus);
      garden.snap();
    },
    focus(ref) {
      applyFocus(ref);
      if (still()) garden.snap();
    },
    frame(top, bottom) {
      garden.frame(top, bottom);
      if (still()) garden.snap();
    },
    hold() {
      held = true;
      applyMotion();
    },
    release() {
      held = false;
      applyMotion();
    },
    setMotionPreference(value) {
      preference = value;
      applyMotion();
    },
    setHost(value) {
      if (value === host) return;
      host = value;
      // The same chapter, posed for the new host, without a glide.
      if (focusRef !== null || chapter !== null) {
        applyFocus(focusRef);
        garden.snap();
      }
    },
    go(id, options = {}) {
      chapter = id;
      const cue = sceneCues[id];
      applyProgress(cue.progress);
      applyFocus(id);
      if (options.immediate || still()) garden.snap();
    },
    isSettled: () => garden.isSettled(),
    onSettled: (callback) => garden.onSettled(callback),
    state: () => ({
      chapter,
      progress,
      focus: focusRef ? poseFor(focusRef, host).focus : null,
      held,
      preference,
      host,
    }),
  };
}
