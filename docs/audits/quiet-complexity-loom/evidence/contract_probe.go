// Audit-only contract checks. Does not start a server or call a model.
package main

import (
 "encoding/json"
 "fmt"
 "strings"
 loomv1 "github.com/teradata-labs/loom/gen/go/loom/v1"
 "google.golang.org/protobuf/encoding/protojson"
)

func main() {
 var camel, snake loomv1.WeaveRequest
 if err := json.NewDecoder(strings.NewReader(`{"query":"audit","sessionId":"audit-session","agentId":"audit-agent","enableTrace":true}`)).Decode(&camel); err != nil { panic(err) }
 if err := json.Unmarshal([]byte(`{"query":"audit","session_id":"audit-session","agent_id":"audit-agent","enable_trace":true}`), &snake); err != nil { panic(err) }
 if camel.SessionId != "" || camel.AgentId != "" || camel.EnableTrace { panic("camelCase unexpectedly preserved") }
 if snake.SessionId != "audit-session" || snake.AgentId != "audit-agent" || !snake.EnableTrace { panic("snake_case not preserved") }
 fmt.Println("PASS: exact custom SSE decoder drops IDE camelCase sessionId, agentId, enableTrace; snake_case preserves all three")
 var bare, wrapped loomv1.CreateAgentRequest
 if err := protojson.Unmarshal([]byte(`{"name":"audit-agent"}`), &bare); err == nil { panic("bare agent config unexpectedly accepted") }
 if err := protojson.Unmarshal([]byte(`{"config":{"name":"audit-agent"}}`), &wrapped); err != nil { panic(err) }
 fmt.Println("PASS: CreateAgentRequest rejects bare config and accepts nested config")
 body, err := protojson.Marshal(&loomv1.AnswerClarificationResponse{Success:true, Accepted:true}); if err != nil { panic(err) }
 var response map[string]any; if err := json.Unmarshal(body, &response); err != nil { panic(err) }
 if _, ok := response["status"]; ok { panic("unexpected status field") }
 fmt.Println("PASS: accepted clarification has success/accepted and no status field")
}
