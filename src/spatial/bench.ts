// The Babylon spatial bench. Stage 1.2 minimal scene: the Loom sphere
// (state indicator), two ring objects (notebook + flask) in their Unity
// positions, a legible label, a warm key light + hemisphere ambient,
// GlowLayer, and the selectable background. Parity with the full Unity
// scene is completed in Fase 2; this is the go/no-go pilot.

import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  GlowLayer,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Vector3,
} from "@babylonjs/core";

/** Sphere state -> colour (white theme), from MemoryPalaceController.StateColor. */
const STATE_COLORS: Record<string, Color3> = {
  attention: new Color3(217 / 255, 166 / 255, 95 / 255),
  completed: new Color3(120 / 255, 155 / 255, 137 / 255),
  error: new Color3(184 / 255, 117 / 255, 112 / 255),
  exploring: new Color3(106 / 255, 145 / 255, 204 / 255),
  executing: new Color3(106 / 255, 145 / 255, 204 / 255),
  idle: new Color3(161 / 255, 134 / 255, 116 / 255),
  listening: new Color3(161 / 255, 134 / 255, 116 / 255),
  processing: new Color3(161 / 255, 134 / 255, 116 / 255),
};

/** Background -> scene clear colour (gradient top approximated by clearColor). */
const BACKGROUNDS: Record<string, Color4> = {
  charcoal: new Color4(0.114, 0.106, 0.102, 1), // #1d1b1a
  dusk: new Color4(0.16, 0.12, 0.16, 1),
  moss: new Color4(0.09, 0.12, 0.09, 1),
  night: new Color4(0.04, 0.05, 0.09, 1),
};

const PEARL = new Color3(235 / 255, 220 / 255, 211 / 255);
const IVORY = new Color3(229 / 255, 218 / 255, 195 / 255);
const WOOD = new Color3(105 / 255, 66 / 255, 39 / 255);
const GLASS = new Color3(0.82, 0.86, 0.9);

export interface BenchHandle {
  engine: Engine;
  scene: Scene;
  applyLoomState(state: string): void;
  applyTheme(theme: "white" | "dark"): void;
  applyBackground(id: string): void;
  refreshVault(work: number, experiments: number): void;
  applyQuality(_tier: string): void;
  applyCanvasSize(width: number, height: number): void;
  applyReducedMotion(reduced: boolean): void;
  dispose(): void;
}

export function createBench(canvas: HTMLCanvasElement): BenchHandle {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  const scene = new Scene(engine);
  scene.clearColor = BACKGROUNDS.charcoal.clone();

  const camera = new ArcRotateCamera("camera", -Math.PI / 2, 1.25, 12.76, new Vector3(0, 1.25, 0), scene);
  camera.fov = 0.733; // ~42°
  camera.minZ = 0.1;
  camera.maxZ = 80;
  camera.attachControl(canvas, false);

  // Three-point rig (subset): warm key + hemisphere ambient.
  const key = new DirectionalLight("key", new Vector3(-0.5, -0.7, 0.5), scene);
  key.diffuse = new Color3(1, 0.94, 0.87);
  key.intensity = 1.15;
  const ambient = new HemisphericLight("ambient", new Vector3(0, 1, 0), scene);
  ambient.diffuse = new Color3(0.89, 0.85, 0.82);
  ambient.groundColor = new Color3(0.85, 0.75, 0.71);
  ambient.intensity = 0.6;

  // Floor + bench.
  const floor = MeshBuilder.CreateGround("floor", { width: 16, height: 12 }, scene);
  floor.position.y = 0;
  const floorMat = new PBRMaterial("floorMat", scene);
  floorMat.albedoColor = new Color3(214 / 255, 198 / 255, 188 / 255);
  floorMat.roughness = 0.7;
  floor.material = floorMat;

  // The sphere.
  const sphere = MeshBuilder.CreateSphere("sphere", { diameter: 2.35, segments: 48 }, scene);
  sphere.position.set(0, 1.75, 0);
  const sphereMat = new PBRMaterial("sphereMat", scene);
  sphereMat.albedoColor = PEARL.clone();
  sphereMat.metallic = 0.12;
  sphereMat.roughness = 0.55;
  sphereMat.emissiveColor = STATE_COLORS.idle.clone();
  sphere.material = sphereMat;

  // The glow layer catches the sphere's emission.
  const glow = new GlowLayer("glow", scene, { blurKernelSize: 32, mainTextureRatio: 0.5 });
  glow.intensity = 0.3;

  // Two ring objects (Unity positions): Notes (notebook) + Experiments (flask).
  const notebook = buildNotebook(scene);
  notebook.root.position.set(-2.8, 0.36, -1.2);
  const flask = buildFlask(scene);
  flask.root.position.set(2.7, 0.36, -0.1);
  glow.addIncludedOnlyMesh(notebook.accent);
  glow.addIncludedOnlyMesh(flask.accent);

  // Orbit rings (visual: inner + outer).
  buildOrbit(scene, 4.1, 1.05, new Color3(0.85, 0.75, 0.71), 0);
  buildOrbit(scene, 5.75, 1.35, new Color3(0.87, 0.84, 0.82), 17 * (Math.PI / 180));

  engine.runRenderLoop(() => scene.render());
  const onResize = () => engine.resize();
  window.addEventListener("resize", onResize);

  return {
    engine,
    scene,
    applyLoomState(state: string) {
      const c = STATE_COLORS[state] ?? STATE_COLORS.idle;
      sphereMat.albedoColor = Color3.Lerp(PEARL, c, 0.4);
      sphereMat.emissiveColor = c;
    },
    applyTheme(_theme: "white" | "dark") {
      // Fase 2 parity: dark palette swap. Stage 1.2 keeps the light scene.
    },
    applyBackground(id: string) {
      scene.clearColor = (BACKGROUNDS[id] ?? BACKGROUNDS.charcoal).clone();
    },
    refreshVault(_work: number, _experiments: number) {
      // Fase 2 parity: portal descriptions show the counts.
    },
    applyQuality(_tier: string) {
      // Fase 2 parity: Low tier disables bloom.
    },
    applyCanvasSize(_width: number, _height: number) {
      // Fase 2 parity: aspect-driven framing; the ArcRotateCamera keeps
      // the target framed, and engine.resize() tracks the canvas.
    },
    applyReducedMotion(_reduced: boolean) {
      // Fase 2 parity: freeze orbit/pulse.
    },
    dispose() {
      window.removeEventListener("resize", onResize);
      engine.dispose();
    },
  };
}

