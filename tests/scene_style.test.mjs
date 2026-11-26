import assert from 'node:assert/strict';
import {materialRole} from '../scene_style.js';
assert.equal(materialRole({map:{name:'wood'}}),'bark');
assert.equal(materialRole({map:{name:'stone'}}),'rock');
assert.equal(materialRole({map:{},alphaTest:.4},'grass'),'leaf');
assert.equal(materialRole({map:{},alphaTest:.4},'lavender'),'detail');
assert.equal(materialRole({map:{name:'character'}}),'detail');
assert.equal(materialRole({}),'plain');
console.log('PASS material classification');
