# Faaah — Editor Action Sounds 🔊

Play satisfying sound effects on **undo**, **redo**, **save**, and more in VS Code.

No configuration needed. Install it, and every editor action comes with audio feedback.

## Features

- 🔈 **Undo sound** — plays on every Ctrl+Z / Cmd+Z
- 🔁 **Redo sound** — plays on every Ctrl+Y / Cmd+Shift+Z
- 💾 **Save sound** — plays on every Ctrl+S / Cmd+S
- ⚡ **Zero latency** — listens to native VS Code events, never intercepts your keystrokes
- 🎵 **Custom sounds** — use any `.wav` file for each action
- 🔇 **Status bar toggle** — click the 🔊/🔇 icon in the status bar to mute/unmute
- 💻 **Cross-platform** — Windows, macOS, and Linux
- 🪶 **Lightweight** — no dependencies, tiny footprint

## Getting Started

1. Install the extension
2. That's it! Default sounds are bundled for undo, redo, and save
3. To use your own sounds, drop `.wav` files in the extension's `media/` folder as `undo.wav`, `redo.wav`, and `save.wav`

## Extension Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `undo-sound.enabled` | `boolean` | `true` | Enable or disable all sound effects |
| `undo-sound.soundFilePath` | `string` | `""` | Custom `.wav` path for undo |
| `undo-sound.redoSoundFilePath` | `string` | `""` | Custom `.wav` path for redo |
| `undo-sound.saveSoundFilePath` | `string` | `""` | Custom `.wav` path for save |
| `undo-sound.toggleOnSoundFilePath` | `string` | `""` | Custom `.wav` path for the toggle-on confirmation sound |

## Commands

| Command | Description |
|---|---|
| `Undo Sound: Toggle On/Off` | Quickly enable or disable all sounds (also available via status bar icon) |

## Requirements

- `.wav` audio files (short clips under 1 second work best)
- **Windows**: No extra software needed (uses built-in .NET audio)
- **macOS**: No extra software needed (uses built-in `afplay`)
- **Linux**: Requires `aplay` (ALSA) or `paplay` (PulseAudio)

## Troubleshooting

If no sound plays:

1. Open **Output** panel → select **Undo Sound** from the dropdown
2. Check the log for warnings about missing files or process errors
3. Make sure your `.wav` files exist at the paths shown in the log

## License

MIT
