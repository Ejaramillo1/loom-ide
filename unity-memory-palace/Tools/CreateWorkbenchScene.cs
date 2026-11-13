using Loom.MemoryPalace;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;

var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
var root = new GameObject("Resolute Workbench");
root.AddComponent<MemoryPalaceController>();
EditorSceneManager.SaveScene(scene, "Assets/Scenes/ResoluteWorkbench.unity");
EditorBuildSettings.scenes = new[]
{
    new EditorBuildSettingsScene("Assets/Scenes/ResoluteWorkbench.unity", true)
};
AssetDatabase.SaveAssets();
AssetDatabase.Refresh();
return new
{
    scene = scene.path,
    root = root.name,
    paletteMatches = MemoryPalaceController.PaletteMatchesDesignTokens()
};
