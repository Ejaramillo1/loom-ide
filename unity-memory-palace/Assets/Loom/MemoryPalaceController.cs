using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.InputSystem;

namespace Loom.MemoryPalace
{
    public sealed class MemoryPalaceController : MonoBehaviour
    {
        // Visual colors start from the White tokens; ApplyTheme switches the live scene to the shell theme (dark/white).
        static readonly Color Deep = Rgb(245, 240, 235);
        static readonly Color Reading = Rgb(248, 244, 240);
        static readonly Color Surface = Rgb(241, 234, 229);
        static readonly Color Text = Rgb(41, 39, 37);
        static readonly Color Muted = Rgb(100, 93, 87);
        static readonly Color Purple = Rgb(161, 134, 116);
        static readonly Color Blue = Rgb(106, 145, 204);
        static readonly Color Amber = Rgb(217, 166, 95);
        static readonly Color Green = Rgb(120, 155, 137);
        static readonly Color Red = Rgb(184, 117, 112);
        static readonly Color Pearl = Rgb(235, 220, 211);
        // Dark theme palette (from design-tokens.json dark values).
        static readonly Color DarkDeep = Rgb(29, 27, 26);
        static readonly Color DarkReading = Rgb(36, 33, 31);
        static readonly Color DarkSurface = Rgb(44, 40, 37);
        static readonly Color DarkText = Rgb(240, 233, 226);
        static readonly Color DarkMuted = Rgb(178, 168, 160);
        static readonly Color DarkAmber = Rgb(217, 166, 95);
        static readonly Color DarkBlue = Rgb(139, 166, 204);
        static readonly Color DarkGreen = Rgb(147, 177, 159);
        static readonly Color DarkRed = Rgb(211, 146, 138);
        static readonly Color DarkPurple = Rgb(185, 164, 144);
        static readonly Color DarkSky = Rgb(58, 52, 46);
        static readonly Color DarkEquator = Rgb(44, 40, 37);
        static readonly Color DarkGround = Rgb(32, 29, 27);
        static readonly Color DarkOrbitInner = Rgb(120, 105, 95);
        static readonly Color DarkOrbitOuter = Rgb(100, 88, 80);
        static readonly Color DarkKeyLight = Rgb(255, 240, 225);

        static readonly Portal[] Portals =
        {
            new("Work", "The pieces currently on the bench", Amber),
            new("Code", "The tools and material of the build", Blue),
            new("Experiments", "The jig where ideas are tested", Green),
            new("Evidence", "Measurements and observed results", Red),
            new("Agents", "Collaborators currently at the bench", Purple),
            new("Notes", "The drawer for ideas worth returning to", Pearl),
        };

        readonly List<MemoryAnchor> anchors = new();
        readonly List<Material> orbitMaterials = new();
        readonly List<Color> orbitColors = new();
        readonly List<TextMesh> portalLabels = new();
        Material floorMaterial;
        Material benchMaterial;
        Material wallMaterial;
        Material sphereMaterial;
        Light keyLight;
        Light orbLight;
        Color liveText = Text;
        Color liveMuted = Muted;
        Color liveReading = Reading;
        Color liveSurface = Surface;
        string currentTheme = "white";
        string currentState = "idle";
        Camera sceneCamera;
        Transform sphere;
        MemoryAnchor selected;
        MemoryAnchor hovered;
        Vector2 look;
        float distance = 11f;
        bool reduceMotion;
        string draft = "";
        string savedDraft = "";
        string saveStatus = "";
        bool saving;
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void LoomMemory(string action, string objectName, string body);
        [DllImport("__Internal")] static extern void LoomNavigate(string objectName);
#endif
        [Serializable] sealed class MemoryResult { public bool ok; public string action; public string body; public string message; }
        public void OnMemoryResult(string json)
        {
            var result = JsonUtility.FromJson<MemoryResult>(json);
            saving = false;
            saveStatus = result.message;
            if (result.ok)
            {
                if (result.action == "read") draft = result.body;
                savedDraft = draft;
            }
        }
        LocalDataSummary localData;
        GUIStyle titleStyle;
        GUIStyle bodyStyle;
        GUIStyle smallStyle;

