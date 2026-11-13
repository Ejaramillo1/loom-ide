//! Runtime ports. No endpoint is called by the offline application.
//! Implement against the verified Loom bridge after an explicit connection action.
use crate::knowledge::State;
#[derive(Debug, Clone)]
pub struct AgentActivity {
    pub state: State,
    pub execution_id: Option<String>,
    pub evidence: Vec<String>,
}
#[derive(Debug, Clone)]
pub struct ContextPack {
    pub intent: String,
    pub object_ids: Vec<String>,
    pub excluded_ids: Vec<String>,
    pub estimated_tokens: usize,
}
pub trait AgentAdapter {
    fn activity(&self) -> AgentActivity;
    fn submit(&mut self, context: &ContextPack, prompt: &str) -> Result<String, String>;
}
pub struct OfflineAdapter;
impl AgentAdapter for OfflineAdapter {
    fn activity(&self) -> AgentActivity {
        AgentActivity {
            state: State::Idle,
            execution_id: None,
            evidence: Vec::new(),
        }
    }
    fn submit(&mut self, _: &ContextPack, _: &str) -> Result<String, String> {
        Err("No agent is connected. Local knowledge remains available.".into())
    }
}
pub trait TraceAdapter {
    fn trace_link(&self, execution_id: &str) -> Option<String>;
}
