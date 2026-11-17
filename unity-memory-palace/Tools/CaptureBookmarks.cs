using System;
using System.IO;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
using Loom.MemoryPalace;

// CaptureBookmarks.cs — the fixed camera bookmarks from §8.2, in Editor Play
// Mode: front, three-quarter and top-down views of the bench, dark and light
// themes, with and without the global grade, at a fixed 1280x548 buffer.
// Written to docs/bench-shots/ in the repo.
//
// These are Editor captures, not the Tauri window (D14 stays blocked); they
// are the first pixel-level evidence the bench renders as intended, and the
// fixed views future passes judge against.

EditorApplication.EnterPlaymode();
var started = DateTime.UtcNow;
while (!EditorApplication.isPlaying && (DateTime.UtcNow - started).TotalSeconds < 90)
    await Task.Delay(250);
if (!EditorApplication.isPlaying) throw new Exception("Play mode did not start.");

started = DateTime.UtcNow;
MemoryPalaceController controller = null;
while (controller == null && (DateTime.UtcNow - started).TotalSeconds < 90)
{
    controller = UnityEngine.Object.FindAnyObjectByType<MemoryPalaceController>();
    if (controller == null) await Task.Delay(250);
}
if (!controller) throw new Exception("Workbench controller is missing.");

// Let the world, lights and post settle, then freeze the controller so the
// orbit pulse and camera follow do not fight the bookmark poses.
await Task.Delay(1600);
controller.enabled = false;

var camera = Camera.main;
if (!camera) throw new Exception("No main camera.");
var volume = UnityEngine.Object.FindAnyObjectByType<UnityEngine.Rendering.Volume>();

var outDir = Path.GetFullPath("../docs/bench-shots");
Directory.CreateDirectory(outDir);
var shots = 0;
const int width = 1280, height = 548;
var rt = new RenderTexture(width, height, 24, RenderTextureFormat.ARGB32);
var tex = new Texture2D(width, height, TextureFormat.RGB24, false);

async Task Capture(string name)
{
    camera.targetTexture = rt;
    await Task.Delay(250);
    RenderTexture.active = rt;
    tex.ReadPixels(new Rect(0, 0, width, height), 0, 0);
    tex.Apply();
    File.WriteAllBytes(Path.Combine(outDir, name), tex.EncodeToPNG());
    RenderTexture.active = null;
    camera.targetTexture = null;
    shots++;
}

async Task Bookmark(string name, Vector3 position, Vector3 target)
{
    camera.transform.position = position;
    camera.transform.rotation = Quaternion.LookRotation(target - position);
    await Capture(name);
}

var sphere = new Vector3(0f, 1.75f, 0f);
// The front bookmark matches the runtime camera (MoveCamera's 17.9° pitch
// at aspect ≥ 1.1); the other two are look-dev views.
var bench = new Vector3(0f, 1.25f, 0f);

// Dark theme — the shipping default from the Tauri shell.
controller.ApplyTheme("dark");
controller.ApplyLoomState("idle");
await Bookmark("bench-dark-front.png", new Vector3(0f, 5.37f, -12.76f), bench);
await Bookmark("bench-dark-three-quarter.png", new Vector3(-9.8f, 5.37f, -8.2f), bench);
await Bookmark("bench-dark-top-down.png", new Vector3(0f, 13f, 0.4f), bench);
if (volume)
{
    volume.enabled = false;
    await Bookmark("bench-dark-front-no-post.png", new Vector3(0f, 5.37f, -12.76f), bench);
    volume.enabled = true;
}

// Light theme — §12 of the philosophy requires both modes to read.
controller.ApplyTheme("white");
controller.ApplyLoomState("idle");
await Bookmark("bench-light-front.png", new Vector3(0f, 5.37f, -12.76f), bench);

// The narrow centre-column framing the app actually uses (aspect ≈ 0.6):
// the camera pulls back further, so judge at that size too.
controller.ApplyTheme("dark");
camera.aspect = 0.6f;
controller.SendMessage("MoveCamera");
await Bookmark("bench-column.png", new Vector3(0f, 8.8f, -23.3f), bench);
camera.aspect = 1280f / 548f;

// §1.6.5: judge the rig light by light — key alone, fill alone, rim alone.
var allLights = UnityEngine.Object.FindObjectsByType<Light>(FindObjectsInactive.Exclude);
Light ByName(string n) => System.Array.Find(allLights, l => l.name == n);
var keyLight = ByName("Warm key");
var fillLight = ByName("Cool fill");
var rimLight = ByName("White rim");
var saved = new System.Collections.Generic.Dictionary<Light, float>();
foreach (var l in allLights) saved[l] = l.intensity;
async Task Solo(string name, Light keep)
{
    foreach (var l in allLights) l.intensity = l == keep ? l.intensity : 0f;
    await Bookmark(name, new Vector3(0f, 5.37f, -12.76f), bench);
    foreach (var l in allLights) l.intensity = saved[l];
}
await Solo("bench-light-key.png", keyLight);
await Solo("bench-light-fill.png", fillLight);
await Solo("bench-light-rim.png", rimLight);

controller.enabled = true;
EditorApplication.ExitPlaymode();
return new { shots, outDir, size = $"{width}x{height}", post = volume != null };
