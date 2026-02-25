# Changelog

All notable changes to **Faaah Undo** will be documented in this file.

## [1.1.0] - 2026-02-26

### Added

- **Redo sound** — plays a sound on every redo action (Ctrl+Y / Cmd+Shift+Z)
- **Save sound** — plays a sound on every file save (Ctrl+S / Cmd+S)
- **Status bar indicator** — 🔊/🔇 icon in the status bar to toggle sounds on/off with a click
- `undo-sound.redoSoundFilePath` setting for custom redo sound
- `undo-sound.saveSoundFilePath` setting for custom save sound
- **Toggle-on sound** — plays a confirmation sound when sounds are re-enabled
- `undo-sound.toggleOnSoundFilePath` setting for custom toggle-on sound
- Save sound suppression during toggle to prevent false triggers
- Each sound type has its own independent PowerShell SoundPlayer for zero-latency playback

## [1.0.0] - 2026-02-25

### Added

- Play a `.wav` sound on every undo action (Ctrl+Z / Cmd+Z)
- Custom sound file path via `undo-sound.soundFilePath` setting
- `undo-sound.enabled` setting to turn the sound on/off
- `Undo Sound: Toggle On/Off` command in the command palette
- Debounce to prevent audio pile-up on rapid consecutive undos
- Diagnostics output channel (Output → "Undo Sound")
- Cross-platform support: Windows, macOS, Linux