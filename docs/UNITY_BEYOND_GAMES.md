# Unity for Non-Game Projects — Survey for a Desktop AI-Agent Developer Tool

**Research date:** 2026-11-13. **Requester:** research engineer building a desktop AI-agent developer tool (an IDE for an agent framework) in Unity, likely for visualization and interactive UI rather than gameplay.
**Method:** web-index searches plus live fetches of official Unity pages, docs and GitHub repos on 2026-11-13 (marked `verified live`). Other claims are `index` (search-result text) and are labelled **[Unity marketing]**, **[independent]** or **[vendor/secondary]**.
**Headline:** Unity is a proven, heavily used platform for non-game real-time 3D: automotive HMI, AEC/BIM, film demos, simulation/training, digital twins, medical XR and education all have named, shipping products. There is **no direct precedent found for a Unity-based AI-agent IDE / developer IDE**. **Project status (2026-11-13): this is a personal open-source, non-commercial project, so the commercial licensing notes in §3.3 (Industry seats, distribution fee) do not apply to the current state; they matter only if the project is later commercialized or adopted by a large company.**

## Summary

| Question | Answer in brief |
|---|---|
| Is Unity used for non-games at scale? | Yes — Renault/Mazda HMI, SHoP/Mortenson/DPR in AEC, Siemens training, Specto medical XR, Labster education, TIER IV AWSIM robotics, SmartPixels/Walmart retail. Most evidence is Unity-published case studies; independent corroboration is strongest for Mazda/Panasonic, Siemens/DiSTI, Labster's scale and AWSIM. |
| Notable open-source non-game Unity projects? | AWSIM (autonomous driving), Unity Robotics Hub / Simulation Pro, MAES 2.0 (multi-robot), GeoViz and OceanViz (scientific viz), SUMO2Unity (traffic), Unity 3D Radar Chart (immersive analytics), a small Unity 6 WebGL digital-twin demo. |
| Why Unity over Unreal / Godot / web? | C#, fastest prototyping, broadest platform/XR support, largest ecosystem and hiring pool, smaller/heavier trade-off vs Unreal's visuals; Godot is free/light but smaller ecosystem and weaker XR/3D maturity; web (Three.js) is far lighter to load but lacks Unity's physics, tooling and native-desktop story. See §2.4. |
| Linux? | Editor and Player officially support **Ubuntu 22.04 and 24.04, x64 only** (Unity 6.0 docs, verified live). Wayland is experimental; video import on Linux is VP8-only. |
| Runtime size / distribution? | No single-file desktop exe natively (exe + `UnityPlayer.dll` + `_Data` folder). An empty 2022 Windows build was ~66 MB uncompressed (old, indicative only); no authoritative current desktop empty-build figure was found — measure a Unity 6.3 LTS empty build. WebGL empty builds are 10.7 MB default, 2.0 MB heavily stripped (not a desktop figure). |
| Licensing for this project? | **Not applicable right now.** The project is personal open-source and non-commercial (2026-11-13), so the commercial licensing terms in §3.3 (Industry seats, 4% distribution fee) do not apply to the current state. See §3.3 for the terms that would matter only if the project is later commercialized or adopted by a large company. |
| UI-heavy desktop limitations? | Two UI systems: legacy uGUI (Canvas rebuilds, no native data binding, prefab-YAML diffs) vs UI Toolkit (UXML/USS, Flexbox, better for data-heavy/desktop UI, but weaker Timeline/animator and custom-shader support). No native OS menus/dialogs/accessibility parity — a Unity app is a game-style window, not a native desktop app. |

---

## 1. Non-game verticals

*Convention: [Unity marketing] = published by Unity or on unity.com; [independent] = third-party press, peer-reviewed paper, or the customer's own release; [vendor] = the project's own site/portfolio.*

### 1.1 Automotive — HMI, configurators, digital twins

| Project | What Unity does | Source / status |
|---|---|---|
| **Renault — Emblème concept-car cockpit HMI** | Real-time 3D cockpit: instrument cluster, lighting/shadows, mesh deformation, day/night cycles, generative backgrounds; design-to-production continuity across high- and low-end hardware. Unity claims two perf sessions cut frame time 90% and GPU use 85%; demo scenes ≥180 fps, full composed view 75 fps; a 2D cluster proof-of-concept ran ~170 fps at 1920×720 on a low-cost single-board computer. | [Unity marketing] https://web-prd.hexagon.unity.com/resources/renault-real-time-3d-cockpit — session at Unity Industry Summit, Munich, Oct 2026; published 2026-11-05. Performance figures are Unity-reported, not independently verified. |
| **Mazda CX-5 (2026) — Panasonic Automotive cockpit domain controller** | Unity 3D engine integrated in-vehicle to visualise vehicle data in real time — door status, turn signals, surrounding-environment info — in high-definition responsive graphics, across infotainment, head-up display and instrument cluster. | [independent] Panasonic press release 2026-07-07: https://news.panasonic.com/global/press/en260707-2 — Panasonic says it is the first Japanese manufacturer to integrate Unity into in-vehicle systems (Panasonic's own research claim). CX-5 launched Europe Dec 2025, Japan May 2026. Also: https://unityreleases.com/resources (Unity summary: "Mazda built the new CX-5's HMI with Unity, from the 2024 partnership to the 2026 launch"). |
| **ART S.p.A. — Cockpit Design Suite** | VR cockpit design-review platform (Unity Industry): OEM style and HMI teams test layouts at full scale; hand and gaze tracking record where testers look/reach; a dashboard compares variants with data instead of opinion. ART builds infotainment/clusters incl. Pagani Utopia and Alfa Romeo 33 Stradale ClusterX. | [Unity marketing] https://unity.com/resources/art-spa-vr-cockpit-design-review (2026-10-02). **Caveat:** Unity states the suite was to be released Oct 2026 and "no customer has run a full program on it yet" at publication — it is a launched product, not yet a proven deployment. |
| **Aston Martin Lagonda VR HMI** (extra) | Photoreal VR digital-cockpit prototype (Unity HDRP, Photon Fusion multiplayer co-location, eye-tracking heatmaps on HP Reverb/Varjo) to validate menu hierarchies, interaction flows and UI state machines before production vehicle code. | [vendor/portfolio, unverified by Aston Martin] https://bilgekagan.site/AstonMartin.html — Nov 2024–Dec 2025, client listed as SIMUX Defence. Treat as portfolio claim. |
| **Unicontrol** (extra, construction-machine HMI) | Unity HMI for machine control: live 3D and colour-coded guidance (green/yellow/red depth bars) replacing numbers. | [Unity marketing] via https://unity.com/blog/october-2026-industry-content-wrap-up |

