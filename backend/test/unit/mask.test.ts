import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskName, maskPhone, maskIdCard, maskUser } from '../../src/common/mask';

test('maskName 保留首字，其余打码', () => {
  assert.equal(maskName('陈某某'), '陈**');
  assert.equal(maskName('张'), '张'); // 单字不打码
  assert.equal(maskName(''), '');
  assert.equal(maskName(null), '');
});

test('maskPhone 保留前3后4', () => {
  assert.equal(maskPhone('13800009999'), '138****9999');
  assert.equal(maskPhone('138-0000-9999'), '138****9999'); // 去除非数字
  assert.equal(maskPhone('123'), '123'); // 太短原样返回
  assert.equal(maskPhone(null), '');
});

test('maskIdCard 保留前4后4', () => {
  assert.equal(maskIdCard('44010019900101XXXX'), '4401**********XXXX');
  assert.equal(maskIdCard('1234567'), '1234567'); // <8 原样
  assert.equal(maskIdCard(''), '');
});

test('maskUser 微金号掩码 首*****尾', () => {
  assert.equal(maskUser('100886699'), '1*****9');
  assert.equal(maskUser('ab'), 'a*'); // 长度<=2
  assert.equal(maskUser('j'), 'j*');
  assert.equal(maskUser(null), '');
});
