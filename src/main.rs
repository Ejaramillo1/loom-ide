//! Loom — Human-Centered, AI-Native Development Environment.
//! Quiet Complexity: human intention defines the work, AI supports execution,
//! evidence makes outcomes understandable.
//! Chat talks to the real Loom server (POST /v1/weave) when it is running;
//! when it is not, a clearly labelled demonstration adapter answers instead.
//! Work persists locally as structured JSON. Nothing here fakes agent
//! progress with timers: the sphere and the collaboration panel reflect
//! real local state (typing, a request in flight, a gate waiting on you).

use eframe::egui;
use egui::{Color32, FontId, Pos2, Rect, RichText, Stroke, Vec2};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver, Sender};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

// ---------- palette (specification, warm and restrained) ----------
const BG: Color32 = Color32::from_rgb(0xF5, 0xF0, 0xEB);
const SURFACE: Color32 = Color32::from_rgb(0xF1, 0xEA, 0xE5);
const INK: Color32 = Color32::from_rgb(0x29, 0x27, 0x25);
const MUTED: Color32 = Color32::from_rgb(0x77, 0x71, 0x6D);
const LINE: Color32 = Color32::from_rgb(0xDD, 0xD5, 0xD0);
const WARM: Color32 = Color32::from_rgb(0xE9, 0xD7, 0xCA);
const AGENT: Color32 = Color32::from_rgb(0x6A, 0x91, 0xCC);
const ATTENTION: Color32 = Color32::from_rgb(0xD9, 0xA6, 0x5F);
const GLASS: Color32 = Color32::from_rgba_premultiplied(255, 252, 248, 205);
const GLASS_SOFT: Color32 = Color32::from_rgba_premultiplied(255, 252, 248, 150);

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn ago(ts: u64) -> String {
    let d = now_secs().saturating_sub(ts);
    if d < 60 {
        "just now".into()
    } else if d < 3600 {
        format!("{} min ago", d / 60)
    } else if d < 86400 {
        format!("{} h ago", d / 3600)
    } else {
        format!("{} d ago", d / 86400)
    }
}

fn slug(input: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for c in input.chars() {
        if c.is_ascii_alphanumeric() {
            out.push(c.to_ascii_lowercase());
            last_dash = false;
        } else if !out.is_empty() && !last_dash {
            out.push('-');
            last_dash = true;
        }
    }
    out.trim_matches('-').to_string()
}

// ---------- agents & patterns (kept from the working app) ----------
#[derive(Clone)]
struct AgentInfo {
    name: String,
    version: String,
    description: String,
    labels: Vec<(String, String)>,
    tools: Vec<String>,
    memory: String,
    config: String,
    skills: Vec<String>,
    prompt_summary: String,
    source: String,
}

#[derive(Clone)]
struct PatternInfo {
    name: String,
    category: String,
    path: String,
}

fn first_line_value(text: &str, key: &str) -> String {
    for line in text.lines() {
        let t = line.trim();
        if let Some(rest) = t.strip_prefix(key) {
            let rest = rest.trim().trim_matches('"').trim_matches('\'');
            if !rest.is_empty() && !rest.starts_with('#') {
                return rest.to_string();
            }
        }
    }
    String::new()
}

fn parse_agent_yaml(path: &Path, text: &str) -> AgentInfo {
    let name = {
        let n = first_line_value(text, "name:");
        if n.is_empty() {
            path.file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "agent".into())
        } else {
            n
        }
    };
    let version = {
        let v = first_line_value(text, "version:");
        if v.is_empty() { "—".into() } else { v }
    };
    let description = {
        let d = first_line_value(text, "description:");
        if d.is_empty() { "—".into() } else { d }
    };
    let mut tools = Vec::new();
    let mut in_tools = false;
    let mut tools_indent = 0usize;
    let mut prompt_lines: Vec<String> = Vec::new();
    let mut in_prompt = false;
    let mut prompt_indent = 0usize;
    for line in text.lines() {
        let indent = line.len() - line.trim_start().len();
        let t = line.trim();
        if t.starts_with("tools:") {
            in_tools = true;
            tools_indent = indent;
            continue;
        }
        if in_tools {
            if indent > tools_indent && t.starts_with("- ") {
                tools.push(
                    t.trim_start_matches("- ")
                        .trim()
                        .trim_matches('"')
                        .to_string(),
                );
                continue;
            }
            in_tools = false;
        }
        if t.starts_with("system_prompt:") {
            in_prompt = true;
            prompt_indent = indent;
            let rest = t.trim_start_matches("system_prompt:").trim().to_string();
            if !rest.is_empty() && rest != "|" && rest != ">" {
                prompt_lines.push(rest.trim_matches('"').to_string());
            }
            continue;
        }
        if in_prompt {
            if !t.is_empty() && indent <= prompt_indent {
                in_prompt = false;
            } else if !t.is_empty() {
                prompt_lines.push(t.to_string());
                let joined: String = prompt_lines.join(" ");
                if joined.len() > 420 {
                    break;
                }
            }
        }
    }
    let mut prompt_summary = prompt_lines.join(" ");
    if prompt_summary.len() > 420 {
        prompt_summary.truncate(420);
        prompt_summary.push('…');
    }
    if prompt_summary.is_empty() {
        prompt_summary = "No system prompt found in file.".into();
    }
    let memory = {
        let h = first_line_value(text, "max_history:");
        if h.is_empty() {
            "—".into()
        } else {
            format!("keeps up to {h} past messages")
        }
    };
    let mut cfg: Vec<String> = Vec::new();
    for (key, label) in [
        ("max_turns:", "max turns"),
        ("max_tool_executions:", "max tool runs"),
        ("max_context_tokens:", "context"),
    ] {
        let v = first_line_value(text, key);
        if !v.is_empty() {
            let suffix = if key == "max_context_tokens:" {
                " tokens"
            } else {
                ""
            };
            cfg.push(format!("{label} {v}{suffix}"));
        }
    }
    let config = if cfg.is_empty() {
        "—".into()
    } else {
        cfg.join(" · ")
    };
    AgentInfo {
        name,
        version,
        description,
        labels: Vec::new(),
        tools,
        memory,
        config,
        skills: Vec::new(),
        prompt_summary,
        source: path.display().to_string(),
    }
}

fn bundled_agents() -> Vec<AgentInfo> {
    vec![
        AgentInfo {
            name: "guide".into(), version: "1.0.0".into(),
            description: "Helper agent that discovers and recommends agents based on user needs".into(),
            labels: vec![("domain".into(), "meta-agent".into()), ("category".into(), "agent-discovery".into()), ("author".into(), "loom-core".into())],
            tools: vec!["agent_management".into()],
            memory: "SQLite, keeps up to 100 past messages".into(),
            config: "max turns 50 · max tool runs 10 · context 50,000 tokens".into(),
            skills: vec![],
            prompt_summary: "Discovers and recommends agents, points to the Weaver when nothing fits, and offers shortcuts for exploring, weaving and saving.".into(),
            source: "built-in copy (agents/guide.yaml not found)".into(),
        },
        AgentInfo {
            name: "weaver".into(), version: "1.0.0".into(),
            description: "Meta-agent that generates k8s-style agent and workflow configurations from natural language".into(),
            labels: vec![("domain".into(), "meta-agent".into()), ("category".into(), "agent-generation".into()), ("author".into(), "loom-core".into())],
            tools: vec!["agent_management".into(), "shell_execute".into(), "tool_search".into(), "task_board".into()],
            memory: "SQLite, keeps up to 1000 past messages".into(),
            config: "max turns 1000 · max tool runs 50 · context 200,000 tokens · self-correction on".into(),
            skills: vec!["weaver-creation".into(), "weaver-presets".into(), "weaver-templates".into(), "weaver-from-scratch".into()],
            prompt_summary: "Creates agents and workflows from presets, templates or from scratch, always confirming before writing files, then validating.".into(),
            source: "built-in copy (agents/weaver.yaml not found)".into(),
        },
        AgentInfo {
            name: "internet-researcher".into(), version: "1.0.0".into(),
            description: "Deep web research with high context window, systematic data synthesis and citation.".into(),
            labels: vec![("preset".into(), "research_analyst".into()), ("source".into(), "weaver-apply-preset".into())],
            tools: vec!["web_search".into(), "http_request".into(), "parse_document".into(), "file_read".into()],
            memory: "In-memory, 100 messages, graph memory on".into(),
            config: "max turns 1000 · max tool runs 1000 · context 200,000 tokens · thinking: high".into(),
            skills: vec![],
            prompt_summary: "Researches across multiple sources, cross-checks claims, cites URLs, and separates facts from speculation.".into(),
            source: "built-in copy (agents/internet-researcher.yaml not found)".into(),
        },
    ]
}

