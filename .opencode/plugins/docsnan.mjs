// docsnan — OpenCode plugin (dual API, satu file).
//
// - V2 (opencode 2.x): pakai `id` + `setup` — daftar skill/command via
//   transform, injeksi SKILL.md via `ctx.session.hook('context')`.
// - V1 (opencode 1.x): pakai `server()` — `config` hook,
//   `experimental.chat.system.transform`, `command.execute.before`.
// - Persist `/docsnan on|off` di `<config>/opencode/.docsnan-active`,
//   dibaca kedua API bila mode sama.
//
// Pakai di opencode.json (V2):
//   { "plugins": ["docsnan"] }                       (dari npm)
//   { "plugins": ["/abs/path/docsnan-checkout"] }     (dari checkout, dir bukan file)

import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const require = createRequire(import.meta.url);
const { getDocsnanInstructions } = require('../../hooks/docsnan-instructions');
const { getDefaultMode, normalizePersistedMode } = require('../../hooks/docsnan-config');
const { routeCommand } = require('../../hooks/docsnan-command');
const { getInstalledVersion, checkUpdate, performUpdate } = require('../../hooks/docsnan-update');

// ponytail: simpan state beside opencode config, sama seperti .ponytail-active.
const statePath = path.join(
  process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'),
  'opencode',
  '.docsnan-active',
);

function readMode() {
  try {
    return normalizePersistedMode(fs.readFileSync(statePath, 'utf8').trim()) || getDefaultMode();
  } catch (e) {
    return getDefaultMode();
  }
}

function writeMode(mode) {
  fs.mkdirSync(path.dirname(statePath), { recursive: true });
  fs.writeFileSync(statePath, mode);
}

export function parseCommandFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  const description = match[1].match(/description:\s*(.+)/)?.[1]?.trim();
  return { description, template: match[2].trim() };
}

// Frontmatter flat + block scalar (`>`/`|`) — bentuk yang dipakai SKILL.md.
function frontmatterField(frontmatter, key) {
  const lines = frontmatter.split(/\r?\n/);
  const at = lines.findIndex((line) => line.startsWith(key + ':'));
  if (at === -1) return undefined;
  const value = lines[at].slice(key.length + 1).trim();
  if (value[0] !== '>' && value[0] !== '|') return value;
  const block = [];
  for (const line of lines.slice(at + 1)) {
    if (line.trim() && !/^\s/.test(line)) break;
    block.push(line.trim());
  }
  while (block.length && !block[block.length - 1]) block.pop();
  const joined = block.join(value[0] === '|' ? '\n' : ' ');
  return value.endsWith('-') ? joined : joined + '\n';
}

function readSkill() {
  const file = path.resolve(__dirname, '../../skills/docsnan/SKILL.md');
  try {
    const content = fs.readFileSync(file, 'utf8');
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---[^\S\n]*\r?\n?([\s\S]*)$/);
    if (!match) return null;
    return {
      id: 'docsnan',
      name: frontmatterField(match[1], 'name') || 'docsnan',
      description:
        frontmatterField(match[1], 'description') ||
        'Wajibkan 1 tugas = 1 file docs/YYYYMMDD/HHmmss-<slug>.log.',
      path: file,
      content: match[2],
    };
  } catch (e) {
    return null;
  }
}

