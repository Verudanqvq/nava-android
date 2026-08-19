# Nava Blogger Live Layer

This folder provides a fail-safe live CSS/JS layer for the existing Blogger theme.

## One-time Blogger install

Add this line once before `</head>` in the Blogger theme:

```html
<script defer='defer' src='https://cdn.jsdelivr.net/gh/Verudanqvq/nava-android@main/blogger-live/bootstrap.js'></script>
```

The bootstrap fetches `manifest.json` with cache disabled. The manifest points to versioned, immutable-style release filenames under `releases/`. If the manifest cannot be loaded, the existing Blogger theme continues without the live layer.

## Release protocol

1. Create new versioned files, e.g. `releases/12.4.0-live.1.css` and `.js`.
2. Validate JavaScript syntax and scope CSS selectors to Nava-owned surfaces.
3. Update `manifest.json` only after the new files are ready.
4. Roll back by pointing the manifest at an older pair of files.
5. Emergency disable: set `enabled` to `false`.

Never overwrite an existing release file after it has gone live; create a new versioned filename instead.
