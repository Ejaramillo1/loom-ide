//! Actual command boundaries against a disposable TCP peer, never the user's Loom.
use super::*;
use std::io::{BufRead, BufReader};
use std::net::TcpListener;
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};

#[test]
fn command_matrix_uses_only_the_disposable_peer() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    listener.set_nonblocking(true).unwrap();
    let stop = Arc::new(AtomicBool::new(false));
    let stopped = stop.clone();
    let peer = std::thread::spawn(move || {
        let mut requests = Vec::new();
        while !stopped.load(Ordering::SeqCst) {
            let (mut stream, _) = match listener.accept() {
                Ok(s) => s,
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(5));
                    continue;
                }
                Err(e) => panic!("{e}"),
            };
            stream
                .set_read_timeout(Some(Duration::from_secs(5)))
                .unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut first = String::new();
            reader.read_line(&mut first).unwrap();
            let mut length = 0;
            loop {
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                if line.trim().is_empty() {
                    break;
                }
                if let Some((key, value)) = line.split_once(':') {
                    if key.eq_ignore_ascii_case("content-length") {
                        length = value.trim().parse().unwrap();
                    }
                }
            }
            let mut body = vec![0; length];
            reader.read_exact(&mut body).unwrap();
            requests.push((first, String::from_utf8(body).unwrap()));
            let body = r#"{"text":"fixture reply","executionId":"fixture-run"}"#;
            write!(stream, "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}", body.len(), body).unwrap();
        }
        requests
    });
    // A child process scopes LOOM_ADDR without mutating a multithreaded test process's environment.
    let output = std::process::Command::new(std::env::current_exe().unwrap())
        .args([
            "--exact",
            "execution_admission_tests::command_matrix_child",
            "--nocapture",
        ])
        .env("LOOM_IDE_ADMISSION_TEST_CHILD", "1")
        .env("LOOM_ADDR", addr.to_string())
        .output()
        .unwrap();
    stop.store(true, Ordering::SeqCst);
    let requests = peer.join().unwrap();
    assert!(
        output.status.success(),
        "{}\n{}",
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    );
    // Only the allowed chat, explicitly disabled create/update and pause/delete may send.
    assert_eq!(
        requests.len(),
        5,
        "unexpected network execution: {requests:?}"
    );
    assert!(requests[0].0.starts_with("POST /v1/weave "));
    let body: serde_json::Value = serde_json::from_str(&requests[0].1).unwrap();
    assert_eq!(body["backendConfig"]["autonomy"], "assisted");
    assert!(requests[1].1.contains("\"enabled\":false"));
    assert!(requests[2].1.contains("\"enabled\":false"));
}

fn rejected<T>(result: Result<T, String>, needle: &str) {
    match result {
        Err(e) => assert!(e.contains(needle), "unexpected refusal: {e}"),
        Ok(_) => panic!("command bypassed admission ({needle})"),
    }
}

