# Nava Android 12.1.52

Fixes series download discovery by querying the Blogger feed for the exact series-name label first. Volumes are derived from `Cilt N` labels inside that series feed, and chapters are taken from the same feed for the selected volume. This removes the global `Cilt`/`Bölüm` feed dependency that failed in 12.1.51.
