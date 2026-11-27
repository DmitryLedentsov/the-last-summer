import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeGraphics,DEFAULT_GRAPHICS} from '../graphics_settings.js';
import {vegetationProfile,densityFor} from '../vegetation_system.js';
test('default medium diorama and independent 52m grass range',()=>{assert.deepEqual(normalizeGraphics(),DEFAULT_GRAPHICS);assert.deepEqual(normalizeGraphics({style:1,quality:1,grassDistance:100}),{style:1,quality:1,grassDistance:80});assert.equal(vegetationProfile(0,52).far,52);assert.equal(vegetationProfile(3,52).far,52);assert.equal(densityFor(0,1,0,52),1);assert.equal(densityFor(55,1,0,52),0);assert.ok(densityFor(38,1,0,52)>0);});
