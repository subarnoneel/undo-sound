import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';

// ── Output channel (visible via Output → "Undo Sound") ───────────────────────
let log: vscode.OutputChannel;

function info(msg: string): void { log.appendLine(`[INFO]  ${msg}`); }
function warn(msg: string): void { log.appendLine(`[WARN]  ${msg}`); }

// ── Persistent PowerShell process (Windows only) ─────────────────────────────
// One process lives for the entire session. Each sound gets its own
// $global:spXxx SoundPlayer variable so they never interfere.
let psProc: ChildProcess | null = null;

function getPs(): ChildProcess {
	if (!psProc || psProc.exitCode !== null || psProc.killed) {
		info('Spawning persistent PowerShell process');
		psProc = spawn(
			'powershell',
			['-NoProfile', '-NonInteractive', '-NoLogo', '-Command', '-'],
			{ stdio: ['pipe', 'ignore', 'ignore'] }
		);
		// Mark all players as needing re-init on respawn
		psProc.on('exit', (code) => {
			warn(`PowerShell process exited (code ${code}), will respawn on next play`);
			psProc = null;
			for (const s of Object.values(sounds)) { s.psReady = false; }
		});
	}
	return psProc;
}

function psRun(line: string): void {
	getPs().stdin!.write(line + '\n');
}

// ── Sound slot ────────────────────────────────────────────────────────────────
// A reusable structure for each sound type (undo, redo, save).
interface SoundSlot {
	/** Setting key for the custom file path */
	settingKey: string;
	/** Default bundled WAV filename inside media/ */
	defaultFile: string;
	/** PowerShell variable name (e.g. $global:spUndo) */
	psVar: string;
	/** Resolved absolute path to the WAV file */
	filePath: string;
	/** Whether this slot's PS SoundPlayer is loaded */
	psReady: boolean;
	/** Last time this slot played (for debounce) */
	lastPlayTime: number;
}

const sounds: Record<string, SoundSlot> = {
	undo:     { settingKey: 'soundFilePath',         defaultFile: 'undo.wav',      psVar: '$global:spUndo',     filePath: '', psReady: false, lastPlayTime: 0 },
	redo:     { settingKey: 'redoSoundFilePath',     defaultFile: 'redo.wav',      psVar: '$global:spRedo',     filePath: '', psReady: false, lastPlayTime: 0 },
	save:     { settingKey: 'saveSoundFilePath',     defaultFile: 'save.wav',      psVar: '$global:spSave',     filePath: '', psReady: false, lastPlayTime: 0 },
	toggleOn: { settingKey: 'toggleOnSoundFilePath', defaultFile: 'toggle-on.wav', psVar: '$global:spToggleOn', filePath: '', psReady: false, lastPlayTime: 0 },
};

function resolveSlot(slot: SoundSlot, context: vscode.ExtensionContext): string {
	const cfg = vscode.workspace.getConfiguration('undo-sound');
	const custom = cfg.get<string>(slot.settingKey, '').trim();

	if (custom) {
		if (fs.existsSync(custom)) {
			info(`[${slot.defaultFile}] Using custom sound: ${custom}`);
			return custom;
		}
		warn(`[${slot.defaultFile}] Custom path not found: ${custom} — falling back to bundled`);
	}

	const bundled = context.asAbsolutePath(path.join('media', slot.defaultFile));
	if (fs.existsSync(bundled)) {
		info(`[${slot.defaultFile}] Using bundled sound: ${bundled}`);
		return bundled;
	}

	warn(`[${slot.defaultFile}] No sound file found. Will use system fallback.`);
	return '';
}

function resolveAllSlots(context: vscode.ExtensionContext): void {
	for (const slot of Object.values(sounds)) {
		slot.filePath = resolveSlot(slot, context);
	}
}

