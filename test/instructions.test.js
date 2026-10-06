const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getDocsnanInstructions, getFallbackInstructions } = require('../hooks/docsnan-instructions');

test('injeksi pendek, imperatif, tak terkubur', () => {
  const text = getDocsnanInstructions('on');
  assert.match(text, /DOCSNAN MODE ACTIVE/);
  assert.match(text, /MANDATORY FINAL STEP/);
  assert.match(text, /MUST/);
  assert.match(text, /INCOMPLETE/);
  assert.match(text, /mkdir -p docs/);
  assert.match(text, /HHmmss-<slug>/);
  assert.match(text, /Skip ONLY/);
  assert.ok(text.length < 1500, `injeksi harus pendek, dapat ${text.length}`);
});

test('mode off diam', () => {
  assert.equal(getDocsnanInstructions('off'), '');
  assert.equal(getDocsnanInstructions(' off '), '');
});

test('fallback juga imperatif', () => {
  const text = getFallbackInstructions();
  assert.match(text, /MANDATORY FINAL STEP/);
  assert.match(text, /INCOMPLETE/);
});
