# Freeway — ChromeOS PWA

## Included
- Your existing `game.js` and game interface
- Fullscreen PWA manifest
- Service worker for offline caching
- 192×192 and 512×512 app icons

## Add your game assets
Copy your original game images and audio into these exact paths:

`uploads/Empty_Highway_from_Above.png`
`uploads/redsportscar.png`
`uploads/graysportscar.png`
`uploads/darkcar.png`
`uploads/lilghtgraycar.png`
`uploads/white_car.png`
`uploads/Forward_Pulse.mp3`
`sfx/honk.wav`

The game will not be fully playable until those original assets are added.

## Test and install on Chromebook
A PWA must be served from HTTPS or localhost; opening `index.html` as a local file will not enable installation.

1. Upload the whole `freeway_pwa` folder to a static HTTPS host (for example, GitHub Pages), or serve it from localhost for testing.
2. Open the hosted `index.html` in Chrome.
3. Use Chrome's **Install page as app** / **Install Freeway** option when it appears.
4. Launch Freeway from the Chromebook Launcher.

The manifest requests `display: fullscreen`. Chrome decides which display modes are supported; if fullscreen display mode is unavailable on a particular Chrome version, the `standalone` fallback may be used.

## Offline behavior
The service worker pre-caches the app shell and caches same-origin game assets after they have been successfully requested online. Open the game once while online before testing offline play.

## Notes
- Your game's best score and preferences remain in `localStorage`.
- The Google Fonts import was replaced with system font fallbacks so the interface does not depend on an internet connection.
- The existing in-game fullscreen button remains available as an additional control.
