using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using UnityEngine;
using UnityEngine.InputSystem;
using UnityEngine.Rendering;
using UnityEngine.Rendering.Universal;

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
        // Dark theme palette (from design-tokens.json dark values), regraded
        // for the beauty pass: a near-black blue backdrop (#0A0E14) with cool
        // dim ambient so blacks stay black and only the rig lights model form.
        static readonly Color DarkDeep = Rgb(10, 14, 20);
        static readonly Color DarkReading = Rgb(36, 33, 31);
        static readonly Color DarkSurface = Rgb(44, 40, 37);
        static readonly Color DarkText = Rgb(240, 233, 226);
        static readonly Color DarkMuted = Rgb(178, 168, 160);
        static readonly Color DarkAmber = Rgb(217, 166, 95);
        static readonly Color DarkBlue = Rgb(139, 166, 204);
        static readonly Color DarkGreen = Rgb(147, 177, 159);
        static readonly Color DarkRed = Rgb(211, 146, 138);
        static readonly Color DarkPurple = Rgb(185, 164, 144);
        static readonly Color DarkSky = Rgb(44, 52, 66);
        static readonly Color DarkEquator = Rgb(34, 40, 52);
        static readonly Color DarkGround = Rgb(22, 26, 34);
        static readonly Color DarkOrbitInner = Rgb(120, 105, 95);
        static readonly Color DarkOrbitOuter = Rgb(100, 88, 80);
        static readonly Color DarkKeyLight = Rgb(255, 240, 225);
        // The three-point rig colors (§5.5): warm key, cool fill, white rim.
        static readonly Color FillCool = Rgb(133, 158, 202);
        static readonly Color RimWhite = Rgb(228, 236, 248);
        // Emission hero discipline (§5.4): the sphere is the hero at 2.0× HDR
        // and every portal accent glows at 1.35–2.0× (spine, ribbon, screen,
        // liquid, badge, eyes) — the plan wanted accents glowing too; the
        // discipline is that the state sphere always stays the brightest.
        const float SphereEmission = 2.0f;
        internal const float AccentEmission = 1.35f;

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
        Material contactShadowMaterial;
        UnityEngine.Rendering.Universal.Bloom bloomOverride;
        Light keyLight;
        Light fillLight;
        Light rimLight;
        ParticleSystem dust;
        Color liveText = Text;
        Color liveMuted = Muted;
        Color liveReading = Reading;
        Color liveSurface = Surface;
        string currentTheme = "white";
        string currentState = "idle";
        Color liveStateColor = Purple;
        Camera sceneCamera;
        Transform sphere;
        MemoryAnchor selected;
        MemoryAnchor hovered;
        Vector2 look;
        float distance = 12.76f;
        float orbitAngle;
        bool reduceMotion;
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")] static extern void LoomNavigate(string objectName);
#endif
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
                keyLight.intensity = dark ? 0.9f : 0.85f;
            }
            if (fillLight)
            {
                fillLight.color = FillCool;
                fillLight.intensity = dark ? 0.32f : 0.22f;
            }
            if (rimLight) rimLight.intensity = dark ? 0.55f : 0.35f;

            if (floorMaterial) floorMaterial.color = deep;
            if (benchMaterial) benchMaterial.color = surface;
            if (wallMaterial) wallMaterial.color = reading;
            ApplyLoomState(currentState);
            for (var i = 0; i < orbitMaterials.Count; i++)
                orbitMaterials[i].color = dark ? (i == 0 ? DarkOrbitInner : DarkOrbitOuter) : orbitColors[i];
            foreach (var anchor in anchors)
            {
                var color = dark ? PortalColorDark(anchor.Key) : PortalColorWhite(anchor.Key);
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
            liveStateColor = color;
            if (sphereMaterial)
            {
                sphereMaterial.color = Color.Lerp(Pearl, color, 0.4f);
                // HDR emission: the state reads as glow, not as a coloured
                // ball (§6). The pulse in Update modulates around this base.
                sphereMaterial.SetColor("_EmissionColor", color * SphereEmission);
            }
        }

        public void ApplyReducedMotion(string reduced) => reduceMotion = reduced == "true";

        /// The shell's quality-tier choice (High/Balanced/Low). The index
        /// mirrors the quality levels BeautifyBench wrote: High 0, Balanced 1,
        /// Low 2. Per-tier bloom follows in Update.
        public void ApplyQuality(string tier)
        {
            var index = string.Equals(tier, "Balanced", StringComparison.OrdinalIgnoreCase) ? 1
                : string.Equals(tier, "Low", StringComparison.OrdinalIgnoreCase) ? 2
                : 0;
            if (index < QualitySettings.names.Length) QualitySettings.SetQualityLevel(index, false);
        }

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

            // Reduced motion pauses ambient dust; normal motion keeps it slow.
            if (dust)
            {
                if (reduceMotion && dust.isPlaying) dust.Pause();
                else if (!reduceMotion && dust.isPaused) dust.Play();
            }

            // Per-tier volume profile (§1.3.4): the Low tier turns bloom off
            // ("Bloom off on Low tier"); the tier itself comes from the
            // quality level the shell selected.
            if (bloomOverride)
            {
                var tier = QualitySettings.names[QualitySettings.GetQualityLevel()];
                var bloomOn = tier != "Low";
                if (bloomOverride.active != bloomOn) bloomOverride.active = bloomOn;
            }

            if (!reduceMotion)
            {
                sphere.Rotate(0f, 1.2f * Time.deltaTime, 0f, Space.World);
                var pulse = 1f + Mathf.Sin(Time.time * 0.35f) * 0.004f;
                sphere.localScale = Vector3.one * 2.35f * pulse;
                // The pulse animates emission, not a light: cheaper and
                // bloom-stable (§5.4). HDR emission 2.0× keeps the sphere
                // bloom while paper and matte surfaces stay under threshold.
                if (sphereMaterial)
                    sphereMaterial.SetColor("_EmissionColor", liveStateColor * (SphereEmission + 0.3f * Mathf.Sin(Time.time * 1.1f)));
                // The portals orbit the sphere so each can be brought to the
                // front to select. Hovering or selecting pauses the ring.
                if (hovered == null && selected == null) orbitAngle += 12f * Time.deltaTime;
            }

            foreach (var anchor in anchors)
                anchor.Animate(anchor == hovered, anchor == selected, reduceMotion, orbitAngle);
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
            // Whisper density (§5.7): depth between the front objects and the
            // back of the desk without a visible haze band.
            RenderSettings.fogDensity = 0.005f;
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
            // Product-shot framing (§5.8): a vertical FOV of ~35–45° reads
            // like a desk photograph, with less distortion on the near props
            // than a wide game FOV.
            sceneCamera.fieldOfView = 42f;
            sceneCamera.nearClipPlane = 0.1f;
            sceneCamera.farClipPlane = 80f;
            // HDR is the prerequisite for bloom (§5.4): without it, emission
            // clamps at 1.0 and the sphere has nothing to threshold on.
            sceneCamera.allowHDR = true;
            // The camera is created at runtime, so URP's additional camera
            // data may never be attached by the pipeline — and without it
            // post-processing and anti-aliasing silently no-op. Attach it
            // explicitly and turn the grade on (MSAA comes from the asset).
            var cameraData = sceneCamera.GetUniversalAdditionalCameraData();
            cameraData.renderPostProcessing = true;
            cameraData.antialiasing = AntialiasingMode.None;

            foreach (var light in FindObjectsByType<Light>())
                Destroy(light.gameObject);

            // Three-point rig (§5.5): warm key from front-left, cool fill
            // from front-right at ~40%, and a white rim behind the sphere
            // pointing at the camera so every object gets a separating edge.
            var key = keyLight = new GameObject("Warm key", typeof(Light)).GetComponent<Light>();
            key.type = LightType.Directional;
            key.color = Rgb(255, 240, 222);
            key.intensity = 1.15f;
            key.shadows = LightShadows.Soft;
            key.transform.rotation = Quaternion.Euler(44f, -38f, 0f);

            var fill = fillLight = new GameObject("Cool fill", typeof(Light)).GetComponent<Light>();
            fill.type = LightType.Directional;
            fill.color = FillCool;
            fill.intensity = 0.42f;
            fill.shadows = LightShadows.None;
            fill.transform.rotation = Quaternion.Euler(30f, 118f, 0f);

            var rim = rimLight = new GameObject("White rim", typeof(Light)).GetComponent<Light>();
            rim.type = LightType.Spot;
            rim.color = RimWhite;
            rim.intensity = 0.55f;
            rim.range = 30f;
            rim.spotAngle = 60f;
            rim.shadows = LightShadows.None;
            rim.transform.SetPositionAndRotation(
                new Vector3(0f, 2.6f, 4.2f),
                Quaternion.LookRotation(new Vector3(0f, 0.6f, -1f).normalized));

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
            // Shader-variant canary (§7.3): emission is enabled BY DEFAULT on
            // the shipped sphere material, so the _EMISSION variant survives
            // IL2CPP stripping and runtime keywords never silently no-op.
            sphereMaterial.EnableKeyword("_EMISSION");

            CreateOrbit("Inner orbit", 4.1f, 1.05f, Rgb(216, 191, 180), 0f);
            CreateOrbit("Outer orbit", 5.75f, 1.35f, Rgb(221, 213, 208), 17f);

            // One global grade (§5.6): ACES + bloom + gentle grade + vignette
            // in a single profile, versionable and swapped via the Volume.
            var gradeObject = new GameObject("Bench grade", typeof(Volume));
            var grade = gradeObject.GetComponent<Volume>();
            grade.isGlobal = true;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            var bloom = bloomOverride = profile.Add<Bloom>(true);
            bloom.threshold.Override(1.05f);
            bloom.intensity.Override(0.45f);
            bloom.scatter.Override(0.7f);
            // The high-quality filter costs more but keeps the glow soft
            // without the cheap filter's blur artifacts (§1.3.1).
            bloom.highQualityFiltering.Override(true);
            var tonemapping = profile.Add<Tonemapping>(true);
            tonemapping.mode.Override(TonemappingMode.ACES);
            var adjustments = profile.Add<ColorAdjustments>(true);
            // §5.6: the scene has no baked indirect light, so the grade must
            // lift, not darken — post-exposure well above neutral and a
            // shadows lift keep the near-blacks separable instead of crushed.
            adjustments.postExposure.Override(0.45f);
            adjustments.contrast.Override(8f);
            adjustments.saturation.Override(-5f);
            adjustments.colorFilter.Override(new Color(1f, 0.95f, 0.9f));
            var shadows = profile.Add<ShadowsMidtonesHighlights>(true);
            shadows.shadows.Override(new Vector4(1f, 1f, 1f, 0.07f));
            var vignette = profile.Add<Vignette>(true);
            vignette.intensity.Override(0.18f);
            vignette.smoothness.Override(0.4f);
            grade.sharedProfile = profile;

            // Dust motes (§5.7): a handful of tiny additive particles near
            // the sphere — the cheapest perceived atmosphere per millisecond.
            // Under reduced motion they are paused, not hidden.
            var dustObject = new GameObject("Dust motes", typeof(ParticleSystem));
            dustObject.transform.position = new Vector3(0f, 1.7f, 0f);
            dust = dustObject.GetComponent<ParticleSystem>();
            var dustMain = dust.main;
            dustMain.loop = true;
            dustMain.maxParticles = 80;
            dustMain.startLifetime = 16f;
            dustMain.startSpeed = 0.05f;
            dustMain.startSize = 0.012f;
            dustMain.startColor = new ParticleSystem.MinMaxGradient(new Color(1f, 0.97f, 0.9f, 0.22f));
            dustMain.simulationSpace = ParticleSystemSimulationSpace.World;
            var dustEmission = dust.emission;
            dustEmission.rateOverTime = 5f;
            var dustShape = dust.shape;
            dustShape.shapeType = ParticleSystemShapeType.Sphere;
            dustShape.radius = 1.55f;
            var dustRenderer = dustObject.GetComponent<ParticleSystemRenderer>();
            var dustShader = Shader.Find("Universal Render Pipeline/Particles/Unlit");
            if (dustShader)
            {
                var dustMaterial = new Material(dustShader) { name = "Dust mote" };
                dustMaterial.SetColor("_BaseColor", new Color(1f, 1f, 1f, 0.45f));
                dustRenderer.material = dustMaterial;
            }
            dustRenderer.shadowCastingMode = ShadowCastingMode.Off;
            dustRenderer.receiveShadows = false;

            var placements = new[] {
                new Vector3(0, 0.36f, -2.65f), new Vector3(-2.85f, 0.36f, 1.35f),
                new Vector3(2.7f, 0.36f, -0.1f), new Vector3(2.8f, 0.36f, -2.55f),
                new Vector3(2.65f, 0.36f, 2.05f), new Vector3(-2.8f, 0.36f, -1.2f),
            };
            for (var i = 0; i < Portals.Length; i++) anchors.Add(CreateAnchor(Portals[i], placements[i]));

            ApplyTheme(currentTheme);
            MoveCamera();
        }

        // A soft radial-gradient blob under an object (§5.7's Low-tier
        // grounding cue, used here for every tier): grounds props on the desk
        // for one transparent draw each, before the flask in the sort order.
        Renderer ContactShadow(Transform root)
        {
            if (!contactShadowMaterial)
            {
                var template = Resources.Load<Material>("LoomGlass");
                contactShadowMaterial = new Material(template) { name = "Contact shadow" };
                contactShadowMaterial.color = Color.white;
                var tex = new Texture2D(128, 128) { wrapMode = TextureWrapMode.Clamp };
                for (var y = 0; y < 128; y++)
                {
                    for (var x = 0; x < 128; x++)
                    {
                        var dx = (x - 63.5f) / 63.5f;
                        var dy = (y - 63.5f) / 63.5f;
                        var d = Mathf.Clamp01(1f - Mathf.Sqrt(dx * dx + dy * dy) / 1.414f);
                        tex.SetPixel(x, y, new Color(0f, 0f, 0f, d * d * 0.45f));
                    }
                }
                tex.Apply();
                contactShadowMaterial.SetTexture("_BaseMap", tex);
                contactShadowMaterial.renderQueue = 3000;
            }
            var quad = GameObject.CreatePrimitive(PrimitiveType.Quad);
            quad.name = "Contact shadow";
            quad.transform.SetParent(root, false);
            quad.transform.localPosition = new Vector3(0f, -0.008f, 0f);
            quad.transform.localRotation = Quaternion.Euler(90f, 0f, 0f);
            quad.transform.localScale = new Vector3(2.6f, 2.6f, 1f);
            var renderer = quad.GetComponent<Renderer>();
            renderer.sharedMaterial = contactShadowMaterial;
            renderer.shadowCastingMode = ShadowCastingMode.Off;
            return renderer;
        }

        MemoryAnchor CreateAnchor(Portal portal, Vector3 position)
        {
            var root = new GameObject($"Memory · {portal.Name}");
            root.transform.position = position;
            var yaw = portal.Name == "Code" ? 15f : -12f;
            var outward = new Vector3(position.x, 0f, position.z);
            // Each portal faces outward from the sphere so it keeps its front
            // toward the viewer as the ring rotates (a gentle yaw offset remains).
            root.transform.rotation = outward.sqrMagnitude > 0.0001f
                ? Quaternion.LookRotation(-outward.normalized) * Quaternion.Euler(0f, yaw, 0f)
                : Quaternion.Euler(0f, yaw, 0f);
            var accentMaterial = Material(portal.Name, portal.Color, 0.42f, 0.015f);
            // One reserved accent per object (§5.4): emissive at 1–2× HDR so
            // it reads as a soft glow while the sphere's 2.0× stays the hero.
            accentMaterial.EnableKeyword("_EMISSION");
            accentMaterial.SetColor("_EmissionColor", portal.Color * AccentEmission);
            var accent = BuildPhysicalPortal(portal.Name, root.transform, accentMaterial);

            // Grounding cue (§5.7): a soft contact shadow under the object
            // so props sit on the desk instead of floating in black.
            ContactShadow(root.transform);

            var label = new GameObject("Label", typeof(TextMesh)).GetComponent<TextMesh>();
            label.transform.position = position + Vector3.up * 1.05f;
            label.text = portal.Name;
            label.anchor = TextAnchor.MiddleCenter;
            label.alignment = TextAlignment.Center;
            label.characterSize = 0.09f;
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
            anchor.Initialize(portal.Name, description, portal.Color, label.transform, accent);
            return anchor;
        }

        // Physical parts share URP materials; only the accent follows the portal palette.
        Renderer BuildPhysicalPortal(string key, Transform root, Material accent)
        {
            // PBR signatures per surface (§5.2): paper matte, metal bright,
            // wood in between — so each reads under the same light instead
            // of six grey primitives. Base + normal maps are generated
            // tileable at 256 px (no imported assets; values documented in
            // docs/BENCH_MATERIALS.md).
            var paper = Material("Ivory paper", Rgb(229, 218, 195), 0.25f, 0f);
            paper.SetTexture("_BaseMap", PaperTexture(512));
            paper.SetTexture("_BumpMap", PaperNormal(512));
            paper.EnableKeyword("_NORMALMAP");
            var ink = Material("Graphite", Rgb(47, 51, 54), 0.3f, 0f);
            var metal = Material("Brushed nickel", Rgb(150, 159, 162), 0.72f, 0f);
            metal.SetFloat("_Metallic", 0.88f);
            metal.SetTexture("_BaseMap", BrushedMetalTexture(512));
            metal.SetTexture("_BumpMap", BrushedMetalNormal(512));
            metal.EnableKeyword("_NORMALMAP");
            var wood = Material("Oiled walnut", Rgb(105, 66, 39), 0.37f, 0f);
            wood.SetTexture("_BaseMap", WoodGrainTexture(512));
            wood.SetTexture("_BumpMap", WoodGrainNormal(512));
            wood.EnableKeyword("_NORMALMAP");
            var glassTemplate = Resources.Load<Material>("LoomGlass");
            if (!glassTemplate) throw new InvalidOperationException("Loom glass material resource is missing");
            var glass = new Material(glassTemplate) { name = "Optical glass" };
            // Faked-glass discipline (§5.3): the flask is the only large
            // transparent, fixed in the sort order after the contact shadows
            // (3000). The magnifier lens uses the opaque fallback instead —
            // at this size a high-smoothness tinted lens reads as glass with
            // no sorting cost and no self-intersection flicker.
            glass.SetFloat("_Metallic", 0.1f);
            glass.SetFloat("_Smoothness", 0.85f);
            glass.renderQueue = 3010;
            var lensGlass = Material("Optical lens", Rgb(148, 166, 178), 0.95f, 0f);
            lensGlass.SetFloat("_Metallic", 0.05f);

            Renderer Box(string name, Transform parent, Vector3 p, Vector3 size, Material mat) => Part(name, parent, PrimitiveType.Cube, p, size, mat);
            Renderer Ball(string name, Transform parent, Vector3 p, Vector3 size, Material mat) => Part(name, parent, PrimitiveType.Sphere, p, size, mat);
            switch (key)
            {
                case "Notes":
                {
                    var spine = Box("Cloth spine", root, new Vector3(0, 0.12f, 0), new Vector3(0.12f, 0.15f, 1.23f), accent);
                    for (var side = -1; side <= 1; side += 2)
                    {
                        var leaf = new GameObject(side < 0 ? "Left leaves" : "Right leaves").transform;
                        leaf.SetParent(root, false);
                        leaf.localPosition = new Vector3(side * 0.43f, 0.12f, 0);
                        leaf.localRotation = Quaternion.Euler(0, 0, side * 7f);
                        Box("Leather cover", leaf, Vector3.zero, new Vector3(0.87f, 0.045f, 1.25f), wood);
                        for (var i = 0; i < 6; i++)
                            Box("Page edge", leaf, new Vector3(0, 0.035f + i * 0.014f, 0), new Vector3(0.82f - i * 0.008f, 0.012f, 1.17f), paper);
                        for (var i = 0; i < 9; i++)
                            Box("Ruled paper", leaf, new Vector3(0, 0.115f, -0.43f + i * 0.1f), new Vector3(0.65f, 0.002f, 0.003f), metal);
                    }
                    Box("Ribbon bookmark", root, new Vector3(0.08f, 0.1f, -0.65f), new Vector3(0.06f, 0.012f, 0.32f), accent);
                    var pencil = Part("Pencil", root, PrimitiveType.Cylinder, new Vector3(1.02f, 0.08f, 0), new Vector3(0.045f, 0.52f, 0.045f), wood);
                    pencil.transform.localRotation = Quaternion.Euler(90, 0, -12);
                    return spine;
                }
                case "Code":
                {
                    Box("Aluminium laptop base", root, new Vector3(0, 0.09f, 0), new Vector3(1.65f, 0.13f, 1.05f), metal);
                    Box("Keyboard well", root, new Vector3(0, 0.16f, 0.15f), new Vector3(1.4f, 0.012f, 0.49f), ink);
                    for (var row = 0; row < 4; row++)
                        for (var col = 0; col < 11; col++)
                            Box("Key", root, new Vector3(-0.62f + col * 0.124f, 0.178f, -0.025f + row * 0.115f), new Vector3(0.103f, 0.02f, 0.085f), metal);
                    Box("Trackpad", root, new Vector3(0, 0.161f, -0.32f), new Vector3(0.52f, 0.009f, 0.24f), ink);
                    var lid = new GameObject("Hinged display").transform;
                    lid.SetParent(root, false); lid.localPosition = new Vector3(0, 0.15f, 0.46f); lid.localRotation = Quaternion.Euler(14, 0, 0);
                    Box("Display casing", lid, new Vector3(0, 0.55f, 0), new Vector3(1.65f, 1.1f, 0.07f), metal);
                    Box("Black bezel", lid, new Vector3(0, 0.55f, -0.041f), new Vector3(1.54f, 0.99f, 0.012f), ink);
                    var screen = Box("Unlit screen", lid, new Vector3(0, 0.57f, -0.05f), new Vector3(1.42f, 0.84f, 0.008f), accent);
                    Ball("Camera lens", lid, new Vector3(0, 1.055f, -0.05f), Vector3.one * 0.025f, ink);
                    Box("Screen reflection", lid, new Vector3(0, 0.94f, -0.057f), new Vector3(1.3f, 0.012f, 0.003f), metal);
                    return screen;
                }
                case "Work":
                {
                    Box("Toolbox floor", root, new Vector3(0, 0.08f, 0), new Vector3(1.85f, 0.14f, 1.02f), wood);
                    for (var side = -1; side <= 1; side += 2)
                    {
                        for (var row = 0; row < 3; row++)
                            Box("Side plank", root, new Vector3(0, 0.21f + row * 0.16f, side * 0.47f), new Vector3(1.85f, 0.15f, 0.09f), wood);
                        Box("Raised end", root, new Vector3(side * 0.86f, 0.51f, 0), new Vector3(0.12f, 0.91f, 0.94f), wood);
                        for (var z = -1; z <= 1; z += 2)
                        {
                            Box("Corner strap", root, new Vector3(side * 0.76f, 0.35f, z * 0.523f), new Vector3(0.1f, 0.53f, 0.018f), metal);
                            for (var y = 0; y < 2; y++) Ball("Rivet", root, new Vector3(side * 0.76f, 0.15f + y * 0.38f, z * 0.539f), Vector3.one * 0.04f, ink);
                        }
                    }
                    var handle = Part("Wooden carrying handle", root, PrimitiveType.Cylinder, new Vector3(0, 0.98f, 0), new Vector3(0.14f, 0.85f, 0.14f), wood);
                    handle.transform.localRotation = Quaternion.Euler(0, 0, 90);
                    var hammer = new GameObject("Hammer").transform; hammer.SetParent(root, false); hammer.localPosition = new Vector3(-0.3f, 0.5f, 0.15f); hammer.localRotation = Quaternion.Euler(0, 0, -25);
                    Box("Hammer shaft", hammer, Vector3.zero, new Vector3(0.08f, 0.7f, 0.09f), wood);
                    Box("Hammer head", hammer, new Vector3(0, 0.35f, 0), new Vector3(0.42f, 0.16f, 0.17f), metal);
                    var tool = Box("Screwdriver grip", root, new Vector3(0.4f, 0.67f, -0.17f), new Vector3(0.13f, 0.33f, 0.13f), accent);
                    Box("Screwdriver shaft", root, new Vector3(0.4f, 0.38f, -0.17f), new Vector3(0.035f, 0.3f, 0.035f), metal);
                    return tool;
                }
                case "Experiments":
                {
                    Lathe("Borosilicate flask", root, new[] { new Vector2(0, 0.06f), new Vector2(0.57f, 0.06f), new Vector2(0.62f, 0.13f), new Vector2(0.59f, 0.22f), new Vector2(0.2f, 1.12f), new Vector2(0.18f, 1.55f), new Vector2(0.23f, 1.57f), new Vector2(0.23f, 1.63f), new Vector2(0.145f, 1.63f), new Vector2(0.145f, 1.16f), new Vector2(0.54f, 0.18f), new Vector2(0, 0.13f) }, glass);
                    var liquid = Lathe("Tinted glass base", root, new[] { new Vector2(0, 0.14f), new Vector2(0.52f, 0.14f), new Vector2(0.44f, 0.4f), new Vector2(0, 0.4f) }, accent);
                    Ring("Rolled glass lip", root, new Vector3(0, 1.6f, 0), 0.19f, 0.035f, metal);
                    for (var i = 0; i < 4; i++)
                        Box("Etched graduation", root, new Vector3(0, 0.45f + i * 0.13f, -0.5f + i * 0.058f), new Vector3(i % 2 == 0 ? 0.21f : 0.12f, 0.012f, 0.012f), paper);
                    return liquid;
                }
                case "Agents":
                {
                    for (var side = -1; side <= 1; side += 2)
                    {
                        Part("Boot", root, PrimitiveType.Capsule, new Vector3(side * 0.27f, 0.14f, -0.08f), new Vector3(0.29f, 0.16f, 0.45f), ink);
                        Part("Leg", root, PrimitiveType.Cylinder, new Vector3(side * 0.27f, 0.37f, 0), new Vector3(0.14f, 0.16f, 0.14f), metal);
                        Ball("Shoulder joint", root, new Vector3(side * 0.53f, 0.84f, 0), Vector3.one * 0.22f, metal);
                        var arm = Part("Arm", root, PrimitiveType.Capsule, new Vector3(side * 0.62f, 0.63f, -0.02f), new Vector3(0.17f, 0.24f, 0.17f), paper);
                        arm.transform.localRotation = Quaternion.Euler(0, 0, side * 16);
                        Ball("Hand", root, new Vector3(side * 0.68f, 0.4f, -0.02f), Vector3.one * 0.21f, metal);
                    }
                    Ball("Ceramic torso", root, new Vector3(0, 0.74f, 0), new Vector3(0.91f, 0.8f, 0.58f), paper);
                    var badge = Box("Chest inset", root, new Vector3(0, 0.8f, -0.3f), new Vector3(0.38f, 0.25f, 0.04f), accent);
                    Part("Neck", root, PrimitiveType.Cylinder, new Vector3(0, 1.13f, 0), new Vector3(0.23f, 0.1f, 0.23f), metal);
                    Ball("Rounded head", root, new Vector3(0, 1.43f, 0), new Vector3(1f, 0.66f, 0.62f), paper);
                    Ball("Dark faceplate", root, new Vector3(0, 1.43f, -0.27f), new Vector3(0.8f, 0.42f, 0.16f), ink);
                    for (var side = -1; side <= 1; side += 2) Ball("Eye lens", root, new Vector3(side * 0.21f, 1.46f, -0.35f), new Vector3(0.13f, 0.16f, 0.055f), accent);
                    Part("Antenna", root, PrimitiveType.Cylinder, new Vector3(0.22f, 1.86f, 0), new Vector3(0.025f, 0.13f, 0.025f), metal);
                    Ball("Antenna cap", root, new Vector3(0.22f, 1.99f, 0), Vector3.one * 0.09f, accent);
                    return badge;
                }
                default: // Evidence: blank documents and an optical instrument, never invented results.
                {
                    for (var i = 0; i < 4; i++)
                    {
                        var sheet = Box("Document", root, new Vector3(0, 0.025f + i * 0.027f, 0), new Vector3(1.35f, 0.02f, 1.45f), paper);
                        sheet.transform.localRotation = Quaternion.Euler(0, i * 7 - 10, 0);
                    }
                    var magnifier = new GameObject("Magnifying glass").transform; magnifier.SetParent(root, false);
                    magnifier.localPosition = new Vector3(-0.12f, 0.22f, 0.15f); magnifier.localRotation = Quaternion.Euler(-12, -28, 0);
                    Ring("Brass lens rim", magnifier, Vector3.zero, 0.45f, 0.045f, metal);
                    Part("Glass lens", magnifier, PrimitiveType.Sphere, Vector3.zero, new Vector3(0.86f, 0.055f, 0.86f), lensGlass);
                    var ferrule = Part("Handle ferrule", magnifier, PrimitiveType.Cylinder, new Vector3(0, 0, -0.54f), new Vector3(0.12f, 0.12f, 0.12f), metal);
                    ferrule.transform.localRotation = Quaternion.Euler(90, 0, 0);
                    var grip = Part("Magnifier handle", magnifier, PrimitiveType.Capsule, new Vector3(0, 0, -0.9f), new Vector3(0.15f, 0.26f, 0.15f), accent);
                    grip.transform.localRotation = Quaternion.Euler(90, 0, 0);
                    // The documents are a legibility surface (§5.5/§6): a
                    // dedicated soft "reading light" keeps them the highest
                    // local luminance after the sphere.
                    var readingLight = new GameObject("Reading light", typeof(Light)).GetComponent<Light>();
                    readingLight.type = LightType.Spot;
                    readingLight.color = Rgb(255, 240, 216);
                    readingLight.intensity = 0.5f;
                    readingLight.range = 4.5f;
                    readingLight.spotAngle = 62f;
                    readingLight.shadows = LightShadows.None;
                    readingLight.transform.SetParent(root, false);
                    readingLight.transform.localPosition = new Vector3(0.4f, 1.05f, 0.3f);
                    readingLight.transform.localRotation = Quaternion.Euler(72f, -18f, 0f);
                    Box("Document clip", root, new Vector3(0.47f, 0.14f, 0.59f), new Vector3(0.25f, 0.04f, 0.18f), metal);
                    return grip;
                }
            }
        }

        static Renderer Part(string name, Transform parent, PrimitiveType shape, Vector3 position, Vector3 scale, Material material)
        {
            var part = GameObject.CreatePrimitive(shape);
            part.name = name; part.transform.SetParent(parent, false);
            part.transform.localPosition = position; part.transform.localScale = scale;
            var renderer = part.GetComponent<Renderer>(); renderer.sharedMaterial = material;
            return renderer;
        }

        static Renderer Ring(string name, Transform parent, Vector3 position, float radius, float thickness, Material material)
        {
            var profile = new Vector2[17];
            for (var i = 0; i < profile.Length; i++)
            {
                var angle = i * Mathf.PI * 2 / (profile.Length - 1);
                profile[i] = new Vector2(radius + Mathf.Cos(angle) * thickness, Mathf.Sin(angle) * thickness);
            }
            var ring = Lathe(name, parent, profile, material);
            ring.transform.localPosition = position;
            return ring;
        }

        static Renderer Lathe(string name, Transform parent, Vector2[] profile, Material material)
        {
            const int segments = 48;
            var vertices = new Vector3[profile.Length * (segments + 1)];
            var triangles = new int[(profile.Length - 1) * segments * 6];
            var cursor = 0;
            for (var row = 0; row < profile.Length; row++)
                for (var col = 0; col <= segments; col++)
                {
                    var angle = col * Mathf.PI * 2 / segments;
                    vertices[row * (segments + 1) + col] = new Vector3(Mathf.Cos(angle) * profile[row].x, profile[row].y, Mathf.Sin(angle) * profile[row].x);
                    if (row == profile.Length - 1 || col == segments) continue;
                    var a = row * (segments + 1) + col; var b = a + segments + 1;
                    triangles[cursor++] = a; triangles[cursor++] = b; triangles[cursor++] = a + 1;
                    triangles[cursor++] = b; triangles[cursor++] = b + 1; triangles[cursor++] = a + 1;
                }
            var mesh = new Mesh { name = name, vertices = vertices, triangles = triangles };
            mesh.RecalculateNormals(); mesh.RecalculateBounds();
            var part = new GameObject(name, typeof(MeshFilter), typeof(MeshRenderer), typeof(MeshCollider));
            part.transform.SetParent(parent, false);
            part.GetComponent<MeshFilter>().sharedMesh = mesh;
            part.GetComponent<MeshCollider>().sharedMesh = mesh;
            var renderer = part.GetComponent<Renderer>(); renderer.sharedMaterial = material;
            return renderer;
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
            // Keep all six tools within the narrower center column without
            // changing user zoom. The 4.12/12.76 constants keep the same
            // 17.9° pitch and bench coverage at the product-shot FOV of 42°
            // (the previous 3.55/11 were tuned for 48°).
            var framing = Mathf.Max(1f, 1.1f / sceneCamera.aspect);
            var desired = new Vector3(parallax.x * 0.25f, 1.25f + 4.12f * framing + parallax.y * 0.12f, -distance * framing);
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
            if (Physics.Raycast(ray, out var hit, 100f)) hovered = hit.collider.GetComponentInParent<MemoryAnchor>();
            if (hovered != null && mouse.leftButton.wasPressedThisFrame)
            {
                selected = hovered;
                // The bench navigates; it does not edit text. Selecting an
                // object opens the matching Tauri view (Notes editing lives
                // in the Tauri Knowledge surface, not in IMGUI).
#if UNITY_WEBGL && !UNITY_EDITOR
                LoomNavigate(selected.Key);
#endif
            }
        }

        void OnGUI()
        {
            EnsureStyles();
            // The bench navigates and shows state; text editing lives in the
            // Tauri Notes view. The read-only card is drawn at its real size
            // — no matrix scaling that would shrink text below reading size.
            if (selected == null) return;
            var panel = new Rect(Screen.width - 348f, 20f, 328f, 168f);
            GUI.Box(panel, GUIContent.none);
            GUI.Label(new Rect(panel.x + 20f, panel.y + 18f, panel.width - 40f, 32f), selected.Key, titleStyle);
            GUI.Label(new Rect(panel.x + 20f, panel.y + 54f, panel.width - 40f, 50f), selected.Description, bodyStyle);
            GUI.Label(new Rect(panel.x + 20f, panel.y + 104f, panel.width - 40f, 24f), "Notes are edited in the Tauri Notes view.", smallStyle);
            if (GUI.Button(new Rect(panel.x + 20f, panel.y + 130f, 176f, 30f), "Open note in Notes"))
            {
#if UNITY_WEBGL && !UNITY_EDITOR
                LoomNavigate("Notes");
#endif
                selected = null;
            }
            if (GUI.Button(new Rect(panel.x + 210f, panel.y + 130f, 98f, 30f), "Close")) selected = null;
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

        // ------------------------------------------------------------------
        // Generated tileable PBR maps (§5.2, no imported assets): 256 px
        // base + normal pairs for wood, paper and brushed metal. Multi-sine
        // fields tile by construction; normals come from the analytic height
        // gradient so they match the colour maps exactly.
        // ------------------------------------------------------------------

        static Texture2D TileableTexture(int size, System.Func<float, float, float> height, Color low, Color high)
        {
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat };
            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var u = (x + 0.5f) / size;
                    var v = (y + 0.5f) / size;
                    var h = Mathf.InverseLerp(-1.15f, 1.15f, height(u, v));
                    texture.SetPixel(x, y, Color.Lerp(low, high, h));
                }
            }
            texture.Apply();
            return texture;
        }

        static Texture2D NormalFromHeight(int size, System.Func<float, float, float> height)
        {
            var texture = new Texture2D(size, size, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat };
            var step = 1f / size;
            for (var y = 0; y < size; y++)
            {
                for (var x = 0; x < size; x++)
                {
                    var u = (x + 0.5f) / size;
                    var v = (y + 0.5f) / size;
                    var dhdu = (height(u + step, v) - height(u - step, v)) / (2f * step);
                    var dhdv = (height(u, v + step) - height(u, v - step)) / (2f * step);
                    var n = new Vector3(-dhdu, -dhdv, 1f).normalized;
                    texture.SetPixel(x, y, new Color(n.x * 0.5f + 0.5f, n.y * 0.5f + 0.5f, n.z * 0.5f + 0.5f, 1f));
                }
            }
            texture.Apply();
            return texture;
        }

        static float WoodHeight(float u, float v)
        {
            var grain = Mathf.Sin(v * Mathf.PI * 2f * 4f + Mathf.Sin(u * Mathf.PI * 2f * 2f) * 2.2f);
            var fine = 0.35f * Mathf.Sin(v * Mathf.PI * 2f * 17f + u * 3.1f);
            var knots = 0.25f * Mathf.Sin(u * Mathf.PI * 2f * 3f + v * 1.7f) * Mathf.Sin(v * Mathf.PI * 2f * 5f);
            return grain + fine + knots;
        }

        static Texture2D WoodGrainTexture(int size) => TileableTexture(size, WoodHeight, Rgb(96, 60, 34), Rgb(178, 142, 104));
        static Texture2D WoodGrainNormal(int size) => NormalFromHeight(size, WoodHeight);

        static float PaperHeight(float u, float v)
        {
            var fibre = Mathf.Sin(u * Mathf.PI * 2f * 37f + v * 9f) * Mathf.Sin(v * Mathf.PI * 2f * 41f + u * 7f);
            var speckle = Mathf.Sin((u * 53f + v * 71f) * Mathf.PI * 2f);
            return fibre * 0.55f + speckle * 0.12f;
        }

        static Texture2D PaperTexture(int size) => TileableTexture(size, PaperHeight, Rgb(214, 203, 180), Rgb(243, 236, 220));
        static Texture2D PaperNormal(int size) => NormalFromHeight(size, PaperHeight);

        static float BrushedHeight(float u, float v)
        {
            var streaks = Mathf.Sin(u * Mathf.PI * 2f * 46f + Mathf.Sin(v * 2.1f) * 4f);
            var wobble = 0.3f * Mathf.Sin(v * Mathf.PI * 2f * 9f + u * 5f);
            return streaks * 0.7f + wobble;
        }

        static Texture2D BrushedMetalTexture(int size) => TileableTexture(size, BrushedHeight, Rgb(128, 136, 142), Rgb(178, 186, 192));
        static Texture2D BrushedMetalNormal(int size) => NormalFromHeight(size, BrushedHeight);

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
        Quaternion baseRotation;
        Color color;
        float phase;
        Transform label;
        Renderer accent;
        public string Key { get; private set; }
        public string Description { get; private set; }

        public void SetColor(Color anchorColor) { color = anchorColor; if (accent) accent.sharedMaterial.color = color; }

        public void SetDescription(string description) { Description = description; }

        public void Initialize(string key, string description, Color anchorColor, Transform anchorLabel, Renderer accentRenderer)
        {
            Key = key;
            Description = description;
            color = anchorColor;
            label = anchorLabel;
            accent = accentRenderer;
            basePosition = transform.position;
            baseScale = transform.localScale;
            baseRotation = transform.rotation;
            phase = Mathf.Abs(key.GetHashCode() % 1000) * 0.01f;
        }

        public void Animate(bool hovered, bool selected, bool reduceMotion, float orbitAngle)
        {
            var lift = hovered || selected ? 0.12f : 0f;
            if (!reduceMotion) lift += Mathf.Sin(Time.time * 0.8f + phase) * 0.025f;
            var orbit = Quaternion.Euler(0f, orbitAngle, 0f);
            transform.position = Vector3.Lerp(transform.position, orbit * basePosition + Vector3.up * lift, reduceMotion ? 1f : Time.deltaTime * 5f);
            transform.rotation = Quaternion.Slerp(transform.rotation, orbit * baseRotation, reduceMotion ? 1f : Time.deltaTime * 6f);
            transform.localScale = Vector3.Lerp(transform.localScale, baseScale * (selected ? 1.06f : hovered ? 1.03f : 1f), reduceMotion ? 1f : Time.deltaTime * 6f);
            if (label && Camera.main)
            {
                label.position = transform.position + new Vector3(0f, 0.08f, -0.96f);
                label.rotation = Quaternion.LookRotation(label.position - Camera.main.transform.position);
            }
            // Selection is an accent emissive pulse, not an outline alone
            // (§5.5): idle accents sit at 1.35× HDR, hover lifts to ~1.75,
            // and the selected object pulses around 2× — always under the
            // sphere's 2.6 so the state hero stays dominant.
            var accentGlow = MemoryPalaceController.AccentEmission;
            if (hovered || selected) accentGlow = 1.75f;
            if (selected && !reduceMotion) accentGlow += Mathf.Sin(Time.time * 2.2f) * 0.25f;
            accent.sharedMaterial.SetColor("_EmissionColor", color * accentGlow);
        }
    }
}