        public static bool PaletteMatchesDesignTokens()
        {
            return ToBytes(Deep).Equals(new Color32(245, 240, 235, 255))
                && ToBytes(Purple).Equals(new Color32(161, 134, 116, 255))
                && ToBytes(Blue).Equals(new Color32(106, 145, 204, 255))
                && ToBytes(Amber).Equals(new Color32(217, 166, 95, 255))
                && ToBytes(Green).Equals(new Color32(120, 155, 137, 255))
                && ToBytes(Red).Equals(new Color32(184, 117, 112, 255));
        }

        // Called from the Tauri shell (spatial-player.js) whenever the
        // Dark/White selector changes, and once at the end of BuildWorld so
        // a theme set before the world exists still applies.
        public void ApplyTheme(string theme)
        {
            var dark = string.Equals(theme, "dark", StringComparison.OrdinalIgnoreCase);
            currentTheme = dark ? "dark" : "white";
            var deep = dark ? DarkDeep : Deep;
            var reading = dark ? DarkReading : Reading;
            var surface = dark ? DarkSurface : Surface;
            var text = dark ? DarkText : Text;
            var muted = dark ? DarkMuted : Muted;
            RenderSettings.fogColor = deep;
            RenderSettings.ambientSkyColor = dark ? DarkSky : Rgb(226, 216, 208);
            RenderSettings.ambientEquatorColor = dark ? DarkEquator : Rgb(238, 230, 224);
            RenderSettings.ambientGroundColor = dark ? DarkGround : Rgb(216, 191, 180);
            if (sceneCamera) sceneCamera.backgroundColor = deep;
            if (keyLight)
            {
                keyLight.color = dark ? DarkKeyLight : Rgb(255, 249, 243);
                keyLight.intensity = dark ? 0.7f : 0.85f;
            }

            if (floorMaterial) floorMaterial.color = deep;
            if (benchMaterial) benchMaterial.color = surface;
            if (wallMaterial) wallMaterial.color = reading;
            ApplyLoomState(currentState);
            for (var i = 0; i < orbitMaterials.Count; i++)
                orbitMaterials[i].color = dark ? (i == 0 ? DarkOrbitInner : DarkOrbitOuter) : orbitColors[i];
            foreach (var anchor in anchors)
            {
                var color = dark ? PortalColorDark(anchor.Key) : PortalColorWhite(anchor.Key);
                anchor.GetComponent<Renderer>().material.color = color;
                anchor.SetColor(color);
            }
            foreach (var label in portalLabels) label.color = text;
            liveText = text;
            liveMuted = muted;
            liveReading = reading;
            liveSurface = surface;
            titleStyle = bodyStyle = smallStyle = null;
        }

        // The host resolves mechanics::sphere_state; the player only renders that state.
        public static Color StateColor(string state, bool dark) => state switch
        {
            "attention" => dark ? DarkAmber : Amber,
            "completed" => dark ? DarkGreen : Green,
            "error" => dark ? DarkRed : Red,
            "exploring" or "executing" => dark ? DarkBlue : Blue,
            _ => dark ? DarkPurple : Purple,
        };

        public void ApplyLoomState(string state)
        {
            if (state != "idle" && state != "listening" && state != "processing" && state != "executing"
                && state != "exploring" && state != "attention" && state != "completed" && state != "error") return;
            currentState = state;
            var color = StateColor(state, currentTheme == "dark");
            if (orbLight) orbLight.color = color;
            if (sphereMaterial)
            {
                sphereMaterial.color = Color.Lerp(Pearl, color, 0.4f);
                sphereMaterial.SetColor("_EmissionColor", color * 0.15f);
            }
        }

        public void ApplyReducedMotion(string reduced) => reduceMotion = reduced == "true";

        static Color PortalColorWhite(string name)
        {
            foreach (var portal in Portals)
                if (portal.Name == name) return portal.Color;
            return Pearl;
        }

