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

// Dark theme — the shipping default from the Tauri shell.
controller.ApplyTheme("dark");
controller.ApplyLoomState("idle");
await Bookmark("bench-dark-front.png", new Vector3(0f, 1.9f, -7.1f), sphere);
await Bookmark("bench-dark-three-quarter.png", new Vector3(-4.9f, 2.5f, -5.2f), sphere);
await Bookmark("bench-dark-top-down.png", new Vector3(0f, 8.4f, 0.25f), sphere);
if (volume)
{
    volume.enabled = false;
    await Bookmark("bench-dark-front-no-post.png", new Vector3(0f, 1.9f, -7.1f), sphere);
    volume.enabled = true;
}

// Light theme — §12 of the philosophy requires both modes to read.
controller.ApplyTheme("white");
controller.ApplyLoomState("idle");
await Bookmark("bench-light-front.png", new Vector3(0f, 1.9f, -7.1f), sphere);

controller.enabled = true;
EditorApplication.ExitPlaymode();
return new { shots, outDir, size = $"{width}x{height}", post = volume != null };
