using UnityEditor;

PlayerSettings.companyName = "Loom";
PlayerSettings.productName = "Resolute Workbench";
PlayerSettings.bundleVersion = "0.1.0";
PlayerSettings.defaultScreenWidth = 1280;
PlayerSettings.defaultScreenHeight = 720;
PlayerSettings.fullScreenMode = UnityEngine.FullScreenMode.Windowed;
PlayerSettings.runInBackground = true;
AssetDatabase.SaveAssets();
return new
{
    company = PlayerSettings.companyName,
    product = PlayerSettings.productName,
    version = PlayerSettings.bundleVersion
};
