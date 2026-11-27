import test from 'node:test';
import assert from 'node:assert/strict';
import {flashFrame,FLASH_LIFE,BLOOD_LIFE,FLASH_SCALE} from '../styled_vfx.js';
test('new flash gets a full rendered frame even after a slow frame',()=>{assert.equal(flashFrame(-1,.1),0);assert.ok(flashFrame(0,1/30)<FLASH_LIFE);assert.ok(flashFrame(0,.4)>FLASH_LIFE);});

test('flash and compact blood burst last longer without changing combat timing',()=>{assert.equal(FLASH_LIFE,.34);assert.equal(BLOOD_LIFE,1.20);assert.equal(FLASH_SCALE,1.34);});
