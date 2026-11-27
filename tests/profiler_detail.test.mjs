import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfiler} from '../duel_perf.js';
test('checkbox keeps its DOM and detailed FPS reports vegetation and shadow stats',()=>{
 const handlers={},output={textContent:''},check={checked:false,parentElement:{addEventListener(){}},addEventListener(n,fn){handlers[n]=fn;}},el={hidden:true,querySelector(s){return s==='#perftext'?output:check;}};
 const p=createProfiler({getContext:()=>({getExtension:()=>null}),info:{render:{calls:300,triangles:100000}}},el);
 p.toggle();assert.equal(el.hidden,false);check.checked=true;handlers.change();assert.equal(p.detailed,true);
 const data={steps:3,sim:10,player:2,botAI:1,botMove:3,monster:2,respawn:0,fx:1,actors:7,corpses:2,bullets:1,colliders:70,map:'test',view:1,graphics:{prep:1,sceneMs:10,postMs:2,sceneCalls:285,postCalls:15,sceneTriangles:99970,shadowMs:3,shadowCalls:70,shadowTriangles:20000,width:800,height:450,vegetation:{active:1200,total:40000,activeChunks:20,chunks:400,activeMeshes:20},shadow:{radius:36,resolution:1024}},staticBatchStats:{saved:50}};
 for(let i=0;i<6;i++)p.sample(.11,12,13,'MEDIUM',data);
 assert.ok(output.textContent.includes('GRASS 1,200/40,000'));assert.ok(output.textContent.includes('SHADOW CPU 3.0 ms | DRAW 70'));assert.ok(output.textContent.includes('GPU n/a'));assert.equal(check.checked,true);
 p.toggleDetail();assert.equal(check.checked,false);assert.equal(p.detailed,false);
});
test('GPU timer uses WebGL query result enum, not the extension object',()=>{
 const ext={TIME_ELAPSED_EXT:1,GPU_DISJOINT_EXT:2},gl={QUERY_RESULT_AVAILABLE:3,QUERY_RESULT:4,getExtension:()=>ext,createQuery:()=>({}),beginQuery(){},endQuery(){},deleteQuery(){},getParameter:()=>false,getQueryParameter(q,p){if(p===3)return true;assert.equal(p,4);return 2000000;}};
 const output={textContent:''},el={hidden:true,querySelector:s=>s==='#perftext'?output:null};
 const p=createProfiler({getContext:()=>gl,info:{render:{calls:1,triangles:2}}},el);p.toggle();p.beforeRender();p.afterRender();p.beforeRender();p.afterRender();p.sample(.7,1,1,'LOW');assert.ok(output.textContent.includes('GPU 2.0 ms'));
});
