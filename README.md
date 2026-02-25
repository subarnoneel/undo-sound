# Faaah Undo 🔊

Plays a sound effect every time you undo — **Ctrl+Z** on Windows/Linux, **Cmd+Z** on macOS.

No configuration needed. Install it, drop a `.wav` file, and every undo comes with audio feedback.

## Features

- 🔈 **Instant audio feedback** on every undo action
- ⚡ **Zero undo latency** — listens to native VS Code undo events, never intercepts your keystrokes
- 🎵 **Custom sound** — use any `.wav` file you like
- 🔇 **Toggle on/off** from the command palette (`Undo Sound: Toggle On/Off`)
- 💻 **Cross-platform** — Windows, macOS, and Linux
- 🪶 **Lightweight** — no dependencies, tiny footprint

## Getting Started

1. Install the extension
2. Place your `.wav` sound file in the extension's `media/` folder as `undo.wav`
3. Press **Ctrl+Z** — hear the sound!

## Extension Settings

| Setting | Type | Default | Description |
|---|---|---|---|
| `undo-sound.enabled` | `boolean` | `true` | Enable or disable the undo sound effect |
| `undo-sound.soundFilePath` | `string` | `""` | Absolute path to a custom `.wav` file. Leave empty to use the bundled `media/undo.wav` |

## Commands

| Command | Description |
|---|---|
| `Undo Sound: Toggle On/Off` | Quickly enable or disable the sound from the command palette |

## Requirements

- A `.wav` audio file (short clips under 1 second work best)
- **Windows**: No extra software needed (uses built-in .NET audio)
- **macOS**: No extra software needed (uses built-in `afplay`)
- **Linux**: Requires `aplay` (ALSA) or `paplay` (PulseAudio)

## Troubleshooting

If no sound plays:

1. Open **Output** panel → select **Undo Sound** from the dropdown
2. Check the log for warnings about missing files or process errors
3. Make sure your `.wav` file exists at the path shown in the log

## License

MIT
