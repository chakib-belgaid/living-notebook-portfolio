/** The narrative's vocabulary: chapter identities, URL compatibility, scene
 * cues and reading state. Pure data and helpers with no browser globals, so
 * vite.config.ts can import it at build time (through src/render.ts). The
 * English copy for each chapter lives in ./content.ts. */

/** Page order. Locale-independent and stable: these are the URL fragments. */
export const chapterIds = ["intro", "work", "bplog", "whisperbook", "energy-tools", "mcq-scan", "about", "contact"] as const;
export type ChapterId = (typeof chapterIds)[number];
export const isChapterId = (value: unknown): value is ChapterId => chapterIds.includes(value as ChapterId);

/** The house's construction phases, in order. */
export const phases = ["sketch", "blueprint", "build", "bloom"] as const;
export type Phase = (typeof phases)[number];
/** English source labels; i18n translates the rendered text. */
export const phaseLabels: Record<Phase, string> = { sketch: "Sketch", blueprint: "Blueprint", build: "Build", bloom: "Bloom" };

/** Named places in the Garden (src/scene.ts points/rooms). Identical to the
 * old `Spot` so the retained soundscape keeps its per-place mix. */
export type SceneSpot = "whisperbook" | "wattch" | "about" | "contact" | "workshop" | "bplog";

/** How the camera frames a chapter: the whole world, one named place, or a
 * wider view around a place (About's terrace and tower). */
export type FramingKind = "world" | "focus" | "wide";

/** The wide layout: one sticky scene rail (`[data-scene-host="rail"]`) beside
 * the chapters; per-chapter hosts are hidden. Otherwise (portrait/narrow)
 * each chapter's inline `[data-scene-host="<chapterId>"]` is the mount point.
 * Use with matchMedia; src/narrative/style.css uses the same query (for
 * screen media). From 900px the text column is 420–520px, never narrower. */
export const WIDE_LAYOUT_QUERY = "(min-width: 900px) and (min-height: 500px)";
export const RAIL_HOST = "rail";

/** Existing stills in public/assets/stills/ (780×1688 portrait crops). */
export type PosterKey = "sketch" | "blueprint" | "build" | "whisperbook" | "wattch" | "bloom";
export const posterSrc = (key: PosterKey) => `/assets/stills/${key}.webp`;
export const POSTER_SIZE = { width: 780, height: 1688 } as const;

/** What the page shows while a chapter is read: phase label, poster and the
 * scene's construction progress (0 sketch … 1 bloom). `progress` carries the
 * values tuned in the P1 motion study; the camera pose for each chapter (shift,
 * room, mark, portrait overrides) is `ScenePoseCue` in ./scene-adapter.ts,
 * which P4 drives from the navigation controller. */
export interface SceneCue {
  phase: Phase;
  focus: SceneSpot | null;
  progress: number;
  framing: { desktop: FramingKind; portrait: FramingKind };
  poster: PosterKey;
}

/** section: an in-page chapter; case: a same-origin case page; source: a
 * public repository or release page; download: the CV; contact: mail/profile. */
export type ActionType = "section" | "case" | "source" | "download" | "contact";
export interface Action {
  /** English source label. */
  label: string;
  type: ActionType;
  /** Destination for English (and Arabic, which has no localized cases). */
  href: string;
  /** French destination where one exists (/fr/work/…, the French CV). */
  hrefFr?: string;
  /** Visually emphasised (the opening's "Explore my work", "Email me"). */
  primary?: boolean;
}

/** What kind of support a claim has. */
export type EvidenceKind = "public-code" | "public-evaluation" | "product-capture" | "synthetic-illustration" | "internal-account";
export interface EvidenceNote {
  text: string;
  kinds: EvidenceKind[];
}

export interface IndexEntry {
  /** Name shown in the Work index, e.g. "At MCQ Scan". */
  title: string;
  /** "Practical AI · A small system for a specific task." */
  summary: string;
  /** The professional entry is listed apart from the three projects. */
  professional?: boolean;
}

export interface Chapter {
  id: ChapterId;
  /** Short destination name for next links and the footer ("The work"). */
  short: string;
  label?: string;
  title: string;
  subtitle?: string;
  /** Motivation, or the context for professional work. */
  motivation?: string[];
  decision?: { heading: string; text: string };
  evidence?: EvidenceNote;
  actions: Action[];
  index?: IndexEntry;
  scene: SceneCue;
}

/** Old fragments that remain valid. Each resolves to a chapter and to the
 * element that carries the alias id in the static page (never display:none). */
export const fragmentAliases = {
  wattch: { chapter: "energy-tools", target: "wattch" },
  workshop: { chapter: "about", target: "workshop" },
} as const satisfies Record<string, { chapter: ChapterId; target: string }>;
export type FragmentAlias = keyof typeof fragmentAliases;

/** Resolve a location hash (with or without "#") to its chapter and the id of
 * the element to land on. Empty and "#intro" are the opening. */
export function resolveFragment(hash: string): { chapter: ChapterId; target: string } | null {
  const id = decodeURIComponent(hash.replace(/^#/, ""));
  if (id === "") return { chapter: "intro", target: "intro" };
  if (isChapterId(id)) return { chapter: id, target: id };
  if (Object.hasOwn(fragmentAliases, id)) return { ...fragmentAliases[id as FragmentAlias] };
  return null;
}

/** Primary navigation. `chapters` lists the chapters during which the item is
 * the current one; CV is a download, never current. */
export const primaryNav = [
  { label: "Work", href: "#work", chapters: ["work", "bplog", "whisperbook", "energy-tools", "mcq-scan"] },
  { label: "About", href: "#about", chapters: ["about"] },
  { label: "Contact", href: "#contact", chapters: ["contact"] },
] as const satisfies readonly { label: string; href: string; chapters: readonly ChapterId[] }[];

export const activeNavHref = (chapter: ChapterId): string | null =>
  primaryNav.find(item => (item.chapters as readonly ChapterId[]).includes(chapter))?.href ?? null;

export const chapterOrder = (id: ChapterId) => chapterIds.indexOf(id);
export const nextChapterId = (id: ChapterId): ChapterId | null => chapterIds[chapterOrder(id) + 1] ?? null;

/** Reading state the navigation controller (P3) and scene adapter (P4) share. */
export type ReadingMode = "guided" | "exploration" | "stills";
export type MotionPreference = "normal" | "user-paused" | "system-reduced";
export type RendererLifecycle = "not-requested" | "loading" | "ready" | "failed" | "context-lost";
export interface ReadingState {
  chapter: ChapterId;
  /** 0–1 progress of the transition into `chapter`; 1 once settled. */
  transition: number;
  mode: ReadingMode;
  motion: MotionPreference;
  renderer: RendererLifecycle;
  /** False until the visitor explicitly turns sound on. */
  sound: boolean;
}
