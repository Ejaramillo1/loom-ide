// BeautifyBench.cs — one-shot editor step for the beauty pass (build-plan
// §5.7/§5.8/§7): quality tiers, SSAO, WebGL 2.0 only, and the preloaded
// shader-variant canaries.
//
// Lightmap baking, baked reflection probes and light probe groups are
// deliberately absent: the bench is built at runtime in Awake, and baked GI
// needs an authored static scene. The runtime equivalents shipped instead:
// the three-point rig, HDR + ACES + Bloom grade, SSAO, and contact-shadow
// decals under every object (MemoryPalaceController).

using System;
using System.IO;
using UnityEditor;
using UnityEditor.Build;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

static void SetSsaoSetting(SerializedObject ssao, string name, float value)
{
    var settings = ssao.FindProperty("m_Settings");
    var prop = settings.FindPropertyRelative(name);
    if (prop != null) prop.floatValue = value;
}

var step = "load-assets";
var mobile = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/Mobile_RPAsset.asset");
var pc = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>("Assets/Settings/PC_RPAsset.asset");
if (!mobile || !pc) throw new Exception("URP assets missing under Assets/Settings");

step = "ssao";
var ssaoAdded = 0;
foreach (var asset in new[] { mobile, pc })
{
    foreach (var renderer in asset.rendererDataList.ToArray())
    {
        if (renderer.rendererFeatures.Exists(f => f is ScreenSpaceAmbientOcclusion)) continue;
        var ssao = ScriptableObject.CreateInstance<ScreenSpaceAmbientOcclusion>();
        ssao.name = "Screen Space Ambient Occlusion";
        var ssaoSo = new SerializedObject(ssao);
        var settings = ssaoSo.FindProperty("m_Settings");
        if (settings == null) throw new Exception("SSAO has no m_Settings property");
        SetSsaoSetting(ssaoSo, "Intensity", 0.5f);
        SetSsaoSetting(ssaoSo, "SampleCount", 4f);
        var downsample = settings.FindPropertyRelative("Downsample");
        if (downsample != null) downsample.boolValue = true;
        ssaoSo.ApplyModifiedProperties();
        renderer.rendererFeatures.Add(ssao);
        AssetDatabase.AddObjectToAsset(ssao, renderer);
        EditorUtility.SetDirty(renderer);
        ssaoAdded++;
    }
    EditorUtility.SetDirty(asset);
}

step = "tiers";

// Tier table (§5.8): renderScale is the low-tier lever; MSAA is
// forward-only and stays on for High/Balanced.
mobile.renderScale = 1f;
mobile.msaaSampleCount = 4;

const string balancedPath = "Assets/Settings/Balanced_RPAsset.asset";
const string lowPath = "Assets/Settings/Low_RPAsset.asset";
if (!File.Exists(balancedPath)) AssetDatabase.CopyAsset("Assets/Settings/Mobile_RPAsset.asset", balancedPath);
if (!File.Exists(lowPath)) AssetDatabase.CopyAsset("Assets/Settings/Mobile_RPAsset.asset", lowPath);
var balanced = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(balancedPath);
var low = AssetDatabase.LoadAssetAtPath<UniversalRenderPipelineAsset>(lowPath);
balanced.renderScale = 0.85f;
balanced.msaaSampleCount = 2;
low.renderScale = 0.75f;
low.msaaSampleCount = 1;
EditorUtility.SetDirty(balanced);
EditorUtility.SetDirty(low);

// The lowest tier drops SSAO entirely (§5.7): baked AO equivalents are the
// contact-shadow decals, and SSAO's depth priming + blur passes are exactly
// the cost integrated GPUs should not pay.
const string lowRendererPath = "Assets/Settings/Low_Renderer.asset";
if (!File.Exists(lowRendererPath)) AssetDatabase.CopyAsset("Assets/Settings/Mobile_Renderer.asset", lowRendererPath);
var lowRenderer = AssetDatabase.LoadAssetAtPath<UniversalRendererData>(lowRendererPath);
lowRenderer.rendererFeatures.RemoveAll(f => f is ScreenSpaceAmbientOcclusion);
EditorUtility.SetDirty(lowRenderer);
var lowSo = new SerializedObject(low);
var lowRendererList = lowSo.FindProperty("m_RendererDataList");
if (lowRendererList != null && lowRendererList.arraySize > 0)
{
    lowRendererList.GetArrayElementAtIndex(0).objectReferenceValue = lowRenderer;
    lowSo.ApplyModifiedProperties();
}

