import unittest

from app.music import ordered_download_br_types, score_download_candidate


class DownloadCandidateScoringTest(unittest.TestCase):
    def test_ordered_download_br_types_keeps_preference_then_fallbacks(self) -> None:
        self.assertEqual(
            ordered_download_br_types(
                ["QQVIP_MP3_128", "QQVIP_Flac_2000", "QQVIP_MP3_320"],
                ["KW_FLAC_2000", "QQVIP_Flac_2000", "QQVIP_MP3_320"],
            ),
            ["QQVIP_Flac_2000", "QQVIP_MP3_320", "QQVIP_MP3_128"],
        )

    def test_original_album_candidate_beats_live_version(self) -> None:
        studio = {
            "name": "真的爱你",
            "artistName": "BEYOND",
            "albumName": "Beyond IV",
            "albumid": "123",
            "dataInfo": {"songname": "真的爱你", "album": "Beyond IV", "albumid": "123", "originalsongtype": "1"},
        }
        live = {
            "name": "真的爱你",
            "artistName": "BEYOND",
            "albumName": "",
            "albumid": "0",
            "dataInfo": {"songname": "真的爱你 (现场版)", "album": "", "albumid": "0"},
        }

        self.assertGreater(score_download_candidate("真的爱你", "Beyond", studio), score_download_candidate("真的爱你", "Beyond", live))
        self.assertLess(score_download_candidate("真的爱你", "Beyond", live), 0.65)

    def test_original_album_candidate_beats_dj_version(self) -> None:
        studio = {
            "name": "喜欢你",
            "artistName": "BEYOND",
            "albumName": "秘密警察",
            "albumid": "456",
            "dataInfo": {"songname": "喜欢你", "album": "秘密警察", "albumid": "456", "originalsongtype": "1"},
        }
        dj = {
            "name": "喜欢你",
            "artistName": "BEYOND",
            "albumName": "",
            "albumid": "0",
            "dataInfo": {"songname": "喜欢你 (DJ版)", "album": "", "albumid": "0"},
        }

        self.assertGreater(score_download_candidate("喜欢你", "Beyond", studio), score_download_candidate("喜欢你", "Beyond", dj))
        self.assertLess(score_download_candidate("喜欢你", "Beyond", dj), 0.65)

    def test_album_candidate_works_when_artist_is_missing_from_request(self) -> None:
        candidate = {
            "name": "后来",
            "artistName": "刘若英",
            "albumName": "2020 刘若英陪你 献上录音专辑",
            "albumid": "13825074",
            "dataInfo": {"songname": "后来", "album": "2020 刘若英陪你 献上录音专辑", "albumid": "13825074", "originalsongtype": "1"},
        }

        self.assertGreaterEqual(score_download_candidate("后来", "", candidate), 0.65)

    def test_subtitle_usage_does_not_hide_original_candidate(self) -> None:
        candidate = {
            "name": "后来",
            "artistName": "刘若英",
            "albumName": "2020 刘若英陪你 献上录音专辑",
            "albumid": "13825074",
            "dataInfo": {
                "songname": "后来",
                "album": "2020 刘若英陪你 献上录音专辑",
                "albumid": "13825074",
                "originalsongtype": "1",
                "subtitle": "《后来的我们》电影插曲",
            },
        }

        self.assertGreaterEqual(score_download_candidate("后来", "刘若英", candidate), 0.65)

    def test_original_album_beats_compilation_album(self) -> None:
        original = {
            "name": "海阔天空",
            "artistName": "BEYOND",
            "albumName": "乐与怒",
            "albumid": "002qcJuX3lO3EZ",
            "dataInfo": {"songname": "海阔天空", "album": "乐与怒", "albumid": "002qcJuX3lO3EZ"},
        }
        compilation = {
            "name": "海阔天空",
            "artistName": "BEYOND",
            "albumName": "BEYOND珍藏版 I",
            "albumid": "23132587",
            "dataInfo": {"songname": "海阔天空", "album": "BEYOND珍藏版 I", "albumid": "23132587"},
        }
        instrumental = {
            "name": "海阔天空",
            "artistName": "BEYOND",
            "albumName": "Piano in gold",
            "albumid": "9576258",
            "dataInfo": {"songname": "海阔天空 (纯音乐)", "album": "Piano in gold", "albumid": "9576258"},
        }

        self.assertGreater(score_download_candidate("海阔天空", "Beyond", original), score_download_candidate("海阔天空", "Beyond", compilation))
        self.assertGreater(score_download_candidate("海阔天空", "Beyond", original), score_download_candidate("海阔天空", "Beyond", instrumental))

    def test_exact_title_beats_movie_suffix_variant(self) -> None:
        original = {
            "name": "海阔天空",
            "artistName": "BEYOND",
            "albumName": "乐与怒",
            "albumid": "002qcJuX3lO3EZ",
            "dataInfo": {"songname": "海阔天空", "album": "乐与怒", "albumid": "002qcJuX3lO3EZ", "originalsongtype": "1"},
        }
        movie_song = {
            "name": "海阔天空-《九五2班》网络电影插曲",
            "artistName": "BEYOND",
            "albumName": "乐与怒",
            "albumid": "002qcJuX3lO3EZ",
            "dataInfo": {
                "songname": "海阔天空-《九五2班》网络电影插曲",
                "album": "乐与怒",
                "albumid": "002qcJuX3lO3EZ",
                "originalsongtype": "1",
            },
        }

        self.assertGreater(score_download_candidate("海阔天空", "Beyond", original), score_download_candidate("海阔天空", "Beyond", movie_song))
        self.assertLess(score_download_candidate("海阔天空", "Beyond", movie_song), 0.65)

    def test_plain_songname_beats_alternate_version(self) -> None:
        plain = {
            "name": "真的爱你",
            "artistName": "BEYOND",
            "albumName": "BEYOND IV (超越时代2CD纪念版)",
            "albumid": "004a7Kps1wc87r",
            "dataInfo": {"songname": "真的爱你", "album": "BEYOND IV (超越时代2CD纪念版)", "albumid": "004a7Kps1wc87r"},
        }
        alternate = {
            "name": "真的爱你",
            "artistName": "BEYOND",
            "albumName": "BEYOND IV (超越时代2CD纪念版)",
            "albumid": "004a7Kps1wc87r",
            "dataInfo": {"songname": "真的爱你 (Kenya Version)", "album": "BEYOND IV (超越时代2CD纪念版)", "albumid": "004a7Kps1wc87r"},
        }

        self.assertGreater(score_download_candidate("真的爱你", "Beyond", plain), score_download_candidate("真的爱你", "Beyond", alternate))

    def test_original_album_beats_generic_pop_collection(self) -> None:
        original = {
            "name": "真的爱你",
            "artistName": "BEYOND",
            "albumName": "BEYOND IV (超越时代2CD纪念版)",
            "albumid": "9857744",
            "dataInfo": {"songname": "真的爱你", "album": "BEYOND IV (超越时代2CD纪念版)", "albumid": "9857744"},
        }
        collection = {
            "name": "真的爱你",
            "artistName": "BEYOND",
            "albumName": "Chinese Pop 90s",
            "albumid": "14442180",
            "dataInfo": {"songname": "真的爱你", "album": "Chinese Pop 90s", "albumid": "14442180", "originalsongtype": "1"},
        }

        self.assertGreater(score_download_candidate("真的爱你", "Beyond", original), score_download_candidate("真的爱你", "Beyond", collection))

    def test_original_album_beats_best_hits_album(self) -> None:
        original = {
            "name": "海阔天空",
            "artistName": "BEYOND",
            "albumName": "乐与怒",
            "albumid": "002qcJuX3lO3EZ",
            "dataInfo": {"songname": "海阔天空", "album": "乐与怒", "albumid": "002qcJuX3lO3EZ"},
        }
        best_hits = {
            "name": "海阔天空",
            "artistName": "BEYOND",
            "albumName": "Beyond Best Sound Best Hits",
            "albumid": "113280",
            "dataInfo": {"songname": "海阔天空", "album": "Beyond Best Sound Best Hits", "albumid": "113280"},
        }

        self.assertGreater(score_download_candidate("海阔天空", "Beyond", original), score_download_candidate("海阔天空", "Beyond", best_hits))
        self.assertLess(score_download_candidate("海阔天空", "Beyond", best_hits), 0.65)

    def test_wrong_artist_same_title_is_not_enough(self) -> None:
        cover = {
            "name": "海阔天空",
            "artistName": "信乐团",
            "albumName": "海阔天空",
            "albumid": "73633",
            "dataInfo": {"songname": "海阔天空", "album": "海阔天空", "albumid": "73633"},
        }

        self.assertLess(score_download_candidate("海阔天空", "Beyond", cover), 0.65)

    def test_instrumental_album_is_not_original_recording(self) -> None:
        instrumental = {
            "name": "海阔天空",
            "artistName": "BEYOND",
            "albumName": "品味LP 器乐篇",
            "albumid": "92311",
            "dataInfo": {"songname": "海阔天空", "album": "品味LP 器乐篇", "albumid": "92311"},
        }

        self.assertLess(score_download_candidate("海阔天空", "Beyond", instrumental), 0.65)


if __name__ == "__main__":
    unittest.main()
