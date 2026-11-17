using UnityEditor;
using UnityEngine;

// ConfigureHdri.cs — authoring command for the selectable scene backgrounds.
// (1) Imports the single allowed external asset — the Poly Haven "Dikhololo
// Night" HDRI (CC0, 2K) — as a linear 2D equirectangular panorama, and
// (2) writes the four Resources skybox materials that reference the Loom
// skybox shaders. Because those materials live in Resources, they (and the
// shaders they reference) are bundled into the WebGL build and survive IL2CPP
// stripping; MemoryPalaceController loads them and swaps RenderSettings.skybox
// at runtime. Ambient lighting stays Gradient (Trilight), so the swap is cheap.

const string hdriPath = "Assets/Loom/Resources/Textures/dikhololo_night_2k.hdr";

// 1. Import the HDRI as linear HDR radiance (never sRGB, never compressed).
var importer = AssetImporter.GetAtPath(hdriPath) as TextureImporter;
if (!importer) throw new System.Exception("HDRI not found at " + hdriPath);
importer.textureType = TextureImporterType.Default;
importer.textureShape = TextureImporterShape.Texture2D;
importer.sRGBTexture = false;
importer.mipmapEnabled = true;
importer.wrapMode = TextureWrapMode.Repeat;
importer.filterMode = FilterMode.Bilinear;
importer.anisoLevel = 1;
importer.maxTextureSize = 2048;
importer.textureCompression = TextureImporterCompression.Uncompressed;
var platform = importer.GetDefaultPlatformTextureSettings();
platform.format = TextureImporterFormat.RGBAHalf;
platform.textureCompression = TextureImporterCompression.Uncompressed;
importer.SetPlatformTextureSettings(platform);
importer.SaveAndReimport();

var panorama = AssetDatabase.LoadAssetAtPath<Texture2D>(hdriPath);
if (!panorama) throw new System.Exception("HDRI failed to import.");

var gradient = Shader.Find("Loom/SkyboxGradient");
var panoramic = Shader.Find("Loom/SkyboxPanoramic");
if (!gradient) throw new System.Exception("Loom/SkyboxGradient shader is missing.");
if (!panoramic) throw new System.Exception("Loom/SkyboxPanoramic shader is missing.");

// 2. Three dark, low-saturation gradient backgrounds (Quiet Complexity).
Gradient("SkyboxCharcoal", new Color(43f / 255f, 38f / 255f, 33f / 255f), new Color(66f / 255f, 57f / 255f, 49f / 255f), new Color(28f / 255f, 25f / 255f, 23f / 255f));
Gradient("SkyboxDusk", new Color(38f / 255f, 42f / 255f, 50f / 255f), new Color(52f / 255f, 55f / 255f, 64f / 255f), new Color(26f / 255f, 29f / 255f, 35f / 255f));
Gradient("SkyboxMoss", new Color(40f / 255f, 43f / 255f, 36f / 255f), new Color(55f / 255f, 57f / 255f, 46f / 255f), new Color(27f / 255f, 31f / 255f, 28f / 255f));

// 3. The imported HDRI, dimmed and desaturated into the same palette.
var night = Create("SkyboxNight", panoramic);
night.SetTexture("_MainTex", panorama);
night.SetFloat("_Exposure", 0.55f);
night.SetColor("_Tint", new Color(188f / 255f, 196f / 255f, 210f / 255f));
night.SetFloat("_Saturation", 0.35f);
night.SetFloat("_Rotation", 0f);
EditorUtility.SetDirty(night);

AssetDatabase.SaveAssets();
AssetDatabase.Refresh();
return new
{
    panorama = panorama.width + "x" + panorama.height,
    format = panorama.format.ToString(),
    sRGB = importer.sRGBTexture,
    materials = new[] { "SkyboxCharcoal", "SkyboxDusk", "SkyboxMoss", "SkyboxNight" },
};

Material Create(string name, Shader shader)
{
    var path = $"Assets/Loom/Resources/{name}.mat";
    var existing = AssetDatabase.LoadAssetAtPath<Material>(path);
    if (existing) return existing;
    var mat = new Material(shader) { name = name };
    AssetDatabase.CreateAsset(mat, path);
    return mat;
}

void Gradient(string name, Color top, Color horizon, Color ground)
{
    var mat = Create(name, gradient);
    mat.SetColor("_Top", top);
    mat.SetColor("_Horizon", horizon);
    mat.SetColor("_Ground", ground);
    mat.SetFloat("_HorizonHeight", 0.08f);
    mat.SetFloat("_Exposure", 1f);
    EditorUtility.SetDirty(mat);
}