// Quality levels: High (WebGL + Standalone default), Balanced, Low.
var levels = new (string, UniversalRenderPipelineAsset)[]
{
    ("High", mobile),
    ("Balanced", balanced),
    ("Low", low),
};
var qsObject = new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/QualitySettings.asset")[0]);
var list = qsObject.FindProperty("m_QualitySettings");
list.arraySize = levels.Length;
for (var i = 0; i < levels.Length; i++)
{
    var entry = list.GetArrayElementAtIndex(i);
    entry.FindPropertyRelative("name").stringValue = levels[i].Item1;
    entry.FindPropertyRelative("customRenderPipeline").objectReferenceValue = levels[i].Item2;
}
var defaults = qsObject.FindProperty("m_PerPlatformDefaultQuality");
// The per-platform defaults serialize as pairs { first: platform, second:
// quality level } — find WebGL and Standalone by name and point both at
// the High tier (level 0).
var pairs = defaults.FindPropertyRelative("Array.size").intValue;
for (var i = 0; i < pairs; i++)
{
    var pair = defaults.FindPropertyRelative($"Array.data[{i}]");
    var platform = pair.FindPropertyRelative("first").stringValue;
    if (platform == "WebGL" || platform == "Standalone")
        pair.FindPropertyRelative("second").intValue = 0;
}
qsObject.ApplyModifiedProperties();

// WebGL 2.0 only (§7.2): HDR + MSAA + post is the fragile combination on
// WebGL 1.0; Chromium (the Tauri WebView) is WebGL2.
PlayerSettings.SetGraphicsAPIs(BuildTarget.WebGL, new[] { GraphicsDeviceType.OpenGLES3 });

// WebGL build-size discipline (§7.4): data caching on, exceptions none,
// managed stripping High (the link.xml keeps the primitive colliders and
// the material canaries keep the runtime-toggled shader variants), and
// IL2CPP code generation set for smaller builds.
PlayerSettings.WebGL.dataCaching = true;
PlayerSettings.WebGL.exceptionSupport = WebGLExceptionSupport.None;
PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.WebGL, ManagedStrippingLevel.High);
try
{
    PlayerSettings.SetIl2CppCodeGeneration(NamedBuildTarget.WebGL, Il2CppCodeGeneration.OptimizeSize);
}
catch (Exception)
{
    // Older editors lack the named-build-target API; stripping level alone
    // still applies. Not an error.
}

// Preloaded canaries (§7.3): the _EMISSION, _NORMALMAP and transparent
// variants ride in a preloaded collection so runtime keyword toggles never
// silently no-op in an IL2CPP-stripped build.
var svc = new ShaderVariantCollection();
var lit = Shader.Find("Universal Render Pipeline/Lit");
var unlit = Shader.Find("Universal Render Pipeline/Unlit");
var particleUnlit = Shader.Find("Universal Render Pipeline/Particles/Unlit");
if (lit)
{
    svc.Add(new ShaderVariantCollection.ShaderVariant(lit, PassType.ScriptableRenderPipeline,
        new[] { "_EMISSION", "_NORMALMAP", "_SURFACE_TYPE_TRANSPARENT", "_ALPHAPREMULTIPLY_ON" }));
    svc.Add(new ShaderVariantCollection.ShaderVariant(lit, PassType.ScriptableRenderPipeline, new string[0]));
}
if (unlit)
    svc.Add(new ShaderVariantCollection.ShaderVariant(unlit, PassType.ScriptableRenderPipeline, new string[0]));
if (particleUnlit)
    svc.Add(new ShaderVariantCollection.ShaderVariant(particleUnlit, PassType.ScriptableRenderPipeline, new string[0]));
const string svcPath = "Assets/Settings/WorkbenchShaders.shadervariants";
if (File.Exists(svcPath)) AssetDatabase.DeleteAsset(svcPath);
AssetDatabase.CreateAsset(svc, svcPath);
var gsObject = new SerializedObject(GraphicsSettings.GetGraphicsSettings());
var preloaded = gsObject.FindProperty("m_PreloadedShaders");
if (preloaded != null)
{
    preloaded.arraySize = 1;
    preloaded.GetArrayElementAtIndex(0).objectReferenceValue = svc;
    gsObject.ApplyModifiedProperties();
}

AssetDatabase.SaveAssets();
return new
{
    ssaoAdded,
    balancedPath,
    lowPath,
    qualityLevels = levels.Length,
    webglApis = Array.ConvertAll(PlayerSettings.GetGraphicsAPIs(BuildTarget.WebGL), a => a.ToString()),
    preloadedShadersSet = preloaded != null,
};
