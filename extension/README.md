# rtcstats-extension

A chrome extension that injects rtcstats into a page (the webrtc samples)
and sends to a server running on localhost. Useful for development purposes.

## Usage
Change
* the domain where you want inject rtcstats in manifest.json
* the location of the rtcstats-server in rtcstats-extension.js (defaults to a local instance)
and run
```
npm run --workspace=extension build
```
which will create the `dist/main.js` referred to by the manifest. Next load the extension into Chrome
(or Chromium-based browsers) using "Load unpacked extension" on the `chrome://extensions/` page.