*Configurators:* Unity ships Industry sample/template projects for this — Car Review, Configurator, HMI Mockup templates, and an Automotive HMI sample (Unity 6.3+, up to 60 fps on Raspberry Pi 5) — [Unity marketing] https://unity.com/blog/october-2026-industry-content-wrap-up. These are templates, not customer products.

### 1.2 Architecture / Engineering / Construction — visualization, BIM

| Project | What Unity does | Source / status |
|---|---|---|
| **SHoP Architects + JDS Development — The Brooklyn Tower / 9 DeKalb, New York** | Real-time BIM digital twin of a 93-storey, 1,073-ft skyscraper. Built a real-time BIM application ("SHoP Portal Immersive Suite") with Unity Pro + Unity Reflect: stakeholders view BIM-linked documents/renderings/live construction data; technicians overlay designs in AR on the construction site; acoustics visualised in VR. Aimed at faster decisions, fewer errors, lower carbon/cost. | [Unity marketing, corroborated by independent trade press] https://activation.unity3d.com/topics/digital-twin-applications-and-use-cases ; https://constructionmanagement.co.uk/game-changing-unity-steps-visualise-construction-p/ (BIM+, 2021-06-15). |
| **Mortenson** | Interactive VR/360° experiences for construction clients (e.g. with Kaiser Permanente, a new interventional radiology room modelled in full so staff could walk it before construction), to catch design issues and avoid physical mockups. | [Unity marketing via reseller] https://www.arkinfo.in/unity-architecture-engineering-construction |
| **DPR Construction** | AR that brings BIM data to the field in real time so field teams can capture design errors in a few clicks and resolve them without rework. DPR is described as an ENR Top 10 contractor. | [Unity marketing] https://activation.unity3d.com/topics/digital-twin-applications-and-use-cases |
| **Skanska** | Unity-based VR worker-safety training (with agency OutHere) adopted into its standard safety-training programme. | [Unity marketing via partner] https://www.advancedrealitysolutions.com/architecture-engineering-construction |

**Important caveat for AEC planning:** Unity Reflect — the BIM product behind the SHoP story (Revit/Navisworks/SketchUp/Rhino plugins) — was **discontinued in August 2023**, together with VisualLive. Its role now passes to the Industry Viewer Template and BIM/CAD import via the Asset Transformer Toolkit (formerly Pixyz, 70+ formats). [independent] https://construbim.com/bim-qa-visualization.html ; https://construbim.com/bim-software-visualization.html. Unity's AEC onboarding page still claims "more than half of the top 50 AEC companies use Unity" — [Unity marketing, unverified] https://create.unity.com/aec-onboarding-intro (URL as returned by search; do not rely on the figure without the underlying list).

### 1.3 Film and animation — real-time cinematics, virtual production

Unity's film evidence is almost entirely **Unity's own demo productions**, not third-party feature films. That matters: Unreal, not Unity, powered the LED-wall virtual production on *The Mandalorian* — do not attribute that to Unity.

| Project | What Unity does | Source / status |
|---|---|---|
| **Adam (2016) + Adam: The Mirror / The Prophet (2017, Oats Studios)** | Real-time-rendered short films made with Unity (Unity Demo Team, Sweden; Oats/Neill Blomkamp for episodes 2–3). Original *Adam* ran at 1440p on a GeForce GTX 980. Proof that a game engine could carry cinematic work. | [Unity marketing + independent] https://unity.com/demos ; https://www.moviemaker.com/how-unity-is-transforming-the-film-industry-from-animation-to-virtual-sets/ (2025-11-14); https://www.shortflix.org/title/adam-2017 |
| **The Heretic (2019)** | Real-time cinematic showcasing HDRP — photorealistic digital human, the first Unity project to explore that concept with stock Unity 2019.3. | [Unity marketing] https://unity.com/demos ; journal summary http://journal.cg-korea.org/archive/view_article_pubreader?pid=jkcgs-29-3-45 |
| **Enemies (2022)** | Cinematic teaser: photorealistic eyes, hair, skin, real-time ray-traced reflections/ambient occlusion, rendered in real time at 4K. | [Unity marketing] https://unity.com/demos |
| **Book of the Dead (2018)** | Interactive short film rendered in real time, showcasing high-end visuals. | [Unity marketing] https://unity.com/demos |

What Unity is *for* in film, per its own and independent coverage: previs, look development, real-time iteration on lighting/camera/effects, and Cinemachine (virtual-camera system, no-code camera behaviours) — https://learn.unity.com/course/introduction-to-3d-mobile-games-for-artists-companion-toolkit-2018-4/tutorial/overview-of-cinemachine?version=2018.4. For virtual production at scale, independent comparisons consistently give Unreal the lead; Unity's strength is lower cost / smaller teams / faster iteration.

### 1.4 Simulation and training — flight, medical, military, industrial

