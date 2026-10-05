const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'docsnan-v2-'));
process.env.XDG_CONFIG_HOME = tmp;

async function loadPlugin() {
  return (await import('../.opencode/plugins/docsnan.mjs')).default;
}

function mockCtx() {
  const skills = [];
  const commands = [];
  const hooks = {};
  const prompts = [];
  return {
    skills, commands, hooks, prompts,
    skill: { transform: async (cb) => cb({ add: (s) => skills.push(s) }) },
    command: { transform: async (cb) => cb({ add: (c) => commands.push(c) }) },
    session: {
      hook: async (kind, cb) => { hooks[kind] = cb; },
      prompt: async (p) => { prompts.push(p); return p; },
    },
  };
}

test('plugin exposes V2 id+setup and V1 server', async () => {
  const plugin = await loadPlugin();
  assert.equal(plugin.id, 'docsnan');
  assert.equal(typeof plugin.setup, 'function');
  assert.equal(typeof plugin.server, 'function');
});

test('setup registers skill, command, context hook', async () => {
  const plugin = await loadPlugin();
  const ctx = mockCtx();
  await plugin.setup(ctx);
  assert.ok(ctx.skills.some((s) => s.id === 'docsnan'));
  assert.ok(ctx.commands.some((c) => c.name === 'docsnan'));
  assert.equal(typeof ctx.hooks.context, 'function');
});

test('/docsnan off persists off, status keeps mode', async () => {
  const plugin = await loadPlugin();
  const ctx = mockCtx();
  await plugin.setup(ctx);
  const cmd = ctx.commands.find((c) => c.name === 'docsnan');
  const flag = path.join(tmp, 'opencode', '.docsnan-active');
  await cmd.execute({ sessionID: 's', prompt: { text: 'off' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(flag, 'utf8'), 'off');
  await cmd.execute({ sessionID: 's', prompt: { text: '' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(flag, 'utf8'), 'off');
  await cmd.execute({ sessionID: 's', prompt: { text: 'on' }, delivery: 'steer' });
  assert.equal(fs.readFileSync(flag, 'utf8'), 'on');
});

test('V1 server() keeps config/system/command hooks', async () => {
  const plugin = await loadPlugin();
  const hooks = await plugin.server({});
  assert.equal(typeof hooks.config, 'function');
  assert.equal(typeof hooks['experimental.chat.system.transform'], 'function');
  assert.equal(typeof hooks['command.execute.before'], 'function');
});
test('context hook injects when on, silent when off', async () => {
  const plugin = await loadPlugin();
  const ctx = mockCtx();
  await plugin.setup(ctx);
  const flag = path.join(tmp, 'opencode', '.docsnan-active');
  fs.mkdirSync(path.dirname(flag), { recursive: true });
  fs.writeFileSync(flag, 'on');
  const ev1 = { system: [] };
  await ctx.hooks.context(ev1);
  assert.equal(ev1.system.length, 1);
  assert.match(ev1.system[0].text, /DOCSNAN MODE ACTIVE/);
  fs.writeFileSync(flag, 'off');
  const ev2 = { system: [] };
  await ctx.hooks.context(ev2);
  assert.equal(ev2.system.length, 0);
});
