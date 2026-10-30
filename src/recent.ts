// Public summaries aligned with the October 2026 dossier and clarification email.
const escape = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
export const recentWork = [
  {
    "title": "BP Log · bp-tracker",
    "status": "Public project · offline OCR in the browser",
    "text": "A phone web app that reads a blood-pressure monitor’s display from a photo, then lets the user check and correct the values before saving. Image-processing rules handle the display layout; a 10,123-parameter CNN trained on synthetic digits runs in plain JavaScript with a 54 KB weights file.",
    "evidence": "Published evaluation: 91% complete readings on 55 photos from one monitor; 99.5% digit accuracy on 187 held-out digits. The full reading set guided pipeline development, so it is not an independent holdout. Median phone latency: 268 ms across three runs on an Android 10 phone.",
    "url": "https://github.com/chakib-belgaid/bp-tracker"
  },
  {
    "title": "AgentDiet",
    "status": "Professional work · demonstrator and funded proposal",
    "text": "I conceived an agent-governance project at MCQ Scan: signed Biscuit tokens, attenuated delegations, and local Datalog checks for tool permissions. I built a Python/FastAPI demonstrator and prepared the technical proposal, market analysis, budget, and project plan. AgentDiet received a 2026 Hyper Open X grant funded by France 2030.",
    "evidence": "The demonstrator validates simulated authorizations; MCP/A2A integration is the project target.",
    "url": "/work/mcq-scan/#agentdiet"
  },
  {
    "title": "Store Chat",
    "status": "Professional work · structured-output evaluation",
    "text": "A clothing-shopping assistant with Llama 3.1 8B LoRA, local vLLM inference, and Pydantic business validation. I evaluated constrained-decoding tools and integrated LM Format Enforcer to enforce enum values. Internal evaluation separates 97% structurally valid, enum-compliant requests from 95% semantic accuracy per attribute.",
    "evidence": "These are internal evaluation results, not a public benchmark. My contribution was tool evaluation and integration, not a custom sampler.",
    "url": "/work/mcq-scan/#store-chat"
  },
  {
    "title": "Whispbook · web studio",
    "status": "Public source · self-hosted audiobook studio",
    "text": "A React/FastAPI studio for importing and editing documents, assigning character voices, and generating chapter audio with Kokoro or Chatterbox. It exports M4B audiobooks, subtitles, and Python scripts that preserve the edited text and synthesis settings.",
    "evidence": "Separate from the Android app. The current web app does not integrate the separate model-based speaker-attribution experiment.",
    "url": "https://github.com/chakib-belgaid/whispbook"
  },
  {
    "title": "Z-Image-Turbo · Android",
    "status": "Personal experiment · mobile diffusion inference",
    "text": "Porting image generation to Nothing Phone 3: 512×512 output, a comparison of 100 runtime/precision configurations, INT8/INT4 quantization, and a QNN w8a16 path on the Hexagon NPU. The work includes numerical checks, activation-saturation diagnosis, and calibration across all diffusion steps.",
    "evidence": "Experimental work described in my October dossier. Single-block timings do not establish an end-to-end generation speedup; no public repository is linked here.",
    "url": null
  },
  {
    "title": "Pocket TTS Android Benchmark",
    "status": "Public benchmark · OnePlus 6T",
    "text": "A pinned English INT8 Pocket TTS conversion running through sherpa-onnx on Android. On a OnePlus 6T with Android 11, CPU and two threads, the recorded real-time factors are 0.94, 1.01, and 1.06 for 2, 4, and 8 diffusion steps. Audio samples and machine-readable measurements are published.",
    "evidence": "One observed run per setting; not averages or a Whisperbook benchmark. RTF is generation time divided by audio duration.",
    "url": "https://github.com/chakib-belgaid/pocket-tts-android-benchmark"
  },
  {
    "title": "Speculative decoding · MLX",
    "status": "Public experiment · negative result documented",
    "text": "Compared Qwen3 4B with a Qwen3 0.6B draft model on 40 labeled speaker-classification samples. Both paths reached 97.5% accuracy, but speculative decoding was 28.3% slower in the recorded protocol.",
    "evidence": "Short outputs and model loading inside each timed call limit the conclusion. This is not a steady-state serving benchmark.",
    "url": "https://github.com/chakib-belgaid/speculative-decoding-mlx"
  }
];
export const practice = [
  "Python is my strongest language. I build APIs and AI workflows with FastAPI, Django, Pydantic, React, and TypeScript, and deliver with Docker, GitHub Actions, and GCP.",
  "My inference experience includes local vLLM, MLX on Apple Silicon, LoRA, quantization, and calibration. I distinguish that experimental work from specialist operation of GPU LLM servers in production.",
  "I use AI coding assistants regularly and review and validate their output. Wattch’s Rust implementation was developed with AI assistance; my Rust skill is reading and understanding code, not Python-level fluency."
];
export function recentWorkMarkup() { return `<section class="recent-work" aria-label="Recent projects and experiments"><h3>Recent projects and experiments</h3><p class="recent-intro">October 2026 · Applied AI, local inference, and reproducible evaluation.</p><div class="recent-grid">${recentWork.map(p => `<article class="recent-card"><p class="eyebrow">${escape(p.status)}</p><h4>${escape(p.title)}</h4><p>${escape(p.text)}</p><p class="recent-evidence">${escape(p.evidence)}</p>${p.url ? `<a href="${p.url}"${p.url.startsWith("https:") ? ' target="_blank" rel="noopener noreferrer"' : ""}>Read project and evidence ↗</a>` : ""}</article>`).join("")}</div></section>`; }
export function practiceMarkup() { return `<section class="practice"><h3>How I work</h3>${practice.map(p => `<p>${escape(p)}</p>`).join("")}</section>`; }