        static Color PortalColorDark(string name) => name switch
        {
            "Work" => DarkAmber,
            "Code" => DarkBlue,
            "Experiments" => DarkGreen,
            "Evidence" => DarkRed,
            "Agents" => DarkPurple,
            _ => Pearl,
        };

        public static Vector2Int ReadLoomRecordCounts()
        {
            var summary = LocalDataSummary.Load();
            return new Vector2Int(summary.WorkCount, summary.ExperimentCount);
        }

        [Serializable]
        sealed class VaultCounts { public int work; public int experiments; }

        // Called from the Tauri shell (spatial-player.js) whenever the vault
        // changes in Tauri. The WebGL player cannot read the vault from disk,
        // so the host pushes the counts and the bench updates live, with no
        // manual refresh. Malformed input is ignored: a bad push must never
        // break the player.
        public void RefreshVault(string json)
        {
            VaultCounts counts;
            try { counts = JsonUtility.FromJson<VaultCounts>(json); }
            catch (ArgumentException) { return; }
            if (counts == null) return;
            localData = new LocalDataSummary(Mathf.Max(0, counts.work), Mathf.Max(0, counts.experiments));
            foreach (var anchor in anchors)
            {
                foreach (var portal in Portals)
                {
                    if (portal.Name != anchor.Key) continue;
                    anchor.SetDescription(portal.Name switch
                    {
                        "Work" => $"{portal.Description} · {localData.WorkCount} saved",
                        "Experiments" => $"{portal.Description} · {localData.ExperimentCount} saved",
                        _ => portal.Description,
                    });
                }
            }
        }

        void Awake()
        {
            BuildWorld();
        }

        void Update()
        {
            if (!sceneCamera) return;
            ReadPointer();
            MoveCamera();
            PickMemory();

            if (!reduceMotion)
            {
                sphere.Rotate(0f, 1.2f * Time.deltaTime, 0f, Space.World);
                var pulse = 1f + Mathf.Sin(Time.time * 0.35f) * 0.004f;
                sphere.localScale = Vector3.one * 2.35f * pulse;
            }

            foreach (var anchor in anchors)
                anchor.Animate(anchor == hovered, anchor == selected, reduceMotion);
        }