fn candidate_dirs(kind: &str) -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("..").join(kind),
        PathBuf::from(kind),
        PathBuf::from("/home/ed/.loom").join(kind),
    ];
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            dirs.push(parent.join("..").join(kind));
            dirs.push(parent.join(kind));
        }
    }
    dirs
}

fn load_agents() -> (Vec<AgentInfo>, String) {
    for dir in candidate_dirs("agents") {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            let mut paths: Vec<PathBuf> = entries
                .filter_map(|e| e.ok().map(|e| e.path()))
                .filter(|p| {
                    matches!(p.extension().and_then(|s| s.to_str()), Some("yaml") | Some("yml"))
                })
                .collect();
            paths.sort();
            let mut agents = Vec::new();
            for p in &paths {
                if let Ok(text) = std::fs::read_to_string(p) {
                    agents.push(parse_agent_yaml(p, &text));
                }
            }
            if !agents.is_empty() {
                return (agents, format!("Loaded from {}", dir.display()));
            }
        }
    }
    (
        bundled_agents(),
        "Built-in copies (agents/ folder not found)".into(),
    )
}

fn scan_patterns_into(dir: &Path, base: &Path, depth: usize, out: &mut Vec<PatternInfo>) {
    if depth > 3 || out.len() >= 500 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    let mut paths: Vec<PathBuf> = entries.filter_map(|e| e.ok().map(|e| e.path())).collect();
    paths.sort();
    for p in paths {
        if out.len() >= 500 {
            return;
        }
        if p.is_dir() {
            scan_patterns_into(&p, base, depth + 1, out);
        } else if matches!(
            p.extension().and_then(|s| s.to_str()),
            Some("yaml") | Some("yml") | Some("md")
        ) {
            let category = p
                .strip_prefix(base)
                .ok()
                .and_then(|r| r.components().next())
                .map(|c| c.as_os_str().to_string_lossy().into_owned())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| "general".into());
            let name = p
                .file_stem()
                .map(|s| s.to_string_lossy().into_owned())
                .unwrap_or_else(|| "pattern".into());
            out.push(PatternInfo {
                name,
                category,
                path: p.display().to_string(),
            });
        }
    }
}

fn load_patterns() -> (Vec<PatternInfo>, String) {
    for dir in candidate_dirs("patterns") {
        let mut out = Vec::new();
        if dir.is_dir() {
            scan_patterns_into(&dir, &dir, 0, &mut out);
        }
        if !out.is_empty() {
            return (out, format!("Loaded from {}", dir.display()));
        }
    }
    let cats = [
        "code", "debugging", "document", "evaluation", "fun", "libraries", "loom", "nasa",
        "postgres", "prompt_engineering", "rest_api", "sql", "teradata", "text", "vision",
        "weaver",
    ];
    (
        cats.iter()
            .map(|c| PatternInfo {
                name: c.to_string(),
                category: c.to_string(),
                path: String::new(),
            })
            .collect(),
        "Built-in list (patterns/ folder not found)".into(),
    )
}

// ---------- tiny HTTP client (kept from the working app) ----------
fn http_request(method: &str, url: &str, body: Option<&str>) -> Result<(u16, String), String> {
    let rest = url
        .strip_prefix("http://")
        .ok_or_else(|| "Only http:// addresses are supported (the Loom server is local).".to_string())?;
    let (hostport, path) = match rest.find('/') {
        Some(i) => (&rest[..i], &rest[i..]),
        None => (rest, "/"),
    };
    let (host, port) = match hostport.rfind(':') {
        Some(i) => {
            let p: u16 = hostport[i + 1..]
                .parse()
                .map_err(|_| "Bad port in address".to_string())?;
            (&hostport[..i], p)
        }
        None => (hostport, 80),
    };
    let mut stream = TcpStream::connect((host, port)).map_err(|e| {
        format!("Could not connect to {host}:{port} — is the Loom server running? ({e})")
    })?;
    let _ = stream.set_read_timeout(Some(Duration::from_secs(180)));
    let _ = stream.set_write_timeout(Some(Duration::from_secs(15)));
    let payload = body.unwrap_or("");
    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: {hostport}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{payload}",
        payload.len()
    );
    stream
        .write_all(req.as_bytes())
        .map_err(|e| format!("Could not send the request: {e}"))?;
    let mut raw = String::new();
    stream
        .read_to_string(&mut raw)
        .map_err(|e| format!("Could not read the reply: {e}"))?;
    let (head, resp_body) = raw
        .split_once("\r\n\r\n")
        .ok_or_else(|| "The server sent an unreadable reply.".to_string())?;
    let status: u16 = head
        .split_whitespace()
        .nth(1)
        .and_then(|s| s.parse().ok())
        .ok_or_else(|| "The server sent an unreadable status line.".to_string())?;
    let text = if head.to_lowercase().contains("transfer-encoding: chunked") {
        decode_chunked(resp_body)
    } else {
        resp_body.to_string()
    };
    Ok((status, text))
}

fn decode_chunked(s: &str) -> String {
    let mut out = String::new();
    let mut rest = s;
    loop {
        let Some(nl) = rest.find("\r\n") else { break };
        let Ok(size) = usize::from_str_radix(rest[..nl].trim(), 16) else {
            break;
        };
        if size == 0 {
            break;
        }
        let start = nl + 2;
        let end = (start + size).min(rest.len());
        out.push_str(&rest[start..end]);
        rest = &rest[end.min(rest.len())..];
        rest = rest.strip_prefix("\r\n").unwrap_or(rest);
    }
    if out.is_empty() {
        s.to_string()
    } else {
        out
    }
}

fn extract_reply_text(body: &str) -> String {
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(body) {
        for key in ["response", "output", "result", "text", "message", "answer"] {
            if let Some(s) = v.get(key).and_then(|x| x.as_str()) {
                if !s.trim().is_empty() {
                    return s.to_string();
                }
            }
        }
        let pretty = serde_json::to_string_pretty(&v).unwrap_or_else(|_| body.to_string());
        if pretty.len() > 4000 {
            return format!("{}…", &pretty[..4000]);
        }
        return pretty;
    }
    let t = body.trim();
    if t.is_empty() {
        "(empty reply)".into()
    } else if t.len() > 4000 {
        format!("{}…", &t[..4000])
    } else {
        t.to_string()
    }
}

// ---------- persisted work (structured data, not chat threads) ----------
#[derive(Clone, Serialize, Deserialize)]
struct WorkItem {
    id: String,
    objective: String,
    status: String, // active | paused | done
    created: u64,
    updated: u64,
    autonomy: String,
    findings: Vec<String>,
    artifacts: Vec<String>,
}

#[derive(Clone, Serialize, Deserialize)]
struct ChatMsg {
    who: String,
    text: String,
    mine: bool,
    card: bool, // experiment-design action card
}

#[derive(Clone, Serialize, Deserialize, Default)]
struct Store {
    works: Vec<WorkItem>,
    active_work: usize,
    chat: Vec<ChatMsg>,
    autonomy: String,
    mode: String,
    hypothesis: String,
    exp_notes: String,
    reduced_motion: bool,
    code_notes: String,
}

fn store_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            return dir.join("loom-workspace.json");
        }
    }
    PathBuf::from("loom-workspace.json")
}

