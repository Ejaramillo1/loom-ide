using UnityEditor;
using UnityEngine;

const string directory = "Assets/Loom/Resources";
if (!AssetDatabase.IsValidFolder("Assets/Loom/Resources"))
    AssetDatabase.CreateFolder("Assets/Loom", "Resources");

Create("LoomLit", "Universal Render Pipeline/Lit");
Create("LoomUnlit", "Universal Render Pipeline/Unlit");
Create("LoomGlass", "Universal Render Pipeline/Lit");
// A Resources template retains the transparent variant when URP strips unused shaders.
var glass = AssetDatabase.LoadAssetAtPath<Material>($"{directory}/LoomGlass.mat");
glass.color = new Color(0.69f, 0.84f, 0.86f, 0.22f);
glass.SetFloat("_Smoothness", 0.92f);
glass.SetFloat("_Surface", 1f);
glass.SetFloat("_SrcBlend", (float)UnityEngine.Rendering.BlendMode.SrcAlpha);
glass.SetFloat("_DstBlend", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
glass.SetFloat("_SrcBlendAlpha", (float)UnityEngine.Rendering.BlendMode.One);
glass.SetFloat("_DstBlendAlpha", (float)UnityEngine.Rendering.BlendMode.OneMinusSrcAlpha);
glass.SetFloat("_ZWrite", 0f);
glass.EnableKeyword("_SURFACE_TYPE_TRANSPARENT");
glass.SetOverrideTag("RenderType", "Transparent");
glass.renderQueue = (int)UnityEngine.Rendering.RenderQueue.Transparent;
glass.SetShaderPassEnabled("ShadowCaster", false);
EditorUtility.SetDirty(glass);
AssetDatabase.SaveAssets();
AssetDatabase.Refresh();
return new { lit = "Resources/LoomLit", unlit = "Resources/LoomUnlit", glass = "Resources/LoomGlass" };

static void Create(string name, string shaderName)
{
    var path = $"Assets/Loom/Resources/{name}.mat";
    if (AssetDatabase.LoadAssetAtPath<Material>(path)) return;
    var shader = Shader.Find(shaderName);
    if (!shader) throw new System.InvalidOperationException($"Shader not found: {shaderName}");
    AssetDatabase.CreateAsset(new Material(shader) { name = name }, path);
}
