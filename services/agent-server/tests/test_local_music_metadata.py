from types import SimpleNamespace
import unittest

from app.local_music import fallback_track_metadata, safe_duration_seconds


class SafeDurationSecondsTest(unittest.TestCase):
    def test_non_finite_duration_falls_back_to_zero(self) -> None:
        self.assertEqual(safe_duration_seconds(SimpleNamespace(info=SimpleNamespace(length=float("nan")))), 0)
        self.assertEqual(safe_duration_seconds(SimpleNamespace(info=SimpleNamespace(length=float("inf")))), 0)

    def test_invalid_duration_falls_back_to_zero(self) -> None:
        self.assertEqual(safe_duration_seconds(SimpleNamespace(info=SimpleNamespace(length="bad"))), 0)
        self.assertEqual(safe_duration_seconds(SimpleNamespace(info=None)), 0)

    def test_valid_duration_is_truncated_to_seconds(self) -> None:
        self.assertEqual(safe_duration_seconds(SimpleNamespace(info=SimpleNamespace(length=215.9))), 215)


class FallbackTrackMetadataTest(unittest.TestCase):
    def test_fallback_uses_file_name_when_tags_are_unreadable(self) -> None:
        import tempfile
        from pathlib import Path

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "刘若英-后来.flac"
            path.write_bytes(b"not a real flac")

            metadata = fallback_track_metadata(path)

        self.assertEqual(metadata["title"], "后来")
        self.assertEqual(metadata["artist"], "刘若英")
        self.assertEqual(metadata["file_name"], "刘若英-后来.flac")
        self.assertEqual(metadata["duration_seconds"], 0)


if __name__ == "__main__":
    unittest.main()