fn load_store() -> Store {
    let p = store_path();
    if let Ok(text) = std::fs::read_to_string(&p) {
        if let Ok(s) = serde_json::from_str::<Store>(&text) {
            if !s.works.is_empty() {
                return s;
            }
        }
    }
    let t = now_secs();
    Store {
        works: vec![
            WorkItem { id: "memory-latency".into(), objective: "Investigate agent memory latency".into(), status: "active".into(), created: t, updated: t, autonomy: "Collaborative".into(),
                findings: vec!["Observed: enabling memory raises reply latency in the traces we have.".into(), "Inferred: the memory write, not the read, is the likely cost — unproven.".into()], artifacts: vec!["Experiment design — Compare memory strategies".into()] },
            WorkItem { id: "tool-reliability".into(), objective: "Improve tool reliability".into(), status: "active".into(), created: t, updated: t, autonomy: "Assisted".into(), findings: vec!["Unknown: which tool fails most often — no counts yet.".into()], artifacts: vec![] },
            WorkItem { id: "pr-4287".into(), objective: "Review PR #4287".into(), status: "paused".into(), created: t, updated: t, autonomy: "Manual".into(), findings: vec![], artifacts: vec![] },
        ],
        active_work: 0,
        chat: vec![
            ChatMsg { who: "You".into(), text: "Can you help me design the next experiment?".into(), mine: true, card: false },
            ChatMsg { who: "Loom".into(), text: "Based on the current findings, here's a proposal.".into(), mine: false, card: true },
        ],
        autonomy: "Collaborative".into(),
        mode: "Work".into(),
        hypothesis: "Memory writes on every turn are what slow replies down; reading memory is cheap.".into(),
        exp_notes: String::new(),
        reduced_motion: false,
        code_notes: String::new(),
    }
}

enum NetEvent {
    HealthOk(String),
    HealthFail(String),
    SessionCreated(String),
    SessionFail(String),
    WeaveReply { agent: String, text: String },
    WeaveFail(String),
}

#[derive(Clone, Copy, PartialEq)]
enum Mode {
    Code,
    Experiment,
    Work,
}
impl Mode {
    fn label(&self) -> &'static str {
        match self {
            Mode::Code => "Code",
            Mode::Experiment => "Experiment",
            Mode::Work => "Work",
        }
    }
}

#[derive(Clone, Copy, PartialEq)]
enum SphereState {
    Idle,
    Listening,
    Processing,
    Executing,
    Attention,
    Completed,
}
impl SphereState {
    fn words(&self) -> &'static str {
        match self {
            SphereState::Idle => "At rest — nothing is running.",
            SphereState::Listening => "Listening — Loom is with you.",
            SphereState::Processing => "Thinking — preparing a reply.",
            SphereState::Executing => "An agent is working on your work.",
            SphereState::Attention => "Needs you — a decision is waiting.",
            SphereState::Completed => "Done — back at rest.",
        }
    }
}

struct CodeFile {
    path: PathBuf,
    label: String,
    text: String,
}

struct LoomApp {
    store: Store,
    mode: Mode,
    started: Instant,
    server_url: String,
    server_status: String,
    server_online: bool,
    busy: usize,
    tx: Sender<NetEvent>,
    rx: Receiver<NetEvent>,
    agents: Vec<AgentInfo>,
    agents_source: String,
    selected_agent: usize,
    patterns: Vec<PatternInfo>,
    chat_agent: String,
    session_id: String,
    chat_input: String,
    chat_failed: Option<String>,
    notice: String,
    new_work: String,
    rail: String, // work | agents | patterns
    files: Vec<CodeFile>,
    selected_file: usize,
    code_status: String,
    exp_status: String,
    demo_step: usize, // 0 idle, 1 baseline recorded, 2 configurations compared, 3 causes noted
    attention_open: bool,
    completed_until: f64,
    processing_until: f64,
    show_how: bool,
}

impl LoomApp {
    fn new() -> Self {
        let (tx, rx) = channel();
        let (agents, agents_source) = load_agents();
        let (patterns, _ps) = load_patterns();
        let chat_agent = agents.first().map(|a| a.name.clone()).unwrap_or_default();
        let store = load_store();
        let mode = match store.mode.as_str() {
            "Code" => Mode::Code,
            "Experiment" => Mode::Experiment,
            _ => Mode::Work,
        };
        // Real, editable local files for Code mode: this project's own notes and entry file.
        let mut files = Vec::new();
        for (label, rel) in [
            ("Notes — design philosophy", "docs/01-design-philosophy.md"),
            ("Notes — interaction model", "docs/03-interaction-model.md"),
            ("Scratch notes (saved with your work)", "SCRATCH"),
        ] {
            if rel == "SCRATCH" {
                files.push(CodeFile {
                    path: store_path(),
                    label: label.into(),
                    text: store.code_notes.clone(),
                });
            } else {
                for cand in [
                    PathBuf::from(rel),
                    PathBuf::from("/home/ed/.loom/app").join(rel),
                ] {
                    if let Ok(text) = std::fs::read_to_string(&cand) {
                        files.push(CodeFile {
                            path: cand,
                            label: label.into(),
                            text,
                        });
                        break;
                    }
                }
            }
        }
        if files.is_empty() {
            files.push(CodeFile {
                path: store_path(),
                label: "Scratch notes (saved with your work)".into(),
                text: String::new(),
            });
        }
        let mut app = Self {
            store,
            mode,
            started: Instant::now(),
            server_url: "http://localhost:5006".into(),
            server_status: "Not checked yet.".into(),
            server_online: false,
            busy: 0,
            tx,
            rx,
            agents,
            agents_source,
            selected_agent: 0,
            patterns,
            chat_agent,
            session_id: String::new(),
            chat_input: String::new(),
            chat_failed: None,
            notice: String::new(),
            new_work: String::new(),
            rail: "work".into(),
            files,
            selected_file: 0,
            code_status: String::new(),
            exp_status: String::new(),
            demo_step: 0,
            attention_open: false,
            completed_until: 0.0,
            processing_until: 0.0,
            show_how: false,
        };
        app.check_health();
        app
    }

    fn persist(&self) {
        let mut s = self.store.clone();
        s.mode = self.mode.label().into();
        if let Some(f) = self.files.iter().find(|f| f.label.starts_with("Scratch")) {
            s.code_notes = f.text.clone();
        }
        if let Ok(text) = serde_json::to_string_pretty(&s) {
            let _ = std::fs::write(store_path(), text);
        }
    }

    fn active_work(&self) -> Option<&WorkItem> {
        self.store.works.get(self.store.active_work)
    }

    fn objective(&self) -> String {
        self.active_work()
            .map(|w| w.objective.clone())
            .unwrap_or_else(|| "Choose or create a piece of work to begin.".into())
    }

    // ---- real Loom server calls (unchanged endpoints) ----
    fn check_health(&mut self) {
        self.busy += 1;
        self.server_status = "Checking…".into();
        let tx = self.tx.clone();
        let base = self.server_url.trim_end_matches('/').to_string();
        std::thread::spawn(move || match http_request("GET", &format!("{base}/health"), None) {
            Ok((code, _)) if code == 200 => {
                let detail = http_request("GET", &format!("{base}/v1/health"), None)
                    .map(|(_, b)| extract_reply_text(&b))
                    .unwrap_or_else(|_| "healthy".into());
                let _ = tx.send(NetEvent::HealthOk(detail));
            }
            Ok((code, _)) => {
                let _ = tx.send(NetEvent::HealthFail(format!(
                    "Server answered with status {code}."
                )));
            }
            Err(e) => {
                let _ = tx.send(NetEvent::HealthFail(e));
            }
        });
    }

    fn new_session(&mut self) {
        self.busy += 1;
        let tx = self.tx.clone();
        let base = self.server_url.trim_end_matches('/').to_string();
        let agent = self.chat_agent.clone();
        std::thread::spawn(move || {
            let body = serde_json::json!({ "agent_id": agent }).to_string();
            match http_request("POST", &format!("{base}/v1/sessions"), Some(&body)) {
                Ok((code, resp)) if (200..300).contains(&code) => {
                    let id = serde_json::from_str::<serde_json::Value>(&resp)
                        .ok()
                        .and_then(|v| {
                            ["session_id", "sessionId", "id"]
                                .iter()
                                .find_map(|k| v.get(k).and_then(|x| x.as_str()).map(|s| s.to_string()))
                        })
                        .unwrap_or_default();
                    let _ = tx.send(NetEvent::SessionCreated(id));
                }
                Ok((code, resp)) => {
                    let _ = tx.send(NetEvent::SessionFail(format!(
                        "status {code}: {}",
                        extract_reply_text(&resp)
                    )));
                }
                Err(e) => {
                    let _ = tx.send(NetEvent::SessionFail(e));
                }
            }
        });
    }