        void BuildWorld()
        {
            anchors.Clear();
            orbitMaterials.Clear();
            orbitColors.Clear();
            portalLabels.Clear();
            localData = LocalDataSummary.Load();
            RenderSettings.fog = true;
            RenderSettings.fogColor = Deep;
            RenderSettings.fogMode = FogMode.ExponentialSquared;
            RenderSettings.fogDensity = 0.009f;
            RenderSettings.ambientMode = UnityEngine.Rendering.AmbientMode.Trilight;
            RenderSettings.ambientSkyColor = Rgb(226, 216, 208);
            RenderSettings.ambientEquatorColor = Rgb(238, 230, 224);
            RenderSettings.ambientGroundColor = Rgb(216, 191, 180);

            sceneCamera = Camera.main;
            if (!sceneCamera)
            {
                var cameraObject = new GameObject("Main Camera", typeof(Camera), typeof(AudioListener));
                cameraObject.tag = "MainCamera";
                sceneCamera = cameraObject.GetComponent<Camera>();
            }
            sceneCamera.clearFlags = CameraClearFlags.SolidColor;
            sceneCamera.backgroundColor = Deep;
            sceneCamera.fieldOfView = 48f;
            sceneCamera.nearClipPlane = 0.1f;
            sceneCamera.farClipPlane = 80f;

            foreach (var light in FindObjectsByType<Light>())
                Destroy(light.gameObject);

            var key = keyLight = new GameObject("Soft skylight", typeof(Light)).GetComponent<Light>();
            key.type = LightType.Directional;
            key.color = Rgb(255, 249, 243);
            key.intensity = 0.85f;
            key.shadows = LightShadows.Soft;
            key.transform.rotation = Quaternion.Euler(38f, -32f, 0f);

            var glow = orbLight = new GameObject("Orb glow", typeof(Light)).GetComponent<Light>();
            glow.type = LightType.Point;
            glow.color = Pearl;
            glow.intensity = 0.2f;
            glow.range = 6f;
            glow.transform.position = new Vector3(0f, 1.4f, 0f);

            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "Reflective floor";
            floor.transform.localScale = new Vector3(5f, 1f, 4f);
            floor.GetComponent<Renderer>().sharedMaterial = floorMaterial = Material("Loom floor", Deep, 0.24f, 0f);

            var bench = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bench.name = "Resolute work surface";
            bench.transform.position = new Vector3(0f, 0.18f, 0f);
            bench.transform.localScale = new Vector3(13.5f, 0.34f, 7.8f);
            bench.GetComponent<Renderer>().sharedMaterial = benchMaterial = Material("Workbench surface", Surface, 0.32f, 0f);

            var back = GameObject.CreatePrimitive(PrimitiveType.Cube);
            back.name = "Memory wall";
            back.transform.SetPositionAndRotation(new Vector3(0f, 4f, 7f), Quaternion.identity);
            back.transform.localScale = new Vector3(18f, 8f, 0.25f);
            back.GetComponent<Renderer>().sharedMaterial = wallMaterial = Material("Memory wall", Reading, 0.16f, 0f);

            sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
            sphere.name = "Loom sphere";
            sphere.position = new Vector3(0f, 1.75f, 0f);
            sphere.localScale = Vector3.one * 2.35f;
            sphere.GetComponent<Renderer>().sharedMaterial = sphereMaterial = Material("Loom sphere", Rgb(248, 238, 230), 0.68f, 0.02f);
            sphereMaterial.SetFloat("_Metallic", 0.12f);

            CreateOrbit("Inner orbit", 4.1f, 1.05f, Rgb(216, 191, 180), 0f);
            CreateOrbit("Outer orbit", 5.75f, 1.35f, Rgb(221, 213, 208), 17f);

            for (var i = 0; i < Portals.Length; i++)
            {
                var angle = i * Mathf.PI * 2f / Portals.Length - Mathf.PI * 0.5f;
                var radius = i % 2 == 0 ? 4.3f : 5.4f;
                var position = new Vector3(Mathf.Cos(angle) * radius, 0.72f, Mathf.Sin(angle) * radius);
                anchors.Add(CreateAnchor(Portals[i], position));
            }

            ApplyTheme(currentTheme);
            MoveCamera();
        }

        MemoryAnchor CreateAnchor(Portal portal, Vector3 position)
        {
            var shape = portal.Name switch
            {
                "Work" => PrimitiveType.Cylinder,
                "Experiments" => PrimitiveType.Cylinder,
                "Evidence" => PrimitiveType.Capsule,
                "Agents" => PrimitiveType.Sphere,
                _ => PrimitiveType.Cube,
            };
            var root = GameObject.CreatePrimitive(shape);
            root.name = $"Memory · {portal.Name}";
            root.transform.position = position;
            root.transform.localScale = portal.Name switch
            {
                "Work" => new Vector3(0.95f, 0.42f, 0.95f),
                "Code" => new Vector3(1.1f, 1.45f, 1.1f),
                "Experiments" => new Vector3(0.72f, 0.9f, 0.72f),
                "Evidence" => new Vector3(0.72f, 0.92f, 0.72f),
                "Agents" => Vector3.one * 1.08f,
                _ => new Vector3(1.45f, 0.42f, 1.1f),
            };
            root.transform.rotation = Quaternion.Euler(0f, 45f, 0f);
            root.GetComponent<Renderer>().sharedMaterial = Material(portal.Name, portal.Color, 0.3f, 0.015f);

            var label = new GameObject("Label", typeof(TextMesh)).GetComponent<TextMesh>();
            label.transform.position = position + Vector3.up * 1.05f;
            label.text = portal.Name;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.characterSize = 0.07f;
            label.fontSize = 48;
            label.color = Text;
            portalLabels.Add(label);

            var anchor = root.AddComponent<MemoryAnchor>();
            var description = portal.Name switch
            {
                "Work" => $"{portal.Description} · {localData.WorkCount} saved",
                "Experiments" => $"{portal.Description} · {localData.ExperimentCount} saved",
                _ => portal.Description,
            };
#if UNITY_WEBGL && !UNITY_EDITOR
            description = portal.Description;
#endif
            anchor.Initialize(portal.Name, description, portal.Color, label.transform);
            return anchor;
        }

