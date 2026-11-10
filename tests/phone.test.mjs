import test from 'node:test';
import assert from 'node:assert/strict';
import {formatCheckoutPhone,formatPhone} from '../src/phone.ts';
test('phone formats partial input, complete numbers, pasted country prefix, and clearing',()=>{
 for(const [input,expected] of [['',''],['555','555'],['5551','(555) 1'],['555123','(555) 123'],['5551234567','(555) 123-4567'],['+1 (555) 123-4567','(555) 123-4567']])assert.equal(formatPhone(input),expected);
});

test('checkout masks domestic numbers and preserves explicit international input', () => {
 assert.equal(formatCheckoutPhone('5551234567'), '(555) 123-4567');
 assert.equal(formatCheckoutPhone('+1 555 123 4567'), '(555) 123-4567');
 assert.equal(formatCheckoutPhone('+1'), '+1');
 assert.equal(formatCheckoutPhone('+44 20 7946 0958'), '+44 20 7946 0958');
});
