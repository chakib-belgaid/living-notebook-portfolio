# Project presentation evidence

Checked against the public upstream repositories on 6 October 2026. These are documentation and distribution checks, not hands-on Android or hardware performance tests.

## Distribution

| Project | Verified public evidence | Portfolio wording |
| --- | --- | --- |
| Whisperbook | [v0.1 release](https://github.com/chakib-belgaid/whisper-book/releases/tag/v0.1) includes `whisperbook-v0.1-debug.apk`, a SHA-256 file, and license notices. Release notes specify Android 8+, arm64, and a debug-signed testing build. | Installable Android test APK. Link to the release page so visitors see its requirements and notices. Do not equate current source features with the older downloadable build or imply Play Store distribution. |
| Wattch Core | [Public releases](https://github.com/chakib-belgaid/wattch-core/releases) has no release assets. The [quick start](https://github.com/chakib-belgaid/wattch-core#quick-start) builds the Rust workspace and installs Python from source. The [extension README](https://github.com/chakib-belgaid/wattch-core/tree/main/editors/vscode-energy-tests#development) documents building locally and launching an Extension Development Host. | Build from source. No Marketplace release is linked by the project documentation; absence of a link alone is not proof that no listing exists anywhere. |

The Whisperbook APK was not downloaded, installed, or benchmarked in this portfolio update. Wattch's build and extension instructions were inspected, not executed here. The Android browser-speech illustration and Wattch synthetic screenshot remain explicitly labeled.

## Canonical research repositories

- [pyJoules](https://github.com/powerapi-ng/pyJoules): Python energy measurement. Its README documents `pip install pyJoules` and hardware/platform limitations.
- [Joulehunter](https://github.com/powerapi-ng/joulehunter): energy profiling based on pyinstrument. GitHub marks the repository archived; its existing installation documentation is not a promise of active maintenance.
- [PowerAPI](https://github.com/powerapi-ng/powerapi): organization-owned framework for software-defined power meters.

The portfolio and its README link directly to these repositories. They do not attribute all organization work, stars, or citations to one contributor. Updating profile pins or packaging unrelated repositories is separate from this portfolio change.

## Measurements still needed

No reproducible public device benchmark or native-C comparison was found in the reviewed project documentation. Do not turn an example number, model-vendor benchmark, configured threshold, or synthetic fixture into a measured product outcome.

### Whisperbook

Record the app commit and APK checksum, model/runtime versions, device/SoC, Android version, acceleration provider, thread count, and thermal/battery conditions. Use a redistributable fixed text fixture, recording language, voice, input length, and generated audio duration.

Measure cold and warm time to first playable audio separately, synthesis wall time, and peak process PSS in MiB. Report real-time factor as synthesis seconds / audio seconds (lower is faster), or explicitly label its inverse as audio seconds generated per wall-clock second. Include repetition count, median/p95, raw logs, and the benchmark script. APK size is a download characteristic, not a substitute for runtime RAM.

### Wattch Core

Compare the daemon with a minimal native C reader on the same Linux host, reading the same RAPL domains through the same interface at identical intervals. Record CPU, kernel, commit, counter access method, privileges, workload, warmup, duration, and repeated trial order. Include an uninstrumented workload baseline.

Report daemon CPU time and peak RSS, sampling interval error and dropped samples, workload slowdown against baseline, and the C reader's corresponding costs. Preserve raw traces and commands. Separate measurement overhead from energy-estimation accuracy; synthetic data can exercise protocol behavior but cannot establish either hardware result.

Publish exact measurements only once those artifacts are available, then replace the pending evidence text in `src/content.ts` and update both translations. Keep the device, workload, version, and source link next to each number.
