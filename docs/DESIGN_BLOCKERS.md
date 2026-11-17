# Design blockers and verification boundaries

- Prior browser/computer visual inspection was permission-blocked. No workaround or alternate capture path will bypass that denial. Pixel-level desktop/WebGL rendering, physical-form appearance, responsive screenshots and photorealistic parity are not verified.
- Resolved: Unity initially had no connected Editor. A normal host launch of the existing project completed; recompile and runtime geometry self-check are available. No new Unity package was installed.
- Resolved: sandbox loopback restrictions blocked the existing Rust window-registration tests. Rerunning the unchanged suites with loopback access passed.
- Q2 remains deferred; Unity-load failure behavior is unchanged.
