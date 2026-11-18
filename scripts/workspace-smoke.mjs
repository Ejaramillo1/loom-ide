// Uses Chromium's existing debugging endpoint; no browser automation package.
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const base = process.env.WORKSPACE_URL || 'http://127.0.0.1:4182';
const debug = process.env.CHROME_DEBUG_URL || 'http://127.0.0.1:9238';
const output = 'docs/babylon-migration/evidence/workspace';
await mkdir(output, { recursive: true });
async function connect(url, onEvent = () => {}) {
 const ws = new WebSocket(url);
 await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 let id=0;
 const pending=new Map();
 ws.addEventListener('message',({data})=>{
  const msg=JSON.parse(data);
  if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(msg.error):p.resolve(msg.result);}
  else onEvent(msg);
 });
 return {ws, command:(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));})};
}
const browserInfo = await (await fetch(`${debug}/json/version`)).json();
const browser = await connect(browserInfo.webSocketDebuggerUrl);
const {browserContextId} = await browser.command('Target.createBrowserContext');
const {targetId} = await browser.command('Target.createTarget', {url:'about:blank',browserContextId});
const target = (await (await fetch(`${debug}/json/list`)).json()).find(t=>t.id===targetId);
const errors=[];
const {ws,command} = await connect(target.webSocketDebuggerUrl, msg=>{
 if(msg.method==='Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails);
 if(msg.method==='Runtime.consoleAPICalled' && msg.params.type==='error') errors.push({console:msg.params.args.map(a=>a.value||a.description).join(' ')});
});
const evaluate=async expression=>{const r=await command('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
const waitFor=async(expression)=>{for(let i=0;i<60;i++){if(await evaluate(expression))return;await new Promise(r=>setTimeout(r,250));}throw new Error('Timed out: '+expression);};
try {
 await command('Runtime.enable');
 await command('Network.enable');
 await command('Network.setBlockedURLs', {urls:['*/api/loom/*']});
 await command('Page.enable');
 await command('Page.addScriptToEvaluateOnNewDocument',{source:`if (window === window.top && location.origin === '${base}') { localStorage.setItem('loom:appearance', 'dark'); localStorage.removeItem('loom-ide-tauri:chat-draft'); }`});
 const reports=[];
 for(const [name,width,height] of [['desktop-dark',1366,650],['reference-light',1671,941],['tablet',900,720],['mobile',390,740]]){
  await command('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:base});
  await waitFor(`document.querySelector('#chat-panel')?.parentElement?.id === 'spatial-chat-slot' && document.querySelector('#collaboration-summary')?.textContent.includes('offline')`);
  if(name==='reference-light')await evaluate(`document.querySelector('.application-controls').open=true;document.querySelectorAll('.app-menu-trigger')[2].click(); [...document.querySelectorAll('.app-menu-panel button')].find(b=>b.textContent==='White')?.click();document.querySelector('.application-controls').open=false`);
  await new Promise(r=>setTimeout(r,1200));
  const metrics=await evaluate(`(()=>{
    const rect=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,w:r.width,h:r.height,hidden:e.hidden||s.display==='none'||s.visibility==='hidden'};};
    return {width:innerWidth,height:innerHeight,bodyWidth:document.documentElement.scrollWidth, chatParent:document.getElementById('chat-panel').parentElement.id,
    work:rect('work-list'),chat:rect('chat-panel'),composer:rect('chat-form'),sphere:rect('spatial-frame'),context:rect('inspector-context'),collaboration:rect('collaboration-summary'),attention:rect('attention-list'),nav:(()=>{const e=document.querySelector('.workspace-nav'),r=e.getBoundingClientRect();return {y:r.y,h:r.height,parent:e.parentElement.id,labels:[...e.querySelectorAll('button')].map(b=>b.textContent)}})(),canvas:document.getElementById('spatial-frame').contentDocument.querySelector('canvas')?.getBoundingClientRect().width};})()`);
  console.log(name,JSON.stringify(metrics),'exceptions',JSON.stringify(errors));
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/${name}.png`,Buffer.from(r.data,'base64')));
  assert.equal(metrics.chatParent,'spatial-chat-slot');
  assert.ok(metrics.bodyWidth<=width+1,'horizontal overflow');
  for(const key of ['work','chat','context','collaboration','attention'])assert.ok(!metrics[key].hidden && metrics[key].h>0,key+' hidden');
  assert.equal(metrics.nav.parent,'view-spatial','navigation not in sphere view');
  assert.deepEqual(metrics.nav.labels,['Overview','Code','Experiment','Work','Agents','Knowledge']);
  assert.ok(metrics.nav.y+metrics.nav.h<=height+1,'navigation clipped');
  if(width>=700) assert.ok(metrics.composer.y+metrics.composer.h<=height,'composer clipped');
  if(width>=1100){assert.ok(metrics.chat.x<metrics.sphere.x,'chat is not left');assert.ok(metrics.context.x>metrics.sphere.x,'context is not right');assert.ok(metrics.composer.y+metrics.composer.h<=height,'composer clipped');}
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/${name}.png`,Buffer.from(r.data,'base64')));
  if(width<700){await evaluate(`document.getElementById('chat-text').scrollIntoView({block:'center'})`); assert.ok(await evaluate(`(()=>{const r=document.getElementById('chat-form').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})()`),'mobile composer unreachable');await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/mobile-chat.png`,Buffer.from(r.data,'base64')));}
  // A draft and the actual chat node survive navigation away and back.
  await evaluate(`document.getElementById('chat-text').value='Unsent smoke-test draft'; document.getElementById('chat-text').dispatchEvent(new Event('input',{bubbles:true})); window.originalChat=document.getElementById('chat-panel'); document.querySelector('.workspace-nav [data-workspace-mode="code"]').click()`);
  await waitFor(`document.querySelector('.scene').dataset.mode==='code'`);
  assert.equal(await evaluate(`document.getElementById('chat-panel').parentElement.id`),'right-col');
  await evaluate(`document.querySelector('.workspace-nav [data-workspace-mode="spatial"]').click()`);
  await waitFor(`document.querySelector('.scene').dataset.mode==='spatial'`);
  assert.ok(await evaluate(`window.originalChat===document.getElementById('chat-panel') && document.getElementById('chat-text').value==='Unsent smoke-test draft'`),'draft or chat identity lost');
  // Orbital controls use the same router and remain keyboard-focusable buttons.
  for(const mode of ['work','experiment','agents','knowledge','code']){
   await evaluate(`document.querySelector('.orbital-nav [data-workspace-mode="${mode}"]').click()`);
   assert.equal(await evaluate(`document.querySelector('.scene').dataset.mode`),mode);
   await evaluate(`document.querySelector('.workspace-nav [data-workspace-mode="spatial"]').click()`);
  }
  if(name==='mobile') {
    await evaluate(`document.querySelector('#chat-toggle').click()`);
    assert.equal(await evaluate(`document.activeElement.id`), 'chat-text');
    await evaluate(`document.getElementById('spatial-frame').contentWindow.postMessage({type:'loom-state',state:'attention'}, location.origin)`);
    await evaluate(`document.getElementById('spatial-frame').contentWindow.postMessage({type:'loom-quality',tier:'Low'}, location.origin)`);
    await new Promise(r=>setTimeout(r,100));
    const low = await evaluate(`document.getElementById('spatial-frame').contentDocument.querySelector('canvas').width`);
    await evaluate(`document.getElementById('spatial-frame').contentWindow.postMessage({type:'loom-quality',tier:'High'}, location.origin)`);
    await new Promise(r=>setTimeout(r,100));
    const high = await evaluate(`document.getElementById('spatial-frame').contentDocument.querySelector('canvas').width`);
    assert.ok(high > low, 'quality did not change render resolution');
    await evaluate(`document.getElementById('spatial-frame').contentDocument.querySelector('canvas').dispatchEvent(new Event('webglcontextlost',{cancelable:true}))`);
    await waitFor(`!document.getElementById('spatial-load-error').hidden`);
    await evaluate(`document.getElementById('spatial-load').click()`);
    await waitFor(`document.getElementById('spatial-frame').contentDocument?.querySelector('#bench-loading')?.hidden`);
    assert.ok(await evaluate(`document.getElementById('spatial-load-error').hidden`), 'renderer retry failed');
  }
  reports.push({name,...metrics});
 }
 // Exercise real local Work creation in this disposable profile, not seeded production data.
 await evaluate(`document.querySelector('.workspace-nav [data-workspace-mode="work"]').click()`);
 await evaluate(`document.getElementById('new-work-input').value='Ephemeral browser layout verification';document.getElementById('new-work-form').requestSubmit()`);
 await waitFor(`document.getElementById('objective-title').textContent==='Ephemeral browser layout verification'`);
 await evaluate(`document.querySelector('.workspace-nav [data-workspace-mode="spatial"]').click()`);
 assert.equal(await evaluate(`document.getElementById('chat-scope').textContent`), 'Ephemeral browser layout verification');
 assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), 'selected work makes the header overflow');
 assert.equal(errors.length,0,'browser exceptions');
 await writeFile(`${output}/browser-results.json`,JSON.stringify({base,network:'Loom HTTP calls blocked: disposable offline UI test; no live turns',reports,dynamicWorkHeader:true,qualityAndRecovery:true,exceptions:errors},null,2)+'\n');
 console.log(JSON.stringify({passed:true,viewports:reports.map(r=>r.name),exceptions:errors.length},null,2));
} finally {
 await browser.command('Target.disposeBrowserContext',{browserContextId}).catch(()=>{});
 ws.close();
 browser.ws.close();
}
