# Changelog

All notable changes to **Faaah Undo** will be documented in this file.

## [1.0.0] - 2026-02-25

### Added

- Play a `.wav` sound on every undo action (Ctrl+Z / Cmd+Z)
- Custom sound file path via `undo-sound.soundFilePath` setting
- `undo-sound.enabled` setting to turn the sound on/off
- `Undo Sound: Toggle On/Off` command in the command palette
- Debounce to prevent audio pile-up on rapid consecutive undos
- Diagnostics output channel (Output → "Undo Sound")
- Cross-platform support: Windows, macOS, Linux