        void CreateOrbit(string name, float radius, float height, Color color, float tilt)
        {
            const int segments = 128;
            var orbit = new GameObject(name, typeof(LineRenderer));
            orbit.transform.rotation = Quaternion.Euler(tilt, 0f, 0f);
            var line = orbit.GetComponent<LineRenderer>();
            line.loop = true;
            line.useWorldSpace = false;
            line.positionCount = segments;
            line.widthMultiplier = 0.01f;
            var orbitMaterial = Material(name, color, 0f, 1.2f, true);
            line.sharedMaterial = orbitMaterial;
            orbitMaterials.Add(orbitMaterial);
            orbitColors.Add(color);
            for (var i = 0; i < segments; i++)
            {
                var angle = i * Mathf.PI * 2f / segments;
                line.SetPosition(i, new Vector3(Mathf.Cos(angle) * radius, height, Mathf.Sin(angle) * radius * 0.62f));
            }
        }

        void ReadPointer()
        {
            if (selected != null) return;
            var mouse = Mouse.current;
            if (mouse == null) return;
            var position = mouse.position.ReadValue();
            look = new Vector2(
                Mathf.Clamp((position.x / Screen.width - 0.5f) * 2f, -1f, 1f),
                Mathf.Clamp((position.y / Screen.height - 0.5f) * 2f, -1f, 1f));
            distance = Mathf.Clamp(distance - mouse.scroll.ReadValue().y * 0.006f, 7.5f, 15f);
        }

        void MoveCamera()
        {
            var target = new Vector3(0f, 1.25f, 0f);
            var parallax = reduceMotion ? Vector2.zero : look;
            var desired = new Vector3(parallax.x * 0.25f, 4.8f + parallax.y * 0.12f, -distance);
            sceneCamera.transform.position = Vector3.Lerp(sceneCamera.transform.position, desired, reduceMotion ? 1f : Time.deltaTime * 1.8f);
            sceneCamera.transform.rotation = Quaternion.Slerp(sceneCamera.transform.rotation,
                Quaternion.LookRotation(target - sceneCamera.transform.position), reduceMotion ? 1f : Time.deltaTime * 3.5f);
        }

        void PickMemory()
        {
            hovered = null;
            if (selected != null) return;
            var mouse = Mouse.current;
            if (mouse == null || UnityEngine.EventSystems.EventSystem.current != null
                && UnityEngine.EventSystems.EventSystem.current.IsPointerOverGameObject()) return;

            var ray = sceneCamera.ScreenPointToRay(mouse.position.ReadValue());
            if (Physics.Raycast(ray, out var hit, 100f)) hovered = hit.collider.GetComponent<MemoryAnchor>();
            if (hovered != null && mouse.leftButton.wasPressedThisFrame)
            {
                selected = hovered;
#if UNITY_WEBGL && !UNITY_EDITOR
                draft = savedDraft = "";
                saving = true;
                saveStatus = "Opening memory…";
                LoomMemory("read", selected.Key, "");
                LoomNavigate(selected.Key);
#else
                draft = PlayerPrefs.GetString($"loom.memory.{selected.Key}", "");
                savedDraft = draft;
                saveStatus = "";
#endif
            }
        }

