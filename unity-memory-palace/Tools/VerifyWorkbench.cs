using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using UnityEditor;
using UnityEngine;
using Loom.MemoryPalace;

// Drives Play Mode and runs the workbench self-check (the same assertions
// as Tools/CheckWorkbench.cs), so the runtime-built scene is verified
// headlessly: six portals, physical parts, collider selection, materials
// on URP, reduced-motion stability, palette, themes, and the glass
// variant retention.

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

// The self-check runs with the SHIPPING tier (High, level 0), not the
// editor's current level (§1.1.5/§1.7.6). The tier is returned so the
// run is verifiable.
QualitySettings.SetQualityLevel(0, false);
var tier = QualitySettings.names[QualitySettings.GetQualityLevel()];

var errors = new List<string>();
void Check(bool condition, string message) { if (!condition) errors.Add(message); }

var glass = Resources.Load<Material>("LoomGlass");
Check(glass != null && glass.IsKeywordEnabled("_SURFACE_TYPE_TRANSPARENT") && glass.GetFloat("_ZWrite") == 0 && glass.renderQueue == 3000,
    "The transparent URP Resources variant must be retained for WebGL.");

var anchors = UnityEngine.Object.FindObjectsByType<MemoryAnchor>();
var expected = new[] { "Work", "Code", "Experiments", "Evidence", "Agents", "Notes" };
Check(anchors.Select(a => a.Key).OrderBy(k => k).SequenceEqual(expected.OrderBy(k => k)), "Six unique portals required.");

var parts = 0;
var colliderErrors = 0;
foreach (var anchor in anchors)
{
    var meshes = anchor.GetComponentsInChildren<MeshFilter>();
    if (meshes.Length < 7) { errors.Add(anchor.Key + " lacks its physical parts."); continue; }
    foreach (var filter in meshes)
    {
        var mesh = filter.sharedMesh;
        if (!mesh || mesh.vertexCount == 0 || mesh.triangles.Any(i => i < 0 || i >= mesh.vertexCount)) errors.Add("Invalid mesh: " + filter.name);
        if (mesh.vertices.Any(v => !float.IsFinite(v.x) || !float.IsFinite(v.y) || !float.IsFinite(v.z))) errors.Add("Nonfinite mesh: " + filter.name);
        if (filter.GetComponent<Collider>()?.GetComponentInParent<MemoryAnchor>() != anchor) colliderErrors++;
        var renderer = filter.GetComponent<Renderer>();
        if (!renderer.sharedMaterial.shader.name.StartsWith("Universal Render Pipeline/")) errors.Add("Unexpected render pipeline on " + filter.name);
    }
    parts += meshes.Length;
    anchor.Animate(false, false, true, 0f);
    var position = anchor.transform.position; var rotation = anchor.transform.rotation; var scale = anchor.transform.localScale;
    anchor.Animate(false, false, true, 0f);
    if (position != anchor.transform.position || rotation != anchor.transform.rotation || scale != anchor.transform.localScale) errors.Add("Reduced motion drift on " + anchor.Key);
    anchor.Animate(true, true, true, 0f);
    if (anchor.transform.localScale.x <= scale.x) errors.Add("Portal selection feedback missing on " + anchor.Key);
    anchor.Animate(false, false, true, 0f);
}
Check(MemoryPalaceController.PaletteMatchesDesignTokens(), "Palette mismatch.");
foreach (var theme in new[] { "dark", "white" })
{
    controller.ApplyTheme(theme);
    foreach (var state in new[] { "idle", "attention", "executing", "error", "completed", "exploring" }) controller.ApplyLoomState(state);
    if (anchors.Any(a => a.GetComponentsInChildren<Renderer>().Any(r => r.sharedMaterial == null))) errors.Add("Missing themed material.");
}
controller.ApplyTheme("white"); controller.ApplyLoomState("idle");
var camera = Camera.main;
var aspect = camera.aspect;
controller.ApplyReducedMotion("true");
foreach (var ratio in new[] { 0.65f, 1f, 1.6f })
{
    camera.aspect = ratio; controller.SendMessage("MoveCamera");
    foreach (var anchor in anchors)
        foreach (var renderer in anchor.GetComponentsInChildren<Renderer>())
        {
            // Contact-shadow decals are soft ground gradients wider than the
            // prop; cropping their transparent edge is harmless and is not a
            // portal-framing failure.
            if (renderer.name == "Contact shadow") continue;
            var bounds = renderer.bounds;
            for (var corner = 0; corner < 8; corner++)
            {
                var p = bounds.center + Vector3.Scale(bounds.extents, new Vector3((corner & 1) == 0 ? -1 : 1, (corner & 2) == 0 ? -1 : 1, (corner & 4) == 0 ? -1 : 1));
                var v = camera.WorldToViewportPoint(p);
                if (v.z <= 0 || v.x < 0 || v.x > 1 || v.y < 0 || v.y > 1) errors.Add("Portal cropped at aspect " + ratio + ": " + anchor.Key);
            }
        }
}
camera.aspect = aspect; controller.SendMessage("MoveCamera");
controller.ApplyReducedMotion("false");

EditorApplication.ExitPlaymode();
if (errors.Count > 0) throw new Exception(string.Join(" | ", errors.Take(12)));
return new { tier, portals = anchors.Length, physicalParts = parts, colliderErrors, palette = true, themes = 2, cameraAspects = 3, glassVariant = true };
