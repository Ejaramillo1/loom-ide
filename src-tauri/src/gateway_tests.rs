//! Wire-contract regression tests. Samples exercise protojson's camelCase,
//! string int64s and base64 bytes; they are never used as application data.
use super::*;
use serde_json::json;

#[test]
fn session_detail_preserves_camel_case_fields_and_fractional_cost() {
    let detail: SessionDetail = serde_json::from_value(json!({
        "id": "session", "createdAt": "1760000000", "updatedAt": "1760000001",
        "totalCostUsd": 0.05, "conversationCount": 3, "agentId": "agent",
        "agentName": "Agent", "startedAt": "2026-11-12T00:00:00Z",
        "endedAt": "2026-11-12T00:01:00Z", "metadataStatus": "completed",
        "artifactCount": 2
    }))
    .unwrap();
    assert_eq!(detail.created_at, 1760000000);
    assert_eq!(detail.updated_at, 1760000001);
    assert_eq!(detail.total_cost_usd, 0.05);
    assert_eq!(detail.conversation_count, 3);
    assert_eq!(detail.agent_id, "agent");
    assert_eq!(detail.agent_name, "Agent");
    assert_eq!(detail.started_at, "2026-11-12T00:00:00Z");
    assert_eq!(detail.ended_at, "2026-11-12T00:01:00Z");
    assert_eq!(detail.metadata_status, "completed");
    assert_eq!(detail.artifact_count, 2);
    let omitted: SessionDetail = serde_json::from_value(json!({})).unwrap();
    assert_eq!(omitted.total_cost_usd, 0.0);
    let integer_zero: SessionDetail = serde_json::from_value(json!({"totalCostUsd": 0})).unwrap();
    assert_eq!(integer_zero.total_cost_usd, 0.0);
}

#[test]
fn model_and_tool_fields_match_protojson_names() {
    let model: ModelInfo = serde_json::from_value(json!({
        "contextWindow": 200000, "costPer1mInputUsd": 3.0,
        "costPer1mOutputUsd": 15.0, "maxOutputTokens": 8000,
        "isReasoning": true, "showInDropdown": true
    }))
    .unwrap();
    assert_eq!(model.context_window, 200000);
    assert_eq!(model.cost_per_1m_input_usd, 3.0);
    assert_eq!(model.cost_per_1m_output_usd, 15.0);
    assert_eq!(model.max_output_tokens, 8000);
    assert!(model.is_reasoning);
    assert!(model.show_in_dropdown);
    let tool: ToolDefinition = serde_json::from_value(json!({
        "inputSchemaJson": "{\"type\":\"object\"}",
        "outputSchemaJson": "{\"type\":\"string\"}"
    }))
    .unwrap();
    assert_eq!(tool.input_schema_json, "{\"type\":\"object\"}");
    assert_eq!(tool.output_schema_json, "{\"type\":\"string\"}");
}

#[test]
fn trace_and_artifact_stats_preserve_string_int64s() {
    let span = json!({
        "parentId": "parent", "startTimeUs": "9007199254740993",
        "endTimeUs": "9007199254740995", "durationUs": "2"
    });
    let trace: Trace = serde_json::from_value(json!({
        "sessionId": "session", "rootSpan": span, "spans": [span], "totalDurationMs": "1"
    }))
    .unwrap();
    assert_eq!(trace.session_id, "session");
    assert_eq!(trace.total_duration_ms, 1);
    for span in [trace.root_span.unwrap(), trace.spans[0].clone()] {
        assert_eq!(span.parent_id, "parent");
        assert_eq!(span.start_time_us, 9007199254740993);
        assert_eq!(span.end_time_us, 9007199254740995);
        assert_eq!(span.duration_us, 2);
    }
    let stats: ArtifactStats = serde_json::from_value(json!({
        "totalFiles": 6, "totalSizeBytes": "9007199254740993",
        "userFiles": 1, "generatedFiles": 2, "deletedFiles": 3
    }))
    .unwrap();
    assert_eq!(stats.total_files, 6);
    assert_eq!(stats.total_size_bytes, 9007199254740993);
    assert_eq!(
        (stats.user_files, stats.generated_files, stats.deleted_files),
        (1, 2, 3)
    );
}

