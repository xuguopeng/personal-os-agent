from functools import lru_cache
from os import getenv
from pathlib import Path

from pydantic import BaseModel


DEFAULT_ENV_FILES = (
    "/data/secrets/agent-server.env",
    "/data/secrets/daoliyu.env",
    "/data/secrets/music-sources.env",
    "./data/secrets/agent-server.env",
    "./data/secrets/daoliyu.env",
    "./data/secrets/music-sources.env",
    "../../data/secrets/agent-server.env",
    "../../data/secrets/daoliyu.env",
    "../../data/secrets/music-sources.env",
)


class Settings(BaseModel):
    db_path: str
    bind_host: str
    port: int
    token: str
    username: str
    password: str
    daoliyu_base_urls: str
    daoliyu_username: str
    daoliyu_password: str
    daoliyu_media_root: str
    music_library_roots: str
    music_cover_dir: str
    radio_output_dir: str
    llm_provider: str
    openai_compat_base_url: str
    openai_compat_api_key: str
    openai_compat_model: str
    tts_provider: str
    fish_api_key: str
    fish_tts_model: str
    fish_tts_reference_id: str
    minimax_subscription_key: str
    minimax_api_key: str
    minimax_group_id: str
    minimax_chat_model: str
    minimax_tts_voice_id: str
    minimax_tts_model: str
    radio_daily_enabled: bool
    radio_daily_time: str
    radio_daily_timezone: str
    radio_weather_city: str
    radio_weather_lat: float
    radio_weather_lon: float
    radio_recent_limit: int
    radio_mix_crossfade_seconds: float
    radio_mix_ducking_volume: float
    radio_mix_music_volume: float
    missing_download_enabled: bool
    missing_download_start_hour: int
    missing_download_end_hour: int
    missing_download_interval_hours: int
    missing_download_batch_size: int
    listening_plugin_dirs: str
    metadata_plugin_dirs: str
    sqmusic_base_url: str
    sqmusic_username: str
    sqmusic_password: str
    sqmusic_plug_names: str
    sqmusic_preferred_br_types: str
    loaded_secret_files: list[str]


