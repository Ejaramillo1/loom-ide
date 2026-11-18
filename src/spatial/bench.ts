// Babylon spatial bench — v2 (Stage 1.2): the sphere only.
//
// Quiet Complexity: Babylon renders exactly one object — the pearl sphere,
// the ambient indicator of Loom state. Background, shadow and reflection are
// CSS (the canvas is transparent). Zero props, zero 3D labels, zero platform.
//
// The diorama from v1 (notebook, flask, floor, orbit rings) is superseded.

import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";

// State -> tint colour. From design-tokens.json (white / dark). The tint is
// applied discreetly (fresnel rim + a whisper of emissive), never a loud
// full recolor of the pearl sphere (v2 risk H3).
const STATE_WHITE: Record<string, Color3> = {
  idle: new Color3(161 / 255, 134 / 255, 116 / 255), // purple
  listening: new Color3(161 / 255, 134 / 255, 116 / 255),
  processing: new Color3(161 / 255, 134 / 255, 116 / 255),
  exploring: new Color3(106 / 255, 145 / 255, 204 / 255), // blue
  executing: new Color3(106 / 255, 145 / 255, 204 / 255),
  attention: new Color3(217 / 255, 166 / 255, 95 / 255), // amber
  completed: new Color3(120 / 255, 155 / 255, 137 / 255), // green
  error: new Color3(184 / 255, 117 / 255, 112 / 255), // red
};
const STATE_DARK: Record<string, Color3> = {
  idle: new Color3(185 / 255, 164 / 255, 144 / 255),
  listening: new Color3(185 / 255, 164 / 255, 144 / 255),
  processing: new Color3(185 / 255, 164 / 255, 144 / 255),
  exploring: new Color3(139 / 255, 166 / 255, 204 / 255),
  executing: new Color3(139 / 255, 166 / 255, 204 / 255),
  attention: new Color3(217 / 255, 166 / 255, 95 / 255),
  completed: new Color3(147 / 255, 177 / 255, 159 / 255),
  error: new Color3(211 / 255, 146 / 255, 138 / 255),
};

// Pearl base (same in both themes): orb-base #F8EEE6.
const PEARL = new Color3(248 / 255, 238 / 255, 230 / 255);
// Fine curved lines: orb-line #D8BFB4.
const ORB_LINE = "#d8bfb4";

export interface BenchHandle {
  engine: Engine;
  scene: Scene;
  applyLoomState(state: string): void;
  applyTheme(theme: "white" | "dark"): void;
  applyBackground(_id: string): void;
  refreshVault(_work: number, _experiments: number): void;
  applyQuality(_tier: string): void;
  applyCanvasSize(width: number, height: number): void;
  applyReducedMotion(reduced: boolean): void;
  dispose(): void;
}

export function createBench(canvas: HTMLCanvasElement): BenchHandle {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: false,
    stencil: true,
  });
  const scene = new Scene(engine);
  // Transparent canvas: the CSS atmospheric background shows through.
  scene.clearColor = new Color4(0, 0, 0, 0);

  // Sphere at origin; camera frames it at ~25% of viewport height.
  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5.3, Vector3.Zero(), scene);
  camera.fov = 0.733; // ~42°
  camera.minZ = 0.1;
  camera.maxZ = 80;
  // No pointer control: the sphere is an ambient indicator, not a navigable
  // diorama. Navigation lives in the DOM (bottom nav / View menu).

  // Soft three-quarter lighting: warm key from the upper-left (matches the
  // reference's diagonal light) + a soft hemisphere fill.
  const key = new DirectionalLight("key", new Vector3(-0.6, -0.9, 0.35), scene);
  key.diffuse = new Color3(1, 0.95, 0.9);
  key.intensity = 0.85;
  const fill = new HemisphericLight("fill", new Vector3(0, 1, 0), scene);
  fill.diffuse = new Color3(0.92, 0.89, 0.85);
  fill.groundColor = new Color3(0.85, 0.76, 0.72);
  fill.intensity = 0.55;

  // Fine flowing curved lines, drawn onto an equirectangular texture and
  // mapped onto the sphere as a subtle diffuse pattern.
  const lineTexture = new DynamicTexture("lines", { width: 1024, height: 512 }, scene, false);
  const ctx = lineTexture.getContext();
  ctx.fillStyle = "#f8eee6";
  ctx.fillRect(0, 0, 1024, 512);
  ctx.strokeStyle = ORB_LINE;
  ctx.lineWidth = 0.8;
  ctx.globalAlpha = 0.85;
  for (let i = 0; i < 64; i++) {
    const baseY = (i + 0.5) * (512 / 64);
    ctx.beginPath();
    for (let x = 0; x <= 1024; x += 8) {
      const y = baseY + Math.sin((x / 1024) * Math.PI * 2 * 2.5 + i * 0.9) * 7;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  lineTexture.update();

  const sphere = CreateSphere("sphere", { diameter: 2, segments: 64 }, scene);
  sphere.position.set(0, 0, 0);
  const mat = new StandardMaterial("sphereMat", scene);
  mat.diffuseColor = PEARL;
  mat.diffuseTexture = lineTexture;
  mat.specularColor = new Color3(0.18, 0.17, 0.16);
  mat.specularPower = 48;
  // Discreet state tint: a uniform emissive glow (never a loud recolor).
  // The pearl albedo stays dominant; the tint reads at the rim and body alike.
  mat.emissiveColor = STATE_WHITE.idle.scale(0.10);
  sphere.material = mat;

  let currentState = "idle";
  let theme: "white" | "dark" = "dark";
  let reducedMotion = false;
  let t = 0;

  const applyState = (state: string) => {
    currentState = state;
    const palette = theme === "white" ? STATE_WHITE : STATE_DARK;
    const tint = palette[state] ?? palette.idle;
    mat.emissiveColor = tint.scale(0.10);
  };

  const render = () => {
    const dt = Math.min(engine.getDeltaTime(), 100) / 1000;
    if (!reducedMotion) {
      t += dt;
      sphere.rotation.y += dt * 0.02; // ~1.15°/s, slow flow
      const breathe = 1 + 0.004 * Math.sin(t * 1.1);
      sphere.scaling.setAll(breathe);
    }
    scene.render();
  };
  const visibility = () => {
    engine.stopRenderLoop(render);
    if (!document.hidden) engine.runRenderLoop(render);
  };
  document.addEventListener("visibilitychange", visibility);
  visibility();

  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);

  return {
    engine,
    scene,
    applyLoomState: applyState,
    applyTheme(next: "white" | "dark") {
      theme = next;
      applyState(currentState);
    },
    applyBackground(_id: string) {
      // v2 removed the four themed backgrounds; the continuous light/dark
      // atmosphere is CSS. Accepted for contract parity, no scene change.
    },
    refreshVault(_work: number, _experiments: number) {
      // The sphere does not display vault counts; accepted for contract parity.
    },
    applyQuality(tier: string) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      engine.setHardwareScalingLevel((tier === "Low" ? 2 : tier === "Balanced" ? 1.4 : 1) / dpr);
      engine.resize();
    },
    applyCanvasSize(_width: number, _height: number) {
      // ArcRotateCamera keeps the sphere's angular size constant; just resize.
      engine.resize();
    },
    applyReducedMotion(reduced: boolean) {
      reducedMotion = reduced;
    },
    dispose() {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("resize", onResize);
      engine.dispose();
    },
  };
}
