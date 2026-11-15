using System;
using System.Linq;
using UnityEngine;
using UnityEditor;
using Loom.MemoryPalace;

if (!EditorApplication.isPlaying) throw new Exception("Run the existing workbench in Play Mode first.");
var controller = UnityEngine.Object.FindAnyObjectByType<MemoryPalaceController>();
if (!controller) throw new Exception("Workbench controller is missing.");
var glass = Resources.Load<Material>("LoomGlass");
if (!glass || !glass.IsKeywordEnabled("_SURFACE_TYPE_TRANSPARENT") || glass.GetFloat("_ZWrite") != 0 || glass.renderQueue != 3000)
    throw new Exception("The transparent URP Resources variant must be retained for WebGL.");
var anchors = UnityEngine.Object.FindObjectsByType<MemoryAnchor>();
var expected = new[] { "Work", "Code", "Experiments", "Evidence", "Agents", "Notes" };
if (!anchors.Select(a => a.Key).OrderBy(k => k).SequenceEqual(expected.OrderBy(k => k))) throw new Exception("Six unique portals required.");
var parts = 0;
foreach (var anchor in anchors)
{
    var meshes = anchor.GetComponentsInChildren<MeshFilter>();
    if (meshes.Length < 7) throw new Exception(anchor.Key + " lacks its physical parts.");
    foreach (var filter in meshes)
    {
        var mesh = filter.sharedMesh;
        if (!mesh || mesh.vertexCount == 0 || mesh.triangles.Any(i => i < 0 || i >= mesh.vertexCount)) throw new Exception("Invalid mesh: " + filter.name);
        if (mesh.vertices.Any(v => !float.IsFinite(v.x) || !float.IsFinite(v.y) || !float.IsFinite(v.z))) throw new Exception("Nonfinite mesh: " + filter.name);
        if (filter.GetComponent<Collider>()?.GetComponentInParent<MemoryAnchor>() != anchor) throw new Exception("Part does not select its portal: " + filter.name);
        if (!filter.GetComponent<Renderer>().sharedMaterial.shader.name.StartsWith("Universal Render Pipeline/")) throw new Exception("Unexpected render pipeline.");
    }
    parts += meshes.Length;
    anchor.Animate(false, false, true);
    var position = anchor.transform.position; var rotation = anchor.transform.rotation; var scale = anchor.transform.localScale;
    anchor.Animate(false, false, true);
    if (position != anchor.transform.position || rotation != anchor.transform.rotation || scale != anchor.transform.localScale) throw new Exception("Reduced motion drift.");
    anchor.Animate(true, true, true);
    if (anchor.transform.localScale.x <= scale.x) throw new Exception("Portal selection feedback missing.");
    anchor.Animate(false, false, true);
}
if (!MemoryPalaceController.PaletteMatchesDesignTokens()) throw new Exception("Palette mismatch.");
foreach (var theme in new[] { "dark", "white" })
{
    controller.ApplyTheme(theme);
    foreach (var state in new[] { "idle", "attention", "executing", "error", "completed", "exploring" }) controller.ApplyLoomState(state);
    if (anchors.Any(a => a.GetComponentsInChildren<Renderer>().Any(r => r.sharedMaterial == null))) throw new Exception("Missing themed material.");
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
            var bounds = renderer.bounds;
            for (var corner = 0; corner < 8; corner++)
            {
                var p = bounds.center + Vector3.Scale(bounds.extents, new Vector3((corner & 1) == 0 ? -1 : 1, (corner & 2) == 0 ? -1 : 1, (corner & 4) == 0 ? -1 : 1));
                var v = camera.WorldToViewportPoint(p);
                if (v.z <= 0 || v.x < 0 || v.x > 1 || v.y < 0 || v.y > 1) throw new Exception("Portal cropped at aspect " + ratio + ": " + anchor.Key);
            }
        }
}
camera.aspect = aspect; controller.SendMessage("MoveCamera");
controller.ApplyReducedMotion("false");
return new { portals = anchors.Length, physicalParts = parts, palette = true, childSelection = true, reducedMotion = true, themes = 2, cameraAspects = 3, glassVariant = true, visualRendering = "not inspected" };
