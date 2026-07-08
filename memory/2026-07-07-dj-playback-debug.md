# DJ Playback Debug Report - 2026-07-07

## Symptom
Flutter client showed Migi replying to “播放夜曲”, but the song did not play, lyrics did not show, and Migi spoken interjection did not duck the music stream.

## Root Cause
1. The deployed NAS service was v0.3.5, but local music search returned zero results for 夜曲. `/v1/dj/chat` therefore fell back to other Jay Chou tracks while the reply still implied the direct request was being fulfilled.
2. Flutter resolved `/v1/dj/spoken/{id}/stream` with the music API base, producing a wrong URL under `/v1/music/v1/dj/...`; the second audio player never received the spoken mp3, so ducking never triggered.
3. DJ action tracks did not include `lyrics`, so direct action playback could not surface lyrics without a separate metadata fetch containing lyrics.
4. Flutter sqmusic client paths missed `/api`, causing client-side sqmusic download/search calls to 404.

## Fix
- Service version bumped to v0.3.6.
- Direct song requests now hard-match first. If not found, they enqueue/process missing track download and do not pretend to play a similar song.
- DJ spoken URLs under `/v1/dj` now resolve against the root server URL in Flutter.
- DJ action track payload now includes lyrics.
- Flutter NAS track search now sends `keyword` to the server.
- Flutter sqmusic paths now use `/v1/music/api/download/sqmusic/...`.

## Evidence
- Before fix, deployed search `/v1/music/api/tracks?keyword=夜曲` returned total 0.
- Before fix, deployed `/v1/dj/chat` returned `spoken.status=ready` and stream URL, but Flutter URL resolver would route it incorrectly.
- `python3 -m py_compile services/agent-server/app/*.py` passed.
- `flutter analyze --no-fatal-infos --no-fatal-warnings` passed with only existing warnings/info.

## Status
DONE_WITH_CONCERNS: NAS must be redeployed so `/version` returns v0.3.6. The actual 夜曲 playback still depends on sqmusic downloading/scanning the missing track into the local library.