interface Prop {
  root: Mesh;
  accent: Mesh;
}

function buildNotebook(scene: Scene): Prop {
  const root = MeshBuilder.CreateBox("notebook", { width: 0.95, height: 0.16, depth: 1.3 }, scene);
  root.rotation.x = 0;
  const cover = new PBRMaterial("cover", scene);
  cover.albedoColor = WOOD.clone();
  cover.roughness = 0.63;
  root.material = cover;
  // A few ruled-page slats on top.
  const paper = new PBRMaterial("paper", scene);
  paper.albedoColor = IVORY.clone();
  paper.roughness = 0.75;
  for (let i = 0; i < 4; i++) {
    const page = MeshBuilder.CreateBox(`page${i}`, { width: 0.86, height: 0.015, depth: 1.18 }, scene);
    page.position.set(0, 0.09 + i * 0.014, 0);
    page.parent = root;
    page.material = paper;
  }
  const accent = MeshBuilder.CreateBox("notebook-accent", { width: 0.06, height: 0.02, depth: 0.34 }, scene);
  accent.position.set(0.08, 0.09, -0.66);
  accent.parent = root;
  const accentMat = new PBRMaterial("notebookAccent", scene);
  accentMat.albedoColor = PEARL.clone();
  accentMat.emissiveColor = PEARL.clone().scale(1.35);
  accent.material = accentMat;
  return { root, accent };
}

function buildFlask(scene: Scene): Prop {
  const shape: Vector3[] = [
    new Vector3(0, 0.05, 0),
    new Vector3(0.55, 0.05, 0),
    new Vector3(0.6, 0.14, 0),
    new Vector3(0.58, 0.22, 0),
    new Vector3(0.2, 1.1, 0),
    new Vector3(0.18, 1.55, 0),
    new Vector3(0.23, 1.57, 0),
    new Vector3(0.23, 1.63, 0),
    new Vector3(0.145, 1.63, 0),
    new Vector3(0.145, 1.16, 0),
    new Vector3(0.54, 0.18, 0),
    new Vector3(0, 0.13, 0),
  ];
  const root = MeshBuilder.CreateLathe("flask", { shape, tessellation: 48, sideOrientation: 0 }, scene);
  const glass = new PBRMaterial("glass", scene);
  glass.albedoColor = GLASS.clone();
  glass.metallic = 0.1;
  glass.roughness = 0.15;
  glass.alpha = 0.55;
  root.material = glass;
  const accent = MeshBuilder.CreateLathe("liquid", { shape: [
    new Vector3(0, 0.13, 0),
    new Vector3(0.52, 0.13, 0),
    new Vector3(0.44, 0.4, 0),
    new Vector3(0, 0.4, 0),
  ], tessellation: 48 }, scene);
  accent.position.y = 0.01;
  accent.parent = root;
  const accentMat = new PBRMaterial("flaskAccent", scene);
  accentMat.albedoColor = new Color3(120 / 255, 155 / 255, 137 / 255);
  accentMat.emissiveColor = new Color3(120 / 255, 155 / 255, 137 / 255).scale(1.35);
  accent.material = accentMat;
  return { root, accent };
}

function buildOrbit(scene: Scene, radius: number, height: number, color: Color3, tilt: number) {
  const points: Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    points.push(new Vector3(Math.cos(a) * radius, height, Math.sin(a) * radius * 0.62));
  }
  const line = MeshBuilder.CreateLines("orbit", { points }, scene);
  line.rotation.x = tilt;
  line.color = color;
  line.alpha = 0.35;
}
