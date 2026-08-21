# Nava Android 12.1.51

12.1.50 download hotfix follow-up.

- Keeps the signed 12.1.47 native WebView/classes.dex/UA baseline.
- Keeps the 12.1.49 queue, offline library, notifications and language variant features.
- Fixes `Eseri indir` volume discovery by reading Blogger `Cilt` feeds instead of relying only on rendered DOM links.
- Fixes selected-volume chapter discovery by reading the volume label / `Bölüm` feeds instead of parsing an unexecuted fetched HTML document.
- Sends the resolved volume + chapter list to the existing native `downloadBatch` bridge and preserves the existing queue storage format.

Version: 12.1.51 (67)
