#!/usr/bin/env node
// docsnan — command router (pure, no deps).
// Distinguishes: bare, on, off, update, version. No ambiguous behavior.

const { normalizeMode } = require('./docsnan-config');

function routeCommand(rawArgs) {
  const arg = String(rawArgs || '').trim().toLowerCase();
  if (arg === '') return { action: 'status' };
  if (normalizeMode(arg)) return { action: 'mode', mode: normalizeMode(arg) };
  if (arg === 'update') return { action: 'update' };
  if (arg === 'version' || arg === '-v' || arg === '--version') return { action: 'version' };
  return { action: 'unknown', arg: String(rawArgs || '').trim() };
}

module.exports = { routeCommand };