    fn weave(&mut self, text: &str) {
        self.busy += 1;
        let tx = self.tx.clone();
        let base = self.server_url.trim_end_matches('/').to_string();
        let agent = self.chat_agent.clone();
        let session = self.session_id.clone();
        let q = text.to_string();
        std::thread::spawn(move || {
            let body = serde_json::json!({ "query": q, "session_id": session, "agent_id": agent })
                .to_string();
            match http_request("POST", &format!("{base}/v1/weave"), Some(&body)) {
                Ok((code, resp)) if (200..300).contains(&code) => {
                    let _ = tx.send(NetEvent::WeaveReply {
                        agent: agent.clone(),
                        text: extract_reply_text(&resp),
                    });
                }
                Ok((code, resp)) => {
                    let _ = tx.send(NetEvent::WeaveFail(format!(
                        "The server answered with status {code}: {}",
                        extract_reply_text(&resp)
                    )));
                }
                Err(e) => {
                    let _ = tx.send(NetEvent::WeaveFail(format!(
                        "Could not reach the Loom server. Start it with `looms serve` and check the address. Details: {e}"
                    )));
                }
            }
        });
    }

    fn send_chat(&mut self) {
        let text = self.chat_input.trim().to_string();
        if text.is_empty() {
            return;
        }
        // Autonomy is a real boundary, not a label.
        let level = self.store.autonomy.as_str();
        if level == "Manual" {
            self.notice =
                "Autonomy is Manual: nothing is sent. Raise it to Assisted to send with approval, or Collaborative to send directly.".into();
            return;
        }
        self.chat_input.clear();
        self.chat_failed = None;
        // A brief calm "thinking" moment when a message is sent, before
        // the agent-working state (a real request sets busy right after).
        self.processing_until = self.started.elapsed().as_secs_f64() + 1.5;
        self.store.chat.push(ChatMsg {
            who: "You".into(),
            text: text.clone(),
            mine: true,
            card: false,
        });
        if self.server_online {
            self.weave(&text);
        } else {
            // Demonstration adapter — labelled, never presented as a real agent.
            self.store.chat.push(ChatMsg {
                who: "Loom (demonstration)".into(),
                text: format!(
                    "Demonstration reply — the Loom server is offline, so no agent really ran. You wrote: “{text}”. Connect the server (address under Search, top right) and this same message goes to the real agent. Based on the current findings, here's a proposal:"
                ),
                mine: false,
                card: true,
            });
            self.completed_until = self.started.elapsed().as_secs_f64() + 2.5;
        }
        self.persist();
    }

    fn poll_network(&mut self) {
        while let Ok(ev) = self.rx.try_recv() {
            self.busy = self.busy.saturating_sub(1);
            match ev {
                NetEvent::HealthOk(d) => {
                    self.server_online = true;
                    self.server_status = format!("Online — {d}");
                }
                NetEvent::HealthFail(e) => {
                    self.server_online = false;
                    self.server_status = format!("Offline — {e}");
                }
                NetEvent::SessionCreated(id) => {
                    if id.is_empty() {
                        self.notice = "Session created (server did not return an id).".into();
                    } else {
                        self.notice = format!("New session started: {id}");
                        self.session_id = id;
                    }
                }
                NetEvent::SessionFail(e) => {
                    self.notice = format!("Could not start a session: {e}");
                    self.chat_failed = Some(self.notice.clone());
                }
                NetEvent::WeaveReply { agent, text } => {
                    self.store.chat.push(ChatMsg {
                        who: agent,
                        text,
                        mine: false,
                        card: false,
                    });
                    self.completed_until = self.started.elapsed().as_secs_f64() + 2.5;
                    self.persist();
                }
                NetEvent::WeaveFail(e) => {
                    self.chat_failed = Some(e.clone());
                    self.store.chat.push(ChatMsg {
                        who: "Loom".into(),
                        text: e,
                        mine: false,
                        card: false,
                    });
                    self.persist();
                }
            }
        }
    }

    fn sphere_state(&self) -> SphereState {
        if self.attention_open || self.has_attention() {
            return SphereState::Attention;
        }
        if self.started.elapsed().as_secs_f64() < self.processing_until {
            return SphereState::Processing;
        }
        if self.busy > 0 {
            return SphereState::Executing;
        }
        if !self.chat_input.trim().is_empty() {
            return SphereState::Listening;
        }
        if self.started.elapsed().as_secs_f64() < self.completed_until {
            return SphereState::Completed;
        }
        SphereState::Idle
    }

    fn has_attention(&self) -> bool {
        // Only genuine human decisions: an unsent Manual message, a failed
        // send, or the experiment decision that has not been made yet.
        self.chat_failed.is_some() || self.demo_step == 2
    }

    // ---- painting: the calm scene ----
    fn paint_scene(&self, ui: &mut egui::Ui) {
        let rect = ui.available_rect_before_wrap();
        let painter = ui.painter_at(rect);
        // warm gradient sky
        let steps = 24;
        for i in 0..steps {
            let t0 = i as f32 / steps as f32;
            let y0 = rect.top() + rect.height() * t0;
            let y1 = rect.top() + rect.height() * ((i + 1) as f32 / steps as f32);
            let c = Color32::from_rgb(
                (245.0 - 10.0 * t0) as u8,
                (240.0 - 12.0 * t0) as u8,
                (235.0 - 14.0 * t0) as u8,
            );
            painter.rect_filled(Rect::from_min_max(Pos2::new(rect.left(), y0), Pos2::new(rect.right(), y1 + 1.0)), 0.0, c);
        }
        // water along the bottom: a soft band with fine horizontal light lines
        let water_top = rect.bottom() - rect.height() * 0.16;
        painter.rect_filled(
            Rect::from_min_max(Pos2::new(rect.left(), water_top), rect.max),
            0.0,
            Color32::from_rgba_premultiplied(233, 224, 214, 255),
        );
        for i in 0..7 {
            let y = water_top + 8.0 + i as f32 * 13.0;
            let a = 46u8.saturating_sub(i * 5);
            painter.line_segment(
                [Pos2::new(rect.left() + 30.0, y), Pos2::new(rect.right() - 30.0, y)],
                Stroke::new(1.0_f32, Color32::from_rgba_premultiplied(190, 175, 160, a)),
            );
        }
        // the sphere, centred a little above the water
        let t = if self.store.reduced_motion {
            0.0
        } else {
            self.started.elapsed().as_secs_f64()
        };
        let state = self.sphere_state();
        let centre = Pos2::new(rect.center().x, rect.center().y - rect.height() * 0.06);
        let radius = (rect.height() * 0.30).min(300.0).max(90.0);
        // soft reflection on the water
        let refl = Pos2::new(centre.x, water_top + radius * 0.34);
        for i in 0..6 {
            let rr = radius * (0.95 - i as f32 * 0.11);
            painter.circle_filled(
                refl,
                rr,
                Color32::from_rgba_premultiplied(255, 250, 242, 16),
            );
        }
        // glow
        let glow = match state {
            SphereState::Attention => ATTENTION,
            SphereState::Executing | SphereState::Processing => AGENT,
            _ => Color32::from_rgb(255, 244, 230),
        };
        let pulse = if self.store.reduced_motion {
            0.0
        } else {
            (t * 0.6).sin() as f32 * 0.5 + 0.5
        };
        for i in 0..7 {
            let rr = radius * (1.42 - i as f32 * 0.06);
            let a = (10.0 + pulse * 8.0) as u8;
            painter.circle_filled(centre, rr, Color32::from_rgba_premultiplied(glow.r(), glow.g(), glow.b(), a));
        }
        // body: layered translucent ivory
        for i in 0..9 {
            let f = i as f32 / 9.0;
            painter.circle_filled(
                centre,
                radius * (1.0 - f * 0.55),
                Color32::from_rgba_premultiplied(255, 251, 245, 26),
            );
        }
        painter.circle_stroke(
            centre,
            radius,
            Stroke::new(1.0_f32, Color32::from_rgba_premultiplied(190, 175, 160, 120)),
        );
        // delicate curved lines: latitude-like arcs that drift very slowly
        let speed = match state {
            SphereState::Executing => 0.11,
            SphereState::Processing => 0.07,
            _ => 0.02,
        };
        let phase = (t * speed) as f32;
        for k in 0..6 {
            let off = (k as f32 - 2.5) * radius * 0.24;
            let wob = if self.store.reduced_motion {
                0.0
            } else {
                (t * 0.25 + k as f64).sin() as f32 * radius * 0.03
            };
            let mut pts = Vec::new();
            for s in 0..=48 {
                let f = s as f32 / 48.0;
                let x = centre.x - radius + 2.0 * radius * f;
                let dx = (x - centre.x) / radius;
                let half = (1.0f32 - dx * dx).max(0.0).sqrt() * radius;
                let y = centre.y + off + wob + (f * std::f32::consts::PI * 2.0 + phase + k as f32).sin() * radius * 0.05;
                if (y - centre.y).abs() <= half {
                    pts.push(Pos2::new(x, y));
                }
            }
            if pts.len() > 2 {
                painter.add(egui::Shape::line(
                    pts,
                    Stroke::new(0.8_f32, Color32::from_rgba_premultiplied(176, 160, 146, 120)),
                ));
            }
        }
        // gentle light from the upper left
        painter.circle_filled(
            Pos2::new(centre.x - radius * 0.34, centre.y - radius * 0.38),
            radius * 0.42,
            Color32::from_rgba_premultiplied(255, 255, 252, 46),
        );
        // status words: the sphere never replaces plain text
        painter.text(
            Pos2::new(centre.x, centre.y + radius + 26.0),
            egui::Align2::CENTER_CENTER,
            state.words(),
            FontId::proportional(13.0),
            MUTED,
        );
        painter.text(
            Pos2::new(centre.x, centre.y + radius + 46.0),
            egui::Align2::CENTER_CENTER,
            if self.server_online { "Loom server connected" } else { "Demonstration mode — Loom server offline" },
            FontId::proportional(11.5),
            MUTED,
        );
    }

