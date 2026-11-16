// Session-reuse probe: proves the snake_case session_id contract on
// POST /v1/weave:stream reuses the SAME session across two turns (QC-03),
// against the live server. Turn 1 (no session) auto-creates; turn 2 sends
// the returned session_id and must increment conversationCount on the same
// session rather than creating a new one.
import net from "node:net";

const HOST = process.env.LOOM_HOST || "127.0.0.1";
const PORT = Number(process.env.LOOM_PORT || 5006);
const addr = `${HOST}:${PORT}`;

async function streamTurn(query, sessionId) {
  const body = JSON.stringify(
    sessionId
      ? { query, session_id: sessionId, enable_trace: true }
      : { query, enable_trace: true },
  );
  const request =
    `POST /v1/weave:stream HTTP/1.1\r\n` +
    `Host: ${addr}\r\n` +
    `X-Loom-Slot-Origin: interactive\r\n` +
    `Content-Type: application/json\r\n` +
    `Accept: text/event-stream\r\n` +
    `Content-Length: ${Buffer.byteLength(body)}\r\n` +
    `Connection: close\r\n\r\n` +
    body;
  return new Promise((resolve, reject) => {
    const socket = net.connect(PORT, HOST);
    let raw = Buffer.alloc(0);
    socket.on("connect", () => socket.write(request));
    socket.on("data", (c) => (raw = Buffer.concat([raw, c])));
    socket.on("end", () => {
      const headEnd = raw.indexOf("\r\n\r\n");
      const head = raw.subarray(0, headEnd).toString("utf8");
      let payload = raw.subarray(headEnd + 4);
      if (/transfer-encoding:\s*chunked/i.test(head)) {
        const out = [];
        let i = 0;
        while (i < payload.length) {
          const e = payload.indexOf("\r\n", i);
          if (e < 0) break;
          const sz = parseInt(payload.subarray(i, e).toString("utf8").split(";")[0].trim(), 16);
          i = e + 2;
          if (sz === 0) break;
          out.push(payload.subarray(i, i + sz));
          i += sz + 2;
        }
        payload = Buffer.concat(out);
      }
      const text = payload.toString("utf8");
      const completions = text
        .split(/\r?\n/)
        .filter((l) => l.startsWith("data:"))
        .map((l) => {
          try { return JSON.parse(l.slice(5).trim()); } catch { return null; }
        })
        .filter(Boolean);
      resolve({ status: head.split(" ")[1], completions });
    });
    socket.on("error", reject);
  });
}

async function getSessions() {
  const res = await fetch(`http://${addr}/v1/sessions?limit=500`);
  return res.json();
}

const before = await getSessions();
const t1 = await streamTurn("Reply with exactly: alpha");
const t1Done = t1.completions.find((c) => c.stage === 7);

// Find the session created by turn 1 (the newest one).
const afterT1 = await getSessions();
const created = afterT1.sessions
  .filter((s) => !before.sessions.some((b) => b.id === s.id))
  .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];

const t2 = await streamTurn("Reply with exactly: beta", created.id);
const t2Done = t2.completions.find((c) => c.stage === 7);

const afterT2 = await getSessions();
const sameSession = afterT2.sessions.find((s) => s.id === created.id);
const totalSessions = afterT2.totalCount;

console.log(JSON.stringify({
  turn1: { status: t1.status, completed: !!t1Done, answer: t1Done?.partial_content },
  createdSession: { id: created?.id, agentId: created?.agentId, conversationCountAfterT1: afterT1.sessions.find((s) => s.id === created?.id)?.conversationCount },
  turn2: { status: t2.status, completed: !!t2Done, answer: t2Done?.partial_content },
  afterTurn2: {
    sameSessionConversationCount: sameSession?.conversationCount,
    totalSessions,
    reusedSameSession: totalSessions === 1 && sameSession?.id === created?.id,
  },
}, null, 2));
