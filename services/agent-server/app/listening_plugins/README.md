# Listening Source Plugin Protocol

The public repository only defines the plugin protocol.

Private plugins that read personal NetEase Cloud Music, QQ Music, Kugou Music, Kuwo Music, or other account data must live outside the public code path, for example:

```text
/data/private_plugins/music_sources/netease_history.py
/data/private_plugins/music_sources/qqmusic_history.py
/data/private_plugins/music_sources/kugou_history.py
/data/private_plugins/music_sources/kuwo_history.py
```

or locally:

```text
services/agent-server/private_plugins/netease_history.py
services/agent-server/private_plugins/qqmusic_history.py
services/agent-server/private_plugins/kugou_history.py
services/agent-server/private_plugins/kuwo_history.py
```

These paths are git ignored.

## Function

Each plugin exports:

```python
def sync(config: dict) -> list[dict]:
    ...
```

`config` contains:

- `source`: source key such as `netease`, `qqmusic`, `kugou`, or `kuwo`
- `limit`: max records requested
- `env`: selected environment values whose names start with `NETEASE_`, `QQ_`, `KUGOU_`, `KUWO_`, or `MUSIC_SOURCE_`

## Event Shape

Return one dict per listening record:

```python
{
    "sourceEventId": "unique-id-from-source",
    "sourceUserId": "optional-account-id",
    "sourceType": "recent",  # recent / ranking / favorite / playlist
    "trackName": "晴天",
    "artistName": "周杰伦",
    "albumName": "叶惠美",
    "playCount": 18,
    "lastPlayedAt": "2026-07-05T10:30:00+08:00",
    "confidence": 0.92,
    "tags": ["华语", "流行"],
    "raw": {
        "sourceTrackId": "optional"
    },
}
```

Do not return cookies, tokens, passwords, or full request headers in `raw`.

The server also strips raw keys containing `cookie`, `token`, `password`, `secret`, or `authorization` before saving.
