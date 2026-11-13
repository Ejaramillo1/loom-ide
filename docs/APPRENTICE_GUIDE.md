# The Loom Workbench — Apprentice Guide

To: My apprentice (the junior developer who will continue this work)
From: Your senior developer (this is my last project on this codebase)
Goal: Merge the Tauri web app and the eframe native workbench into one real Loom-powered workbench — agents, sessions, workflows, artifacts, MCP servers, graph memory, daily work screen, capture-in-work, and an honest layout.

How to read this: Do exactly one implementation phase per sitting. Do not skip ahead. If a step says "verify," you must see it with your own eyes before moving on. When in doubt, stop and ask.

Languages you will touch:
- Rust — the native eframe app (native-app/src/*.rs) and the Tauri backend (src-tauri/src/*.rs)
- TypeScript — the Tauri frontend (src/main.ts, src/api.ts)
- CSS — the Tauri theme (src/style.css)
- TOML — Cargo.toml files (do not edit unless told)
- JSON — config and data files

Golden rules (never break these):
1. 
2. 
3. 
4. 
5. 

## PHASE 1 — Understand what you already have

Before you write a single line of new code, you must know the two codebases inside out.

### Sub-phase 1.1 — Read and map both codebases

#### Implementation 1.1.1 — Read the Tauri app file tree

Open /home/ed/loom-ide-tauri and read these files completely:
- README.md (the whole thing)
- src/main.ts (all of it — this is the frontend brain)
- src/api.ts (all of it — this is how the frontend talks to Rust and Loom)
- src/style.css (the visual tokens and layout)
- index.html (the shell: header, main, footer)
- src-tauri/src/lib.rs (the Rust backend — all 36 Tauri commands)
- src-tauri/src/store.rs (work items, intents, persistence)
- src-tauri/src/experiment.rs (experiments)

What to look for: The Tauri app talks to a real Loom server at http://localhost:5006. It has intents, work items, sessions, agents, workflows, artifacts, tools, models, providers. The UI has modes: Code, Experiment, Work, Agents, Evidence, Artifacts.

What NOT to do: Do not edit any of these files yet. Read-only. Do not delete anything.

Verification: You can draw (on paper or in a text file) a box-and-arrow diagram showing: main.ts → api.ts → Tauri invoke → lib.rs → Loom HTTP → Loom server.

#### Implementation 1.1.2 — Read the eframe native app file tree

Open /home/ed/loom-ide-tauri/native-app/ and read these files completely:
- native-app/README.md (the whole thing)
- native-app/Cargo.toml (dependencies: eframe 0.29.1, serde, image)
- native-app/src/main.rs (the app struct, all views, the conversation, the graph, the canvas)
- native-app/src/knowledge.rs (the Vault: notes, edges, ledger, folders, save rules)
- native-app/src/adapter.rs (the AgentAdapter trait — this is where Loom connects)
- native-app/src/visual.rs (colors, palette, painting helpers)
- native-app/src/mechanics.rs (sphere state, chat rules, experiment stages)
- native-app/src/scene.rs (scene preview inspector)

What to look for: The eframe app is a local-only knowledge workbench. It has a Vault with notes (intent, note, project, experiment, decision, result, memory, etc.), typed edges between them, a graph view, a canvas, and six navigation controls. The AgentAdapter trait exists but submit() returns "No agent is connected."

What NOT to do: Do not rewrite main.rs from scratch. Do not delete the adapter.rs trait. Do not add external crates without asking.

Verification: You can list the six views in the eframe app: Home, Knowledge, Canvas, Experiments, Decisions, Traces.

#### Implementation 1.1.3 — Write a one-page "merge map"

Create a file at docs/MERGE_MAP.md. On it, write (in plain English, no code):

Tauri app has	eframe app has	What we need to connect
Loom server HTTP client	Offline adapter stub	Wire adapter to Loom HTTP
Sessions, agents	Vault notes	Map Loom objects to notes
Artifacts	Vault artifacts folder	Sync Loom artifacts to vault
Graph memory hooks	Local graph view	Connect Loom GraphMemory to graph view
Intent → Work model	Intent setting in vault	Unify the intent concept
Work modes (Code, Work, etc.)	Six nav views	Decide which view owns what

Rule: This map is your contract. If you want to build something not on the map, add it to the map first.

Verification: Show the map to yourself. Does every row have a clear "what we need to connect"? If a row is empty, you do not understand it yet — re-read the source files.

### Sub-phase 1.2 — Set up your development environment

#### Implementation 1.2.1 — Install Rust (if not already installed)

Open a terminal. Run:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env
Then verify:
rustc --version
cargo --version
You should see version numbers. If you see "command not found," stop. Do not proceed. Fix Rust first.

What NOT to do: Do not use sudo to install Rust. Do not install multiple Rust toolchains. Do not edit rustc or cargo binaries.

Verification: cargo --version prints a version like cargo 1.xx.x.

#### Implementation 1.2.2 — Install Node.js 20+ (if not already installed)

node --version
npm --version
If either is missing or the version is below 20, install Node.js from https://nodejs.org (LTS version). Then verify again.

What NOT to do: Do not use npx to random packages. Do not install Node via apt if it gives an old version. Use the official installer or nvm.

Verification: node --version starts with v20. or higher.

#### Implementation 1.2.3 — Install system dependencies for Tauri (Ubuntu 24.04)

Run exactly this (from the HOW_TO_OPEN.md):
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev \
  libgtk-3-dev pkg-config

What NOT to do: Do not skip this. The Tauri window will not open without these libraries.

Verification: Try pkg-config --exists gdk-3.0 && echo OK — it should print OK.

### Sub-phase 1.3 — Run both apps separately, verify they work

#### Implementation 1.3.1 — Run the Tauri app

In /home/ed/loom-ide-tauri:
npm install
npm run tauri dev
Wait for the window to open. It should say "Checking Loom…" then "Loom offline" (because the Loom server is not running yet). Click around: Code, Experiment, Work, Agents, Evidence, Artifacts.

What NOT to do: Do not edit code while it is running. Do not panic when it says "Loom offline" — that is honest and correct.

Verification: The window opens. You can switch modes. The status pill says "Loom offline."

#### Implementation 1.3.2 — Run the eframe native app

In /home/ed/loom-ide-tauri/native-app:
cargo build --offline
./target/debug/living-workbench
Wait for the window. You should see a dark purple interface with a luminous sphere, an intent at top ("Understanding agent memory performance"), and six navigation buttons at bottom.

What NOT to do: Do not edit Cargo.toml to add dependencies. Do not delete target/ while the app is running.

Verification: The window opens. Click the six nav buttons. Click "+ Capture a note" in the sidebar. The app does not crash.

#### Implementation 1.3.3 — Verify both apps can run at the same time

Open a second terminal. Run the Tauri app in one, the eframe app in the other. Both windows should be open simultaneously.

What this proves: The two apps are independent. They do not share a port. They do not conflict.

What NOT to do: Do not try to make them share a window yet. That is Phase 3 work.

Verification: Two windows are open. You can click in both without either crashing.

## PHASE 2 — Connect the eframe workbench to the real Loom server

Now we wire the native app to Loom so it sees real agents, sessions, artifacts, and MCP servers.

### Sub-phase 2.1 — Implement the AgentAdapter to talk to Loom HTTP

#### Implementation 2.1.1 — Understand the AgentAdapter trait

Open native-app/src/adapter.rs. Read it slowly. It currently looks like this:
pub trait AgentAdapter {
    fn activity(&self) -> AgentActivity;
    fn submit(&mut self, context: &ContextPack, prompt: &str) -> Result<String, String>;
}

pub struct OfflineAdapter;
impl AgentAdapter for OfflineAdapter {
    fn activity(&self) -> AgentActivity { ... idle ... }
    fn submit(&mut self, _: &ContextPack, _: &str) -> Result<String, String> {
        Err("No agent is connected. Local knowledge remains available.".into())
    }
}

What this means: activity() reports whether the agent is idle/working. submit() sends a prompt and gets a text answer. Right now submit() always fails.

What NOT to do: Do not change the trait signature. Do not add async to the trait yet (eframe is synchronous; we will use blocking HTTP calls inside spawn_blocking like the Tauri backend does).

Verification: You can explain in one sentence what submit() does.

#### Implementation 2.1.2 — Write a LoomHttpAdapter struct

Create a new file native-app/src/loom_adapter.rs. Write this exactly:
//! Native adapter: connects the eframe workbench to the real Loom server.
//! Uses blocking HTTP over TCP (same pattern as src-tauri/src/lib.rs).

use crate::adapter::{AgentAdapter, AgentActivity, ContextPack};
use std::net::TcpStream;
use std::io::{Read, Write};
use std::time::Duration;
use serde_json::Value;

const LOOM_HTTP_URL: &str = "http://127.0.0.1:5006";

pub struct LoomHttpAdapter {
    connected: bool,
}

impl LoomHttpAdapter {
    pub fn new() -> Self {
        Self { connected: false }
    }

    /// Raw HTTP request to Loom. Returns (status, body_bytes).
    fn loom_request(&self, method: &str, path: &str, body: Option<String>) -> Result<(u16, Vec<u8>), String> {
        let mut stream = TcpStream::connect_timeout(&"127.0.0.1:5006".parse().unwrap(), Duration::from_secs(2))
            .map_err(|e| format!("Loom unavailable: {e}"))?;
        stream.set_read_timeout(Some(Duration::from_secs(10))).map_err(|e| e.to_string())?;
        let body = body.unwrap_or_default();
        let request = format!(
            "{method} {path} HTTP/1.1\r\nHost: 127.0.0.1:5006\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
            body.len()
        );
        stream.write_all(request.as_bytes()).map_err(|e| e.to_string())?;
        let mut raw = Vec::new();
        let mut buf = [0u8; 65536];
        loop {
            match stream.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => raw.extend_from_slice(&buf[..n]),
                Err(e) => return Err(e.to_string()),
            }
        }
        let header_end = raw.windows(4).position(|w| w == b"\r\n\r\n")
            .ok_or("Invalid HTTP response")?;
        let head = String::from_utf8_lossy(&raw[..header_end]);
        let status = head.split_whitespace().nth(1).and_then(|v| v.parse().ok())
            .ok_or("Invalid HTTP status")?;
        let payload = raw[header_end + 4..].to_vec();
        Ok((status, payload))
    }

    /// Parse a JSON response body into a Value.
    fn parse_json(&self, payload: &[u8]) -> Result<Value, String> {
        serde_json::from_slice(payload).map_err(|e| format!("Bad JSON from Loom: {e}"))
    }
}

impl Default for LoomHttpAdapter {
    fn default() -> Self { Self::new() }
}

impl AgentAdapter for LoomHttpAdapter {
    fn activity(&self) -> AgentActivity {
        match self.loom_request("GET", "/v1/health", None) {
            Ok((status, _)) if (200..300).contains(&status) => {
                AgentActivity { state: AgentActivityState::Idle, execution_id: None, evidence: vec![] }
            }
            _ => AgentActivity { state: AgentActivityState::Error, execution_id: None, evidence: vec![] },
        }
    }

    fn submit(&mut self, context: &ContextPack, prompt: &str) -> Result<String, String> {
        let body = serde_json::json!({ "query": prompt }).to_string();
        let (status, payload) = self.loom_request("POST", "/v1/weave", Some(body))?;
        if !(200..300).contains(&status) {
            return Err(format!("Loom returned HTTP {status}"));
        }
        let value = self.parse_json(&payload)?;
        let text = value.get("text")
            .and_then(|v| v.as_str())
            .ok_or("Loom returned no text")?;
        Ok(text.to_string())
    }
}

// Re-export the state enum so main.rs can match on it
#[derive(Clone, Copy, PartialEq, Debug)]
pub enum AgentActivityState {
    Idle,
    Listening,
    Thinking,
    Exploring,
    Executing,
    AwaitingApproval,
    Completed,
    Error,
}

What NOT to do: Do not use reqwest or ureq — add no new dependencies. Use plain TcpStream exactly like src-tauri/src/lib.rs does. Do not make submit() async.

Verification: cargo build --offline in native-app/ compiles with no errors.

#### Implementation 2.1.3 — Wire the adapter into main.rs

Open native-app/src/main.rs. Find where OfflineAdapter is used (search for OfflineAdapter). Replace it with LoomHttpAdapter. Wherever the app checks agent state, match on AgentActivityState instead of the old mechanics::State for the agent activity.

Add a connection test button: when clicked, it calls adapter.activity() and shows a toast "Connected to Loom" or "Loom offline."

What NOT to do: Do not remove the OfflineAdapter struct entirely — keep it as a fallback for when Loom is down. Do not hardcode a fake reply.

Verification: Click the connection test button. If Loom is running, it says "Connected." If not, it says "Loom offline." The app does not crash either way.

### Sub-phase 2.2 — Map Loom objects to vault notes

#### Implementation 2.2.1 — Fetch Loom sessions and save them as notes

Add a function in native-app/src/loom_adapter.rs (or a new file native-app/src/loom_sync.rs):
pub fn sync_sessions(vault: &mut Vault, adapter: &LoomHttpAdapter) -> Result<(), String> {
    let (status, payload) = adapter.loom_request("GET", "/v1/sessions?limit=500", None)?;
    if !(200..300).contains(&status) {
        return Err("Cannot list sessions".into());
    }
    let value = adapter.parse_json(&payload)?;
    let sessions = value.get("sessions").and_then(|v| v.as_array()).ok_or("No sessions array")?;
    for session in sessions {
        let id = session.get("id").and_then(|v| v.as_str()).unwrap_or("unknown");
        let name = session.get("name").and_then(|v| v.as_str()).unwrap_or(id);
        let body = format!("Loom session: {name}\nID: {id}\nSynced from Loom server.\n");
        vault.create(name, body, "session", Actor::Human)?;
    }
    Ok(())
}

What NOT to do: Do not write sessions as chat messages. Each session is a note of kind "session." Do not duplicate sessions on every sync — check vault.get(id) first.

Verification: After syncing, the vault contains notes whose titles are Loom session names.

#### Implementation 2.2.2 — Fetch Loom agents and save them as notes

Same pattern: GET /v1/agents, create notes of kind "agent" with fields: name, status, uptime, active_sessions, total_messages.

What NOT to do: Do not store agent API keys or secrets in notes. Do not write agent passwords anywhere.

Verification: Vault contains agent notes. Clicking an agent note shows its status and message count.

#### Implementation 2.2.3 — Fetch Loom artifacts and save them as notes

GET /v1/artifacts?limit=200, create notes of kind "artifact" with name, purpose, source, and a link to the artifact content.

What NOT to do: Do not download artifact binary content into the vault unless the user asks. Store a reference/link only.

Verification: Vault contains artifact notes. You can see "what this work produced."

### Sub-phase 2.3 — Connect graph memory (the graph view)

#### Implementation 2.3.1 — Understand Loom GraphMemory

Read docs/research/05-loom-assessment.md section "Memory/context (existing)." Loom has GraphMemoryStore with: entities, edges, salience, FTS5, agent-scoped, immutable audit. Operations: CRUD + Relate/Neighbors/Remember/Recall/Forget/Supersede/Consolidate/Lineage/Decay/ContextFor/VectorRecall.

What NOT to do: Do not try to reimplement GraphMemory in the eframe app. The eframe app already has its own local Ledger with edges. We will connect them later, not replace one with the other.

Verification: You can list five GraphMemory operations from the doc.

#### Implementation 2.3.2 — Make the eframe graph view read from vault edges

Open native-app/src/main.rs, find the graph() function. It already reads vault.notes and vault.ledger.edges and draws nodes with edges. Confirm it works by clicking "Knowledge" in the nav and looking at the graph.

What NOT to do: Do not change the graph layout algorithm. Do not add animations. The graph is static circles and lines.

Verification: The Knowledge view shows a graph with at least one node ("result" is the big center node) and lines between nodes.

#### Implementation 2.3.3 — Add a "Sync from Loom" button to the graph view

In the Knowledge view header, add a button labeled "Sync from Loom." When clicked:
1. 
2. 
3. 
4. 

What NOT to do: Do not sync automatically every frame. Sync only on button click. Do not show a spinner that never stops.

Verification: Click "Sync from Loom." New notes appear in the vault. The graph updates with new nodes. No crash.

## PHASE 3 — Build the workbench surface (what the user sees every day)

Now we fix the layout problems you mentioned and build the daily work screen.

### Sub-phase 3.1 — Fix layout issues (conversation, banner, centering)

#### Implementation 3.1.1 — Fix the conversation panel spacing (Tauri app)

Open src/style.css. Find .chat-panel and .left-chat. The problem: the conversation panel is too close to the work list above it. Add margin-top: 16px; and padding-top: 14px; to .left-chat. Also increase the gap between the work list and the chat section.

Open src/main.ts, find where the chat panel is rendered. Confirm there is a visual separator (a 1px border) between the work list and the conversation.

What NOT to do: Do not make the chat a drawer or a tab. It stays in the left column, below the work list. Do not cover the header or footer.

Verification: The conversation panel has breathing room below the work list. There is a clear line separating them.

#### Implementation 3.1.2 — Fix the banner that goes out of the window

Find the objective banner / header title area in index.html and src/main.ts. The #objective-btn and #objective-title use white-space: nowrap with text-overflow: ellipsis. Verify the container min-width: 0 is set on the parent so the ellipsis actually works.

In src/style.css, confirm .objective has min-width: 0, overflow: hidden, text-overflow: ellipsis. If the title is too long, it should show … not push the inspector off-screen.

What NOT to do: Do not set a fixed width on the header. Do not use absolute positioning for the title. Do not hide the title entirely.

Verification: Type a very long work title. The header shows … at the end. The inspector on the right stays visible.

#### Implementation 3.1.3 — Stop everything from being centered in Experiments

Open src/main.ts, find buildWorkflowsSection() and renderExperimentDetail(). The experiment view currently centers content. Change .exp-layout to not use align-items: center or margin: 0 auto. Instead, the left sidebar holds the experiment list, the right detail holds the selected experiment. The sphere stays in the left sidebar (not centered on screen).

Open src/style.css, find .exp-layout and .view-experiment. Remove align-items: center / justify-content: center if present. Make the layout: sidebar left (fixed width), detail right (flexible).

What NOT to do: Do not move the sphere to the center of the screen. It stays in the left sidebar as a state indicator. Do not make every view look like a dashboard.

Verification: In Experiment mode, the list is on the left, detail on the right, sphere in the left sidebar. Nothing is dead-centered on the screen.

### Sub-phase 3.2 — Build the work screen (where you start your day)

#### Implementation 3.2.1 — Design the Work screen as a daily dashboard

Open docs/03-interaction-model.md. Read the "Primary objects" table: Intent, Work, Artifact, Evidence, Control. The Work screen is where the user reviews what they have done and what they will do today.

In src/main.ts, renderWorkDetail() currently shows: success criteria, workflows, artifacts, evidence. We need to add a "Today" summary at the top: active intent, work items due/in progress, recent attention items.

Add a section before buildWorkSummary() that shows:
- Active intent statement (one line)
- Work items count: active / paused
- Attention items waiting (experiments needing a decision)

What NOT to do: Do not make the Work screen a copy of the Experiment screen. Work is about the user's intent and tasks, not about running arms.

Verification: In Work mode, the top shows "You are working on: intent" and a list of work items with status dots.

#### Implementation 3.2.2 — Move "Capture an Idea" into the Work section

Open native-app/src/main.rs. The "+ Capture a note" button is in the sidebar under "Research Vault." Move it (or add a mirror) to the Work view so capturing an idea starts from an intent.

In the Tauri app, the "New work" form is already in the left panel. Add a "Capture idea" button there that creates a work item with title "Idea: user text" and links it to the active intent.

What NOT to do: Do not create a new top-level nav item called "Capture." Capture lives inside Work. Do not make capture create a chat message — it creates a work object.

Verification: Click "Capture an idea." A work item appears in the work list. It is linked to the active intent.

#### Implementation 3.2.3 — Add a Projects and Sessions view

The user said: "I dont see where am I going to have my projects or new projects or sessions."

In native-app/src/main.rs, the sidebar already has vault folders including 50 Projects/. Make clicking a project folder filter the knowledge view to notes in that project.

In the Tauri app, sessions already exist (listSessions, createSession). Add a "Sessions" section to the Work detail or a new sidebar section that lists sessions with their agent and message count.

What NOT to do: Do not create a separate "Projects" app. Projects are folders/kinds inside the existing vault and session system. Do not invent a new database.

Verification: You can see a list of sessions. You can see project folders. Clicking a project shows its notes.

### Sub-phase 3.3 — Test, clean up, and ship

#### Implementation 3.3.1 — Write tests for the Loom adapter

In native-app/src/loom_adapter.rs, add a #[cfg(test)] module with tests:
- test_loom_request_returns_error_when_offline — connect to a dead port, expect error.
- test_submit_parses_text_response — feed fake JSON, expect the text field.

What NOT to do: Do not test against a real Loom server in unit tests (it may not be running). Use mock data or error cases only.

Verification: cargo test --offline in native-app/ passes.

#### Implementation 3.3.2 — Build both apps and verify no warnings

# Tauri frontend
cd /home/ed/loom-ide-tauri
npm run build

# Native eframe app
cd native-app
cargo build --offline

What NOT to do: Do not ignore warnings. Fix every warning. Do not ship with cargo build warnings.

Verification: Both builds complete with zero errors and zero warnings.

#### Implementation 3.3.3 — Commit and push with a clear message

cd /home/ed/loom-ide-tauri
git add -A
git commit -m "Wire eframe workbench to Loom server; add Work daily dashboard; fix layout issues

- native-app/src/loom_adapter.rs: LoomHttpAdapter implements AgentAdapter over
  blocking HTTP (TcpStream), no new dependencies.
- native-app/src/loom_sync.rs: sync sessions, agents, artifacts as vault notes.
- main.ts: Work screen shows active intent + today's work + attention items.
- style.css: conversation panel spacing, header ellipsis, experiment left/right
  layout (no centering).
- Capture an idea creates a work item linked to active intent.

No demo data. Offline shows honest errors."
git push origin tauri-prototype

What NOT to do: Do not commit with git commit --no-verify unless the pre-commit hook is genuinely broken. Do not push to main — push to tauri-prototype. Do not include target/, node_modules/, or Research Vault/ in the commit.

Verification: git status is clean. git log --oneline -1 shows your commit. The remote origin/tauri-prototype is updated.

## What to avoid — the "never" list

Never do this	Why
Fake demo data when Loom is offline	Breaks trust. Show "Loom offline."
Make the window transparent	Breaks the design contract. Opaque only.
Put important data only in chat	Chat is ephemeral. Objects are the record.
Add new Rust dependencies without asking	Cargo.lock is pinned. No unapproved crates.
Make submit() async in the adapter trait	eframe is synchronous. Use blocking HTTP.
Center everything on the screen	The workbench has a left sidebar + center detail layout.
Delete the old eframe app or the Tauri app	Both stay. This is an additive merge.
Commit target/, node_modules/, Research Vault/	Build output and runtime data are excluded by .gitignore.

## How to ask for help

If you are stuck on a step for more than 20 minutes:
1. 
2. 
3. 
4. 

Final words: This is my last project on this codebase. You are the apprentice now. The Tauri app brings real Loom power (agents, sessions, workflows, artifacts, MCP, graph memory). The eframe app brings a real workbench surface (Home, capture, graph, vault, daily review). Your job is to connect them, honestly, one small step at a time, with no demo data and no shortcuts.
Good luck. Build something that tells the truth.