        void OnGUI()
        {
            EnsureStyles();
            var scale = Mathf.Min(1f, Screen.width / 1000f, Screen.height / 520f);
            GUI.matrix = Matrix4x4.Scale(new Vector3(scale, scale, 1f));
            var width = Screen.width / scale;
            GUI.Label(new Rect(28f, 22f, 620f, 38f), "Loom · Resolute Workbench", titleStyle);
            GUI.Label(new Rect(30f, 60f, 700f, 28f), "A spatial bench for making knowledge · select a tool or workpiece", smallStyle);


            if (selected == null) return;
            var panel = new Rect(width - 352f, 82f, 324f, 360f);
            GUI.Box(panel, GUIContent.none);
            GUI.Label(new Rect(panel.x + 20f, panel.y + 18f, panel.width - 40f, 32f), selected.Key, titleStyle);
            GUI.Label(new Rect(panel.x + 20f, panel.y + 56f, panel.width - 40f, 50f), selected.Description, bodyStyle);
            GUI.Label(new Rect(panel.x + 20f, panel.y + 116f, panel.width - 40f, 24f), "Work kept with this object", smallStyle);
            GUI.enabled = !saving;
            draft = GUI.TextArea(new Rect(panel.x + 20f, panel.y + 144f, panel.width - 40f, 92f), draft, 600);
            if (GUI.Button(new Rect(panel.x + 20f, panel.y + 248f, 132f, 34f), "Keep at bench"))
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                saving = true;
                saveStatus = "Saving to vault…";
                LoomMemory("save", selected.Key, draft);
#else
                PlayerPrefs.SetString($"loom.memory.{selected.Key}", draft);
                PlayerPrefs.Save();
                savedDraft = draft;
                saveStatus = "Saved locally in this player.";
#endif
            }
            GUI.enabled = !saving;
            if (GUI.Button(new Rect(panel.x + 164f, panel.y + 248f, 140f, 34f), draft == savedDraft ? "Close" : "Discard & close")) selected = null;
            GUI.enabled = true;
            GUI.Label(new Rect(panel.x + 20f, panel.y + 290f, panel.width - 40f, 62f), saveStatus, bodyStyle);
        }

        void EnsureStyles()
        {
            if (titleStyle != null) return;
            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Normal, normal = { textColor = liveText } };
            bodyStyle = new GUIStyle(GUI.skin.label) { fontSize = 14, wordWrap = true, normal = { textColor = liveText } };
            smallStyle = new GUIStyle(GUI.skin.label) { fontSize = 13, normal = { textColor = liveMuted } };
            GUI.skin.box.normal.background = MakeTexture(new Color(liveReading.r, liveReading.g, liveReading.b, 0.97f), 22);
            GUI.skin.box.border = new RectOffset(22, 22, 22, 22);
            foreach (var style in new[] { GUI.skin.button, GUI.skin.textArea })
            {
                var radius = style == GUI.skin.button ? 10 : 14;
                style.border = new RectOffset(radius, radius, radius, radius);
                style.fontSize = 14;
                style.normal.textColor = style.hover.textColor = style.active.textColor = style.focused.textColor = liveText;
                style.normal.background = MakeTexture(style == GUI.skin.button ? liveSurface : liveReading, radius);
                style.hover.background = MakeTexture(Pearl, radius);
                style.active.background = style.focused.background = MakeTexture(Purple, radius);
            }
            GUI.skin.textArea.padding = new RectOffset(10, 10, 8, 8);
            GUI.skin.settings.cursorColor = liveText;
            GUI.skin.settings.selectionColor = Purple;
        }

        static Material Material(string name, Color color, float smoothness, float emission, bool unlit = false)
        {
            var template = Resources.Load<Material>(unlit ? "LoomUnlit" : "LoomLit");
            if (!template) throw new InvalidOperationException("Loom material resources are missing");
            var material = new Material(template) { name = name, color = color };
            if (!unlit)
            {
                material.SetFloat("_Smoothness", smoothness);
                if (emission > 0f)
                {
                    material.EnableKeyword("_EMISSION");
                    material.SetColor("_EmissionColor", color * emission);
                }
            }
            return material;
        }

        static Texture2D MakeTexture(Color color, int radius)
        {
            var size = radius * 2 + 2;
            var texture = new Texture2D(size, size) { wrapMode = TextureWrapMode.Clamp };
            for (var y = 0; y < size; y++)
                for (var x = 0; x < size; x++)
                {
                    var dx = x - Mathf.Clamp(x, radius, size - radius - 1);
                    var dy = y - Mathf.Clamp(y, radius, size - radius - 1);
                    var coverage = Mathf.Clamp01(radius + 0.5f - Mathf.Sqrt(dx * dx + dy * dy));
                    texture.SetPixel(x, y, new Color(color.r, color.g, color.b, color.a * coverage));
                }
            texture.Apply();
            return texture;
        }

        static Color Rgb(byte r, byte g, byte b) => new(r / 255f, g / 255f, b / 255f, 1f);
        static Color32 ToBytes(Color color) => color;

        readonly struct Portal
        {
            public Portal(string name, string description, Color color)
            {
                Name = name;
                Description = description;
                Color = color;
            }
            public string Name { get; }
            public string Description { get; }
            public Color Color { get; }
        }

        readonly struct LocalDataSummary
        {
            // Internal (not private): RefreshVault builds a summary from
            // counts pushed by the Tauri shell, and a nested type's
            // private constructor is not reachable from its enclosing type.
            internal LocalDataSummary(int workCount, int experimentCount)
            {
                WorkCount = workCount;
                ExperimentCount = experimentCount;
            }

            public int WorkCount { get; }
            public int ExperimentCount { get; }

            public static LocalDataSummary Load()
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                return new LocalDataSummary(0, 0);
#else
                var dataHome = Environment.GetEnvironmentVariable("XDG_DATA_HOME");
                if (string.IsNullOrWhiteSpace(dataHome))
                    dataHome = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".local", "share");
                var root = Path.Combine(dataHome, "com.loom.ide", "loom-ide");
                return new LocalDataSummary(CountArray(Path.Combine(root, "work.json")),
                    CountArray(Path.Combine(root, "experiments.json")));
