# Nava Android 12.1.49 draft

This draft is intentionally rebuilt from the signed Android 12.1.47 APK, not from 12.1.48.

## Intended behavior

- The existing top-bar download icon keeps its 12.1.47 location, but becomes a downloads/status entry point only.
- The top-bar download UI exposes **İndirilenler** and **İndirme sırası**; it does not start a new work/volume/chapter download.
- On a series/work page, **Eseri indir** is inserted after **Özeti Oku** when that action can be identified.
- **Eseri indir** opens a volume picker. The reader can select all or specific volumes, then the selected content is prepared and sent to the native batch download queue.
- The offline library keeps the **Eser → Cilt → Bölüm** hierarchy and the destructive actions **Eseri sil**, **Cildi sil**, and **Sil**. Deletion is verified against the native download index instead of trusting a single UI event.
- Android's in-app notification center supports individual notification deletion and **Tümünü temizle**, backed by the signed-in user's Firestore notification documents.
- Chapter language labels `TR`, `EN`, `JP`, `KR`, `CN` are treated as alternate language variants, not independent visible chapter rows. The selected language is stored per work/series.
- Variant grouping is scoped by volume + chapter number to avoid collisions between similarly numbered chapters in different volumes.
- The selected work language is also used when preparing offline chapter downloads.

## Publishing convention for language variants

For two translations of the same logical chapter, publish separate Blogger posts/URLs as necessary, keep the same volume/chapter identity in their visible metadata/title, and apply the appropriate language label (`TR`, `EN`, `JP`, `KR`, `CN`). The Android UI collapses those posts into one logical chapter row and switches the target URL when the reader changes language.

## Status

Draft only. Not merged, not released, and not marked as latest. Exact placement relative to any existing chapter-list label named `Yazı` still needs real-page/device verification; the current implementation places the **Dil** control at the chapter list boundary.
