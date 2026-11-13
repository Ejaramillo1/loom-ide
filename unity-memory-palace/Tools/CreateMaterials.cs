using UnityEditor;
using UnityEngine;

const string directory = "Assets/Loom/Resources";
if (!AssetDatabase.IsValidFolder("Assets/Loom/Resources"))
    AssetDatabase.CreateFolder("Assets/Loom", "Resources");

Create("LoomLit", "Universal Render Pipeline/Lit");
Create("LoomUnlit", "Universal Render Pipeline/Unlit");
AssetDatabase.SaveAssets();
AssetDatabase.Refresh();
return new { lit = "Resources/LoomLit", unlit = "Resources/LoomUnlit" };

static void Create(string name, string shaderName)
{
    var path = $"Assets/Loom/Resources/{name}.mat";
    if (AssetDatabase.LoadAssetAtPath<Material>(path)) return;
    var shader = Shader.Find(shaderName);
    if (!shader) throw new System.InvalidOperationException($"Shader not found: {shaderName}");
    AssetDatabase.CreateAsset(new Material(shader) { name = name }, path);
}