@lru_cache
def get_settings() -> Settings:
    file_values, loaded_files = load_env_files()

    def value(key: str, default: str = "") -> str:
        env_value = getenv(key)
        if env_value:
            return env_value
        return file_values.get(key, default)

    daoliyu_base_urls = value(
        "DAOLIYU_BASE_URLS",
        value("DAOLIYU_BASE_URL", "http://127.0.0.1:5173,https://daoliyu.xuguopeng.com"),
    )
    return Settings(
        db_path=value("AGENT_SERVER_DB_PATH", "./data/personal-os-agent-server.sqlite3"),
        bind_host=value("AGENT_SERVER_BIND_HOST", "0.0.0.0"),
        port=int(value("AGENT_SERVER_PORT", "8088")),
        token=value("AGENT_SERVER_TOKEN", ""),
        username=value("AGENT_SERVER_USERNAME", ""),
        password=value("AGENT_SERVER_PASSWORD", ""),
        daoliyu_base_urls=daoliyu_base_urls,
        daoliyu_username=value("DAOLIYU_USERNAME", ""),
        daoliyu_password=value("DAOLIYU_PASSWORD", ""),
        daoliyu_media_root=value("DAOLIYU_MEDIA_ROOT", "/data/media"),
        music_library_roots=value("MUSIC_LIBRARY_ROOTS", value("DAOLIYU_MEDIA_ROOT", "/data/media")),
        music_cover_dir=value("MUSIC_COVER_DIR", "/data/covers"),
        radio_output_dir=value("RADIO_OUTPUT_DIR", "/data/radio"),
        llm_provider=value("LLM_PROVIDER", "0029").lower(),
        openai_compat_base_url=value("OPENAI_COMPAT_BASE_URL", "https://api.0029.org/v1").rstrip("/"),
        openai_compat_api_key=value("OPENAI_COMPAT_API_KEY", ""),
        openai_compat_model=value("OPENAI_COMPAT_MODEL", "gpt-5.5"),
        tts_provider=value("TTS_PROVIDER", "fish").lower(),
        fish_api_key=value("FISH_API_KEY", ""),
        fish_tts_model=value("FISH_TTS_MODEL", "s2.1-pro-free"),
        fish_tts_reference_id=value("FISH_TTS_REFERENCE_ID", "c43ae8e1c3664eac9203f9293fabc3c9"),
        minimax_subscription_key=value("MINIMAX_SUBSCRIPTION_KEY", ""),
        minimax_api_key=value("MINIMAX_API_KEY", ""),
        minimax_group_id=value("MINIMAX_GROUP_ID", ""),
        minimax_chat_model=value("MINIMAX_CHAT_MODEL", ""),
        minimax_tts_voice_id=value("MINIMAX_TTS_VOICE_ID", ""),
        minimax_tts_model=value("MINIMAX_TTS_MODEL", ""),
        radio_daily_enabled=parse_bool(value("RADIO_DAILY_ENABLED", "true")),
        radio_daily_time=value("RADIO_DAILY_TIME", "07:00"),
        radio_daily_timezone=value("RADIO_DAILY_TIMEZONE", "Asia/Shanghai"),
        radio_weather_city=value("RADIO_WEATHER_CITY", "陕西西安"),
        radio_weather_lat=float(value("RADIO_WEATHER_LAT", "34.3416")),
        radio_weather_lon=float(value("RADIO_WEATHER_LON", "108.9398")),
        radio_recent_limit=int(value("RADIO_RECENT_LIMIT", "30")),
        radio_mix_crossfade_seconds=float(value("RADIO_MIX_CROSSFADE_SECONDS", "2.5")),
        radio_mix_ducking_volume=float(value("RADIO_MIX_DUCKING_VOLUME", "0.18")),
        radio_mix_music_volume=float(value("RADIO_MIX_MUSIC_VOLUME", "0.92")),
        missing_download_enabled=parse_bool(value("MISSING_DOWNLOAD_ENABLED", "true")),
        missing_download_start_hour=int(value("MISSING_DOWNLOAD_START_HOUR", "7")),
        missing_download_end_hour=int(value("MISSING_DOWNLOAD_END_HOUR", "20")),
        missing_download_interval_hours=int(value("MISSING_DOWNLOAD_INTERVAL_HOURS", "2")),
        missing_download_batch_size=int(value("MISSING_DOWNLOAD_BATCH_SIZE", "20")),
        listening_plugin_dirs=value(
            "LISTENING_PLUGIN_DIRS",
            "/data/private_plugins/music_sources,./services/agent-server/private_plugins,./private_plugins",
        ),
        metadata_plugin_dirs=value(
            "METADATA_PLUGIN_DIRS",
            "/data/private_plugins/music_metadata,./services/agent-server/private_plugins,./private_plugins",
        ),
        sqmusic_base_url=value("SQMUSIC_BASE_URL", "http://192.168.10.21:8096"),
        sqmusic_username=value("SQMUSIC_USERNAME", ""),
        sqmusic_password=value("SQMUSIC_PASSWORD", ""),
        sqmusic_plug_names=value("SQMUSIC_PLUG_NAMES", "kw,qq,netease,kg,mg"),
        sqmusic_preferred_br_types=value(
            "SQMUSIC_PREFERRED_BR_TYPES",
            "KW_FLAC_2000,QQVIP_Flac_2000,QQ_Flac_2000,KG_Flac_3000,NETEASE_FLAC_3000,KW_MP3_320,QQVIP_MP3_320,QQ_MP3_320,KG_MP3_320,NETEASE_MP3_320,KW_MP3_128,QQ_MP3_128",
        ),
        loaded_secret_files=loaded_files,
    )


def load_env_files() -> tuple[dict[str, str], list[str]]:
    values: dict[str, str] = {}
    loaded_files: list[str] = []
    for raw_path in DEFAULT_ENV_FILES:
        path = Path(raw_path)
        if not path.exists() or not path.is_file():
            continue
        loaded_files.append(str(path))
        for line in path.read_text(encoding="utf-8").splitlines():
            parsed = parse_env_line(line)
            if parsed is None:
                continue
            key, value = parsed
            values[key] = value
    return values, loaded_files


def parse_env_line(line: str) -> tuple[str, str] | None:
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
        return None
    key, value = stripped.split("=", 1)
    key = key.strip()
    if not key:
        return None
    value = value.strip().strip('"').strip("'")
    return key, value


def parse_bool(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on", "enabled"}
