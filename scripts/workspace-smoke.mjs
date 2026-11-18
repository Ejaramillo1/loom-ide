// Builds current source, starts its own preview/Chromium, and tests in disposable storage.
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { startBrowser } from './browser-harness.mjs';
import { verifySphereStates } from './sphere-visual-check.mjs';
const output = 'docs/babylon-migration/evidence/workspace';
await mkdir(output, { recursive: true });
const harness = await startBrowser();
const { base, command, evaluate, waitFor, errors } = harness;
const navigateMode = async mode => {
  if(mode === 'spatial') await evaluate(`document.getElementById('overview-sphere').click()`);
  else if(await evaluate(`document.querySelector('.scene').dataset.mode === 'spatial'`)) await evaluate(`document.querySelector('.orbital-nav [data-workspace-mode="${mode}"]:not([data-workspace-section])').click()`);
  else await evaluate(`document.querySelector('.application-controls').open=true; document.querySelectorAll('.app-menu-trigger')[2].click(); [...document.querySelectorAll('.app-menu-panel button')].find(button => button.textContent === '${mode === 'code' ? 'Code' : mode === 'work' ? 'Work' : mode === 'experiment' ? 'Experiment' : mode === 'agents' ? 'Agents' : 'Knowledge'}').click()`);
};
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
    const rect=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,hidden:!e.checkVisibility()};};
    return {width:innerWidth,height:innerHeight,bodyWidth:document.documentElement.scrollWidth, chatParent:document.getElementById('chat-panel').parentElement.id,
    shortcuts:[...document.querySelectorAll('.orbital-nav button')].map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height}}),
    work:rect('work-list'),chat:rect('chat-panel'),composer:rect('chat-form'),sphere:rect('spatial-frame'),context:rect('inspector-context'),collaboration:rect('collaboration-summary'),attention:rect('attention-panel'),canvas:document.getElementById('spatial-frame').contentDocument.querySelector('canvas')?.getBoundingClientRect().width};})()`);
  console.log(name,JSON.stringify(metrics),'exceptions',JSON.stringify(errors));
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/${name}.png`,Buffer.from(r.data,'base64')));
  assert.equal(metrics.chatParent,'spatial-chat-slot');
  assert.ok(metrics.bodyWidth<=width+1,'horizontal overflow');
  for(const key of ['chat','context','collaboration'])assert.ok(!metrics[key].hidden && metrics[key].h>0,key+' hidden');
  assert.ok(metrics.attention.hidden && metrics.attention.h === 0, 'empty Attention panel still occupies space');
  assert.ok(metrics.work.hidden && metrics.work.h === 0, 'Work section still occupies Overview space');
  if(width>=700) assert.equal(metrics.chat.y, metrics.sphere.y, 'chat did not fill the removed Work section');
  else assert.ok(metrics.chat.y >= metrics.sphere.y+metrics.sphere.h && metrics.chat.y <= metrics.sphere.y+metrics.sphere.h+32, 'mobile chat did not fill the removed Work section');
  assert.ok(await evaluate(`!document.querySelector('.workspace-nav, #workspace-navigation-slot')`), 'floating menu remains');
  assert.deepEqual(metrics.shortcuts.map(s=>s.label),['Work','Experiments','Evidence','Agents','Knowledge','Code']);
  for(const shortcut of metrics.shortcuts) assert.ok(shortcut.x>=metrics.sphere.x && shortcut.y>=metrics.sphere.y && shortcut.x+shortcut.w<=metrics.sphere.x+metrics.sphere.w && shortcut.y+shortcut.h<=metrics.sphere.y+metrics.sphere.h,`${shortcut.label} is outside the sphere region`);
  if(width>=700) assert.ok(metrics.composer.y+metrics.composer.h<=height,'composer clipped');
  if(width>=1100){assert.ok(metrics.chat.x<metrics.sphere.x,'chat is not left');assert.ok(metrics.context.x>metrics.sphere.x,'context is not right');assert.ok(metrics.composer.y+metrics.composer.h<=height,'composer clipped');}
  if(width<700){await evaluate(`document.getElementById('chat-text').scrollIntoView({block:'center'})`); assert.ok(await evaluate(`(()=>{const r=document.getElementById('chat-form').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})()`),'mobile composer unreachable');await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/mobile-chat.png`,Buffer.from(r.data,'base64')));}
  // Both pointer picking and keyboard activation of the actual pearl return Overview.
  await evaluate(`window.smokeSphereSelects=0;window.addEventListener('message',e=>{if(e.data?.type==='loom-spatial-select'&&e.data.object==='Overview')window.smokeSphereSelects++});
    const d=document.getElementById('spatial-frame').contentDocument,c=d.querySelector('canvas'),r=c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent('click',{clientX:r.width/2,clientY:r.height/2,bubbles:true}));
    c.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
    c.dispatchEvent(new KeyboardEvent('keydown',{key:' ',bubbles:true}));`);
  await waitFor(`window.smokeSphereSelects===3`);
  // A draft and the actual chat node survive navigation away and back.
  await evaluate(`document.getElementById('chat-text').value='Unsent smoke-test draft'; document.getElementById('chat-text').dispatchEvent(new Event('input',{bubbles:true})); window.originalChat=document.getElementById('chat-panel')`);
  await navigateMode('code');
  await waitFor(`document.querySelector('.scene').dataset.mode==='code'`);
  assert.equal(await evaluate(`document.getElementById('chat-panel').parentElement.id`),'right-col');
  await navigateMode('spatial');
  await waitFor(`document.querySelector('.scene').dataset.mode==='spatial'`);
  assert.ok(await evaluate(`window.originalChat===document.getElementById('chat-panel') && document.getElementById('chat-text').value==='Unsent smoke-test draft'`),'draft or chat identity lost');
  // Restored orbital shortcuts route correctly; the persistent sphere returns home.
  for(const mode of ['work','experiment','agents','knowledge','code']){
   await navigateMode(mode);
   assert.equal(await evaluate(`document.querySelector('.scene').dataset.mode`),mode);
   if(mode==='work') {
    if(width<1100) await evaluate(`document.querySelector('.application-controls').open=true;document.querySelectorAll('.app-menu-trigger')[2].click();[...document.querySelectorAll('.app-menu-panel button')].find(b=>b.textContent==='Work panel').click()`);
    assert.ok(await evaluate(`document.querySelector('.work-panel').checkVisibility()`),'Work catalogue unavailable in Work');
    await evaluate(`document.querySelector('.intent-disclosure').open=true`);
    assert.ok(await evaluate(`document.querySelector('#intent-header').checkVisibility()`),'Intent/autonomy unavailable in Work');
    await evaluate(`document.querySelector('.intent-disclosure').open=false`);
   }
   await navigateMode('spatial');
  }
  await evaluate(`document.querySelector('.orbital-nav [data-workspace-section="evidence"]').click()`);
  assert.equal(await evaluate(`document.querySelector('.scene').dataset.mode`),'knowledge');
  assert.ok(await evaluate(`document.querySelector('[data-tab="evidence"]').getAttribute('aria-pressed') === 'true'`),'Evidence shortcut did not open evidence');
  await navigateMode('spatial');
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
 await navigateMode('work');
 await evaluate(`document.getElementById('new-work-input').value='Ephemeral browser layout verification';document.getElementById('new-work-form').requestSubmit()`);
 await waitFor(`document.getElementById('objective-title').textContent==='Ephemeral browser layout verification'`);
 await navigateMode('spatial');
 assert.equal(await evaluate(`document.getElementById('chat-scope').textContent`), 'Ephemeral browser layout verification');
 assert.ok(await evaluate(`document.documentElement.scrollWidth<=innerWidth`), 'selected work makes the header overflow');
 await verifySphereStates(harness, output);
 assert.equal(errors.length,0,'unexpected browser exceptions');
 await writeFile(`${output}/browser-results.json`,JSON.stringify({base,network:'Loom HTTP calls blocked: disposable offline UI test; no live turns',reports,dynamicWorkHeader:true,qualityAndRecovery:true,exceptions:errors},null,2)+'\n');
 console.log(JSON.stringify({passed:true,viewports:reports.map(r=>r.name),exceptions:errors.length},null,2));
 } finally { await harness.close(); }