#endif
            }

            static int CountArray(string path)
            {
                try
                {
                    var json = File.ReadAllText(path).Trim();
                    if (json.Length < 2 || json[0] != '[') return 0;
                    var wrapped = JsonUtility.FromJson<JsonArray>($"{{\"items\":{json}}}");
                    return wrapped?.items?.Length ?? 0;
                }
                catch (IOException) { return 0; }
                catch (UnauthorizedAccessException) { return 0; }
                catch (ArgumentException) { return 0; }
            }

            [Serializable]
            sealed class JsonArray { public JsonRecord[] items; }
            [Serializable]
            sealed class JsonRecord { public string id; }
        }
    }

    public sealed class MemoryAnchor : MonoBehaviour
    {
        Vector3 basePosition;
        Vector3 baseScale;
        Color color;
        float phase;
        Transform label;
        public string Key { get; private set; }
        public string Description { get; private set; }

        public void SetColor(Color anchorColor) { color = anchorColor; }

        public void SetDescription(string description) { Description = description; }

        public void Initialize(string key, string description, Color anchorColor, Transform anchorLabel)
        {
            Key = key;
            Description = description;
            color = anchorColor;
            label = anchorLabel;
            basePosition = transform.position;
            baseScale = transform.localScale;
            phase = Mathf.Abs(key.GetHashCode() % 1000) * 0.01f;
        }

        public void Animate(bool hovered, bool selected, bool reduceMotion)
        {
            var lift = hovered || selected ? 0.12f : 0f;
            if (!reduceMotion) lift += Mathf.Sin(Time.time * 0.8f + phase) * 0.025f;
            transform.position = Vector3.Lerp(transform.position, basePosition + Vector3.up * lift, reduceMotion ? 1f : Time.deltaTime * 5f);
            transform.localScale = Vector3.Lerp(transform.localScale, baseScale * (selected ? 1.06f : hovered ? 1.03f : 1f), reduceMotion ? 1f : Time.deltaTime * 6f);
            if (label && Camera.main)
            {
                label.position = transform.position + Vector3.up * 0.95f;
                label.rotation = Quaternion.LookRotation(label.position - Camera.main.transform.position);
            }
            var renderer = GetComponent<Renderer>();
            renderer.material.SetColor("_EmissionColor", color * (selected ? 0.10f : hovered ? 0.055f : 0.015f));
            if (!reduceMotion) transform.Rotate(0f, (selected ? 2f : 0.6f) * Time.deltaTime, 0f, Space.World);
        }
    }
}
