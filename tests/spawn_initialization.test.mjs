import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../survival_combat.js',import.meta.url),'utf8');
test('initial bot spawn falls back to global sampling and failed actors stay hidden',()=>{
 assert.match(source,/initial&&a.kind==='bot'&&i<80/);
 assert.match(source,/if\(!p\)\{a.alive=false;a.root.visible=false;a.respawn=1;return false;/);
 assert.match(source,/if\(a.alive&&a.kind!=='monster'\)a.poseGun/);
});
