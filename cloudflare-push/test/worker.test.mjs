import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../src/index.js';
test('health reports unconfigured rather than falsely claiming readiness',async()=>{
 const r=await worker.fetch(new Request('https://demo.invalid/health'),{});
 assert.equal(r.status,200);assert.equal((await r.json()).configured,false);
});
test('CORS permits only actual scanner origin',async()=>{
 const ok=await worker.fetch(new Request('https://demo.invalid/v1/subscribe',{method:'OPTIONS',headers:{Origin:'https://rayanuae4-sudo.github.io'}}),{});
 assert.equal(ok.status,204);assert.equal(ok.headers.get('access-control-allow-origin'),'https://rayanuae4-sudo.github.io');
 const bad=await worker.fetch(new Request('https://demo.invalid/v1/subscribe',{method:'OPTIONS',headers:{Origin:'https://evil.example'}}),{});
 assert.equal(bad.status,403);
});
test('no credentials means no usable API',async()=>{
 const r=await worker.fetch(new Request('https://demo.invalid/v1/subscribe',{method:'POST',headers:{Origin:'https://rayanuae4-sudo.github.io'},body:'{}'}),{});
 assert.equal(r.status,503);assert.equal((await r.json()).error,'SERVER_NOT_CONFIGURED');
});
