// docsnan — OpenCode plugin (mirip .opencode/plugins/ponytail.mjs).
//
// - Daftarkan slash command + skills dir via `config` hook.
// - Injeksi SKILL.md ke system prompt tiap turn bila mode on.
// - Persist `/docsnan on|off` via `command.execute.before`.
//
// Pakai di opencode.json: { "plugin": ["docsnan"] }

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

export default async ({ client } = {}) => {
  const log = (level, message) => {
    try { client && client.app && client.app.log({ body: { service: 'docsnan', level, message } }); } catch (e) {}
  };

  const skillsDir = path.resolve(__dirname, '../../skills');

  return {
    config: async (config) => {
      if (!config.command) config.command = {};
      const commandDir = path.join(__dirname, '..', 'command');
      try {
        for (const file of fs.readdirSync(commandDir).filter((f) => f.endsWith('.md'))) {
          const name = path.basename(file, '.md');
          const parsed = parseCommandFile(path.join(commandDir, file));
          if (parsed) config.command[name] = parsed;
        }
      } catch (e) {}

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
  };
};
