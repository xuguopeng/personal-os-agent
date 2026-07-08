# Agent Server Data Directory

This directory mirrors the NAS host path used by Docker:

```text
/volume1/docker/personal-os-agent/data
```

The container mounts it as:

```text
/data
```

Runtime databases and real secret files must stay out of git.

For Daoliyu, copy:

```text
data/secrets/daoliyu.env.example
```

to:

```text
/volume1/docker/personal-os-agent/data/secrets/daoliyu.env
```

Then fill in the real account values on the NAS.

For NAS DJ radio generation, add these values to either:

```text
/volume1/docker/personal-os-agent/data/secrets/agent-server.env
```

or the existing:

```text
/volume1/docker/personal-os-agent/data/secrets/daoliyu.env
```

```env
RADIO_OUTPUT_DIR=/data/radio
LLM_PROVIDER=0029
OPENAI_COMPAT_BASE_URL=https://api.0029.org/v1
OPENAI_COMPAT_API_KEY=
OPENAI_COMPAT_MODEL=gpt-5.5
TTS_PROVIDER=fish
FISH_API_KEY=
FISH_TTS_MODEL=s2.1-pro-free
FISH_TTS_REFERENCE_ID=c43ae8e1c3664eac9203f9293fabc3c9
RADIO_DAILY_ENABLED=true
RADIO_DAILY_TIME=07:00
RADIO_DAILY_TIMEZONE=Asia/Shanghai
RADIO_WEATHER_CITY=陕西西安
RADIO_WEATHER_LAT=34.3416
RADIO_WEATHER_LON=108.9398
RADIO_RECENT_LIMIT=30
RADIO_MIX_CROSSFADE_SECONDS=2.5
RADIO_MIX_DUCKING_VOLUME=0.18
RADIO_MIX_MUSIC_VOLUME=0.92
MISSING_DOWNLOAD_ENABLED=true
MISSING_DOWNLOAD_START_HOUR=7
MISSING_DOWNLOAD_END_HOUR=20
MISSING_DOWNLOAD_INTERVAL_HOURS=2
MISSING_DOWNLOAD_BATCH_SIZE=20
```

`OPENAI_COMPAT_API_KEY` is the [0029](https://www.0029.org/?promo=AFF1K9)
OpenAI-compatible gateway key. `FISH_API_KEY` is used by Fish Audio for spoken
DJ segments. Do not put either real key in git-tracked files or
`docker-compose.yml`.

If Fish Audio is not configured, the service still creates a playable local test
audio file so the desktop and mobile playback flow can be verified.
