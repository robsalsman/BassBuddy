# Soundtrack

Drop audio files (`.mp3` / `.m4a` / `.ogg`) in this folder and list them in
`playlist.json`:

```json
[
  { "file": "my-song.mp3", "title": "My Song", "artist": "Me" }
]
```

The game shuffles the playlist as background music, shows a 🎵 toast with the
title when a track starts, and adds a Music ON/OFF toggle to the main menu.
An empty playlist keeps music (and the toggle) off entirely. Remember to bump
`BB_V` in index.html when adding tracks so phones re-fetch the playlist.