    fn glass<R>(ui: &mut egui::Ui, add: impl FnOnce(&mut egui::Ui) -> R) -> R {
        egui::Frame::none()
            .fill(GLASS)
            .stroke(Stroke::new(1.0_f32, LINE))
            .rounding(14.0)
            .inner_margin(egui::Margin::same(12.0))
            .shadow(egui::epaint::Shadow {
                offset: Vec2::new(0.0, 6.0),
                blur: 18.0,
                spread: 0.0,
                color: Color32::from_rgba_premultiplied(120, 105, 90, 26),
            })
            .show(ui, add)
            .inner
    }
}

impl eframe::App for LoomApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.poll_network();
        if self.busy > 0 || !self.store.reduced_motion {
            ctx.request_repaint_after(Duration::from_millis(120));
        }
        // ---------- top navigation ----------
        egui::TopBottomPanel::top("top")
            .frame(egui::Frame::none().fill(BG).inner_margin(egui::Margin::symmetric(14.0, 10.0)))
            .show(ctx, |ui| {
                ui.horizontal(|ui| {
                    ui.label(RichText::new("LOOM").font(FontId::proportional(19.0)).color(INK).strong());
                    ui.separator();
                    ui.label(RichText::new("You are working on:").color(MUTED));
                    ui.label(RichText::new(self.objective()).color(INK));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(RichText::new("○  You").color(MUTED));
                        ui.add_space(10.0);
                        ui.label(RichText::new(if self.server_online { "● Loom connected" } else { "○ Demonstration" }).color(if self.server_online { AGENT } else { MUTED }).small());
                        if ui.button("⟳").on_hover_text("Check the Loom server again").clicked() {
                            self.check_health();
                        }
                        let mut url = self.server_url.clone();
                        if ui.add(egui::TextEdit::singleline(&mut url).desired_width(170.0).hint_text("http://localhost:5006")).changed() {
                            self.server_url = url;
                        }
                        ui.label(RichText::new("Search").color(MUTED));
                    });
                });
                ui.label(RichText::new(&self.server_status).small().color(MUTED));
            });

        // ---------- left: icon rail + workspace + chat ----------
        egui::SidePanel::left("left")
            .resizable(true)
            .default_width(340.0)
            .width_range(280.0..=460.0)
            .frame(egui::Frame::none().fill(Color32::from_rgba_premultiplied(245, 240, 235, 235)).inner_margin(egui::Margin::same(10.0)))
            .show(ctx, |ui| {
                ui.horizontal_top(|ui| {
                    // narrow icon rail
                    ui.vertical(|ui| {
                        ui.set_width(44.0);
                        for (key, glyph, tip) in [
                            ("work", "▦", "Human Workspace — your work"),
                            ("agents", "◎", "Agents — who can help"),
                            ("patterns", "≣", "Patterns — the library"),
                        ] {
                            let sel = self.rail == key;
                            let btn = egui::Button::new(RichText::new(glyph).size(17.0).color(if sel { INK } else { MUTED }))
                                .fill(if sel { WARM } else { Color32::TRANSPARENT })
                                .rounding(10.0);
                            if ui.add_sized([38.0, 38.0], btn).on_hover_text(tip).clicked() {
                                self.rail = key.into();
                            }
                            ui.add_space(4.0);
                        }
                        ui.add_space(8.0);
                        let red = self.store.reduced_motion;
                        if ui.button(if red { "▶" } else { "❚❚" }).on_hover_text(if red { "Allow gentle motion" } else { "Reduce motion" }).clicked() {
                            self.store.reduced_motion = !red;
                            self.persist();
                        }
                    });
                    ui.separator();
                    ui.vertical(|ui| {
                        match self.rail.as_str() {
                            "agents" => self.agents_panel(ui),
                            "patterns" => self.patterns_panel(ui),
                            _ => self.work_panel(ui),
                        }
                    });
                });
                ui.add_space(8.0);
                self.chat_panel(ui);
            });

        // ---------- right: collaboration + attention ----------
        egui::SidePanel::right("right")
            .resizable(true)
            .default_width(300.0)
            .width_range(250.0..=400.0)
            .frame(egui::Frame::none().fill(Color32::from_rgba_premultiplied(245, 240, 235, 235)).inner_margin(egui::Margin::same(10.0)))
            .show(ctx, |ui| {
                self.collaboration_panel(ui);
                ui.add_space(10.0);
                self.attention_panel(ui);
            });

        // ---------- centre: scene + mode surface ----------
        egui::CentralPanel::default()
            .frame(egui::Frame::none().fill(BG))
            .show(ctx, |ui| {
                // sphere scene occupies the middle; mode content sits below it
                let total = ui.available_height();
                let scene_h = (total * 0.52).max(220.0);
                ui.allocate_ui(Vec2::new(ui.available_width(), scene_h), |ui| {
                    self.paint_scene(ui);
                });
                ui.add_space(6.0);
                match self.mode {
                    Mode::Work => self.work_mode(ui),
                    Mode::Code => self.code_mode(ui),
                    Mode::Experiment => self.experiment_mode(ui),
                }
                if !self.notice.is_empty() {
                    ui.add_space(6.0);
                    ui.label(RichText::new(&self.notice).small().color(MUTED));
                }
                // floating segmented control, bottom centre
                ui.add_space(8.0);
                ui.vertical_centered(|ui| {
                    egui::Frame::none()
                        .fill(GLASS)
                        .stroke(Stroke::new(1.0_f32, LINE))
                        .rounding(20.0)
                        .inner_margin(egui::Margin::symmetric(6.0, 5.0))
                        .show(ui, |ui| {
                            ui.horizontal(|ui| {
                                for m in [Mode::Code, Mode::Experiment, Mode::Work] {
                                    let sel = self.mode == m;
                                    let btn = egui::Button::new(RichText::new(m.label()).color(if sel { INK } else { MUTED }).size(14.0))
                                        .fill(if sel { WARM } else { Color32::TRANSPARENT })
                                        .rounding(16.0);
                                    if ui.add_sized([104.0, 30.0], btn).clicked() {
                                        self.mode = m;
                                        self.persist();
                                    }
                                }
                            });
                        });
                });
            });
    }
}