// ── Windows player init ───────────────────────────────────────────────────────
function initWinSlot(slot: SoundSlot): void {
	const escaped = slot.filePath.replace(/'/g, "''");
	psRun(`${slot.psVar} = New-Object System.Media.SoundPlayer '${escaped}'; ${slot.psVar}.LoadSync()`);
	slot.psReady = true;
	info(`[${slot.defaultFile}] WAV loaded into memory (${slot.psVar} ready)`);
}

function initAllWinSlots(): void {
	for (const slot of Object.values(sounds)) {
		if (slot.filePath) { initWinSlot(slot); }
	}
}

// ── Debounce ──────────────────────────────────────────────────────────────────
const DEBOUNCE_MS = 80;

// ── Playback ──────────────────────────────────────────────────────────────────
function playSlot(slot: SoundSlot): void {
	const now = Date.now();
	if (now - slot.lastPlayTime < DEBOUNCE_MS) { return; }
	slot.lastPlayTime = now;

	if (process.platform === 'win32') {
		if (slot.filePath) {
			if (!slot.psReady) { initWinSlot(slot); }
			psRun(`${slot.psVar}.Play()`);
		} else {
			psRun('[System.Media.SystemSounds]::Asterisk.Play()');
		}
	} else if (process.platform === 'darwin') {
		if (slot.filePath) {
			spawn('afplay', [slot.filePath], { stdio: 'ignore', detached: true }).unref();
		}
	} else {
		if (slot.filePath) {
			const p = spawn('aplay', [slot.filePath], { stdio: 'ignore', detached: true });
			p.on('error', () =>
				spawn('paplay', [slot.filePath], { stdio: 'ignore', detached: true }).unref()
			);
			p.unref();
		}
	}
}

// ── Status bar ────────────────────────────────────────────────────────────────
let statusBarItem: vscode.StatusBarItem;

function updateStatusBar(): void {
	statusBarItem.text = enabled ? '$(unmute) Sounds' : '$(mute) Sounds';
	statusBarItem.tooltip = enabled ? 'Undo Sound: ON — click to mute' : 'Undo Sound: OFF — click to unmute';
}

// ── Global state ──────────────────────────────────────────────────────────────
let enabled = true;

// Brief suppression flag — prevents the save sound from firing when
// toggling writes to settings.json.
let suppressSaveUntil = 0;

function readEnabled(): boolean {
	return vscode.workspace.getConfiguration('undo-sound').get<boolean>('enabled', true);
}

function setEnabled(value: boolean): void {
	enabled = value;
	vscode.workspace.getConfiguration('undo-sound')
		.update('enabled', enabled, vscode.ConfigurationTarget.Global);
	updateStatusBar();
}

// ── Extension lifecycle ───────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
	log = vscode.window.createOutputChannel('Undo Sound');
	context.subscriptions.push(log);
	info('Extension activating…');

	enabled = readEnabled();
	resolveAllSlots(context);

	// ── Status bar item ──────────────────────────────────────────────────
	statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
	statusBarItem.command = 'undo-sound.toggle';
	updateStatusBar();
	statusBarItem.show();
	context.subscriptions.push(statusBarItem);

	// ── Pre-warm PS + load all WAVs into memory ──────────────────────────
	if (process.platform === 'win32' && enabled) {
		getPs();
		initAllWinSlots();
	}

	// ── Toggle command ───────────────────────────────────────────────────
	context.subscriptions.push(
		vscode.commands.registerCommand('undo-sound.toggle', () => {
			// Suppress the save sound that fires when settings.json is written
			suppressSaveUntil = Date.now() + 500;

			setEnabled(!enabled);
			const state = enabled ? 'ON' : 'OFF';
			vscode.window.showInformationMessage(`Undo Sound: ${state}`);
			info(`Toggled ${state} via command / status bar`);

			// Pre-warm PS and play the toggle-on sound
			if (enabled) {
				if (process.platform === 'win32') { initAllWinSlots(); }
				playSlot(sounds.toggleOn);
			}
		})
	);

	// ── Settings changes ─────────────────────────────────────────────────
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('undo-sound.enabled')) {
				enabled = readEnabled();
				suppressSaveUntil = Date.now() + 500;
				updateStatusBar();
				info(`Enabled setting changed — enabled=${enabled}`);
				if (enabled && process.platform === 'win32') {
					initAllWinSlots();
				}
			}

			// Check each sound slot's custom path setting
			for (const [name, slot] of Object.entries(sounds)) {
				const fullKey = `undo-sound.${slot.settingKey}`;
				if (e.affectsConfiguration(fullKey)) {
					const oldPath = slot.filePath;
					slot.filePath = resolveSlot(slot, context);
					if (slot.filePath !== oldPath && process.platform === 'win32') {
						slot.psReady = false;
						if (enabled && slot.filePath) { initWinSlot(slot); }
					}
					info(`[${name}] Sound path changed — "${oldPath}" → "${slot.filePath}"`);
				}
			}
		})
	);

	// ── Undo & Redo listener ─────────────────────────────────────────────
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(e => {
			if (!enabled) { return; }
			if (e.reason === vscode.TextDocumentChangeReason.Undo) {
				playSlot(sounds.undo);
			} else if (e.reason === vscode.TextDocumentChangeReason.Redo) {
				playSlot(sounds.redo);
			}
		})
	);

	// ── Save listener ────────────────────────────────────────────────────
	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument(() => {
			if (enabled && Date.now() > suppressSaveUntil) { playSlot(sounds.save); }
		})
	);

	info('Extension activated successfully');
}

export function deactivate() {
	info('Extension deactivating — cleaning up');
	psProc?.kill();
	psProc = null;
}
