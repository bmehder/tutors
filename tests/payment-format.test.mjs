import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCard,formatExpiry,formatSecurityCode} from '../src/payment-format.ts';
test('card formatting handles typing, pasted formatting, clearing, and limits',()=>{
 assert.equal(formatCard('42424'),'4242 4');
 assert.equal(formatCard('4242-4242-4242-4242'),'4242 4242 4242 4242');
 assert.equal(formatCard('424242424242424299'),'4242 4242 4242 4242');
 assert.equal(formatCard(''),'');
});
test('expiry formats partial and pasted input without trailing separators',()=>{
 assert.equal(formatExpiry('1'),'1');assert.equal(formatExpiry('12'),'12');
 assert.equal(formatExpiry('123'),'12 / 3');assert.equal(formatExpiry('12/30'),'12 / 30');
 assert.equal(formatExpiry('12 / '),'12');assert.equal(formatExpiry(''),'');
});
test('security code accepts only three digits',()=>{
 assert.equal(formatSecurityCode('a1b234'),'123');assert.equal(formatSecurityCode(''),'');
});
