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
        // shortcut: visual colors mirror White tokens; unify loading when live theme synchronization is added.
        static readonly Color Deep = Rgb(245, 240, 235);
        static readonly Color Reading = Rgb(248, 244, 240);
        static readonly Color Surface = Rgb(241, 234, 229);
        static readonly Color Text = Rgb(41, 39, 37);
        static readonly Color Muted = Rgb(100, 93, 87);
        static readonly Color Purple = Rgb(233, 215, 202);
        static readonly Color Blue = Rgb(106, 145, 204);
        static readonly Color Pearl = Rgb(235, 220, 211);

        static readonly Portal[] Portals =
        {
            new("Work", "The pieces currently on the bench", Surface),
            new("Code", "The tools and material of the build", Purple),
            new("Experiments", "The jig where ideas are tested", Reading),
            new("Evidence", "Measurements and observed results", Surface),
            new("Agents", "Collaborators currently at the bench", Pearl),
            new("Notes", "The drawer for ideas worth returning to", Pearl),
        };

        readonly List<MemoryAnchor> anchors = new();
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
                && ToBytes(Purple).Equals(new Color32(233, 215, 202, 255))
                && ToBytes(Blue).Equals(new Color32(106, 145, 204, 255));
        }

        public static Vector2Int ReadLoomRecordCounts()
        {
            var summary = LocalDataSummary.Load();
            return new Vector2Int(summary.WorkCount, summary.ExperimentCount);
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

            var key = new GameObject("Soft skylight", typeof(Light)).GetComponent<Light>();
            key.type = LightType.Directional;
            key.color = Rgb(255, 249, 243);
            key.intensity = 0.85f;
            key.shadows = LightShadows.Soft;
            key.transform.rotation = Quaternion.Euler(38f, -32f, 0f);

            var glow = new GameObject("Orb glow", typeof(Light)).GetComponent<Light>();
            glow.type = LightType.Point;
            glow.color = Pearl;
            glow.intensity = 0.2f;
            glow.range = 6f;
            glow.transform.position = new Vector3(0f, 1.4f, 0f);

            var floor = GameObject.CreatePrimitive(PrimitiveType.Plane);
            floor.name = "Reflective floor";
            floor.transform.localScale = new Vector3(5f, 1f, 4f);
            floor.GetComponent<Renderer>().sharedMaterial = Material("Loom floor", Deep, 0.24f, 0f);

            var bench = GameObject.CreatePrimitive(PrimitiveType.Cube);
            bench.name = "Resolute work surface";
            bench.transform.position = new Vector3(0f, 0.18f, 0f);
            bench.transform.localScale = new Vector3(13.5f, 0.34f, 7.8f);
            bench.GetComponent<Renderer>().sharedMaterial = Material("Workbench surface", Surface, 0.32f, 0f);

            var back = GameObject.CreatePrimitive(PrimitiveType.Cube);
            back.name = "Memory wall";
            back.transform.SetPositionAndRotation(new Vector3(0f, 4f, 7f), Quaternion.identity);
            back.transform.localScale = new Vector3(18f, 8f, 0.25f);
            back.GetComponent<Renderer>().sharedMaterial = Material("Memory wall", Reading, 0.16f, 0f);

            sphere = GameObject.CreatePrimitive(PrimitiveType.Sphere).transform;
            sphere.name = "Loom sphere";
            sphere.position = new Vector3(0f, 1.75f, 0f);
            sphere.localScale = Vector3.one * 2.35f;
            sphere.GetComponent<Renderer>().sharedMaterial = Material("Loom sphere", Rgb(248, 238, 230), 0.68f, 0.02f);
            sphere.GetComponent<Renderer>().sharedMaterial.SetFloat("_Metallic", 0.12f);

            CreateOrbit("Inner orbit", 4.1f, 1.05f, Rgb(216, 191, 180), 0f);
            CreateOrbit("Outer orbit", 5.75f, 1.35f, Rgb(221, 213, 208), 17f);

            for (var i = 0; i < Portals.Length; i++)
            {
                var angle = i * Mathf.PI * 2f / Portals.Length - Mathf.PI * 0.5f;
                var radius = i % 2 == 0 ? 4.3f : 5.4f;
                var position = new Vector3(Mathf.Cos(angle) * radius, 0.72f, Mathf.Sin(angle) * radius);
                anchors.Add(CreateAnchor(Portals[i], position));
            }

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
            label.characterSize = 0.052f;
            label.fontSize = 48;
            label.color = Text;

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
            line.sharedMaterial = Material(name, color, 0f, 1.2f, true);
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

            if (GUI.Button(new Rect(width - 172f, 24f, 144f, 34f), reduceMotion ? "Motion: reduced" : "Motion: ambient"))
                reduceMotion = !reduceMotion;

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
            titleStyle = new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Normal, normal = { textColor = Text } };
            bodyStyle = new GUIStyle(GUI.skin.label) { fontSize = 14, wordWrap = true, normal = { textColor = Text } };
            smallStyle = new GUIStyle(GUI.skin.label) { fontSize = 13, normal = { textColor = Muted } };
            GUI.skin.box.normal.background = MakeTexture(new Color(Reading.r, Reading.g, Reading.b, 0.97f), 22);
            GUI.skin.box.border = new RectOffset(22, 22, 22, 22);
            foreach (var style in new[] { GUI.skin.button, GUI.skin.textArea })
            {
                var radius = style == GUI.skin.button ? 10 : 14;
                style.border = new RectOffset(radius, radius, radius, radius);
                style.fontSize = 14;
                style.normal.textColor = style.hover.textColor = style.active.textColor = style.focused.textColor = Text;
                style.normal.background = MakeTexture(style == GUI.skin.button ? Surface : Reading, radius);
                style.hover.background = MakeTexture(Pearl, radius);
                style.active.background = style.focused.background = MakeTexture(Purple, radius);
            }
            GUI.skin.textArea.padding = new RectOffset(10, 10, 8, 8);
            GUI.skin.settings.cursorColor = Text;
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
            LocalDataSummary(int workCount, int experimentCount)
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
