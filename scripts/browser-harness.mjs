// Own every process/profile used by the smoke; never reuse a personal browser.
import { spawn, execFileSync } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export async function startBrowser() {
  execFileSync('npm', ['run', 'build'], { stdio: 'pipe', maxBuffer: 8 * 1024 * 1024 });
  const profile = await mkdtemp(join(tmpdir(), 'loom-babylon-smoke-'));
  const children = [];
  const connections = [];
  const errors = [];
  const close = async () => {
    for (const { ws } of connections) ws.close();
    for (const child of children) {
      if (child.exitCode !== null) continue;
      child.kill('SIGTERM');
      await Promise.race([new Promise(resolve => child.once('exit', resolve)), new Promise(resolve => setTimeout(resolve, 2000))]);
      if (child.exitCode === null) child.kill('SIGKILL');
    }
    await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  };
  const connect = async (url, onEvent = () => {}) => {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    let id = 0;
    const pending = new Map();
    ws.addEventListener('message', ({ data }) => {
      const msg = JSON.parse(data);
      if (!msg.id) return onEvent(msg);
      const request = pending.get(msg.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(msg.id);
      msg.error ? request.reject(new Error(JSON.stringify(msg.error))) : request.resolve(msg.result);
    });
    const command = (method, params = {}) => new Promise((resolve, reject) => {
      const n = ++id;
      const timer = setTimeout(() => { pending.delete(n); reject(new Error(`CDP timed out: ${method}`)); }, 20000);
      pending.set(n, { resolve, reject, timer });
      ws.send(JSON.stringify({ id: n, method, params }));
    });
    connections.push({ ws });
    return { ws, command };
  };
  const waitFor = async fn => {
    for (let i = 0; i < 120; i++) {
      try { if (await fn()) return; } catch { /* the owned process may still be starting */ }
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    throw new Error('Timed out waiting for browser/preview readiness');
  };
  try {
    const server = createServer();
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const port = server.address().port;
    await new Promise(resolve => server.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    const launch = (file, args) => {
      const child = spawn(file, args, { stdio: 'ignore' });
      child.on('error', error => errors.push({ process: error.message }));
      children.push(child);
      return child;
    };
    launch(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort']);
    await waitFor(async () => (await fetch(base, { signal: AbortSignal.timeout(1000) })).ok);
    let chrome;
    for (const file of [process.env.CHROMIUM_BIN, '/snap/chromium/current/usr/lib/chromium-browser/chrome', '/usr/bin/chromium', '/usr/bin/google-chrome', '/snap/bin/chromium'].filter(Boolean)) {
      try { await access(file, constants.X_OK); chrome = file; break; } catch { /* next installed browser */ }
    }
    if (!chrome) throw new Error('Chromium is required for the Babylon smoke (or set CHROMIUM_BIN).');
    launch(chrome, ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank']);
    let debug;
    await waitFor(async () => {
      const lines = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n');
      debug = `http://127.0.0.1:${lines[0]}`;
      return true;
    });
    const info = await (await fetch(`${debug}/json/version`)).json();
    const browser = await connect(info.webSocketDebuggerUrl);
    const { browserContextId } = await browser.command('Target.createBrowserContext');
    const { targetId } = await browser.command('Target.createTarget', { url: 'about:blank', browserContextId });
    const target = (await (await fetch(`${debug}/json/list`)).json()).find(t => t.id === targetId);
    const { command } = await connect(target.webSocketDebuggerUrl, msg => {
      if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
      if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') errors.push({ console: msg.params.args.map(a => a.value || a.description).join(' ') });
    });
    const evaluate = async expression => {
      const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
      if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
      return result.result.value;
    };
    return { base, command, evaluate, errors, close, waitFor: expression => waitFor(() => evaluate(expression)) };
  } catch (error) {
    await close();
    throw error;
  }
}