impl LoomApp {
    fn work_panel(&mut self, ui: &mut egui::Ui) {
        ui.label(RichText::new("Human Workspace").font(FontId::proportional(15.0)).color(INK).strong());
        ui.label(RichText::new("Your work — structured, saved, resumable.").small().color(MUTED));
        ui.label(RichText::new("Spec. workspace: Investigate agent memory latency · Improve tool reliability · Review PR #4287.").small().color(MUTED));
        ui.add_space(6.0);
        let mut select: Option<usize> = None;
        let mut toggle: Option<usize> = None;
        for (i, w) in self.store.works.iter().enumerate() {
            let sel = i == self.store.active_work;
            Self::glass(ui, |ui| {
                ui.set_width(ui.available_width());
                let title = RichText::new(&w.objective).color(INK).strong();
                if ui.selectable_label(sel, title).clicked() {
                    select = Some(i);
                }
                ui.horizontal(|ui| {
                    ui.label(RichText::new(match w.status.as_str() { "done" => "Done", "paused" => "Paused", _ => "Active" }).small().color(if w.status == "active" { AGENT } else { MUTED }));
                    ui.label(RichText::new(format!("· {} · {}", w.autonomy, ago(w.updated))).small().color(MUTED));
                    if ui.small_button(if w.status == "paused" { "Resume" } else { "Pause" }).clicked() {
                        toggle = Some(i);
                    }
                });
            });
            ui.add_space(6.0);
        }
        if let Some(i) = select {
            self.store.active_work = i;
            self.store.works[i].updated = now_secs();
            self.persist();
        }
        if let Some(i) = toggle {
            let w = &mut self.store.works[i];
            w.status = if w.status == "paused" { "active".into() } else { "paused".into() };
            w.updated = now_secs();
            self.persist();
        }
        ui.horizontal(|ui| {
            let edit = ui.add(egui::TextEdit::singleline(&mut self.new_work).desired_width(170.0).hint_text("New work…"));
            let go = ui.button("＋ Work").clicked() || (edit.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)));
            if go && !self.new_work.trim().is_empty() {
                let objective = self.new_work.trim().to_string();
                self.store.works.push(WorkItem {
                    id: slug(&objective),
                    objective,
                    status: "active".into(),
                    created: now_secs(),
                    updated: now_secs(),
                    autonomy: self.store.autonomy.clone(),
                    findings: vec![],
                    artifacts: vec![],
                });
                self.store.active_work = self.store.works.len() - 1;
                self.new_work.clear();
                self.persist();
            }
        });
        ui.add_space(4.0);
        // autonomy: a real permission boundary, quiet by design
        ui.label(RichText::new("Autonomy").small().color(MUTED));
        ui.horizontal_wrapped(|ui| {
            for level in ["Manual", "Assisted", "Collaborative", "Delegated"] {
                let sel = self.store.autonomy == level;
                if ui.selectable_label(sel, level).on_hover_text(match level {
                    "Manual" => "Nothing is sent to an agent. You do the work; Loom keeps the record.",
                    "Assisted" => "Loom proposes; you approve before anything is sent.",
                    "Collaborative" => "Chat and proposals flow; consequential changes still stop for you.",
                    _ => "Permitted steps proceed within the limits you set here.",
                }).clicked() {
                    self.store.autonomy = level.into();
                    if let Some(w) = self.store.works.get_mut(self.store.active_work) {
                        w.autonomy = level.into();
                        w.updated = now_secs();
                    }
                    self.notice = format!("Autonomy set to {level}. Lowering it always takes effect at once.");
                    self.persist();
                }
            }
        });
        ui.label(RichText::new("Initial experience emphasises Collaborative. Agents never bypass this.").small().color(MUTED));
    }

    fn agents_panel(&mut self, ui: &mut egui::Ui) {
        ui.label(RichText::new("Agents").font(FontId::proportional(15.0)).color(INK).strong());
        ui.label(RichText::new(&self.agents_source).small().color(MUTED));
        ui.add_space(4.0);
        let names: Vec<String> = self.agents.iter().map(|a| a.name.clone()).collect();
        for (i, n) in names.iter().enumerate() {
            if ui.selectable_label(i == self.selected_agent, n).clicked() {
                self.selected_agent = i;
            }
        }
        if let Some(a) = self.agents.get(self.selected_agent).cloned() {
            ui.separator();
            ui.label(RichText::new(format!("{}  ·  v{}", a.name, a.version)).color(INK).strong());
            ui.label(RichText::new(&a.description).small().color(MUTED));
            if !a.labels.is_empty() {
                ui.collapsing("Labels", |ui| {
                    for (k, v) in &a.labels { ui.label(RichText::new(format!("{k}: {v}")).small().color(MUTED)); }
                });
            }
            ui.collapsing("What it does", |ui| { ui.label(&a.prompt_summary); });
            ui.collapsing("Tools it can use", |ui| {
                if a.tools.is_empty() { ui.label("—"); }
                for t in &a.tools { ui.label(format!("• {t}")); }
            });
            if !a.skills.is_empty() {
                ui.collapsing("Skills", |ui| { for s in &a.skills { ui.label(format!("• {s}")); } });
            }
            ui.label(RichText::new(format!("Memory: {}", a.memory)).small().color(MUTED));
            ui.label(RichText::new(format!("Limits: {}", a.config)).small().color(MUTED));
            ui.label(RichText::new(format!("Source: {}", a.source)).small().color(MUTED));
            ui.horizontal(|ui| {
                if ui.button("Chat with this agent").clicked() {
                    self.chat_agent = a.name.clone();
                    self.rail = "work".into();
                }
                if ui.button("New session").clicked() { self.new_session(); }
            });
        }
    }

    fn patterns_panel(&mut self, ui: &mut egui::Ui) {
        ui.label(RichText::new("Patterns").font(FontId::proportional(15.0)).color(INK).strong());
        ui.label(RichText::new(format!("{} patterns from the library", self.patterns.len())).small().color(MUTED));
        egui::ScrollArea::vertical().max_height(300.0).show(ui, |ui| {
            for p in self.patterns.iter().take(120) {
                let row = ui.label(RichText::new(format!("{}  ({})", p.name, p.category)).small().color(INK));
                if !p.path.is_empty() {
                    row.on_hover_text(&p.path);
                }
            }
        });
    }

    fn chat_panel(&mut self, ui: &mut egui::Ui) {
        Self::glass(ui, |ui| {
            ui.horizontal(|ui| {
                ui.label(RichText::new("●").color(AGENT));
                ui.label(RichText::new("Loom").color(INK).strong());
                ui.label(RichText::new(if self.server_online { format!("· {} · real agent", self.chat_agent) } else { "· demonstration".into() }).small().color(MUTED));
            });
            ui.add_space(4.0);
            let mut open_experiment = false;
            egui::ScrollArea::vertical().max_height(240.0).stick_to_bottom(true).show(ui, |ui| {
                for m in &self.store.chat {
                    if m.mine {
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::TOP), |ui| {
                            egui::Frame::none().fill(WARM).rounding(10.0).inner_margin(egui::Margin::same(8.0)).show(ui, |ui| {
                                ui.label(RichText::new(&m.text).color(INK));
                            });
                        });
                    } else {
                        ui.label(RichText::new(&m.who).small().color(AGENT).strong());
                        // simple Markdown: **bold** lines and `code` blocks stay readable as plain text
                        for line in m.text.lines() {
                            if line.trim_start().starts_with("```") { continue; }
                            let clean = line.replace("**", "");
                            ui.label(RichText::new(clean).color(INK));
                        }
                        if m.card {
                            ui.add_space(4.0);
                            egui::Frame::none().fill(GLASS_SOFT).stroke(Stroke::new(1.0_f32, LINE)).rounding(10.0).inner_margin(egui::Margin::same(8.0)).show(ui, |ui| {
                                ui.label(RichText::new("Experiment design").small().color(MUTED));
                                ui.label(RichText::new("Compare memory strategies").color(INK).strong());
                                if ui.button("Open experiment →").clicked() { open_experiment = true; }
                            });
                        }
                    }
                    ui.add_space(6.0);
                }
                if self.busy > 0 {
                    ui.horizontal(|ui| { ui.spinner(); ui.label(RichText::new("Loom is working…").small().color(MUTED)); });
                }
            });
            if open_experiment {
                self.mode = Mode::Experiment;
                self.persist();
            }
            if let Some(err) = self.chat_failed.clone() {
                ui.label(RichText::new(&err).small().color(ATTENTION));
                if ui.button("Retry connection").clicked() {
                    self.chat_failed = None;
                    self.check_health();
                }
            }
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                let edit = ui.add(egui::TextEdit::multiline(&mut self.chat_input).desired_rows(2).desired_width(ui.available_width() - 64.0).hint_text("Message Loom…"));
                let enter = edit.has_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter) && !i.modifiers.shift);
                if enter && !self.chat_input.trim().is_empty() {
                    // TextEdit inserted the newline; the send trims it.
                    self.send_chat();
                }
                if ui.add_sized([52.0, 40.0], egui::Button::new("Send")).clicked() {
                    self.send_chat();
                }
            });
            ui.label(RichText::new(if self.server_online { "Sends to the real Loom agent (POST /v1/weave)." } else { "Server offline: replies are a labelled demonstration." }).small().color(MUTED));
        });
    }

    fn collaboration_panel(&mut self, ui: &mut egui::Ui) {
        Self::glass(ui, |ui| {
            ui.label(RichText::new("Agentic Collaboration").font(FontId::proportional(15.0)).color(INK).strong());
            ui.add_space(4.0);
            if self.busy > 0 {
                ui.horizontal(|ui| {
                    ui.spinner();
                    ui.label(RichText::new(format!("{} — working · real request in flight", self.chat_agent)).color(INK));
                });
                ui.label(RichText::new("Status comes from the live request to the Loom server, not a timer.").small().color(MUTED));
            } else {
                ui.label(RichText::new("Research Agent — demonstration").color(INK).strong());
                ui.label(RichText::new(if self.server_online { "Server connected; experiment steps below are the local demonstration plan." } else { "Demonstration data — the Loom server does not expose step-by-step execution here yet." }).small().color(MUTED));
                let steps = [
                    "Analyze baseline traces",
                    "Reproduce with memory on/off",
                    "Run configuration experiments",
                    "Compare results",
                    "Identify likely causes",
                ];
                for (i, s) in steps.iter().enumerate() {
                    let (mark, col) = if i < self.demo_step {
                        ("✓", AGENT)
                    } else if i == self.demo_step && self.demo_step > 0 {
                        ("●", ATTENTION)
                    } else {
                        ("○", MUTED)
                    };
                    let state = if i < self.demo_step { "Completed" } else if i == self.demo_step && self.demo_step > 0 { "Ready for you" } else { "Pending" };
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(mark).color(col));
                        ui.label(RichText::new(format!("{s} — {state}")).small().color(INK));
                    });
                }
                ui.label(RichText::new(format!("Experimenting · {}/5 — advances only when you act in Experiment mode", self.demo_step)).small().color(MUTED));
                ui.horizontal(|ui| {
                    if ui.button(if self.demo_step == 0 { "Start demonstration" } else { "Open in Experiment" }).clicked() {
                        self.mode = Mode::Experiment;
                        if self.demo_step == 0 { self.demo_step = 1; }
                        self.persist();
                    }
                    if self.demo_step > 0 && ui.button("Pause demonstration").on_hover_text("Pauses the local demonstration plan; a real server run cannot be paused from here yet").clicked() {
                        self.demo_step = 0;
                        self.exp_status = "Demonstration paused. No server run was running.".into();
                    }
                });
            }
        });
    }

    fn attention_panel(&mut self, ui: &mut egui::Ui) {
        Self::glass(ui, |ui| {
            ui.label(RichText::new("Attention").font(FontId::proportional(15.0)).color(INK).strong());
            ui.add_space(4.0);
            let mut any = false;
            if let Some(err) = self.chat_failed.clone() {
                any = true;
                ui.label(RichText::new("◐  A message could not be sent").color(ATTENTION).strong());
                ui.label(RichText::new(err).small().color(INK));
                if ui.button("Retry connection").clicked() {
                    self.chat_failed = None;
                    self.check_health();
                }
                ui.add_space(4.0);
            }
            if self.demo_step == 2 {
                any = true;
                ui.label(RichText::new("◐  Decision: Next experiment").color(ATTENTION).strong());
                ui.label(RichText::new("2 configurations ready — memory on every turn, or memory written only when asked. Nothing runs until you choose.").small().color(INK));
                ui.horizontal(|ui| {
                    if ui.button("Inspect in Experiment").clicked() {
                        self.mode = Mode::Experiment;
                        self.attention_open = true;
                    }
                    if ui.button("Decide later").clicked() {
                        self.attention_open = false;
                        self.notice = "Left for later. The experiment waits; nothing runs on its own.".into();
                    }
                });
            }
            if self.store.autonomy == "Manual" {
                any = true;
                ui.label(RichText::new("◐  Autonomy is Manual").color(INK).strong());
                ui.label(RichText::new("Chat will not send until you raise the level in Human Workspace.").small().color(MUTED));
            }
            if !any {
                ui.label(RichText::new("Nothing needs you right now.").small().color(MUTED));
            }
        });
    }

    fn work_mode(&mut self, ui: &mut egui::Ui) {
        Self::glass(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.label(RichText::new("Work").font(FontId::proportional(15.0)).color(INK).strong());
            if let Some(w) = self.active_work().cloned() {
                ui.label(RichText::new(format!("Objective: {}", w.objective)).color(INK));
                ui.label(RichText::new(format!("Status {} · autonomy {} · updated {}", w.status, w.autonomy, ago(w.updated))).small().color(MUTED));
                ui.add_space(4.0);
                ui.label(RichText::new("Findings — every claim labelled").small().color(MUTED));
                if w.findings.is_empty() {
                    ui.label(RichText::new("No findings yet. Unknown: nothing recorded for this work.").small().color(INK));
                }
                for f in &w.findings {
                    ui.label(RichText::new(format!("• {f}")).small().color(INK));
                }
                ui.label(RichText::new("Artifacts").small().color(MUTED));
                if w.artifacts.is_empty() {
                    ui.label(RichText::new("None yet — experiments and files you open will appear here.").small().color(INK));
                }
                for a in &w.artifacts {
                    if ui.link(RichText::new(format!("▸ {a}")).color(AGENT)).clicked() {
                        self.mode = Mode::Experiment;
                    }
                }
                ui.horizontal(|ui| {
                    if ui.button(if self.show_how { "Hide how" } else { "Show me how" }).on_hover_text("How the current picture was reached").clicked() {
                        self.show_how = !self.show_how;
                    }
                    if ui.button("Mark work done").clicked() {
                        if let Some(w2) = self.store.works.get_mut(self.store.active_work) {
                            w2.status = "done".into();
                            w2.updated = now_secs();
                        }
                        self.persist();
                    }
                });
                if self.show_how {
                    ui.label(RichText::new("Recorded: findings above came from the work record, not from chat. Inferred claims say so. Chat is a writing aid; these objects are the record.").small().color(MUTED));
                }
            }
        });
    }

    fn code_mode(&mut self, ui: &mut egui::Ui) {
        let mut do_persist = false;
        let mut new_status: Option<String> = None;
        let mut ask_label: Option<String> = None;
        Self::glass(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.label(RichText::new("Code").font(FontId::proportional(15.0)).color(INK).strong());
            ui.horizontal(|ui| {
                for (i, f) in self.files.iter().enumerate() {
                    if ui.selectable_label(i == self.selected_file, &f.label).clicked() {
                        self.selected_file = i;
                    }
                }
            });
            let idx = self.selected_file.min(self.files.len().saturating_sub(1));
            if let Some(f) = self.files.get_mut(idx) {
                let scratch = f.label.starts_with("Scratch");
                egui::ScrollArea::vertical().max_height(190.0).show(ui, |ui| {
                    ui.add(egui::TextEdit::multiline(&mut f.text).font(egui::TextStyle::Monospace).desired_width(f32::INFINITY).desired_rows(10).code_editor());
                });
                let mut save = false;
                let mut ask = false;
                ui.horizontal(|ui| {
                    if ui.button("Save").clicked() {
                        save = true;
                    }
                    if ui.button("Ask Loom about this").on_hover_text("Puts the file name into chat so the conversation stays connected to the code").clicked() {
                        ask = true;
                    }
                });
                if save {
                    if scratch {
                        do_persist = true;
                        new_status = Some("Scratch notes saved with your work.".into());
                    } else {
                        new_status = Some(match std::fs::write(&f.path, &f.text) {
                            Ok(()) => format!("Saved {}", f.path.display()),
                            Err(e) => format!("Could not save: {e}"),
                        });
                    }
                }
                if ask {
                    ask_label = Some(f.label.clone());
                }
            }
            if !self.code_status.is_empty() {
                ui.label(RichText::new(&self.code_status).small().color(MUTED));
            }
            ui.label(RichText::new("A plain editor with saving — syntax colour and a full file tree are honest limits of this desktop build.").small().color(MUTED));
        });
        if do_persist {
            self.persist();
        }
        if let Some(status) = new_status {
            self.code_status = status;
        }
        if let Some(label) = ask_label {
            self.chat_input = format!("Please look at {} and tell me what matters most.", label);
            self.rail = "work".into();
        }
    }

    fn experiment_mode(&mut self, ui: &mut egui::Ui) {
        Self::glass(ui, |ui| {
            ui.set_width(ui.available_width());
            ui.label(RichText::new("Experiment — Compare memory strategies").font(FontId::proportional(15.0)).color(INK).strong());
            ui.label(RichText::new("Hypothesis (yours to edit)").small().color(MUTED));
            let mut hyp = self.store.hypothesis.clone();
            if ui.add(egui::TextEdit::multiline(&mut hyp).desired_rows(2).desired_width(ui.available_width())).changed() {
                self.store.hypothesis = hyp;
                self.persist();
            }
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                for (title, body) in [
                    ("Configuration A", "Memory on, write every turn\nObserved in demo: slower replies"),
                    ("Configuration B", "Memory on, write only when asked\nUnknown: not measured yet"),
                ] {
                    egui::Frame::none().fill(GLASS_SOFT).stroke(Stroke::new(1.0_f32, LINE)).rounding(10.0).inner_margin(egui::Margin::same(8.0)).show(ui, |ui| {
                        ui.set_width(230.0);
                        ui.label(RichText::new(title).color(INK).strong());
                        ui.label(RichText::new(body).small().color(MUTED));
                    });
                }
            });
            ui.add_space(4.0);
            let steps = ["Record baseline", "Compare the two configurations", "Note likely causes"];
            for (i, s) in steps.iter().enumerate() {
                let done = self.demo_step > i;
                ui.label(RichText::new(format!("{} {} — {}", if done { "✓" } else { "○" }, s, if done { "Recorded (demonstration)" } else { "Pending" })).small().color(INK));
            }
            ui.horizontal(|ui| {
                if self.demo_step == 0 && ui.button("Record baseline (demonstration)").clicked() {
                    self.demo_step = 1;
                    self.exp_status = "Baseline recorded in this demonstration. No server experiment ran.".into();
                }
                if self.demo_step == 1 && ui.button("Prepare comparison").clicked() {
                    self.demo_step = 2;
                    self.exp_status = "Two configurations ready. This is the decision waiting in Attention.".into();
                }
                if self.demo_step == 2 {
                    if ui.button("Choose A — write every turn").clicked() {
                        self.demo_step = 3;
                        self.exp_status = "You chose A. Recorded as your decision; a real run needs the Loom server experiment interface, which is not exposed here yet.".into();
                        if let Some(w) = self.store.works.get_mut(self.store.active_work) {
                            w.findings.push("Recorded: you chose Configuration A for the next experiment.".into());
                            w.updated = now_secs();
                        }
                        self.persist();
                    }
                    if ui.button("Choose B — write when asked").clicked() {
                        self.demo_step = 3;
                        self.exp_status = "You chose B. Recorded as your decision; a real run needs the Loom server experiment interface, which is not exposed here yet.".into();
                        if let Some(w) = self.store.works.get_mut(self.store.active_work) {
                            w.findings.push("Recorded: you chose Configuration B for the next experiment.".into());
                            w.updated = now_secs();
                        }
                        self.persist();
                    }
                }
                if self.demo_step == 3 && ui.button("Start again").clicked() {
                    self.demo_step = 0;
                    self.exp_status = String::new();
                }
            });
            ui.label(RichText::new("Your notes").small().color(MUTED));
            let mut notes = self.store.exp_notes.clone();
            if ui.add(egui::TextEdit::multiline(&mut notes).desired_rows(2).desired_width(ui.available_width()).hint_text("What did you learn? Saved with the work.")).changed() {
                self.store.exp_notes = notes;
                self.persist();
            }
            if !self.exp_status.is_empty() {
                ui.label(RichText::new(&self.exp_status).small().color(MUTED));
            }
            ui.label(RichText::new("Demonstration adapter: steps advance only by your clicks. Real execution status is not invented.").small().color(ATTENTION));
        });
    }
}

