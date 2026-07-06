# Metadata Scrape Plugin Protocol

The public repository only defines the private metadata plugin protocol.

Private plugins for QQ Music, NetEase Cloud Music, Kugou, Kuwo, sqmusic, or
other personal metadata providers must live in ignored paths, for example:

```text
/data/private_plugins/music_metadata/netease_metadata.py
/data/private_plugins/music_metadata/qqmusic_metadata.py
/data/private_plugins/music_metadata/kugou_metadata.py
/data/private_plugins/music_metadata/kuwo_metadata.py
/data/private_plugins/music_metadata/sqmusic_metadata.py
```

or locally:

```text
services/agent-server/private_plugins/netease_metadata.py
services/agent-server/private_plugins/qqmusic_metadata.py
services/agent-server/private_plugins/kugou_metadata.py
services/agent-server/private_plugins/kuwo_metadata.py
services/agent-server/private_plugins/sqmusic_metadata.py
```

These paths are git ignored.

## Function

Each plugin exports:

```python
def search(config: dict) -> list[dict]:
    ...
```

`config` contains:

- `query`: `{trackId,title,artist,album,sourcePath,limit}`
- `limit`: max candidates requested
- `env`: selected environment values whose names start with `NETEASE_`, `QQ_`,
  `QQMUSIC_`, `KUGOU_`, `KUWO_`, `SQMUSIC_`, or `MUSIC_METADATA_`

## Candidate Shape

Return one dict per metadata candidate:

```python
{
    "provider": "netease",
    "sourceId": "optional-source-track-id",
    "title": "晴天",
    "artist": "周杰伦",
    "album": "叶惠美",
    "albumArtist": "周杰伦",
    "year": "2003",
    "genre": "华语流行",
    "lyrics": "[00:00.00]...",
    "coverUrl": "https://...",
    "confidence": 0.92,
    "raw": {
        "safeDebugField": "optional"
    },
}
```

Do not return cookies, tokens, passwords, secrets, or full request headers in
`raw`. The server also strips raw keys containing `cookie`, `token`,
`password`, `secret`, or `authorization` before returning or saving candidates.