#[test]
fn config_parses_real_gateway_shape_and_minimal_tls_response() {
    // Captured from the local Loom gateway, with no private configuration.
    let config: ServerConfig = serde_json::from_str(r#"{"name":"looms","network":{"grpcAddress":"0.0.0.0:60051","httpAddress":"0.0.0.0:5006","httpEnabled":true}}"#).unwrap();
    assert_eq!(config.name, "looms");
    let network = config.network.unwrap();
    assert_eq!(network.grpc_address, "0.0.0.0:60051");
    assert_eq!(network.http_address, "0.0.0.0:5006");
    assert!(network.http_enabled);
    assert!(!network.reflection_enabled);
    assert!(config.tls.is_none());
    // With default protojson options, TLSConfig{enabled:false} emits {}.
    for tls in [json!({}), json!({"enabled": false})] {
        let config: ServerConfig = serde_json::from_value(json!({"tls": tls})).unwrap();
        assert!(!config.tls.unwrap().enabled);
    }
    let config: ServerConfig = serde_json::from_value(json!({
        "behavior": {"maxConcurrentRequests": 100, "requestTimeoutSeconds": 300,
            "gracefulShutdown": true, "shutdownTimeoutSeconds": 30,
            "corsEnabled": true, "corsAllowedOrigins": ["http://localhost:1420"]},
        "metadata": {"environment": "test"},
        "storage": {"backend": "STORAGE_BACKEND_TYPE_SQLITE"}
    }))
    .unwrap();
    let behavior = config.behavior.unwrap();
    assert_eq!(behavior.max_concurrent_requests, 100);
    assert_eq!(behavior.request_timeout_seconds, 300);
    assert!(behavior.graceful_shutdown);
    assert_eq!(behavior.shutdown_timeout_seconds, 30);
    assert!(behavior.cors_enabled);
    assert_eq!(behavior.cors_allowed_origins, ["http://localhost:1420"]);
    assert_eq!(config.metadata["environment"], "test");
    assert_eq!(
        config.storage.unwrap().backend,
        "STORAGE_BACKEND_TYPE_SQLITE"
    );
}

#[test]
fn storage_unwraps_status_and_reports_error_and_latency() {
    // Captured from the real gateway; the latency is a protojson string.
    let response: StorageStatusResponse = serde_json::from_str(r#"{"status":{"backend":"STORAGE_BACKEND_TYPE_SQLITE","healthy":true,"latencyMs":"41","migrationVersion":14}}"#).unwrap();
    assert_eq!(response.status.backend, "STORAGE_BACKEND_TYPE_SQLITE");
    assert!(response.status.healthy);
    assert_eq!(response.status.latency_ms, 41);
    let unhealthy: StorageStatusResponse = serde_json::from_value(json!({
        "status": {"backend": "STORAGE_BACKEND_TYPE_POSTGRES", "error": "connection refused"}
    }))
    .unwrap();
    assert!(!unhealthy.status.healthy);
    assert_eq!(unhealthy.status.error, "connection refused");
    // Missing status must not become a fabricated unhealthy backend.
    assert!(serde_json::from_value::<StorageStatusResponse>(json!({})).is_err());
}

#[test]
fn provider_config_is_nested_and_active_comes_from_response() {
    let response: ProviderListResponse = serde_json::from_value(json!({
        "providers": [
            {"name": "primary", "config": {"provider": "anthropic", "model": "model-a"}, "active": false},
            {"name": "secondary", "config": {"provider": "ollama", "model": "model-b"}, "active": true}
        ], "activeProvider": "primary"
    })).unwrap();
    let providers = response.into_entries();
    assert!(providers[0].active);
    assert!(!providers[1].active);
    assert_eq!(providers[0].config.provider, "anthropic");
    assert_eq!(providers[0].config.model, "model-a");
    assert_eq!(providers[1].config.model, "model-b");
    assert!(
        serde_json::from_str::<ProviderListResponse>("{}")
            .unwrap()
            .into_entries()
            .is_empty()
    );
}

#[test]
fn base64_matches_rfc4648_vectors_and_rejects_invalid_input() {
    for (plain, encoded) in [
        ("", ""),
        ("f", "Zg=="),
        ("fo", "Zm8="),
        ("foo", "Zm9v"),
        ("foob", "Zm9vYg=="),
        ("fooba", "Zm9vYmE="),
        ("foobar", "Zm9vYmFy"),
    ] {
        assert_eq!(encode_base64(plain.as_bytes()), encoded);
        assert_eq!(decode_base64(encoded).unwrap(), plain.as_bytes());
    }
    assert_eq!(decode_base64("/wCA").unwrap(), [255, 0, 128]);
    for invalid in [
        "a", "====", "Z===", "Zg=Z", "Zg==Zg==", "Zh==", "Zm9=", "Zm$v", "Zm9v\n",
    ] {
        assert!(decode_base64(invalid).is_err(), "accepted {invalid}");
    }
}

#[test]
fn artifact_content_decodes_both_layers_and_handles_empty_content() {
    for (value, expected) in [
        (json!({"content": "aGVsbG8=", "encoding": "text"}), "hello"),
        (
            json!({"content": "YUdWc2JHOD0=", "encoding": "base64"}),
            "hello",
        ),
        (json!({"content": "L3dDQQ==", "encoding": "base64"}), "/wCA"),
        (json!({"encoding": "text"}), ""),
        (json!({"encoding": "base64"}), ""),
    ] {
        assert_eq!(
            serde_json::from_value::<GetArtifactContentResponse>(value)
                .unwrap()
                .decode()
                .unwrap(),
            expected
        );
    }
    for value in [
        json!({"content": "bad!"}),
        json!({"content": "YmFkIQ==", "encoding": "base64"}),
        json!({"content": [104, 105]}),
    ] {
        assert!(
            serde_json::from_value::<GetArtifactContentResponse>(value)
                .unwrap()
                .decode()
                .is_err()
        );
    }
}

#[test]
fn providers_mark_only_the_active_provider() {
    let resp: ProviderListResponse = serde_json::from_value(json!({
        "providers": [
            {"name": "openai", "config": {"provider": "openai", "model": "gpt-5"}},
            {"name": "deepseek", "config": {"provider": "deepseek", "model": "deepseek-chat"}}
        ],
        "activeProvider": "deepseek"
    }))
    .unwrap();
    let entries = resp.into_entries();
    assert_eq!(entries.len(), 2);
    assert!(!entries[0].active);
    assert!(entries[1].active);
    assert_eq!(entries[1].config.model, "deepseek-chat");
    let unconfigured: ProviderListResponse =
        serde_json::from_value(json!({"providers": []})).unwrap();
    assert!(unconfigured.into_entries().is_empty());
}

#[test]
#[ignore = "requires a live Loom gateway on localhost:5006"]
fn live_gateway_responses_parse() {
    let config: ServerConfig =
        serde_json::from_value(loom_request("GET", "/v1/server/config", None).unwrap()).unwrap();
    assert!(!config.name.is_empty() || config.tls.is_some());
    let status: StorageStatusResponse =
        serde_json::from_value(loom_request("GET", "/v1/server/storage", None).unwrap()).unwrap();
    assert!(!status.status.backend.is_empty());
    let _: ModelListResponse =
        serde_json::from_value(loom_request("GET", "/v1/models", None).unwrap()).unwrap();
    let _: ToolListResponse =
        serde_json::from_value(loom_request("GET", "/v1/tools", None).unwrap()).unwrap();
    let providers: ProviderListResponse =
        serde_json::from_value(loom_request("GET", "/v1/providers", None).unwrap()).unwrap();
    let _ = providers.into_entries();
    let sessions = loom_request("GET", "/v1/sessions?limit=1", None).unwrap();
    if let Some(id) = sessions["sessions"]
        .as_array()
        .and_then(|sessions| sessions.first())
        .and_then(|session| session["id"].as_str())
    {
        let _: SessionDetail = serde_json::from_value(
            loom_request("GET", &format!("/v1/sessions/{}", percent_encode(id)), None).unwrap(),
        )
        .unwrap();
    }
}
