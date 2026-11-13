//! Rules recovered from the shipped ELF. Addresses and evidence: ../MECHANICS.md.
use crate::knowledge::{Actor, State, Vault};

pub const REPAINT_MS: u64 = 120; // update, 0x7ce9e0
pub const PROCESSING_SECONDS: f64 = 1.5; // send_chat, 0x7cc560 (including offline replies)
pub const COMPLETION_SECONDS: f64 = 2.5; // send_chat, 0x7cc560
pub const RIBBON_MIN_POINTS: usize = 3; // paint_scene, 0x7c77b0: 2 < len
pub const RIBBON_WIDTH: f32 = 0.8; // paint_scene, 0x7c77b0

/// send_chat, ELF 0x7cc560: empty input returns before the Manual guard.
/// The second sentence adapts the original notice to this offline workbench.
pub const MANUAL_NOTICE: &str = "Autonomy is Manual: nothing is sent. Turn off Keep chat as drafts in Local workspace settings to use offline replies.";
pub fn prepare_chat(input: &str, manual: bool) -> Result<Option<String>, &'static str> {
    let text = input.trim();
    if text.is_empty() {
        Ok(None)
    } else if manual {
        Err(MANUAL_NOTICE)
    } else {
        Ok(Some(text.to_owned()))
    }
}

/// SphereState::words, 0x7ce860 (two local-only states retain workbench wording).
pub fn state_words(state: State) -> &'static str {
    match state {
        State::Idle => "At rest — nothing is running.",
        State::Listening => "Listening — Loom is with you.",
        State::Thinking => "Thinking — preparing a reply.",
        State::Executing => "An agent is working on your work.",
        State::AwaitingApproval => "Needs you — a decision is waiting.",
        State::Completed => "Done — back at rest.",
        State::Exploring => "Exploring local knowledge.",
        State::Error => "Needs attention — check local activity.",
    }
}

/// sphere_state, 0x7ca680. Attention must win over temporary completion feedback.
pub fn sphere_state(
    attention: Option<State>,
    processing: bool,
    busy: bool,
    input: &str,
    completed: bool,
) -> State {
    if let Some(state) = attention {
        state
    } else if processing {
        State::Thinking
    } else if busy {
        State::Executing
    } else if !input.trim().is_empty() {
        State::Listening
    } else if completed {
        State::Completed
    } else {
        State::Idle
    }
}

/// paint_scene, 0x7c77b0. The sphere's radius does not breathe.
pub fn glow_alpha(elapsed: f64, reduced: bool) -> u8 {
    let pulse = if reduced {
        0.0
    } else {
        (elapsed * 0.6).sin() as f32 * 0.5 + 0.5
    };
    (10.0 + 8.0 * pulse).clamp(0.0, 255.0) as u8
}

pub fn halo_radius(radius: f32, layer: usize) -> f32 {
    radius * (1.42 - 0.06 * layer as f32)
}

