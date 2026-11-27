import test from 'node:test';
import assert from 'node:assert/strict';
import {flashFrame,FLASH_LIFE} from '../styled_vfx.js';
test('new flash gets a full rendered frame even after a slow frame',()=>{assert.equal(flashFrame(-1,.1),0);assert.ok(flashFrame(0,1/30)<FLASH_LIFE);assert.ok(flashFrame(0,.3)>FLASH_LIFE);});
