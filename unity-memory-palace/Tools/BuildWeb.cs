using UnityEditor;
using UnityEditor.Build.Reporting;
using System.IO;

PlayerSettings.WebGL.compressionFormat = WebGLCompressionFormat.Disabled;
PlayerSettings.WebGL.threadsSupport = false;
var output = Path.GetFullPath("../public/spatial");
var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions {
    scenes = new[] { "Assets/Scenes/ResoluteWorkbench.unity" },
    locationPathName = output,
    target = BuildTarget.WebGL,
    options = BuildOptions.None
});
if (report.summary.result != BuildResult.Succeeded) throw new System.Exception("WebGL build failed: " + report.summary.result);
return new { output, result = report.summary.result.ToString() };