/// Six curves, 49 samples each, clipped to the circle; paint_scene, 0x7c77b0.
pub fn wave_points(
    radius: f32,
    elapsed: f64,
    reduced: bool,
    state: State,
    k: usize,
) -> Vec<[f32; 2]> {
    let t = if reduced { 0.0 } else { elapsed };
    let speed = match state {
        State::Thinking => 0.07,
        State::Executing => 0.11,
        _ => 0.02,
    };
    let phase = (t * speed) as f32;
    let offset = (k as f32 - 2.5) * radius * 0.24;
    let wobble = if reduced {
        0.0
    } else {
        (t * 0.25 + k as f64).sin() as f32 * radius * 0.03
    };
    (0..=48)
        .filter_map(|s| {
            let f = s as f32 / 48.0;
            let x = -radius + 2.0 * radius * f;
            let dx = x / radius;
            let half = (1.0 - dx * dx).max(0.0).sqrt() * radius;
            let y = offset
                + wobble
                + (f * std::f32::consts::PI * 2.0 + phase + k as f32).sin() * radius * 0.05;
            (y.abs() <= half).then_some([x, y])
        })
        .collect()
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub enum ExperimentStage {
    #[default]
    Baseline, // original demo_step 0
    Comparison, // 1
    Choose,     // 2: has_attention
    Recorded,   // 3
}

pub const CONFIGURATIONS: [(&str, &str); 2] = [
    (
        "Configuration A",
        "Memory on, write every turn.\nObserved in demo: slower replies",
    ),
    (
        "Configuration B",
        "Memory on, write only when asked.\nUnknown: not measured yet",
    ),
];

/// Adapt the original timestamped WorkItem finding to a durable vault decision.
pub fn record_choice(
    vault: &mut Vault,
    stage: &mut ExperimentStage,
    choice: usize,
) -> Result<String, String> {
    if *stage != ExperimentStage::Choose || choice > 1 {
        return Err("Prepare the comparison before recording a choice".into());
    }
    let (name, description) = CONFIGURATIONS[choice];
    let body = format!("Recorded: you chose {name} for the next experiment.\n\n{description}\n\nThis records your decision only. No server experiment ran; a real run needs the Loom server experiment interface.");
    let id = vault.create(
        &format!("Memory strategy: {name}"),
        &body,
        "decision",
        Actor::Human,
    )?;
    *stage = ExperimentStage::Recorded;
    Ok(id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manual_chat_preserves_guard_order_and_existing_settings() {
        assert_eq!(prepare_chat(" \n\t", true), Ok(None));
        assert_eq!(prepare_chat("  draft  ", true), Err(MANUAL_NOTICE));
        assert_eq!(prepare_chat("  draft  ", false), Ok(Some("draft".into())));
        let legacy: crate::knowledge::Settings = serde_json::from_str(
            r#"{"intent":"Existing workspace","reduced_motion":true,"light_mode":true}"#
        ).unwrap();
        assert!(!legacy.manual_chat);
        assert!(legacy.reduced_motion && legacy.light_mode);
    }

    #[test]
    fn strategy_choices_require_review_and_survive_reopening() {
        let root = std::env::temp_dir().join(crate::knowledge::new_id());
        let mut vault = Vault::open(root.clone()).unwrap();
        let mut stage = ExperimentStage::Baseline;
        let count = vault.notes.len();
        assert!(record_choice(&mut vault, &mut stage, 0).is_err());
        assert_eq!(vault.notes.len(), count);
        for choice in 0..2 {
            stage = ExperimentStage::Choose;
            assert!(record_choice(&mut vault, &mut stage, 2).is_err());
            assert_eq!(stage, ExperimentStage::Choose);
            let id = record_choice(&mut vault, &mut stage, choice).unwrap();
            assert_eq!(stage, ExperimentStage::Recorded);
            assert!(record_choice(&mut vault, &mut stage, choice).is_err());
            let reopened = Vault::open(root.clone()).unwrap();
            let note = reopened.get(&id).unwrap();
            assert_eq!(note.meta.kind, "decision");
            assert!(note.body.contains(CONFIGURATIONS[choice].0));
            assert!(note.body.contains("No server experiment ran"));
            assert!(note.path.starts_with("50 Projects/Agent Memory/Decisions/"));
            assert!(reopened.ledger.audit.iter().any(|a| a.object == id));
        }
        vault.set_motion(true).unwrap();
        assert!(Vault::open(root.clone()).unwrap().settings.reduced_motion);
        vault.set_manual_chat(true).unwrap();
        let reopened = Vault::open(root.clone()).unwrap();
        assert!(reopened.settings.manual_chat && reopened.settings.reduced_motion);
        vault.set_manual_chat(false).unwrap();
        assert!(!Vault::open(root.clone()).unwrap().settings.manual_chat);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn attention_execution_and_input_override_completion() {
        assert_eq!(
            sphere_state(Some(State::AwaitingApproval), true, true, "draft", true),
            State::AwaitingApproval
        );
        assert_eq!(
            sphere_state(None, true, true, "draft", true),
            State::Thinking
        );
        assert_eq!(
            sphere_state(None, false, true, "draft", true),
            State::Executing
        );
        assert_eq!(
            sphere_state(None, false, false, "draft", true),
            State::Listening
        );
        assert_eq!(
            sphere_state(None, false, false, " \n\t", true),
            State::Completed
        );
        assert_eq!(
            sphere_state(None, false, false, " \n\t", false),
            State::Idle
        );
    }

    #[test]
    fn reduced_motion_freezes_geometry_and_illumination() {
        for state in [State::Idle, State::Thinking, State::Executing] {
            for k in 0..6 {
                assert_eq!(
                    wave_points(185.0, 0.0, true, state, k),
                    wave_points(185.0, 123.4, true, state, k)
                );
            }
        }
        assert_eq!(glow_alpha(123.4, true), 10);
        assert_eq!(glow_alpha(0.0, false), 14);
        assert_eq!(glow_alpha(std::f64::consts::PI / 1.2, false), 18);
        for k in 0..6 {
            for [x, y] in wave_points(185.0, 100.0, false, State::Executing, k) {
                assert!(x * x + y * y <= 185.0 * 185.0 + 0.01);
            }
        }
    }
}