#[test]
fn command_matrix_child() {
    if std::env::var("LOOM_IDE_ADMISSION_TEST_CHILD").as_deref() != Ok("1") {
        return;
    }
    let root =
        std::env::temp_dir().join(format!("loom-ide-command-fixture-{}", std::process::id()));
    std::fs::create_dir_all(&root).unwrap();
    let mut work = WorkStore::load(root.join("work.json")).unwrap();
    let mut intents = IntentStore::load(root.join("intents.json")).unwrap();
    let intent = intents
        .create(
            "Execution fixture".into(),
            None,
            vec![],
            Some("delegated".into()),
            None,
            None,
        )
        .unwrap();
    let item = work
        .add("Manual fixture".into(), Some(intent.id.clone()))
        .unwrap();
    work.set_autonomy(&item.id, "manual").unwrap();
    work.set_session(&item.id, Some("owned-session".into()))
        .unwrap();
    let app = tauri::test::mock_app();
    app.manage(AppState {
        work: Mutex::new(work),
        intents: Mutex::new(intents),
        experiments: Mutex::new(ExperimentStore::load(root.join("experiments.json")).unwrap()),
        workspace: Mutex::new(
            WorkspaceStore::load(root.join("workspace.json"), root.join("files")).unwrap(),
        ),
    });
    let state = app.state::<AppState>();
    let w = Some(item.id.clone());
    let i = Some(intent.id.clone());
    tauri::async_runtime::block_on(async {
        rejected(
            ask_loom(
                "query".into(),
                None,
                None,
                None,
                None,
                None,
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            loom_stream::ask_loom_stream(
                app.handle().clone(),
                state.clone(),
                "chat".into(),
                "query".into(),
                None,
                None,
                None,
                None,
                None,
                w.clone(),
                i.clone(),
                None,
            ),
            "Manual",
        );
        rejected(
            execute_workflow("workflow".into(), w.clone(), i.clone(), None, state.clone()).await,
            "Manual",
        );
        rejected(
            loom_stream::execute_workflow_stream(
                app.handle().clone(),
                state.clone(),
                "workflow".into(),
                "workflow".into(),
                w.clone(),
                i.clone(),
                None,
            ),
            "Manual",
        );
        rejected(
            loom_stream::provider_abtest(
                app.handle().clone(),
                state.clone(),
                "ab".into(),
                "query".into(),
                None,
                None,
                w.clone(),
                i.clone(),
                None,
            ),
            "Manual",
        );
        rejected(
            loom_http::session_resume("owned-session".into(), None, None, None, state.clone())
                .await,
            "Manual",
        );
        rejected(
            loom_http::session_resume(
                "owned-session".into(),
                Some("wrong".into()),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "belongs",
        );
        rejected(
            loom_http::workflow_schedule_trigger(
                "schedule".into(),
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            loom_http::workflow_schedule_create(
                "workflow".into(),
                "* * * * *".into(),
                None,
                None,
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            loom_http::workflow_schedule_update(
                "schedule".into(),
                None,
                None,
                Some(true),
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            loom_http::workflow_schedule_update(
                "schedule".into(),
                Some("* * * * *".into()),
                None,
                None,
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            loom_http::workflow_schedule_resume(
                "schedule".into(),
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            loom_http::skills_classify("skill".into(), w.clone(), i.clone(), None, state.clone())
                .await,
            "Manual",
        );
        rejected(
            loom_tasks::loom_task_decompose(
                "goal".into(),
                None,
                None,
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            ask_loom(
                "query".into(),
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                state.clone(),
            )
            .await,
            "ownership is required",
        );
        rejected(
            ask_loom(
                "query".into(),
                None,
                None,
                None,
                None,
                None,
                Some("missing".into()),
                None,
                None,
                state.clone(),
            )
            .await,
            "no longer exists",
        );
        rejected(
            ask_loom(
                "query".into(),
                None,
                None,
                None,
                None,
                None,
                w.clone(),
                Some("missing".into()),
                None,
                state.clone(),
            )
            .await,
            "no longer exists",
        );
        rejected(
            ask_loom(
                "query".into(),
                Some("owned-session".into()),
                None,
                None,
                None,
                None,
                None,
                None,
                Some(true),
                state.clone(),
            )
            .await,
            "belongs",
        );
        state
            .work
            .lock()
            .unwrap()
            .set_autonomy(&item.id, "assisted")
            .unwrap();
        let reply = ask_loom(
            "query".into(),
            None,
            None,
            None,
            None,
            None,
            w.clone(),
            i.clone(),
            None,
            state.clone(),
        )
        .await
        .unwrap();
        assert_eq!(reply.text, "fixture reply");
        // A work record cannot outrun its intent ceiling, even if it is stale.
        state
            .intents
            .lock()
            .unwrap()
            .update(
                &intent.id,
                None,
                None,
                Some("manual".into()),
                None,
                None,
                None,
                None,
            )
            .unwrap();
        rejected(
            ask_loom(
                "ceiling".into(),
                None,
                None,
                None,
                None,
                None,
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        rejected(
            ask_loom(
                "blank owner".into(),
                None,
                None,
                None,
                None,
                None,
                Some(" ".into()),
                None,
                None,
                state.clone(),
            )
            .await,
            "empty identifier",
        );
        let other = state
            .intents
            .lock()
            .unwrap()
            .create("Different intent".into(), None, vec![], None, None, None)
            .unwrap();
        rejected(
            ask_loom(
                "wrong intent".into(),
                None,
                None,
                None,
                None,
                None,
                w.clone(),
                Some(other.id),
                None,
                state.clone(),
            )
            .await,
            "does not own",
        );
        let orphan = state
            .work
            .lock()
            .unwrap()
            .add("orphan".into(), Some("gone".into()))
            .unwrap();
        rejected(
            ask_loom(
                "orphan".into(),
                None,
                None,
                None,
                None,
                None,
                Some(orphan.id),
                None,
                None,
                state.clone(),
            )
            .await,
            "intent no longer exists",
        );
        // The same command rechecks stored policy when a fallback is dispatched.
        state
            .work
            .lock()
            .unwrap()
            .set_autonomy(&item.id, "manual")
            .unwrap();
        rejected(
            ask_loom(
                "fallback".into(),
                None,
                None,
                None,
                None,
                None,
                w.clone(),
                i.clone(),
                None,
                state.clone(),
            )
            .await,
            "Manual",
        );
        // Reading/disabling/deleting remain available under Manual.
        loom_http::workflow_schedule_create(
            "workflow".into(),
            "* * * * *".into(),
            None,
            Some(false),
            None,
            None,
            None,
            state.clone(),
        )
        .await
        .unwrap();
        loom_http::workflow_schedule_update(
            "schedule".into(),
            None,
            None,
            Some(false),
            None,
            None,
            None,
            state.clone(),
        )
        .await
        .unwrap();
        loom_http::workflow_schedule_pause("schedule".into())
            .await
            .unwrap();
        loom_http::workflow_schedule_delete("schedule".into())
            .await
            .unwrap();
    });
}
