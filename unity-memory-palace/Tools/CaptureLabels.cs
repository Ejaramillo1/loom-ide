using System;
using System.IO;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;
using Loom.MemoryPalace;

// CaptureLabels.cs — captures the game view (3D scene + IMGUI labels) so the
// screen-space portal labels can be verified with pixels. Uses
// ScreenCapture (the game view) rather than a render texture, because IMGUI
// (OnGUI) draws after the camera and never reaches a render target.

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

controller.ApplyTheme("dark");
controller.ApplyLoomState("idle");
controller.ApplyReducedMotion("true");
await Task.Delay(1200);

var outDir = Path.GetFullPath("../docs/bench-shots");
Directory.CreateDirectory(outDir);
var path = Path.Combine(outDir, "bench-labels-dark.png");
if (File.Exists(path)) File.Delete(path);
ScreenCapture.CaptureScreenshot(path, 1);
await Task.Delay(1200);

EditorApplication.ExitPlaymode();
var exists = File.Exists(path);
return new { path, exists, size = exists ? new FileInfo(path).Length : 0 };
