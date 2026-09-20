import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectedAccessories,toggleAccessory} from '../public/accessories.js';
test('legacy accessory choices survive and explicit removal takes precedence',()=>{
 assert.deepEqual(selectedAccessories({accessory:4}),[4]);
 assert.deepEqual(selectedAccessories({accessory:4,accessories:[]}),[]);
 assert.deepEqual(selectedAccessories({accessories:[-1,1,2,4,8,10,14,15,16,'3',null]}),[2,4,8,10,14,15]);
});
test('different placements combine, the same placement replaces, and selections toggle off',()=>{
 let a={accessory:1};for(const id of [4,8,10])a=toggleAccessory(a,id);
 assert.deepEqual(selectedAccessories(a),[1,4,8,10]);
 a=toggleAccessory(a,3);assert.deepEqual(selectedAccessories(a),[3,4,8,10]);
 a=toggleAccessory(a,4);assert.deepEqual(selectedAccessories(a),[3,8,10]);
 a=toggleAccessory(a,13);assert.deepEqual(selectedAccessories(a),[3,8,13]);
 a=toggleAccessory(a,0);assert.deepEqual(selectedAccessories(a),[]);assert.equal(a.accessory,0);
});
