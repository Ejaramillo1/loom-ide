import assert from 'node:assert/strict';
import { writeFile, mkdir } from 'node:fs/promises';

// Measure screenshots, not uniforms: frozen motion makes pixel comparisons deterministic.
export async function verifySphereStates({ base, command, evaluate, waitFor, errors }, output) {
  await mkdir(`${output}/states`, { recursive: true });
  await command('Emulation.setDeviceMetricsOverride', { width: 640, height: 480, deviceScaleFactor: 1, mobile: false });
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  const states = ['idle', 'listening', 'processing', 'exploring', 'executing', 'attention', 'completed', 'error'];
  const measurements = [];
  for (const theme of ['white', 'dark']) {
    for (const quality of ['High', 'Low']) {
      await command('Page.navigate', { url: `${base}/spatial-player-babylon.html?theme=${theme}` });
      await waitFor(`document.querySelector('#bench-loading')?.hidden`);
      await evaluate(`window.postMessage({type:'loom-quality',tier:'${quality}'},location.origin)`);
      const group = [];
      for (const state of states) {
        await evaluate(`new Promise(resolve => {
          const applied = event => {
            if(event.source !== window || event.data?.type !== 'loom-state' || event.data.state !== '${state}') return;
            window.removeEventListener('message', applied);
            requestAnimationFrame(() => requestAnimationFrame(resolve));
          };
          window.addEventListener('message', applied);
          window.postMessage({type:'loom-state',state:'${state}'},location.origin);
        })`);
        const { data } = await command('Page.captureScreenshot', { format: 'png' });
        const name = `${theme}-${quality}-${state}`;
        await writeFile(`${output}/states/${name}.png`, Buffer.from(data, 'base64'));
        const pixels = await evaluate(`(async()=>{
          const bytes=Uint8Array.from(atob('${data}'),c=>c.charCodeAt(0));
          const bitmap=await createImageBitmap(new Blob([bytes],{type:'image/png'}));
          const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;
          const ctx=c.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
          const rgba=ctx.getImageData(0,0,c.width,c.height).data;
          const center=[0,0,0],rim=[0,0,0];let nc=0,nr=0,clipped=0,total=0,rough=0,edges=0;
          const radius=Math.min(c.width,c.height)*.30;
          for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
            const r=Math.hypot(x-c.width/2,y-c.height/2)/radius;
            if(r>.88)continue;
            const i=(y*c.width+x)*4;total++;
            if(Math.max(...rgba.slice(i,i+3))>=254)clipped++;
            if(r<.25){for(let k=0;k<3;k++)center[k]+=rgba[i+k];nc++;}
            if(r>.60&&r<.85){for(let k=0;k<3;k++)rim[k]+=rgba[i+k];nr++;}
            if(r<.7&&x>0){rough+=Math.abs(rgba[i]-rgba[i-4]);edges++;}
          }
          return {center:center.map(v=>v/nc),rim:rim.map(v=>v/nr),clipped:clipped/total,roughness:rough/edges};
        })()`);
        assert.ok(pixels.clipped < .03, `${name}: pearl is clipped to white`);
        assert.ok(pixels.roughness < 12, `${name}: excessive pixel contrast/aliasing`);
        group.push({ theme, quality, state, ...pixels });
      }
      for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
        const difference = group[i].rim.reduce((sum, v, k) => sum + Math.abs(v - group[j].rim[k]), 0) / 3;
        assert.ok(difference >= 8, `${theme}/${quality}: ${group[i].state} and ${group[j].state} differ by only ${difference.toFixed(2)} RGB units`);
      }
      const color = name => group.find(g => g.state === name).rim;
      assert.ok(color('error')[0] > color('error')[1] + 20, 'error must read red');
      assert.ok(color('completed')[1] > color('completed')[0] + 8, 'completed must read green');
      assert.ok(color('executing')[2] > color('executing')[0] + 20, 'executing must read blue');
      assert.ok(color('attention')[0] > color('attention')[2] + 25, 'attention must read amber');
      measurements.push(...group);
    }
  }
  for (const high of measurements.filter(m => m.quality === 'High')) {
    const low = measurements.find(m => m.theme === high.theme && m.state === high.state && m.quality === 'Low');
    assert.ok(high.rim.every((v, k) => Math.abs(v - low.rim[k]) < 8), `Low quality changes ${high.state} hue`);
  }
  await writeFile(`${output}/state-colors.json`, JSON.stringify(measurements, null, 2) + '\n');

  // Corrupt the real GLSL before compilation in this test context, then retry normally.
  const before = errors.length;
  const { identifier } = await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    if (location.pathname.includes('spatial-player-babylon') && localStorage.getItem('smoke-shader-failure')==='yes') {
      const getContext=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(...args){
        const gl=getContext.apply(this,args);
        if(gl && String(args[0]).startsWith('webgl')){
          const source=gl.shaderSource.bind(gl);
          gl.shaderSource=(shader,text)=>source(shader,text.includes('stateTint')?'invalid GLSL for smoke test':text);
        }
        return gl;
      };
    }
    if (window===window.top) { window.smokeReadyCount=0;window.addEventListener('message',event=>{if(event.data?.type==='loom-spatial-ready')window.smokeReadyCount++;}); }
  ` });
  await command('Page.navigate', { url: base });
  await waitFor(`document.getElementById('spatial-frame')?.contentDocument?.querySelector('#bench-loading')?.hidden`);
  await evaluate(`localStorage.setItem('smoke-shader-failure','yes');window.smokeReadyCount=0;document.getElementById('spatial-load').click()`);
  await waitFor(`!document.getElementById('spatial-load-error').hidden`);
  assert.match(await evaluate(`document.getElementById('spatial-status').textContent`), /shader|compil|render/i);
  assert.equal(await evaluate('window.smokeReadyCount'), 0, 'failed shader announced readiness');
  const expected = errors.splice(before);
  assert.ok(expected.some(e => /shader|compile|GLSL/i.test(JSON.stringify(e))), 'compiler failure was not exercised');
  await evaluate(`localStorage.removeItem('smoke-shader-failure');document.getElementById('spatial-load').click()`);
  await waitFor(`document.getElementById('spatial-frame')?.contentDocument?.querySelector('#bench-loading')?.hidden`);
  assert.ok(await evaluate(`document.getElementById('spatial-load-error').hidden`), 'retry did not recover from shader failure');
  await command('Page.removeScriptToEvaluateOnNewDocument', { identifier });
  await writeFile(`${output}/shader-failure.json`, JSON.stringify({ failedShaderNeverReady: true, retryRecovered: true, expectedCompilerErrors: expected.length }, null, 2) + '\n');
  console.log(`Visual states: ${measurements.length} captures passed; shader failure and retry passed.`);
}