| Project | What Unity does | Source / status |
|---|---|---|
| **Siemens Power & Gas — gas-turbine field-service training (DiSTI VE Studio for Unity)** | VR/AR training for global gas-turbine technicians: SGT6-8000H Hot Gas Path Inspection (Teach → Practice → Assess), then SGT6-4000F and SGT400 turbine removal; deployed on HP Reverb VR, HoloLens and Magic Leap One AR. Goal: cut time/cost of training new technicians without the physical turbine. | [independent] Halldale, 2020-02-06: https://www.halldale.com/articles/17001-siemens-virtualizes-maintenance-training-with-disti ; DiSTI case study PDF https://cdn.disti.com/main/wp-content/uploads/2020/02/04164834/Siemens-Case-StudyFINAL.pdf |
| **Siemens Energy — wind-turbine technician training** | Unity + Azure + HoloLens 2 immersive training; trainees interact with a simulation of equipment guided by real procedures, pulling live cloud instruction sets, with performance recorded. | [secondary/vendor] https://bart-solutions.com/blog/unity-done-right-how-developers-transform-edtech-real-estate-and-medtech/ — no primary Siemens source verified in this research; treat as uncorroborated. |
| **ZATNav — tank, dental and drone simulators (Pakistan)** | 6-DOF Tank Training Simulator (DITS) for Al Zarar / Al Khalid platforms; dental simulator with 6-DOF haptics; physics-based FPV quadcopter simulator feeding C++ flight physics into Unity 3D on real terrain/lat-long. Stack: Unity 3D + .NET instructor station + SimTools motion platform. | [vendor] https://zatnav.com/services/training-simulator-development |
| **AMMROC — C-130 maintenance & painting VR (VRByte)** | High-fidelity military-aircraft inspection and precision spray-painting module, standalone on Meta Quest 3; shown at Dubai Airshow 2025. | [vendor] https://vrbyte.tech/ |
| **PrecisionOS — orthopaedic VR surgical training** | VR modules for orthopaedic procedures (e.g. reverse shoulder arthroplasty) with haptics, decision-making and assessment; used in residency/device programmes. A secondary source cites a peer-reviewed RCT (Lohre et al., *J Bone Joint Surg* 2020) and a "570% improvement in surgical accuracy" — **that percentage is vendor/secondary-reported and was not verified against the paper here**. | [secondary] https://bart-solutions.com/blog/unity-done-right-how-developers-transform-edtech-real-estate-and-medtech/ ; peer-review context (does not itself confirm the Unity link) https://pmc.ncbi.nlm.nih.gov/articles/PMC12325134/ |
| **Osso VR** | VR surgical/procedural training with assessment, used by device companies and health systems. Frequently listed alongside PrecisionOS; **the Unity-engine link for Osso VR was not independently verified in this research** — do not assert it without checking Osso's own stack. | [secondary] https://reverbico.com/blog/best-vr-companies-for-medical-simulation/ |

No Unity-based certified civilian flight simulator (e.g. FAA Level-D) was found; flight examples in Unity are drone/quadcopter and maintenance trainers, not full flight simulators. If the requester needs that comparison, it is a gap.

### 1.5 Digital twins and industrial IoT

| Project | What Unity does | Source / status |
|---|---|---|
| **Unity Industry sample projects** | "Operational Digital Twin" — interactive duplicate of a production site with multiple real-time data sources, location info and maintenance alerts; "IoT Sample Project" — integrating IoT devices for contextualised real-time visualisation of device data. | [Unity marketing] https://unity.com/demos |
| **Orlando Economic Partnership — regional digital twin** | Immersive digital twin of an entire region (Orlando) built in Unity. | [Unity marketing, via secondary] https://www.katrisoft.com/post/6-ways-digital-twins — detail is thin; treat as a named example, not a deep case study. |
| **Siemens S7-1500 PLC + Unity digital twin (academic)** | Real-time multi-layer architecture: physical PLC, Unity virtual environment, HMI supervision, IoT remote monitoring; bidirectional sync over Ethernet TCP/IP; reported average latency <15 ms, jitter <0.5 ms, SUS usability 86/100. | [independent, peer-reviewed] MDPI *Sensors* 2026: https://www.mdpi.com/1424-8220/26/7/2023 |
| **6-axis robot digital twin (Heilbronn University, IFAC 2026 preprint)** | Unity digital twin of a Mitsubishi 6-axis robot, driven by motor forces via Unity physics (not just kinematic equations), for AI data generation, predictive maintenance and mixed-reality use; Unity chosen because it supplies 3D visualisation plus C# integration in one platform. | [independent, preprint] https://skoge.folk.ntnu.no/prost/proceedings/ifac2026_IFACWC26_preprints/files/3988.pdf |
| **AkifKazi/digital-twin-project (open source, small)** | Unity 6 WebGL digital twin of a vibratory feeder (hopper/separator/conveyor): live or simulated telemetry on cards joined by leader lines, alarms, service view, cross-section/X-ray views, an "Ask" assistant, responsive desktop/phone layouts. | [independent, verified live] https://github.com/AkifKazi/digital-twin-project — created 2026-08-17, 0 stars at reading; author states it is "a visualisation prototype, not a control system". Useful as a UI-pattern reference for the requester's tool, not as production evidence. |

### 1.6 Medical / healthcare