function readCommands() {
  const dir = path.join(__dirname, '..', 'command');
  try {
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith('.md'))
      .map((file) => {
        const parsed = parseCommandFile(path.join(dir, file));
        return parsed && { name: path.basename(file, '.md'), ...parsed };
      })
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

function versionTag() {
  return `(docsnan ${readMode()} v${getInstalledVersion() || '?'})`;
}

// V1: implementasi lama, tak diubah. V2: baca `setup` di export bawah.
async function server({ client } = {}) {
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'docsnan', level, message } }); } catch (e) {}
  };

  const skillsDir = path.resolve(__dirname, '../../skills');

  return {
    config: async (config) => {
      if (!config.command) config.command = {};
      for (const command of readCommands()) {
        config.command[command.name] = { description: command.description, template: command.template };
      }

      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(skillsDir)) {
        config.skills.paths.push(skillsDir);
      }
    },

    'experimental.chat.system.transform': async (_input, output) => {
      const mode = readMode();
      if (mode === 'off') return;
      output.system.push(getDocsnanInstructions(mode));
    },

    // ponytail: mode berlaku mulai pesan berikut, bukan pesan ini.
    // routeCommand bedakan: bare/on/off/update/version tanpa ambigu.
    // Bare = lapor status, bukan ubah mode. update/version tak ubah mode.
    'command.execute.before': async (input) => {
      if (!input || input.command !== 'docsnan') return;
      const routed = routeCommand(input.arguments || '');
      if (routed.action === 'mode') {
        writeMode(routed.mode);
        log('info', 'docsnan ' + routed.mode);
      } else if (routed.action === 'status') {
        log('info', 'docsnan ' + readMode() + ' (v' + (getInstalledVersion() || '?') + ')');
      } else if (routed.action === 'version') {
        log('info', 'docsnan v' + (getInstalledVersion() || '?'));
      } else if (routed.action === 'update') {
        const before = checkUpdate();
        if (!before.latest) {
          log('info', 'docsnan v' + (before.installed || '?') + ': latest unknown (offline/unpublished), kept.');
        } else if (!before.needed) {
          log('info', 'docsnan already up to date (' + before.installed + ').');
        } else {
          log('info', 'docsnan update ' + before.installed + ' -> ' + before.latest + ' (' + before.source + ')');
          const r = performUpdate();
          log(r.ok ? 'info' : 'error', r.ok ? r.message : 'docsnan update failed: ' + r.error);
        }
      } else {
        log('info', 'docsnan: unknown arg "' + routed.arg + '". Use on|off|update|version.');
      }
    },

    // Reminder pasca-tool: muncul di hasil tool agar AI tidak lupa log.
    'tool.execute.after': async (input, output) => {
      try {
        if (readMode() === 'off') return;
        const tool = String((input && input.tool) || '').toLowerCase();
        if (!/edit|write|apply|patch|bash|shell|exec/.test(tool)) return;
        if (output && typeof output.output === 'string' && !/docsnan reminder/i.test(output.output)) {
          output.output += '\n\n[docsnan reminder: if files changed, write 1 NEW docs/YYYYMMDD/HHmmss-<slug>.log before finishing.]';
        }
      } catch (e) {}
    },

    'experimental.session.compacting': async (_input, output) => {
      try {
        if (readMode() === 'off') return;
        if (output && Array.isArray(output.context)) {
          output.context.push('docsnan: preserve pending log duty across compaction — unlogged file changes still need 1 NEW docs/YYYYMMDD/HHmmss-<slug>.log.');
        }
      } catch (e) {}
    },
  };
}

export default {
  id: 'docsnan',

  async setup(ctx) {
    const skill = readSkill();
    if (skill) {
      await ctx.skill.transform((editor) => {
        editor.add(skill);
      });
    }

    const commands = readCommands();
    await ctx.command.transform((editor) => {
      for (const command of commands) {
        editor.add({
          name: command.name,
          description: command.description,
          execute: async ({ sessionID, prompt, delivery }) => {
            const routed = routeCommand(prompt.text || '');
            // on/off persist di sini; pesan berikut baca mode baru.
            if (routed.action === 'mode') writeMode(routed.mode);
            let extra = versionTag();
            if (routed.action === 'update') {
              const before = checkUpdate();
              if (!before.latest) {
                extra = `docsnan v${before.installed || '?'}: latest unknown (offline/unpublished), kept.`;
              } else if (!before.needed) {
                extra = `docsnan already up to date (${before.installed}).`;
              } else {
                const r = performUpdate();
                extra = r.ok ? r.message : 'docsnan update failed: ' + r.error;
              }
            } else if (routed.action === 'unknown') {
              extra += `. Unknown arg "${routed.arg}". Use on|off|update|version.`;
            }
            await ctx.session.prompt({
              ...prompt,
              sessionID,
              text: command.template.replaceAll('$ARGUMENTS', prompt.text || '') + `\n\n${extra}`,
              delivery,
            });
          },
        });
      }
    });

    await ctx.session.hook('context', (event) => {
      const mode = readMode();
      if (mode === 'off') return;
      event.system.push({ type: 'text', text: getDocsnanInstructions(mode) });
    });

    // Preserve log duty across compaction summaries (best-effort, shape-guarded).
    try {
      await ctx.session.hook('compaction', (event) => {
        if (readMode() === 'off') return;
        const note = 'docsnan: unlogged file changes still need 1 NEW docs/YYYYMMDD/HHmmss-<slug>.log after compaction.';
        try {
          if (event && Array.isArray(event.context)) event.context.push(note);
          else if (event && Array.isArray(event.system)) event.system.push({ type: 'text', text: note });
        } catch (e) {}
      });
    } catch (e) {}
  },

  server,
};
