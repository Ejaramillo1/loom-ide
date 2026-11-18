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
import { STATE_COLORS } from "./state-colors";
import { createPearl } from "./pearl";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { CreateSphere } from "@babylonjs/core/Meshes/Builders/sphereBuilder";

export interface BenchHandle {
  ready: Promise<void>;
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

  // Diameter is 60% of the smaller iframe dimension, leaving room for shortcuts.
  const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 5.3, Vector3.Zero(), scene);
  camera.fov = 0.733; // ~42°
  camera.minZ = 0.1;
  camera.maxZ = 80;
  // Camera stays fixed; the pearl itself is the Overview control.

  const sphere = CreateSphere("sphere", { diameter: 2, segments: 64 }, scene);
  const mat = createPearl(scene);
  sphere.material = mat;
  const ready = mat.forceCompilationAsync(sphere);

  let currentState = "idle";
  let theme: "white" | "dark" = "dark";
  let reducedMotion = false;
  let t = 0;

  const applyState = (state: string) => {
    currentState = state;
    const tint = Color3.FromHexString(STATE_COLORS[state] ?? STATE_COLORS.idle);
    mat.setColor3("stateTint", tint);
  };

  const render = () => {
    const dt = Math.min(engine.getDeltaTime(), 100) / 1000;
    if (!reducedMotion) {
      t += dt;
      sphere.rotation.y += dt * 0.02; // ~1.15°/s, slow flow
      const breathe = 1 + 0.004 * Math.sin(t * 1.1);
      sphere.scaling.setAll(breathe);
    }
    mat.setVector3("cameraPosition", camera.position);
    mat.setFloat("time", t);
    scene.render();
  };
  const visibility = () => {
    engine.stopRenderLoop(render);
    if (!document.hidden) engine.runRenderLoop(render);
  };
  document.addEventListener("visibilitychange", visibility);
  visibility();

  const onResize = () => {
    engine.resize();
    const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const fraction = Math.min(0.60, aspect * 0.60);
    camera.radius = 1 / Math.sin(Math.atan(fraction * Math.tan(camera.fov / 2)));
  };
  onResize();
  window.addEventListener("resize", onResize);

  return {
    ready,
    engine,
    scene,
    applyLoomState: applyState,
    applyTheme(next: "white" | "dark") {
      theme = next;
      mat.setFloat("dark", theme === "dark" ? 1 : 0);
      applyState(currentState);
    },
    applyBackground(_id: string) {
      // Optional atmosphere tints live in host CSS, never in the 3D scene.
    },
    refreshVault(_work: number, _experiments: number) {
      // The sphere does not display vault counts; accepted for contract parity.
    },
    applyQuality(tier: string) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      engine.setHardwareScalingLevel((tier === "Low" ? 2 : tier === "Balanced" ? 1.4 : 1) / dpr);
      onResize();
    },
    applyCanvasSize(_width: number, _height: number) {
      // ArcRotateCamera keeps the sphere's angular size constant; just resize.
      onResize();
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