| Project | What Unity does | Source / status |
|---|---|---|
| **Specto Medical — pre-surgical planning XR** | Swiss spin-off (Univ. Basel, founded 2022) turning CT/MRI into interactive XR in seconds via direct volume rendering (custom ray-marching renderer, compute shaders) — no lengthy reconstruction/meshing. Surgeons annotate, measure, virtually place implants; multi-user shared sessions; integrates with hospital PACS/imaging systems. FDA 510(k) cleared for clinical use; CE marking pending at article date. Why Unity (Specto's own words): shader hot-reloading without full recompile, extensible graphics pipeline for the custom renderer, built-in profiling, cross-platform XR (Meta Quest 3, HoloLens 2) without per-device API work, Asset Store/Mirror for multiplayer, .NET Standard for encryption/logging libraries. | [Unity-hosted guest blog by Specto, verified live] https://unity.com/blog/specto-medical-immersive-medical-imaging-visualization (2025-04-16). FDA clearance is stated by Specto/Unity; not independently checked against the FDA database here. |
| **Cincinnati Children's Hospital — Arc Viewer** | Anatomical digital twins for surgical planning: clinicians interact with virtual reconstructions of patient anatomy. | [Unity marketing] https://unity.com/solutions/healthcare |
| **VirtaMed** | Hyperrealistic mixed-reality surgical simulator recreating complex scenarios using a digital twin of the abdomen. | [Unity marketing] https://unity.com/solutions/healthcare |
| **Galderma** | iPad training app for >50,000 healthcare workers (Unity figure, unverified independently). | [Unity marketing] https://unity.com/solutions/healthcare |

### 1.7 Data visualization and scientific visualization

This is the closest vertical to the requester's use case (visualising agent runs/graphs/state), and it is also where the open-source evidence is strongest.

| Project | What Unity does | Source / status |
|---|---|---|
| **GeoViz** | Unity-based 3D oceanographic particle visualisation: OpenDrift NetCDF data (microplastics, oil, organisms) as thousands of particles in 2D/3D, Cesium Ion global terrain/bathymetry; handles 20 GB+ datasets, 45,000+ trajectories. Open source, GPL-3.0 (two private plugins — crosstales, Sirenix — must be bought separately). | [independent/project site] https://www.mspchallenge.info/geoviz.html |
| **OceanViz 3 (Ecopath International Initiative)** | Open-source 3D visualisation framework for underwater/marine ecosystems on Unity (2022.3.20f1): JSON-driven scenarios, split-screen up to 4 scenarios, 50+ asset library; being modernised from an outdated stack *to* Unity under EU MarinePlan. | [independent, verified via GitHub] https://github.com/Official-EwE/OceanViz ; https://www.marineplan.eu/news/detailansicht?tx_news_pi1%5Baction%5D=detail&tx_news_pi1%5Bcontroller%5D=News&tx_news_pi1%5Bnews%5D=479&cHash=f1b81c7e94daf93515e545afafdb3bc6 |
| **SUMO2Unity** | Open-source (MIT) co-simulation: Eclipse SUMO traffic behaviour + Unity 3D/VR environment for driver simulation, human-in-the-loop road-safety studies and digital twins. Unity 6000.0.53f1, SUMO 1.22. | [independent/project] https://roadwayvr.com/sumo2unity/ |
| **Unity 3D Radar Chart (Nicolaus Reski et al.)** | Data-agnostic interactive 3D radar chart for time-oriented data in immersive VR — an "immersive analytics" research implementation, described in peer-reviewed papers (*Virtual Reality* journal, 2024; NordiCHI 2020). | [independent, peer-reviewed + GitHub] https://github.com/nicoversity/unity_3dradarchart |
| **Immersive Chaos / chaotic-attractor VR** | Unity + Meta Quest 2 framework for exploring strange attractors / nonlinear dynamical systems in VR, manipulating parameters in real time. | [independent, preprint] https://assets-eu.researchsquare.com/files/rs-7210820/v1/b16c2a369d47856ae657a129.pdf (code at github.com/rnldtvm/Immersive_Chaos) |

General pattern in these projects: Unity is chosen for real-time 3D rendering + C# scripting + VR/XR + cross-platform deployment in one codebase, where a web stack (D3/Three.js) would struggle with scale, immersion or sensor/physics integration — and where Unreal would be heavier to build and staff.

### 1.8 Education

| Project | What Unity does | Source / status |
|---|---|---|
| **Labster — virtual science labs + UbiSim VR nursing** | The flagship education case. Labster: >6 million students, 3,000+ institutions, 100+ countries (Unity/Labster figures). UbiSim (VR nursing, built by nurses): lifelike patients who speak/react/deteriorate; 300+ nursing institutions, 18+ countries. One Unity codebase deploys UbiSim to standalone VR, Labster sims to browser via WebGL and to mobile via IL2CPP; URP/Shader Graph for VR performance; XR Interaction Toolkit; Addressables to stream large models and cut build size; Unity Asset Manager as the single source of truth for 3D assets. Reported outcomes (Labster/UbiSim via Unity — vendor-reported, not independently audited here): 57%+ improvement in clinical judgment vs traditional methods, 94% of nursing students say it prepared them for practice, up to 50% lower simulation costs vs standardised-patient labs. | [Unity marketing, verified live] https://unity.com/resources/labster (2025-12-15) |
| **Labster Builder** | Labster's proprietary simulation-authoring editor is itself powered by Unity — the closest analogue found to "a developer tool built in Unity". | [independent portfolio] https://www.georgeavdoulos.com/virtual-labs-portfolio |
| **Engage XR / others** | VR lesson/training platforms built on Unity/Unreal for schools; Labster is the strongest named example, so others are not detailed here. | [secondary] https://theportablegamer.com/2026/09/07/top-educational-game-development-companies-and-how-to-choose-the-right-one/ |

### 1.9 Retail / e-commerce

| Project | What Unity does | Source / status |
|---|---|---|
| **SmartPixels — Camille Fournet configurator** | Interactive product configurator for a Paris luxury leather-goods maker: customers configure products in 3D, which Unity says maximised sales/engagement while reducing manufacturing costs. Globe-Trotter (luxury luggage) is a second SmartPixels/Unity retail example. | [Unity marketing] https://unity.com/solutions/retail |
| **Walmart + Unity immersive commerce** | Walmart commerce APIs/SDK integrated into Unity games and apps so players can buy physical goods without leaving the experience; three launch experiences made with Unity — *House Flip* (fun-gi), *Avakin Life* (Lockwood), ZEPETO (Naver Z) — plus affiliate commissions for creators. Press-release figures (1.1M monthly Unity developers, 3.6B app downloads) are Walmart/Unity figures, unverified. | [independent] Walmart corporate, 2024-01-04: https://corporate.walmart.com/news/2024/01/04/walmart-and-unity-to-bring-immersive-commerce-to-games-virtual-worlds-and-apps ; Unity support FAQ https://support.unity.com/hc/en-us/articles/45748238239380-Walmart-Immersive-Commerce-SDK-General-Questions-FAQ |
| **Royal Enfield Hunter 350 "Make It Yours" builder** | Browser-based real-time 3D bike configurator (Unity/WebGL) with AR preview and e-commerce integration, built by Abhiwan. | [vendor] https://www.abhiwan.com/virtual-commerce-storefronts |

Retail is the thinnest vertical for *named, verifiable* Unity deployments: Unity's retail page leans on configurators/showrooms as use cases, and independent retail-software comparisons note luxury brands (Burberry, Louis Vuitton) have deployed Unity retail experiences — [secondary, unverified] https://visualalchemist.in/2026/07/05/best-software-for-immersive-retail-platforms-engines-and-integration-strategies/ — while noting Unreal (Porsche/BMW configurators) leads where photorealism is the priority.

---

## 2. Notable individual non-game Unity applications and open-source projects

### 2.1 Robotics simulators (most relevant open-source cluster)

| Project | What it is | Why Unity / notes | Source |
|---|---|---|---|
| **AWSIM (TIER IV)** | Open-source autonomous-driving simulator for Autoware; 8+ synchronised cameras, ray-traced LiDAR, traffic/pedestrian simulation, hardware-in-the-loop support. Won Industry Innovation Award at the 17th Unity Awards (2025). | Unity's own interview lists five reasons: (1) faster development/prototyping — built-in physics, rendering, scene management, C# iteration; (2) balance of core + advanced tools (DOTS, Scriptable Render Pipeline); (3) performance/flexibility at scale; (4) large ecosystem and talent pool; (5) multi-platform + **Linux/Ubuntu support** fitting Autoware's Ubuntu workflows, CI and containers. Custom libs: `ros2-for-unity`, Robotec-GPU-Lidar (NVIDIA OptiX). Caveat from the team: normal game culling/LOD can corrupt sensor data, so they had to invent custom optimisations. | [Unity marketing, verified live] https://web-prd.hexagon.unity.com/resources/tier-iv-awsim-open-source-autonomous-driving-simulator (2026-06-02); https://unity.com/solutions/robotics |
| **Unity Robotics Hub / Simulation Pro** | Unity's central robotics repo (2,616 stars, 472 forks, created 2020-09-24, verified live). Simulation Pro (Early Access, launched 2026-09-22) consolidates URDF importer, out-of-the-box LiDAR/RGB-D/IMU sensors, ROS 2 support and a **headless Linux build target** for parallel simulation. Requires Unity 6.3+ and a Unity Industry licence. | The official successor to the older ROS-TCP-Connector packages; the hub now points to Simulation Pro as the supported path. | [verified live] https://github.com/Unity-Technologies/Unity-Robotics-Hub ; https://unity.com/blog/unity-simulation-pro-early-access |
| **MAES 2.0 (Aalborg University)** | Open-source, physics-based multi-robot exploration/coverage simulator in Unity, with ROS interface, heatmap visualisation, signal-degradation modelling and a debugging GUI. | Modest hardware: up to 5 robots in ROS mode, up to 120 in Unity-only mode. Chosen for Unity physics + visualisation + ROS transfer to real robots. | [independent, university] https://projekter.aau.dk/maes-2-0-a-ros-compatible-simulation-tool-for-multi-robot-exploration-and-coverage-03d7a67b.html |
| **Unity_ROS2_Robot_Simulator** | Community Unity + ROS 2 robot simulator (Apache 2.0), Unity 6000.0.47f1+, ROS 2 Humble+, ROS-TCP-Connector. | Small community project; useful as a reference, not a production dependency. | [GitHub] https://github.com/REACT-ROBOT/Unity_ROS2_Robot_Simulator |

Unity's robotics page also names Medtronic (robotic-assisted surgery), Seiko Epson (industrial-robot programming simulator) and KITECH (manufacturing digital twin) as Unity robotics users — [Unity marketing] https://unity.com/solutions/robotics — without enough detail to verify independently.

### 2.2 Data-visualization / scientific-visualization tools

See §1.7 (GeoViz, OceanViz, SUMO2Unity, 3D Radar Chart, Immersive Chaos). The pattern: researchers pick Unity when the visualisation is **3D, interactive, large-scale and/or immersive (VR)**, and when they need C#/.NET integration (e.g. NetCDF parsing via Microsoft Scientific DataSet library in GeoViz). For 2D dashboards or browser-first charts, none of these projects argues Unity beats a web stack — and the web comparison in §2.4 explains why.

### 2.3 Developer tools / IDE-like uses

**No Unity-based AI-agent IDE or general-purpose developer IDE was found.** The closest analogues are:

- **Unity Editor itself** — a Unity-based tool for building Unity projects; its editor UI is built with UI Toolkit, which is evidence that IDE-like panels, inspectors, docking and data-heavy UI *can* be built in Unity's own UI system. (Reasoned inference, not a sourced claim.)
- **Labster Builder** — a proprietary simulation-building editor powered by Unity (§1.8).
- **Unity Studio** — Unity's web-based, no-code editor (beta) for building interactive 3D experiences (configurators, training apps, design-review tools) without writing code; publishes to web only at present, whereas the full Editor publishes to desktop/mobile/XR. [independent] https://aecmag.com/collaboration/smoothing-the-path-to-real-time/
- **Unity's own Industry sample/template projects** (HMI, Configurator, Training Application, Distribution Center, Operational Digital Twin, IoT) — [Unity marketing] https://unity.com/demos — these are starter kits, not developer tools.

**Implication for the requester:** the requester would be in largely uncharted territory for an *IDE* in Unity. The transferable precedents are simulation-authoring editors and data-heavy visualisation tools (Specto, Labster, AWSIM), not code editors. A hybrid architecture — Unity for the visualisation canvas embedded in (or alongside) a native/web code-editing shell — is a design option the sources do not directly address; it should be prototyped, not assumed.

### 2.4 Why Unity over Unreal, Godot, or web-based visualization

| Alternative | Where it wins (independent comparisons) | Where Unity wins for this kind of tool | Sources |
|---|---|---|---|
| **Unreal Engine 5** | Best out-of-the-box visuals (Nanite, Lumen); dominant in virtual production and high-end automotive/architectural visualisation; full C++ source. | Smaller builds, faster iteration, C# (easier hiring, faster R&D — AWSIM and Specto both cite this), broader platform/XR support, larger asset ecosystem. Unreal is heavier, steeper (C++ for deep work), and its non-game seat price is reported at $1,850/seat/yr above $1M (secondary, unverified here). | https://www.syntaxstation.co/insights/unity-vs-unreal-vs-godot ; https://oceanviewgames.co.uk/blog/posts/unity-vs-godot-vs-unreal-2026 |
| **Godot 4.x** | Free, open source (MIT), lightweight editor and builds, no licence that can change, excellent 2D. | Maturity: larger feature set, more mature XR/AR support and third-party integrations, bigger asset store, bigger hiring pool, better profiling/optimisation tooling, WebGL/mobile pipelines proven at Labster scale. Godot's 3D/XR and enterprise support are behind Unity's. | https://www.syntaxstation.co/insights/unity-vs-unreal-vs-godot ; https://hackernoon.com/interactive-app-development-the-perfect-technology-stack-zk1434zh?source=rss (Visartech, vendor, older but explicit on this comparison) |
| **Web-based viz (Three.js / D3 / React)** | Far lighter: Three.js core tree-shakes to ~500 kB–1 MB vs Unity WebGL 5–25 MB; loads in 2–6 s vs Unity WebGL 8–30 s; native text input, accessibility, menus, and the whole web UI ecosystem for free; no engine licence. | Native desktop app (no browser sandbox), built-in physics, XR, high-performance 3D at scale, single codebase to desktop/mobile/XR, C#/.NET integration. For a *desktop IDE* the web comparison is about embedding a web view vs a Unity canvas, not about shipping a web page. | https://www.utsubo.com/blog/threejs-vs-unity-web-comparison (secondary comparison; figures are the author's measurements, not a benchmark) |

**Direct "why Unity" statements from project teams (not Unity's marketing):**
- **AWSIM / TIER IV:** five reasons listed in §2.1, including C# iteration speed and Linux/Ubuntu fit.
- **Specto Medical:** shader hot-reload, extensible render pipeline, cross-platform XR, ecosystem/Asset Store.
- **Wabric (construction configurators):** chose Unity over alternatives for better web integration, seamless front-end communication, high-quality/fast display with fewer computer resources. [vendor] https://www.getwabric.com/blog/game-engines-in-construction-sector
- **Visartech (interactive apps):** multiplatform from one codebase, most-supported engine by third-party frameworks/platforms. [vendor] https://hackernoon.com/interactive-app-development-the-perfect-technology-stack-zk1434zh?source=rss

**Trust caveat:** Unity's 2023 Runtime Fee announcement damaged developer trust; Unity cancelled the fee in Sep 2024 and returned to seat-based pricing for games. The Industry distribution terms below are the live version of that risk for non-game tools.

---

## 3. Practical considerations for a desktop developer tool

### 3.1 Linux support — verified live (Unity 6.0 docs)

- **Editor:** Ubuntu **22.04 and 24.04 only**, x64 with SSE2, OpenGL 3.2+ or Vulkan-capable Nvidia/AMD GPUs, GNOME on X11 or Wayland, 8 GB RAM minimum. No other distro is officially supported; no ARM64 Linux editor.
- **Player (desktop Linux):** Ubuntu 22.04 / 24.04, **x64 only**, OpenGL 3.2+ / Vulkan, GNOME X11/Wayland.
- **Linux Editor limitations (official docs):** video import limited to VP8; file systems are case-sensitive; Wayland support is **experimental** (player needs `-force-wayland` in a Wayland session); a "Pipe error!" may require `ulimit -n 4096` before launching.
- **Server/headless:** Linux Server build support exists (Ubuntu 22.04/24.04 AMD64, no GPU requirement) — relevant for headless simulation/CI; Simulation Pro adds a headless Linux build target.
- **Embedded Linux / QNX:** available on request as part of Unity Industry (including Linux on ARM chipsets).
- **Hub:** Unity Hub 4.0.0 (released 2026-11-13) is a rebuilt native app; on Linux it ships as Flatpak alongside AppImage/.deb/.rpm.
- Source (verified live): https://docs.unity.com/en-us/engine/6000.0/manual/get-started/install-and-upgrade/getting-started-installing-unity/system-requirements ; https://unity.com/unity-hub/release-notes
- **Practical read:** Linux is a first-class *target* for Unity (AWSIM is Ubuntu-based), but it is a narrowly supported one — Ubuntu LTS x64 only, Wayland experimental. If the requester's users are on other distros, Arch/Fedora, or ARM Linux, that is unsupported territory and should be tested, not assumed.

### 3.2 Runtime size and distribution

- **Structure:** a Windows standalone build is an exe + `UnityPlayer.dll` (the runtime) + a `<Name>_Data` folder (scenes, assets, engine config). There is **no native single-file exe**; the usual workaround is a self-extracting archive. [secondary, low authority] https://copyprogramming.com/howto/unity-build-exe-without-data-folder — the structure itself is standard Unity behaviour, but treat the workaround guidance as unverified.
- **Size — what was actually measured:**
  - Empty Unity **2022.2.10f1** Windows build: **66.50 MB uncompressed** (community gist, old version, indicative only): https://gist.github.com/Shoozza/6b07423012c4b20a2ee9a1899b1aebcf
  - Empty Unity **6.5** Android arm64 release (default, no optimisations): **31.75 MB** (Defold's own published comparison — vendor figures, not independent, and Android, not desktop): https://umatechnology.org/defold-vs-unity-for-indie-game-development-features-workflow-and-costs-2026/
  - Empty Unity **6** WebGL: **10.7 MB** default 3D URP (6.9 MB code + 3.7 MB data), **2.0 MB** only after removing packages, Input System and Unity UI and using link-time optimisation (Aras Pranckevičius, long-time Unity graphics engineer, Oct 2024, via https://shop.forestrygames.com/blog/engine-choice-is-a-distribution-decision). **This is a WebGL figure, not a desktop figure.**
- **No authoritative current desktop empty-project size was found.** For a desktop IDE the honest answer is: expect tens of MB for the runtime alone before any content, dominated by textures/code/assets in a real project — and **measure a Unity 6.3 LTS empty build on Windows/macOS/Linux** before quoting a download size. Addressables (used by Labster to stream large models and cut build size) are the standard mitigation for large content.
- **Distribution channels:** standard desktop installers / Steam / direct download; no store-imposed size cliff for desktop as there is for mobile/WebGL portals. Updates are whole-build replacements unless Addressables/asset bundles are used for content.

### 3.3 Licensing / pricing for a commercial tool — verified live, read carefully
> **Project status (2026-11-13): personal open-source, non-commercial. The terms below describe the commercial case and do not apply to the current state of this project. They are kept here only for reference, in case the project is later commercialized or adopted by a large company.**


This is the most consequential section for the requester. All official-page claims below were verified live on 2026-11-13.

| Plan | Price (official page) | Who must use it (official FAQ) |
|---|---|---|
| **Personal** | Free | **Gaming and entertainment applications only.** Industry customers may *not* use Personal. |
| **Pro** | **$210.00/month** per seat (official pricing page; annual prepaid $2,310/seat/yr is reported by multiple secondary sources after a 5% increase effective 2026-01-12, but was **not shown** on the official pricing-page crawl — confirm at purchase) | Required for businesses with >$200K funding or annual revenue. |
| **Enterprise** | Custom (sales) | Required for businesses with >$25M annual revenue. |
| **Industry** | **$4,950.00/yr per seat** (header of official Industry page, verified live) | **Required if you create applications outside games/entertainment AND your company's total finances exceed $1,000,000.** Industry customers may only use Pro/Enterprise if total finances do **not** exceed $1M. 30-day free trial available. |

Sources (verified live): https://unity.com/pricing ; https://unity.com/products/unity-industry

**The distribution trap — Industry is not just a seat price:**
> "According to our terms of service, the distribution of the Unity runtime for commercial purposes by Industry Customers requires explicit authorization from Unity and is subject to a fee ('Distribution License') which is generally equivalent to **4.0% of the revenue generated by the software product that incorporates the Unity runtime**. Please contact Sales to discuss further." — Unity Industry FAQ, verified live at https://unity.com/products/unity-industry

That is *different* from games: the Runtime Fee for games was cancelled on 2024-09-12 and Unity's Editor Terms now grant game projects distribution "without royalty, revenue share or runtime fee" provided seat fees are paid. Industry customers do **not** get that grant. Secondary legal analysis agrees: https://wiki.licenseware.io/wiki/unity-runtime-fee-and-editor-terms-history/ ; https://wiki.licenseware.io/wiki/unity-technologies-licensing/

**Other licensing items to confirm with Unity Sales / counsel (not legal advice):**
- **Internal Deployment Add-On (IDAO), announced 2026-08-03:** secondary sources report a separate charge when Industry apps are distributed inside an organisation — free up to 100 monthly active users per app, then tiered annual prepaid fees; apps distributed before 2026-08-03 exempt if registered by 2027-03-31; apps on/after that date incur charges from 2027-08-01. **Unverified against an official Unity page in this research** — https://www.theslidefactory.com/post/unitys-push-to-industry-navigating-the-new-licensing-landscape. If the requester plans internal/enterprise distribution, ask Sales about this explicitly.
- **Total finances** is measured on trailing-12-month revenue + funding, and (per secondary analysis of the Editor Terms) a contractor's client's finances can count — verify the definition for the requester's situation.
- **Unity Studio** is included 1:1 with Industry seats (official FAQ).
- **Havok Physics** is no longer included with Pro/Enterprise/Industry from Unity 6.3 (secondary sources) — budget separately if needed; irrelevant for most UI/visualisation tools.
- **What this means for the requester's decision:** if the tool will be sold commercially and the company is (or will become) >$1M in total finances, budget **$4,950/seat/yr for every developer seat + a negotiated ~4% revenue share on the product**, not just Pro pricing. If the company is ≤$1M, Pro ($210/mo/seat) is permitted for industry apps — but crossing $1M forces a move to Industry. Get the distribution licence in writing before building a business on it.

### 3.4 Known limitations for non-game UI-heavy applications

- **Two UI systems, neither is a native desktop UI toolkit:**
  - **uGUI (Unity UI, since 2014):** GameObject/Canvas/RectTransform-based, still mainstream for runtime UI. Known limits: expensive Canvas rebuilds when anything changes (layout + rendering data recalculated), overdraw, no native data binding (boilerplate to sync UI with data), no CSS, styling is per-element, and UI structure lives in prefab/scene YAML — unreadable in diffs, and Inspector drag-and-drop wiring breaks silently (`NullReferenceException`) if a reference is missed. Sources: https://zenn.dev/s4k1/articles/6c29073680ff21?locale=en ; https://blog.truegeometry.com/api/exploreHTML/8e0193a3d7dee904f37d30e536f0318d.exploreHTML
  - **UI Toolkit (runtime support since 2021.2):** UXML markup + USS stylesheets + C#, Flexbox (Yoga) layout — web-like, retained-mode, better for data-heavy/desktop UI and editor tools, with live reload. Limits: weaker Timeline/Animator integration, limited custom-shader support, smaller community, and world-space UI only became stable in Unity 6.2+. Secondary benchmarks claim 9× fewer draw calls, 3× faster CPU frame times and 2.6× less memory vs uGUI — **those numbers come from a low-authority secondary site and are unverified here**: https://copyprogramming.com/howto/unity3d-ui-elements-snapping-anchoring
  - **Recommendation from the sources:** new data-heavy/desktop projects should default to UI Toolkit; keep uGUI only for animation-heavy or VR spatial UI.
- **No native desktop affordances (assessment, not a single sourced fact):** a Unity player is a single game-style window. There is no built-in native menu bar, native file dialogs, multi-window docking, OS accessibility (screen readers), IME/text-input parity, or native drag-and-drop with the OS. Teams building IDE-like tools either accept a game-style UI, build those affordances themselves, or embed Unity as a viewport inside a native shell. The Unity Editor itself (built with UI Toolkit) proves IDE-like panels *can* be built — but Unity Technologies built that over many years.
- **Text and lists at IDE scale:** uGUI struggles with large dynamic lists (layout groups, >500 items); UI Toolkit handles large lists better, but both need pooling/virtualisation for agent logs, traces and tables with thousands of rows. Plan for this early — it is the most likely performance cliff for an agent-IDE (long streaming logs, tool-call trees, graph views).
- **Editor vs player confusion:** the Unity Editor is a powerful tool, but shipping the Editor is not an option — the requester ships a *player* build. Editor-only features (inspectors, scene view, some UI Toolkit editor APIs) do not transfer to the player.
- **Version churn / trust:** Unity 6 / 6.3 LTS is the current stable line (support through 2027 per secondary sources); Unity Reflect was discontinued in 2023 (see §1.2), and the Runtime Fee reversal shows pricing/terms can change abruptly. Pin an LTS version and budget for licence-terms review at each renewal.
- **GPU requirement:** even a UI-heavy tool needs a GPU (OpenGL 3.2+/Vulkan, DX10+); headless/CI use needs the Linux Server build. A text-first IDE user on a headless or low-GPU machine will have a worse experience than with a native/web IDE.

---

## Could not verify / open questions

1. **No Unity-based AI-agent IDE precedent found.** Searches found simulation-authoring editors (Labster Builder), Unity Studio, and visualisation tools — but no IDE for an agent framework. The requester should treat this as novel and prototype the UI-heavy parts (code editing, logs, graphs) before committing.
2. **Current desktop empty-build size.** No authoritative Unity 6.x desktop figure was found; the figures above are old (2022) or for other platforms (Android/WebGL). Measure a Unity 6.3 LTS empty build.
3. **Pro annual price ($2,310/seat/yr).** Official pricing page crawl showed only $210/mo; the annual figure is consistent across secondary sources but should be confirmed at checkout/sales.
4. **Internal Deployment Add-On (IDAO).** Reported only in secondary sources; not verified against Unity's official terms in this research.
5. **PrecisionOS "570% improvement" and Labster outcome percentages (57%+, 94%, etc.).** Vendor/secondary-reported; not verified against the underlying papers.
6. **Osso VR's engine.** Listed as a Unity surgical trainer in secondary sources, but the Unity link was not verified — do not cite it as a Unity project without checking.
7. **ART Cockpit Design Suite** had no full customer programme at its Oct 2026 launch (Unity's own statement).
8. **Unreal non-game seat price ($1,850/seat/yr)** and **Unity "more than half of top 50 AEC companies"** — secondary/Unity-marketing figures, unverified.
9. **Certified flight simulation in Unity** — no example found; flight examples are drone/maintenance trainers.
10. **No page instructions were encountered that attempted to redirect this research.** No prompt-injection content was followed.

## Sources

*All URLs copied verbatim from search results or live fetches on 2026-11-13. "Verified live" = fetched via browser_open on 2026-11-13.*

**Official Unity (marketing/docs — treat performance and adoption claims as Unity-reported):**
- https://unity.com/products/unity-industry — Industry $4,950/seat/yr, >$1M rule, 4% Distribution License, 30-day trial (verified live)
- https://unity.com/pricing — Personal/Pro $210/mo/Enterprise/Industry eligibility (verified live)
- https://docs.unity.com/en-us/engine/6000.0/manual/get-started/install-and-upgrade/getting-started-installing-unity/system-requirements — Unity 6.0 Linux/Windows/macOS requirements (verified live)
- https://unity.com/blog/specto-medical-immersive-medical-imaging-visualization — Specto (verified live)
- https://unity.com/resources/labster — Labster/UbiSim (verified live)
- https://web-prd.hexagon.unity.com/resources/tier-iv-awsim-open-source-autonomous-driving-simulator — AWSIM (verified live)
- https://web-prd.hexagon.unity.com/resources/renault-real-time-3d-cockpit — Renault (index)
- https://unity.com/resources/art-spa-vr-cockpit-design-review — ART (index)
- https://unity.com/solutions/robotics ; https://unity.com/blog/unity-simulation-pro-early-access — Robotics / Simulation Pro (index)
- https://unity.com/solutions/healthcare ; https://unity.com/solutions/retail ; https://unity.com/demos ; https://unity.com/blog/october-2026-industry-content-wrap-up (index)
- https://activation.unity3d.com/topics/digital-twin-applications-and-use-cases — digital twins, SHoP/DPR (index)
- https://unity.com/unity-hub/release-notes — Hub 4.0.0 (index)

**Independent / peer-reviewed:**
- https://news.panasonic.com/global/press/en260707-2 — Mazda CX-5 / Panasonic (press release)
- https://www.halldale.com/articles/17001-siemens-virtualizes-maintenance-training-with-disti — Siemens/DiSTI
- https://www.mdpi.com/1424-8220/26/7/2023 — PLC + Unity digital twin paper
- https://www.moviemaker.com/how-unity-is-transforming-the-film-industry-from-animation-to-virtual-sets/ — film
- https://constructionmanagement.co.uk/game-changing-unity-steps-visualise-construction-p/ — SHoP/BIM+
- https://corporate.walmart.com/news/2024/01/04/walmart-and-unity-to-bring-immersive-commerce-to-games-virtual-worlds-and-apps — Walmart
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12325134/ — VR orthopaedic training review
- https://skoge.folk.ntnu.no/prost/proceedings/ifac2026_IFACWC26_preprints/files/3988.pdf — 6-axis robot digital twin preprint
- https://www.syntaxstation.co/insights/unity-vs-unreal-vs-godot ; https://oceanviewgames.co.uk/blog/posts/unity-vs-godot-vs-unreal-2026 — engine comparisons
- https://www.utsubo.com/blog/threejs-vs-unity-web-comparison — Three.js vs Unity WebGL

**Open source / project sites:**
- https://github.com/Unity-Technologies/Unity-Robotics-Hub (verified live, 2,616 stars)
- https://github.com/AkifKazi/digital-twin-project (verified live)
- https://github.com/Official-EwE/OceanViz ; https://github.com/nicoversity/unity_3dradarchart ; https://github.com/REACT-ROBOT/Unity_ROS2_Robot_Simulator
- https://www.mspchallenge.info/geoviz.html ; https://roadwayvr.com/sumo2unity/ ; https://projekter.aau.dk/maes-2-0-a-ros-compatible-simulation-tool-for-multi-robot-exploration-and-coverage-03d7a67b.html

**Secondary / vendor (use with caution, flagged in text):**
- https://wiki.licenseware.io/wiki/unity-technologies-licensing/ ; https://wiki.licenseware.io/wiki/unity-runtime-fee-and-editor-terms-history/ — licensing analysis
- https://www.capermint.com/blog/unity-game-development-cost/ ; https://www.theslidefactory.com/post/unitys-push-to-industry-navigating-the-new-licensing-landscape — Pro annual price; IDAO
- https://construbim.com/bim-qa-visualization.html ; https://construbim.com/bim-software-visualization.html — Reflect discontinuation
- https://bart-solutions.com/blog/unity-done-right-how-developers-transform-edtech-real-estate-and-medtech/ — Siemens Energy, PrecisionOS
- https://www.getwabric.com/blog/game-engines-in-construction-sector ; https://hackernoon.com/interactive-app-development-the-perfect-technology-stack-zk1434zh?source=rss — why-Unity vendor views
- https://zenn.dev/s4k1/articles/6c29073680ff21?locale=en ; https://copyprogramming.com/howto/unity3d-ui-elements-snapping-anchoring — UI limitations/benchmarks
- https://gist.github.com/Shoozza/6b07423012c4b20a2ee9a1899b1aebcf ; https://shop.forestrygames.com/blog/engine-choice-is-a-distribution-decision — build-size figures
- https://www.arkinfo.in/unity-architecture-engineering-construction ; https://www.advancedrealitysolutions.com/architecture-engineering-construction ; https://www.katrisoft.com/post/6-ways-digital-twins ; https://zatnav.com/services/training-simulator-development ; https://vrbyte.tech/ ; https://www.georgeavdoulos.com/virtual-labs-portfolio ; https://bilgekagan.site/AstonMartin.html ; https://www.abhiwan.com/virtual-commerce-storefronts ; https://aecmag.com/collaboration/smoothing-the-path-to-real-time/

**Working notes:** `notes/sources-01-verticals.md`, `notes/sources-02-tools-pricing-linux.md`
