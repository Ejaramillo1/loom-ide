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
  if(mode !== 'spatial') await evaluate(`if(innerWidth<1100 && document.querySelector('.scene').dataset.mode==='spatial' && document.getElementById('chat-toggle').getAttribute('aria-expanded')==='true') document.getElementById('chat-toggle').click()`);
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
  await waitFor(`document.querySelector('#chat-panel')?.parentElement?.id === 'spatial-chat-slot' && document.querySelector('#spatial-state-caption')?.textContent.includes('Loom offline')`);
  const initiallyOpen = await evaluate(`document.getElementById('chat-toggle').getAttribute('aria-expanded')==='true'`);
  assert.equal(initiallyOpen,width>=1100,'unexpected default conversation visibility');
  if(!initiallyOpen) await evaluate(`document.getElementById('chat-toggle').click()`);
  await waitFor(`document.getElementById('chat-panel').checkVisibility()`);
  if(name==='reference-light')await evaluate(`document.querySelector('.application-controls').open=true;document.querySelectorAll('.app-menu-trigger')[2].click(); [...document.querySelectorAll('.app-menu-panel button')].find(b=>b.textContent==='White')?.click();document.querySelector('.application-controls').open=false`);
  await new Promise(r=>setTimeout(r,1200));
  const metrics=await evaluate(`(()=>{
    const rect=id=>{const e=document.getElementById(id),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,hidden:!e.checkVisibility()};};
    return {width:innerWidth,height:innerHeight,bodyWidth:document.documentElement.scrollWidth, chatParent:document.getElementById('chat-panel').parentElement.id,
    shortcuts:[...document.querySelectorAll('.orbital-nav button')].map(e=>{const r=e.getBoundingClientRect();return {label:e.textContent,x:r.x,y:r.y,w:r.width,h:r.height}}),
    work:rect('work-list'),chat:rect('chat-panel'),composer:rect('chat-form'),sphere:rect('spatial-frame'),context:rect('inspector-context'),attention:rect('attention-panel'),canvas:document.getElementById('spatial-frame').contentDocument.querySelector('canvas')?.getBoundingClientRect().width};})()`);
  console.log(name,JSON.stringify(metrics),'exceptions',JSON.stringify(errors));
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/${name}.png`,Buffer.from(r.data,'base64')));
  assert.equal(metrics.chatParent,'spatial-chat-slot');
  assert.ok(metrics.bodyWidth<=width+1,'horizontal overflow');
  assert.ok(!metrics.chat.hidden && metrics.chat.h>0,'chat hidden');
  assert.ok(metrics.context.hidden && metrics.context.h===0,'empty context column occupies space');
  assert.ok(await evaluate(`!document.querySelector('.collaboration-panel, .avatar')`),'removed header or collaboration sphere remains');
  assert.ok(metrics.attention.hidden && metrics.attention.h === 0, 'empty Attention panel still occupies space');
  assert.ok(metrics.work.hidden && metrics.work.h === 0, 'Work section still occupies Overview space');
  if(width>=1100) assert.ok(metrics.chat.x>=metrics.sphere.x+metrics.sphere.w,'chat is not to the right of the sphere');
  else assert.ok(metrics.chat.x>=0 && metrics.chat.x+metrics.chat.w<=width,'floating chat extends beyond the screen');
  assert.ok(await evaluate(`!document.querySelector('.workspace-nav, #workspace-navigation-slot')`), 'floating menu remains');
  assert.deepEqual(metrics.shortcuts.map(s=>s.label),['Work','Experiments','Evidence','Agents','Knowledge','Code']);
  for(const shortcut of metrics.shortcuts) assert.ok(shortcut.x>=metrics.sphere.x && shortcut.y>=metrics.sphere.y && shortcut.x+shortcut.w<=metrics.sphere.x+metrics.sphere.w && shortcut.y+shortcut.h<=metrics.sphere.y+metrics.sphere.h,`${shortcut.label} is outside the sphere region`);
  if(width>=700) assert.ok(metrics.composer.y+metrics.composer.h<=height,'composer clipped');
  // Isolated DOM fixture checks intrinsic layout as cumulative reply text grows.
  const chatGrowth = await evaluate(`(()=>{
    const log=document.getElementById('chat-log'),panel=document.getElementById('chat-panel');
    const saved=[...log.childNodes],scroll=log.scrollTop;
    const msg=document.createElement('div'),bubble=document.createElement('div');
    msg.className='chat-msg loom';bubble.className='bubble';msg.append(bubble);log.replaceChildren(msg);
    const measure=()=>panel.getBoundingClientRect().height;
    bubble.textContent='Layout test fixture: short response.';const short=measure();
    bubble.textContent='Layout test fixture. Measuring response growth as text arrives. '.repeat(40);const long=measure();
    bubble.textContent+='Layout test fixture. Measuring a very long response. '.repeat(200);const capped=measure();
    const overflow=log.scrollHeight>log.clientHeight,composer=document.getElementById('chat-form').getBoundingClientRect();
    const sphere=document.getElementById('spatial-frame').getBoundingClientRect();
    log.replaceChildren(...saved);log.scrollTop=scroll;
    return {short,long,capped,overflow,restored:measure(),composerBottom:composer.bottom,sphereHeight:sphere.height};
  })()`);
  assert.ok(chatGrowth.long>chatGrowth.short+20, 'chat does not grow with the response');
  assert.ok(Math.abs(chatGrowth.capped-chatGrowth.long)<1 && chatGrowth.overflow, 'long response does not stay capped and scroll');
  assert.ok(chatGrowth.restored<chatGrowth.long, 'chat did not shrink after restoring the empty conversation');
  assert.ok(chatGrowth.sphereHeight>=260, 'growing chat squeezed out the sphere');
  if(width>=700)assert.ok(chatGrowth.composerBottom<=height,'growing chat clipped the composer');
  await evaluate(`window.originalChat=document.getElementById('chat-panel');document.getElementById('chat-text').value='Unsent smoke-test draft';document.getElementById('chat-text').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('chat-toggle').click()`);
  await waitFor(`!document.getElementById('chat-panel').checkVisibility() && document.getElementById('chat-toggle').getAttribute('aria-expanded')==='false'`);
  const closed = await evaluate(`(()=>{const r=document.getElementById('spatial-frame').getBoundingClientRect();return {sphereWidth:r.width,emptySidebar:!document.getElementById('right-col').checkVisibility()}})()`);
  assert.ok(closed.emptySidebar,'closing chat left an empty sidebar');
  if(width>=1100)assert.ok(closed.sphereWidth>metrics.sphere.w,'closing chat did not return space to the sphere');
  await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/${name}-closed.png`,Buffer.from(r.data,'base64')));
  const attentionVisible=await evaluate(`(()=>{const panel=document.getElementById('attention-panel');panel.hidden=false;const visible=document.getElementById('right-col').checkVisibility();panel.hidden=true;return visible})()`);
  assert.ok(attentionVisible,'attention cannot reveal its column while conversation is closed');
  await evaluate(`document.getElementById('chat-toggle').click()`);
  await waitFor(`document.getElementById('chat-panel').checkVisibility() && document.getElementById('chat-toggle').getAttribute('aria-expanded')==='true'`);
  assert.ok(await evaluate(`window.originalChat===document.getElementById('chat-panel') && document.getElementById('chat-text').value==='Unsent smoke-test draft' && document.activeElement.id==='chat-text'`),'opening chat replaced its content, lost the draft or failed to focus');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert.ok(await evaluate(`!document.getElementById('chat-panel').checkVisibility() && document.activeElement.id==='chat-toggle'`),'Escape did not close chat and return focus');
  await evaluate(`document.getElementById('chat-toggle').click()`);
  if(width<700){await evaluate(`document.getElementById('chat-text').scrollIntoView({block:'center'})`); assert.ok(await evaluate(`(()=>{const r=document.getElementById('chat-form').getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight})()`),'mobile composer unreachable');await command('Page.captureScreenshot',{format:'png',captureBeyondViewport:false}).then(r=>writeFile(`${output}/mobile-chat.png`,Buffer.from(r.data,'base64')));}
  if(width<1100)await evaluate(`document.getElementById('chat-toggle').click()`);
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
  reports.push({name,...metrics,chatGrowth,chatToggle:{initiallyOpen,closed}});
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
