# Loom RPC catalogue

Generated from the pinned local source. A route annotation is NOT proof that the HTTP server registers the service. A server symbol is NOT proof that its body implements the contract; see report 02 for inspected implementations and stubs.

| Service / RPC | Contract | HTTP annotation | Server symbol(s) |
|---|---|---|---|
| GraphMemoryService.CreateEntity | `proto/loom/v1/graph_memory.proto:18`; `CreateEntityRequest` → `CreateEntityResponse` | None | `pkg/server/graph_memory_server.go:53` |
| GraphMemoryService.GetEntity | `proto/loom/v1/graph_memory.proto:19`; `GetEntityRequest` → `GetEntityResponse` | None | `pkg/server/graph_memory_server.go:78` |
| GraphMemoryService.UpdateEntity | `proto/loom/v1/graph_memory.proto:20`; `UpdateEntityRequest` → `UpdateEntityResponse` | None | `pkg/server/graph_memory_server.go:98` |
| GraphMemoryService.ListEntities | `proto/loom/v1/graph_memory.proto:21`; `ListEntitiesRequest` → `ListEntitiesResponse` | None | `pkg/server/graph_memory_server.go:125` |
| GraphMemoryService.DeleteEntity | `proto/loom/v1/graph_memory.proto:22`; `DeleteEntityRequest` → `DeleteEntityResponse` | None | `pkg/server/graph_memory_server.go:153` |
| GraphMemoryService.Relate | `proto/loom/v1/graph_memory.proto:25`; `RelateRequest` → `RelateResponse` | None | `pkg/server/graph_memory_server.go:177` |
| GraphMemoryService.Unrelate | `proto/loom/v1/graph_memory.proto:26`; `UnrelateRequest` → `UnrelateResponse` | None | `pkg/server/graph_memory_server.go:224` |
| GraphMemoryService.Neighbors | `proto/loom/v1/graph_memory.proto:27`; `NeighborsRequest` → `NeighborsResponse` | None | `pkg/server/graph_memory_server.go:263` |
| GraphMemoryService.Remember | `proto/loom/v1/graph_memory.proto:30`; `RememberRequest` → `RememberResponse` | None | `pkg/server/graph_memory_server.go:317` |
| GraphMemoryService.Recall | `proto/loom/v1/graph_memory.proto:31`; `RecallRequest` → `RecallResponse` | None | `pkg/server/graph_memory_server.go:354` |
| GraphMemoryService.Forget | `proto/loom/v1/graph_memory.proto:32`; `ForgetRequest` → `ForgetResponse` | None | `pkg/server/graph_memory_server.go:391` |
| GraphMemoryService.Supersede | `proto/loom/v1/graph_memory.proto:33`; `SupersedeRequest` → `SupersedeResponse` | None | `pkg/server/graph_memory_server.go:408` |
| GraphMemoryService.Consolidate | `proto/loom/v1/graph_memory.proto:34`; `ConsolidateRequest` → `ConsolidateResponse` | None | `pkg/server/graph_memory_server.go:461` |
| GraphMemoryService.ContextFor | `proto/loom/v1/graph_memory.proto:37`; `ContextForRequest` → `ContextForResponse` | None | `pkg/server/graph_memory_server.go:507` |
| GraphMemoryService.GetGraphStats | `proto/loom/v1/graph_memory.proto:40`; `GetGraphStatsRequest` → `GetGraphStatsResponse` | None | `pkg/server/graph_memory_server.go:540` |
| JudgeService.EvaluateWithJudges | `proto/loom/v1/judge.proto:20`; `EvaluateRequest` → `EvaluateResponse` | None | `pkg/server/judge_server.go:127` |
| JudgeService.EvaluateWithJudgesStream | `proto/loom/v1/judge.proto:24`; `EvaluateRequest` → `stream EvaluateProgress` | None | `pkg/server/judge_server.go:141` |
| JudgeService.RegisterJudge | `proto/loom/v1/judge.proto:27`; `RegisterJudgeRequest` → `RegisterJudgeResponse` | None | `pkg/server/judge_server.go:88` |
| JudgeService.GetJudgeHistory | `proto/loom/v1/judge.proto:30`; `GetJudgeHistoryRequest` → `GetJudgeHistoryResponse` | None | `pkg/server/judge_server.go:197` |
| LearningAgentService.AnalyzePatternEffectiveness | `proto/loom/v1/learning.proto:27`; `AnalyzePatternEffectivenessRequest` → `PatternAnalysisResponse` | None | `pkg/server/learning_service.go:38` |
| LearningAgentService.GenerateImprovements | `proto/loom/v1/learning.proto:30`; `GenerateImprovementsRequest` → `ImprovementsResponse` | None | `pkg/server/learning_service.go:46` |
| LearningAgentService.ApplyImprovement | `proto/loom/v1/learning.proto:33`; `ApplyImprovementRequest` → `ApplyImprovementResponse` | None | `pkg/server/learning_service.go:54` |
| LearningAgentService.RollbackImprovement | `proto/loom/v1/learning.proto:36`; `RollbackImprovementRequest` → `RollbackImprovementResponse` | None | `pkg/server/learning_service.go:62` |
| LearningAgentService.GetImprovementHistory | `proto/loom/v1/learning.proto:39`; `GetImprovementHistoryRequest` → `ImprovementHistoryResponse` | None | `pkg/server/learning_service.go:70` |
| LearningAgentService.StreamPatternMetrics | `proto/loom/v1/learning.proto:42`; `StreamPatternMetricsRequest` → `stream PatternMetricEvent` | None | `pkg/server/learning_service.go:79` |
| LearningAgentService.TunePatterns | `proto/loom/v1/learning.proto:45`; `TunePatternsRequest` → `TunePatternsResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| LLMSchedulerService.GetSlotState | `proto/loom/v1/llm_scheduler.proto:202`; `GetSlotStateRequest` → `GetSlotStateResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| LLMSchedulerService.ListWaiters | `proto/loom/v1/llm_scheduler.proto:205`; `ListWaitersRequest` → `ListWaitersResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| LLMSchedulerService.SetSchedulerConfig | `proto/loom/v1/llm_scheduler.proto:208`; `SetSchedulerConfigRequest` → `SetSchedulerConfigResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| LoomService.Weave | `proto/loom/v1/loom.proto:41`; `WeaveRequest` → `WeaveResponse` | POST `/v1/weave` | `pkg/server/server.go:133`<br>`pkg/server/multi_agent.go:998` |
| LoomService.StreamWeave | `proto/loom/v1/loom.proto:49`; `WeaveRequest` → `stream WeaveProgress` | POST `/v1/weave:stream` | `pkg/server/server.go:217`<br>`pkg/server/multi_agent.go:1216` |
| LoomService.LoadPatterns | `proto/loom/v1/loom.proto:57`; `LoadPatternsRequest` → `LoadPatternsResponse` | POST `/v1/patterns:load` | `pkg/server/pattern_rpc.go:26`<br>`pkg/server/server.go:667` |
| LoomService.ListPatterns | `proto/loom/v1/loom.proto:65`; `ListPatternsRequest` → `ListPatternsResponse` | GET `/v1/patterns` | `pkg/server/pattern_rpc.go:202`<br>`pkg/server/server.go:672` |
| LoomService.GetPattern | `proto/loom/v1/loom.proto:70`; `GetPatternRequest` → `Pattern` | GET `/v1/patterns/{name}` | `pkg/server/pattern_rpc.go:282`<br>`pkg/server/server.go:677` |
| LoomService.CreatePattern | `proto/loom/v1/loom.proto:75`; `CreatePatternRequest` → `CreatePatternResponse` | POST `/v1/patterns` | `pkg/server/multi_agent.go:2904` |
| LoomService.StreamPatternUpdates | `proto/loom/v1/loom.proto:84`; `StreamPatternUpdatesRequest` → `stream PatternUpdateEvent` | GET `/v1/patterns:stream` | `pkg/server/multi_agent.go:2990` |
| LoomService.AnswerClarificationQuestion | `proto/loom/v1/loom.proto:92`; `AnswerClarificationRequest` → `AnswerClarificationResponse` | POST `/v1/clarifications/{session_id}/answer` | `pkg/server/multi_agent.go:3836` |
| LoomService.CreateSession | `proto/loom/v1/loom.proto:100`; `CreateSessionRequest` → `Session` | POST `/v1/sessions` | `pkg/server/server.go:519`<br>`pkg/server/multi_agent.go:3285` |
| LoomService.GetSession | `proto/loom/v1/loom.proto:108`; `GetSessionRequest` → `Session` | GET `/v1/sessions/{session_id}` | `pkg/server/server.go:529`<br>`pkg/server/multi_agent.go:3307` |
| LoomService.ListSessions | `proto/loom/v1/loom.proto:113`; `ListSessionsRequest` → `ListSessionsResponse` | GET `/v1/sessions` | `pkg/server/server.go:543`<br>`pkg/server/multi_agent.go:3334` |
| LoomService.DeleteSession | `proto/loom/v1/loom.proto:118`; `DeleteSessionRequest` → `DeleteSessionResponse` | DELETE `/v1/sessions/{session_id}` | `pkg/server/server.go:567`<br>`pkg/server/multi_agent.go:3373` |
| LoomService.ResumeSession | `proto/loom/v1/loom.proto:128`; `ResumeSessionRequest` → `ResumeSessionResponse` | POST `/v1/sessions/{session_id}:resume` | `pkg/server/session_resume.go:40` |
| LoomService.ResolveExecutionGap | `proto/loom/v1/loom.proto:144`; `ResolveExecutionGapRequest` → `ResolveExecutionGapResponse` | POST `/v1/sessions/{session_id}:resolveExecutionGap` | `pkg/server/session_resume.go:126` |
| LoomService.SubscribeToSession | `proto/loom/v1/loom.proto:155`; `SubscribeToSessionRequest` → `stream SessionUpdate` | GET `/v1/sessions/{session_id}:subscribe` | `pkg/server/multi_agent.go:4937` |
| LoomService.GetConversationHistory | `proto/loom/v1/loom.proto:160`; `GetConversationHistoryRequest` → `ConversationHistory` | GET `/v1/sessions/{session_id}/history` | `pkg/server/server.go:612`<br>`pkg/server/multi_agent.go:3446` |
| LoomService.RegisterTool | `proto/loom/v1/loom.proto:165`; `RegisterToolRequest` → `RegisterToolResponse` | POST `/v1/tools:register` | `pkg/server/observability_rpc.go:132`<br>`pkg/server/server.go:662` |
| LoomService.ListTools | `proto/loom/v1/loom.proto:173`; `ListToolsRequest` → `ListToolsResponse` | GET `/v1/tools` | `pkg/server/server.go:642`<br>`pkg/server/multi_agent.go:3490` |
| LoomService.GetTrace | `proto/loom/v1/loom.proto:178`; `GetTraceRequest` → `Trace` | GET `/v1/traces/{trace_id}` | `pkg/server/observability_rpc.go:99`<br>`pkg/server/observability_rpc.go:211`<br>`pkg/server/server.go:682` |
| LoomService.GetHealth | `proto/loom/v1/loom.proto:183`; `GetHealthRequest` → `HealthStatus` | GET `/v1/health` | `pkg/server/server.go:692`<br>`pkg/server/multi_agent.go:3522` |
| LoomService.GetServerConfig | `proto/loom/v1/loom.proto:190`; `GetServerConfigRequest` → `ServerConfig` | GET `/v1/server/config` | `pkg/server/multi_agent.go:3158` |
| LoomService.GetTLSStatus | `proto/loom/v1/loom.proto:195`; `GetTLSStatusRequest` → `TLSStatus` | GET `/v1/server/tls` | `pkg/server/multi_agent.go:3174` |
| LoomService.RenewCertificate | `proto/loom/v1/loom.proto:200`; `RenewCertificateRequest` → `RenewCertificateResponse` | POST `/v1/server/tls:renew` | `pkg/server/multi_agent.go:3195` |
| LoomService.GetStorageStatus | `proto/loom/v1/loom.proto:210`; `GetStorageStatusRequest` → `GetStorageStatusResponse` | GET `/v1/server/storage` | `pkg/server/storage_rpc.go:41` |
| LoomService.RunMigration | `proto/loom/v1/loom.proto:215`; `RunMigrationRequest` → `RunMigrationResponse` | POST `/v1/server/storage:migrate` | `pkg/server/storage_rpc.go:84` |
| LoomService.CreateAgentFromConfig | `proto/loom/v1/loom.proto:225`; `CreateAgentRequest` → `AgentInfo` | POST `/v1/agents` | `pkg/server/agent_lifecycle.go:169` |
| LoomService.ListAgents | `proto/loom/v1/loom.proto:233`; `ListAgentsRequest` → `ListAgentsResponse` | GET `/v1/agents` | `pkg/server/multi_agent.go:967` |
| LoomService.GetAgent | `proto/loom/v1/loom.proto:238`; `GetAgentRequest` → `AgentInfo` | GET `/v1/agents/{agent_id}` | `pkg/server/agent_lifecycle.go:268` |
| LoomService.StartAgent | `proto/loom/v1/loom.proto:243`; `StartAgentRequest` → `AgentInfo` | POST `/v1/agents/{agent_id}:start` | `pkg/server/agent_lifecycle.go:286` |
| LoomService.StopAgent | `proto/loom/v1/loom.proto:251`; `StopAgentRequest` → `AgentInfo` | POST `/v1/agents/{agent_id}:stop` | `pkg/server/agent_lifecycle.go:351` |
| LoomService.DeleteAgent | `proto/loom/v1/loom.proto:259`; `DeleteAgentRequest` → `DeleteAgentResponse` | DELETE `/v1/agents/{agent_id}` | `pkg/server/agent_lifecycle.go:410` |
| LoomService.ReloadAgent | `proto/loom/v1/loom.proto:264`; `ReloadAgentRequest` → `AgentInfo` | POST `/v1/agents/{agent_id}:reload` | `pkg/server/agent_lifecycle.go:482` |
| LoomService.SwitchModel | `proto/loom/v1/loom.proto:272`; `SwitchModelRequest` → `SwitchModelResponse` | POST `/v1/sessions/{session_id}:switch-model` | `pkg/server/server.go:769`<br>`pkg/server/multi_agent.go:3614` |
| LoomService.ListAvailableModels | `proto/loom/v1/loom.proto:280`; `ListAvailableModelsRequest` → `ListAvailableModelsResponse` | GET `/v1/models` | `pkg/server/server.go:1248`<br>`pkg/server/multi_agent.go:3253` |
| LoomService.ListProviders | `proto/loom/v1/loom.proto:285`; `ListProvidersRequest` → `ListProvidersResponse` | GET `/v1/providers` | `pkg/server/server.go:858`<br>`pkg/server/multi_agent.go:3780` |
| LoomService.ABTest | `proto/loom/v1/loom.proto:290`; `ABTestRequest` → `stream ABTestEvent` | POST `/v1/providers:abtest` | `pkg/server/server.go:883`<br>`pkg/server/multi_agent.go:3794` |
| LoomService.RequestToolPermission | `proto/loom/v1/loom.proto:298`; `ToolPermissionRequest` → `ToolPermissionResponse` | POST `/v1/tools:request-permission` | `pkg/server/observability_rpc.go:346`<br>`pkg/server/server.go:1499` |
| LoomService.ListMCPServers | `proto/loom/v1/loom.proto:308`; `ListMCPServersRequest` → `ListMCPServersResponse` | GET `/v1/mcp/servers` | `pkg/server/mcp_management.go:35` |
| LoomService.GetMCPServer | `proto/loom/v1/loom.proto:313`; `GetMCPServerRequest` → `MCPServerInfo` | GET `/v1/mcp/servers/{server_name}` | `pkg/server/mcp_management.go:80` |
| LoomService.AddMCPServer | `proto/loom/v1/loom.proto:318`; `AddMCPServerRequest` → `AddMCPServerResponse` | POST `/v1/mcp/servers` | `pkg/server/mcp_management.go:123` |
| LoomService.UpdateMCPServer | `proto/loom/v1/loom.proto:326`; `UpdateMCPServerRequest` → `MCPServerInfo` | PUT `/v1/mcp/servers/{server_name}` | `pkg/server/mcp_management.go:304` |
| LoomService.DeleteMCPServer | `proto/loom/v1/loom.proto:334`; `DeleteMCPServerRequest` → `DeleteMCPServerResponse` | DELETE `/v1/mcp/servers/{server_name}` | `pkg/server/mcp_management.go:462` |
| LoomService.RestartMCPServer | `proto/loom/v1/loom.proto:339`; `RestartMCPServerRequest` → `MCPServerInfo` | POST `/v1/mcp/servers/{server_name}:restart` | `pkg/server/mcp_management.go:522` |
| LoomService.HealthCheckMCPServers | `proto/loom/v1/loom.proto:347`; `HealthCheckMCPServersRequest` → `HealthCheckMCPServersResponse` | GET `/v1/mcp/servers:health` | `pkg/server/mcp_management.go:575` |
| LoomService.TestMCPServerConnection | `proto/loom/v1/loom.proto:353`; `TestMCPServerConnectionRequest` → `TestMCPServerConnectionResponse` | POST `/v1/mcp/servers:test` | `pkg/server/mcp_management.go:600` |
| LoomService.ListMCPServerTools | `proto/loom/v1/loom.proto:362`; `ListMCPServerToolsRequest` → `ListMCPServerToolsResponse` | GET `/v1/mcp/servers/{server_name}/tools` | `pkg/server/mcp_management.go:744` |
| LoomService.ExecuteWorkflow | `proto/loom/v1/loom.proto:369`; `ExecuteWorkflowRequest` → `ExecuteWorkflowResponse` | POST `/v1/workflows:execute` | `pkg/server/multi_agent.go:4134` |
| LoomService.StreamWorkflow | `proto/loom/v1/loom.proto:377`; `ExecuteWorkflowRequest` → `stream WorkflowProgress` | POST `/v1/workflows:stream` | `pkg/server/multi_agent.go:4262` |
| LoomService.GetWorkflowExecution | `proto/loom/v1/loom.proto:385`; `GetWorkflowExecutionRequest` → `WorkflowExecution` | GET `/v1/workflows/executions/{execution_id}` | `pkg/server/multi_agent.go:4468` |
| LoomService.ListWorkflowExecutions | `proto/loom/v1/loom.proto:390`; `ListWorkflowExecutionsRequest` → `ListWorkflowExecutionsResponse` | GET `/v1/workflows/executions` | `pkg/server/multi_agent.go:4485` |
| LoomService.ListWorkflows | `proto/loom/v1/loom.proto:397`; `ListWorkflowsRequest` → `ListWorkflowsResponse` | GET `/v1/workflows` | `pkg/server/multi_agent.go:4097` |
| LoomService.ScheduleWorkflow | `proto/loom/v1/loom.proto:404`; `ScheduleWorkflowRequest` → `ScheduleWorkflowResponse` | POST `/v1/workflows/schedules` | `pkg/server/multi_agent.go:4556` |
| LoomService.UpdateScheduledWorkflow | `proto/loom/v1/loom.proto:412`; `UpdateScheduledWorkflowRequest` → `ScheduleWorkflowResponse` | PATCH `/v1/workflows/schedules/{schedule_id}` | `pkg/server/multi_agent.go:4608` |
| LoomService.GetScheduledWorkflow | `proto/loom/v1/loom.proto:420`; `GetScheduledWorkflowRequest` → `ScheduledWorkflow` | GET `/v1/workflows/schedules/{schedule_id}` | `pkg/server/multi_agent.go:4655` |
| LoomService.ListScheduledWorkflows | `proto/loom/v1/loom.proto:425`; `ListScheduledWorkflowsRequest` → `ListScheduledWorkflowsResponse` | GET `/v1/workflows/schedules` | `pkg/server/multi_agent.go:4679` |
| LoomService.DeleteScheduledWorkflow | `proto/loom/v1/loom.proto:430`; `DeleteScheduledWorkflowRequest` → `google.protobuf.Empty` | DELETE `/v1/workflows/schedules/{schedule_id}` | `pkg/server/multi_agent.go:4714` |
| LoomService.TriggerScheduledWorkflow | `proto/loom/v1/loom.proto:435`; `TriggerScheduledWorkflowRequest` → `ExecuteWorkflowResponse` | POST `/v1/workflows/schedules/{schedule_id}:trigger` | `pkg/server/multi_agent.go:4748` |
| LoomService.PauseSchedule | `proto/loom/v1/loom.proto:443`; `PauseScheduleRequest` → `google.protobuf.Empty` | POST `/v1/workflows/schedules/{schedule_id}:pause` | `pkg/server/multi_agent.go:4775` |
| LoomService.ResumeSchedule | `proto/loom/v1/loom.proto:451`; `ResumeScheduleRequest` → `google.protobuf.Empty` | POST `/v1/workflows/schedules/{schedule_id}:resume` | `pkg/server/multi_agent.go:4864` |
| LoomService.GetScheduleHistory | `proto/loom/v1/loom.proto:459`; `GetScheduleHistoryRequest` → `GetScheduleHistoryResponse` | GET `/v1/workflows/schedules/{schedule_id}/history` | `pkg/server/multi_agent.go:4887` |
| LoomService.CancelScheduledExecution | `proto/loom/v1/loom.proto:495`; `CancelScheduledExecutionRequest` → `CancelScheduledExecutionResponse` | POST `/v1/workflows/schedules/executions/{execution_id}:cancel` | `pkg/server/multi_agent.go:4810` |
| LoomService.Publish | `proto/loom/v1/loom.proto:507`; `PublishRequest` → `PublishResponse` | POST `/v1/bus/publish` | `pkg/server/communication_handlers.go:93` |
| LoomService.Subscribe | `proto/loom/v1/loom.proto:515`; `SubscribeRequest` → `stream BusMessage` | POST `/v1/bus/subscribe` | `pkg/server/communication_handlers.go:141`<br>`pkg/server/pattern_events.go:32` |
| LoomService.Unsubscribe | `proto/loom/v1/loom.proto:523`; `UnsubscribeRequest` → `UnsubscribeResponse` | POST `/v1/bus/unsubscribe` | `pkg/server/pattern_events.go:42` |
| LoomService.ListTopics | `proto/loom/v1/loom.proto:531`; `ListTopicsRequest` → `ListTopicsResponse` | GET `/v1/bus/topics` | No symbol in pkg/server; implementation elsewhere or unverified |
| LoomService.GetTopicStats | `proto/loom/v1/loom.proto:536`; `GetTopicStatsRequest` → `TopicStats` | GET `/v1/bus/topics/{topic}/stats` | No symbol in pkg/server; implementation elsewhere or unverified |
| LoomService.SendAsync | `proto/loom/v1/loom.proto:543`; `SendAsyncRequest` → `SendAsyncResponse` | POST `/v1/messages:sendAsync` | `pkg/server/communication_handlers.go:371` |
| LoomService.SendAndReceive | `proto/loom/v1/loom.proto:551`; `SendAndReceiveRequest` → `SendAndReceiveResponse` | POST `/v1/messages:sendAndReceive` | `pkg/server/communication_handlers.go:410` |
| LoomService.PutSharedMemory | `proto/loom/v1/loom.proto:561`; `PutSharedMemoryRequest` → `PutSharedMemoryResponse` | PUT `/v1/shared-memory/{namespace}/{key}` | `pkg/server/communication_handlers.go:219` |
| LoomService.GetSharedMemory | `proto/loom/v1/loom.proto:569`; `GetSharedMemoryRequest` → `GetSharedMemoryResponse` | GET `/v1/shared-memory/{namespace}/{key}` | `pkg/server/communication_handlers.go:238` |
| LoomService.DeleteSharedMemory | `proto/loom/v1/loom.proto:574`; `DeleteSharedMemoryRequest` → `DeleteSharedMemoryResponse` | DELETE `/v1/shared-memory/{namespace}/{key}` | `pkg/server/communication_handlers.go:257` |
| LoomService.WatchSharedMemory | `proto/loom/v1/loom.proto:579`; `WatchSharedMemoryRequest` → `stream SharedMemoryValue` | POST `/v1/shared-memory:watch` | `pkg/server/communication_handlers.go:276` |
| LoomService.ListSharedMemoryKeys | `proto/loom/v1/loom.proto:587`; `ListSharedMemoryKeysRequest` → `ListSharedMemoryKeysResponse` | GET `/v1/shared-memory/{namespace}/keys` | `pkg/server/communication_handlers.go:334` |
| LoomService.GetSharedMemoryStats | `proto/loom/v1/loom.proto:592`; `GetSharedMemoryStatsRequest` → `SharedMemoryStats` | GET `/v1/shared-memory/{namespace}/stats` | `pkg/server/communication_handlers.go:353` |
| LoomService.ListArtifacts | `proto/loom/v1/loom.proto:599`; `ListArtifactsRequest` → `ListArtifactsResponse` | GET `/v1/artifacts` | `pkg/server/artifacts.go:27` |
| LoomService.GetArtifact | `proto/loom/v1/loom.proto:604`; `GetArtifactRequest` → `GetArtifactResponse` | GET `/v1/artifacts/{id}` | `pkg/server/artifacts.go:90` |
| LoomService.UploadArtifact | `proto/loom/v1/loom.proto:609`; `UploadArtifactRequest` → `UploadArtifactResponse` | POST `/v1/artifacts` | `pkg/server/artifacts.go:132` |
| LoomService.DeleteArtifact | `proto/loom/v1/loom.proto:617`; `DeleteArtifactRequest` → `DeleteArtifactResponse` | DELETE `/v1/artifacts/{id}` | `pkg/server/artifacts.go:359` |
| LoomService.SearchArtifacts | `proto/loom/v1/loom.proto:622`; `SearchArtifactsRequest` → `SearchArtifactsResponse` | GET `/v1/artifacts:search` | `pkg/server/artifacts.go:378` |
| LoomService.GetArtifactContent | `proto/loom/v1/loom.proto:627`; `GetArtifactContentRequest` → `GetArtifactContentResponse` | GET `/v1/artifacts/{id}/content` | `pkg/server/artifacts.go:410` |
| LoomService.GetArtifactStats | `proto/loom/v1/loom.proto:632`; `GetArtifactStatsRequest` → `GetArtifactStatsResponse` | GET `/v1/artifacts/stats` | `pkg/server/artifacts.go:479` |
| LoomService.ListUIApps | `proto/loom/v1/loom.proto:639`; `ListUIAppsRequest` → `ListUIAppsResponse` | GET `/v1/apps` | `pkg/server/apps_rpc.go:63` |
| LoomService.GetUIApp | `proto/loom/v1/loom.proto:644`; `GetUIAppRequest` → `GetUIAppResponse` | GET `/v1/apps/{name}` | `pkg/server/apps_rpc.go:89` |
| LoomService.CreateUIApp | `proto/loom/v1/loom.proto:649`; `CreateUIAppRequest` → `CreateUIAppResponse` | POST `/v1/apps` | `pkg/server/apps_rpc.go:118` |
| LoomService.UpdateUIApp | `proto/loom/v1/loom.proto:657`; `UpdateUIAppRequest` → `UpdateUIAppResponse` | PUT `/v1/apps/{name}` | `pkg/server/apps_rpc.go:190` |
| LoomService.DeleteUIApp | `proto/loom/v1/loom.proto:665`; `DeleteUIAppRequest` → `DeleteUIAppResponse` | DELETE `/v1/apps/{name}` | `pkg/server/apps_rpc.go:236` |
| LoomService.ListLuaScripts | `proto/loom/v1/loom.proto:673`; `ListLuaScriptsRequest` → `ListLuaScriptsResponse` | GET `/v1/lua-scripts` | `pkg/server/lua_scripts_rpc.go:69` |
| LoomService.GetLuaScript | `proto/loom/v1/loom.proto:678`; `GetLuaScriptRequest` → `GetLuaScriptResponse` | GET `/v1/lua-scripts/{name}` | `pkg/server/lua_scripts_rpc.go:90` |
| LoomService.SaveLuaScript | `proto/loom/v1/loom.proto:683`; `SaveLuaScriptRequest` → `SaveLuaScriptResponse` | POST `/v1/lua-scripts` | `pkg/server/lua_scripts_rpc.go:111` |
| LoomService.DeleteLuaScript | `proto/loom/v1/loom.proto:691`; `DeleteLuaScriptRequest` → `DeleteLuaScriptResponse` | DELETE `/v1/lua-scripts/{name}` | `pkg/server/lua_scripts_rpc.go:137` |
| LoomService.ListComponentTypes | `proto/loom/v1/loom.proto:697`; `ListComponentTypesRequest` → `ListComponentTypesResponse` | GET `/v1/apps/component-types` | `pkg/server/apps_rpc.go:263` |
| LoomService.ListAgentPresets | `proto/loom/v1/loom.proto:706`; `ListAgentPresetsRequest` → `ListAgentPresetsResponse` | GET `/v1/presets/agents` | `pkg/server/template_service.go:24` |
| LoomService.ListWorkflowTemplates | `proto/loom/v1/loom.proto:711`; `ListWorkflowTemplatesRequest` → `ListWorkflowTemplatesResponse` | GET `/v1/templates/workflows` | `pkg/server/template_service.go:32` |
| LoomService.CreateWorkflowFromTemplate | `proto/loom/v1/loom.proto:718`; `CreateWorkflowFromTemplateRequest` → `CreateWorkflowFromTemplateResponse` | POST `/v1/templates/workflows:apply` | `pkg/server/template_service.go:51` |
| AdminService.ListAllSessions | `proto/loom/v1/loom.proto:731`; `ListAllSessionsRequest` → `ListAllSessionsResponse` | GET `/v1/admin/sessions` | `pkg/server/admin_server.go:73` |
| AdminService.CountSessionsByUser | `proto/loom/v1/loom.proto:736`; `CountSessionsByUserRequest` → `CountSessionsByUserResponse` | GET `/v1/admin/sessions:count-by-user` | `pkg/server/admin_server.go:105` |
| AdminService.GetSystemStats | `proto/loom/v1/loom.proto:741`; `GetSystemStatsRequest` → `GetSystemStatsResponse` | GET `/v1/admin/stats` | `pkg/server/admin_server.go:129` |
| MemoryLayerService.GetROMContent | `proto/loom/v1/memory.proto:25`; `GetROMContentRequest` → `GetROMContentResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| MemoryLayerService.GetLearnedLayer | `proto/loom/v1/memory.proto:28`; `GetLearnedLayerRequest` → `GetLearnedLayerResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| MemoryLayerService.UpdateLearnedLayer | `proto/loom/v1/memory.proto:31`; `UpdateLearnedLayerRequest` → `UpdateLearnedLayerResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| MemoryLayerService.GetMemoryStats | `proto/loom/v1/memory.proto:34`; `GetMemoryStatsRequest` → `GetMemoryStatsResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| MemoryLayerService.BootstrapDemonstrations | `proto/loom/v1/memory.proto:37`; `BootstrapDemonstrationsRequest` → `BootstrapDemonstrationsResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| SkillsImportService.BulkImportSkills | `proto/loom/v1/skills_import.proto:52`; `BulkImportSkillsRequest` → `stream BulkImportProgress` | POST `/v1/skills:bulkImport` | `pkg/server/skills_import.go:154` |
| SkillsImportService.AddSkill | `proto/loom/v1/skills_import.proto:72`; `AddSkillRequest` → `AddSkillResponse` | POST `/v1/skills` | `pkg/server/skills_import.go:256` |
| SkillsImportService.ClassifySkill | `proto/loom/v1/skills_import.proto:92`; `ClassifySkillRequest` → `ClassifySkillResponse` | POST `/v1/skills/{skill_name}:classify` | `pkg/server/skills_import.go:319` |
| TaskService.CreateTask | `proto/loom/v1/task.proto:26`; `CreateTaskRequest` → `CreateTaskResponse` | POST `/v1/tasks` | `pkg/server/task_service.go:111` |
| TaskService.GetTask | `proto/loom/v1/task.proto:34`; `GetTaskRequest` → `GetTaskResponse` | GET `/v1/tasks/{task_id}` | `pkg/server/task_service.go:131` |
| TaskService.UpdateTask | `proto/loom/v1/task.proto:39`; `UpdateTaskRequest` → `UpdateTaskResponse` | PATCH `/v1/tasks/{task.id}` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.DeleteTask | `proto/loom/v1/task.proto:47`; `DeleteTaskRequest` → `DeleteTaskResponse` | DELETE `/v1/tasks/{task_id}` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.ListTasks | `proto/loom/v1/task.proto:52`; `ListTasksRequest` → `ListTasksResponse` | GET `/v1/tasks` | `pkg/server/task_service.go:145` |
| TaskService.ClaimTask | `proto/loom/v1/task.proto:60`; `ClaimTaskRequest` → `ClaimTaskResponse` | POST `/v1/tasks/{task_id}:claim` | `pkg/server/task_service.go:167` |
| TaskService.ReleaseTask | `proto/loom/v1/task.proto:68`; `ReleaseTaskRequest` → `ReleaseTaskResponse` | POST `/v1/tasks/{task_id}:release` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.CloseTask | `proto/loom/v1/task.proto:77`; `CloseTaskRequest` → `CloseTaskResponse` | POST `/v1/tasks/{task_id}:close` | `pkg/server/task_service.go:175` |
| TaskService.TransitionTask | `proto/loom/v1/task.proto:85`; `TransitionTaskRequest` → `TransitionTaskResponse` | POST `/v1/tasks/{task_id}:transition` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.AddDependency | `proto/loom/v1/task.proto:96`; `AddTaskDependencyRequest` → `AddTaskDependencyResponse` | POST `/v1/tasks/dependencies` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.RemoveDependency | `proto/loom/v1/task.proto:104`; `RemoveTaskDependencyRequest` → `RemoveTaskDependencyResponse` | DELETE `/v1/tasks/dependencies/{from_task_id}/{to_task_id}` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.GetReadyFront | `proto/loom/v1/task.proto:109`; `GetReadyFrontRequest` → `GetReadyFrontResponse` | GET `/v1/boards/{board_id}/ready` | `pkg/server/task_service.go:183` |
| TaskService.GetBlockedTasks | `proto/loom/v1/task.proto:114`; `GetBlockedTasksRequest` → `GetBlockedTasksResponse` | GET `/v1/boards/{board_id}/blocked` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.CreateBoard | `proto/loom/v1/task.proto:121`; `CreateBoardRequest` → `CreateBoardResponse` | POST `/v1/boards` | `pkg/server/task_service.go:199` |
| TaskService.GetBoard | `proto/loom/v1/task.proto:129`; `GetBoardRequest` → `GetBoardResponse` | GET `/v1/boards/{board_id}` | `pkg/server/task_service.go:211` |
| TaskService.ListBoards | `proto/loom/v1/task.proto:134`; `ListBoardsRequest` → `ListBoardsResponse` | GET `/v1/boards` | `pkg/server/task_service.go:237` |
| TaskService.DecomposeTask | `proto/loom/v1/task.proto:141`; `DecomposeTaskRequest` → `DecomposeTaskResponse` | POST `/v1/tasks:decompose` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.GetTaskContext | `proto/loom/v1/task.proto:152`; `GetTaskContextRequest` → `TaskContext` | GET `/v1/agents/{agent_id}/task-context` | No symbol in pkg/server; implementation elsewhere or unverified |
| TaskService.StreamTaskUpdates | `proto/loom/v1/task.proto:159`; `StreamTaskUpdatesRequest` → `stream TaskUpdate` | GET `/v1/boards/{board_id}/updates:stream` | `pkg/server/task_service.go:61` |
| TeleprompterService.Compile | `proto/loom/v1/teleprompter.proto:36`; `CompileRequest` → `CompileResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| TeleprompterService.GetCompilationHistory | `proto/loom/v1/teleprompter.proto:39`; `GetCompilationHistoryRequest` → `GetCompilationHistoryResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| TeleprompterService.RollbackCompilation | `proto/loom/v1/teleprompter.proto:42`; `RollbackCompilationRequest` → `RollbackCompilationResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| TeleprompterService.CompareCompilations | `proto/loom/v1/teleprompter.proto:45`; `CompareCompilationsRequest` → `CompareCompilationsResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| ToolRegistryService.SearchTools | `proto/loom/v1/tools.proto:25`; `SearchToolsRequest` → `SearchToolsResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| ToolRegistryService.IndexTools | `proto/loom/v1/tools.proto:29`; `IndexToolsRequest` → `IndexToolsResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| ToolRegistryService.ListToolSources | `proto/loom/v1/tools.proto:32`; `ListToolSourcesRequest` → `ListToolSourcesResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| ToolRegistryService.GetIndexedTool | `proto/loom/v1/tools.proto:35`; `GetIndexedToolRequest` → `IndexedTool` | None | No symbol in pkg/server; implementation elsewhere or unverified |
| ToolRegistryService.GetToolsByCapability | `proto/loom/v1/tools.proto:38`; `GetToolsByCapabilityRequest` → `GetToolsByCapabilityResponse` | None | No symbol in pkg/server; implementation elsewhere or unverified |
