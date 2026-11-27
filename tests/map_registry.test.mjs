import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,resolveMap,populationFor,spawnScale} from '../map_registry.js';
test('all nine menu routes resolve to a scene builder',()=>{for(const id of ['sunset','mist','twilight','courtyard','mindbreak','yard','outskirts','demo','swamp']){assert.equal(resolveMap(id),id);assert.ok(MAPS[id].builder);assert.ok(populationFor(id).bots>0&&populationFor(id).monsters>0);}assert.equal(resolveMap('bad'),'demo');});
test('spawn distances scale with compact maps; courtyard has sparse population',()=>{assert.equal(spawnScale(80),1);assert.ok(spawnScale(12.8)<.4);assert.deepEqual(populationFor('courtyard'),{bots:3,monsters:5});});