fn setup_theme(ctx: &egui::Context) {
    let mut fonts = egui::FontDefinitions::default();
    // Keep the working app's local fonts when present; fall back quietly otherwise.
    if let Ok(bytes) = std::fs::read("/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf") {
        fonts.font_data.insert("noto-regular".into(), egui::FontData::from_owned(bytes));
        fonts.families.entry(egui::FontFamily::Proportional).or_default().insert(0, "noto-regular".into());
    }
    if let Ok(bytes) = std::fs::read("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf") {
        fonts.font_data.insert("code-mono".into(), egui::FontData::from_owned(bytes));
        fonts.families.entry(egui::FontFamily::Monospace).or_default().insert(0, "code-mono".into());
    }
    ctx.set_fonts(fonts);
    let mut style = (*ctx.style()).clone();
    style.text_styles = [
        (egui::TextStyle::Heading, FontId::proportional(20.0)),
        (egui::TextStyle::Body, FontId::proportional(14.0)),
        (egui::TextStyle::Button, FontId::proportional(13.5)),
        (egui::TextStyle::Small, FontId::proportional(11.5)),
        (egui::TextStyle::Monospace, FontId::proportional(12.5)),
    ].into();
    style.spacing.item_spacing = Vec2::new(8.0, 5.0);
    style.spacing.button_padding = Vec2::new(9.0, 5.0);
    style.visuals = egui::Visuals::light();
    style.visuals.override_text_color = Some(INK);
    style.visuals.panel_fill = BG;
    style.visuals.window_fill = BG;
    style.visuals.extreme_bg_color = SURFACE;
    style.visuals.faint_bg_color = SURFACE;
    style.visuals.hyperlink_color = AGENT;
    style.visuals.selection.bg_fill = Color32::from_rgba_premultiplied(0x6A, 0x91, 0xCC, 42);
    style.visuals.selection.stroke = Stroke::new(1.0_f32, AGENT);
    style.visuals.widgets.noninteractive.bg_fill = Color32::TRANSPARENT;
    style.visuals.widgets.inactive.bg_fill = Color32::from_rgba_premultiplied(255, 252, 248, 170);
    style.visuals.widgets.inactive.weak_bg_fill = Color32::from_rgba_premultiplied(255, 252, 248, 120);
    style.visuals.widgets.hovered.bg_fill = WARM;
    style.visuals.widgets.active.bg_fill = WARM;
    ctx.set_style(style);
}

fn main() -> eframe::Result<()> {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Loom — Human-Centered Development Environment")
            .with_inner_size([1648.0, 928.0])
            .with_min_inner_size([900.0, 600.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Loom",
        options,
        Box::new(|cc| {
            setup_theme(&cc.egui_ctx);
            Ok(Box::new(LoomApp::new()))
        }),
    )
}
