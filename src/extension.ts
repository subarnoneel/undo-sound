import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { ChildProcess, spawn } from 'child_process';

// ── Output channel (visible via Output → "Undo Sound") ───────────────────────
let log: vscode.OutputChannel;

function info(msg: string): void { log.appendLine(`[INFO]  ${msg}`); }
function warn(msg: string): void { log.appendLine(`[WARN]  ${msg}`); }

// ── Persistent PowerShell process (Windows only) ─────────────────────────────
let psProc: ChildProcess | null = null;
let psReady = false;

function getPs(): ChildProcess {
	if (!psProc || psProc.exitCode !== null || psProc.killed) {
		info('Spawning persistent PowerShell process');
		psProc = spawn(
			'powershell',
			['-NoProfile', '-NonInteractive', '-NoLogo', '-Command', '-'],
			{ stdio: ['pipe', 'ignore', 'ignore'] }
		);
		psReady = false;
		psProc.on('exit', (code) => {
			warn(`PowerShell process exited (code ${code}), will respawn on next play`);
			psProc = null;
			psReady = false;
		});
	}
	return psProc;
}

function psRun(line: string): void {
	getPs().stdin!.write(line + '\n');
}

// ── Sound path (resolved once, updated only on settings change) ───────────────
let soundPath = '';
let enabled = true;

function resolveSound(context: vscode.ExtensionContext): string {
	const cfg = vscode.workspace.getConfiguration('undo-sound');
	const custom = cfg.get<string>('soundFilePath', '').trim();

	if (custom) {
		if (fs.existsSync(custom)) {
			info(`Using custom sound: ${custom}`);
			return custom;
		}
		warn(`Custom sound file not found: ${custom} — falling back to bundled sound`);
	}

	const bundled = context.asAbsolutePath(path.join('media', 'undo.wav'));
	if (fs.existsSync(bundled)) {
		info(`Using bundled sound: ${bundled}`);
		return bundled;
	}

	warn('No sound file found (no custom path, no media/undo.wav). Using system fallback.');
	return '';
}

function readEnabled(): boolean {
	return vscode.workspace.getConfiguration('undo-sound').get<boolean>('enabled', true);
}

// Pre-load the WAV into a $global:sp SoundPlayer inside the persistent PS
// process. LoadSync() reads the file into memory once; every Play() after
// that fires from RAM with near-zero latency.
function initWinPlayer(p: string): void {
	const escaped = p.replace(/'/g, "''");
	psRun(`$global:sp = New-Object System.Media.SoundPlayer '${escaped}'; $global:sp.LoadSync()`);
	psReady = true;
	info('WAV loaded into memory (SoundPlayer ready)');
}

// ── Debounce ──────────────────────────────────────────────────────────────────
// When the user holds Ctrl+Z, VS Code fires many undo events in quick
// succession. Without debounce each one would overlap and create a messy
// audio pile-up. An 80 ms cooldown lets the sound finish its "attack" before
// the next one fires — rapid undos sound clean instead of chaotic.
const DEBOUNCE_MS = 80;
let lastPlayTime = 0;

// ── Playback ──────────────────────────────────────────────────────────────────
function playSound(): void {
	// Debounce: skip if we played very recently
	const now = Date.now();
	if (now - lastPlayTime < DEBOUNCE_MS) { return; }
	lastPlayTime = now;

	if (process.platform === 'win32') {
		if (soundPath) {
			if (!psReady) { initWinPlayer(soundPath); }
			psRun('$global:sp.Play()');
		} else {
			psRun('[System.Media.SystemSounds]::Asterisk.Play()');
		}
	} else if (process.platform === 'darwin') {
		if (soundPath) {
			spawn('afplay', [soundPath], { stdio: 'ignore', detached: true }).unref();
		}
	} else {
		if (soundPath) {
			const p = spawn('aplay', [soundPath], { stdio: 'ignore', detached: true });
			p.on('error', () =>
				spawn('paplay', [soundPath], { stdio: 'ignore', detached: true }).unref()
			);
			p.unref();
		}
	}
}

// ── Extension lifecycle ───────────────────────────────────────────────────────
export function activate(context: vscode.ExtensionContext) {
	log = vscode.window.createOutputChannel('Undo Sound');
	context.subscriptions.push(log);
	info('Extension activating…');

	enabled = readEnabled();
	soundPath = resolveSound(context);

	// Pre-warm: spawn the PS process and load the WAV into memory at activation
	if (process.platform === 'win32' && enabled) {
		if (soundPath) { initWinPlayer(soundPath); }
		else { getPs(); }
	}

	// Toggle command (command palette: "Undo Sound: Toggle On/Off")
	context.subscriptions.push(
		vscode.commands.registerCommand('undo-sound.toggle', () => {
			enabled = !enabled;
			const cfg = vscode.workspace.getConfiguration('undo-sound');
			cfg.update('enabled', enabled, vscode.ConfigurationTarget.Global);
			const state = enabled ? 'ON' : 'OFF';
			vscode.window.showInformationMessage(`Undo Sound: ${state}`);
			info(`Toggled ${state} via command palette`);

			// Pre-warm the PS process when the user turns sound back ON
			if (enabled && process.platform === 'win32') {
				if (soundPath && !psReady) { initWinPlayer(soundPath); }
				else if (!soundPath) { getPs(); }
			}
		})
	);

	// React to settings changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('undo-sound.enabled')) {
				enabled = readEnabled();
				info(`Enabled setting changed — enabled=${enabled}`);
				// Pre-warm when user enables via settings
				if (enabled && process.platform === 'win32' && soundPath && !psReady) {
					initWinPlayer(soundPath);
				}
			}
			if (e.affectsConfiguration('undo-sound.soundFilePath')) {
				const oldPath = soundPath;
				soundPath = resolveSound(context);
				if (soundPath !== oldPath && process.platform === 'win32') {
					psReady = false;
					if (enabled && soundPath) { initWinPlayer(soundPath); }
				}
				info(`Sound path changed — "${oldPath}" → "${soundPath}"`);
			}
		})
	);

	// Listen for undo events — zero interference with native Ctrl+Z speed
	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument(e => {
			if (enabled && e.reason === vscode.TextDocumentChangeReason.Undo) {
				playSound();
			}
		})
	);

	info('Extension activated successfully');
}

export function deactivate() {
	info('Extension deactivating — cleaning up');
	psProc?.kill();
	psProc = null;
}
