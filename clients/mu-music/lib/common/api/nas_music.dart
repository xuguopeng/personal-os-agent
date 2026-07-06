import 'package:flutter/foundation.dart';
import 'package:mu_music/common/index.dart';

class NasMusicApi {
  static String get streamBaseUrl =>
      '${_activeApiUrl()}${Constants.musicApiPath}';

  static Future<Map<String, dynamic>> getStatus() async {
    final response = await HttpUtil().get('/status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> login() async {
    final response = await HttpUtil().post('/auth/login');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<List<Map<String, dynamic>>> listTracks({
    int limit = 30,
    int offset = 0,
    String keyword = '',
  }) async {
    final response = await HttpUtil().get(
      '${Constants.musicApiPath}/tracks',
      params: {
        'limit': limit,
        'offset': offset,
      },
    );
    final items = _extractList(response.data);
    final tracks = items.map((item) => normalizeTrack(item)).toList();
    final trimmedKeyword = keyword.trim().toLowerCase();
    if (trimmedKeyword.isEmpty) return tracks;
    return tracks.where((track) {
      final haystack = [
        track['name'],
        track['ar'] is List && (track['ar'] as List).isNotEmpty
            ? (track['ar'] as List).first['name']
            : '',
        track['al']?['name'],
      ].join(' ').toLowerCase();
      return haystack.contains(trimmedKeyword);
    }).toList();
  }

  static Future<Map<String, dynamic>> getTrack(String id) async {
    final response =
        await HttpUtil().get('${Constants.musicApiPath}/tracks/$id');
    return normalizeTrack(Map<String, dynamic>.from(response.data as Map));
  }

  static Future<List<Map<String, dynamic>>> listPlaylists({
    int limit = 20,
    int offset = 0,
  }) async {
    final response = await HttpUtil().get(
      '${Constants.musicApiPath}/playlists',
      params: {
        'limit': limit,
        'offset': offset,
      },
    );
    final items = _extractList(response.data);
    return items.map((item) => normalizePlaylist(item)).toList();
  }

  static Future<Map<String, dynamic>> getPlaylist(String id) async {
    final response =
        await HttpUtil().get('${Constants.musicApiPath}/playlists/$id');
    return normalizePlaylist(Map<String, dynamic>.from(response.data as Map));
  }

  static Future<void> notifyPlay(String trackId) async {
    try {
      await HttpUtil().post(
        '${Constants.musicApiPath}/player/play',
        data: {'trackId': trackId},
      );
    } catch (error) {
      debugPrint('Daoliyu 播放状态同步失败: $error');
    }
  }

  static Future<void> notifyPause() async {
    try {
      await HttpUtil().post('${Constants.musicApiPath}/player/pause');
    } catch (error) {
      debugPrint('Daoliyu 暂停状态同步失败: $error');
    }
  }

  static Future<Map<String, dynamic>> getRadioStatus() async {
    final response = await HttpUtil().get('/radio/status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> getDailyRadioStatus() async {
    final response = await HttpUtil().get('/radio/daily/status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> runDailyRadioNow() async {
    final response = await HttpUtil().post('/radio/daily/run');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> buildDailyRadioMix({
    int trackCount = 3,
  }) async {
    final response = await HttpUtil().post(
      '/radio/daily/build',
      data: {'trackCount': trackCount},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<List<Map<String, dynamic>>> listRadioEpisodes() async {
    final response = await HttpUtil().get('/radio/episodes');
    final items = _extractList(response.data);
    return items
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  static Future<Map<String, dynamic>> getRadioChat() async {
    final response = await HttpUtil().get('/radio/chat');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> sendRadioChat(String content) async {
    final response = await HttpUtil().post(
      '/radio/chat',
      data: {'content': content},
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> updateRadioMemory({
    required String memoryId,
    required bool remember,
  }) async {
    final action = remember ? 'remember' : 'ignore';
    final response = await HttpUtil().post('/radio/memories/$memoryId/$action');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> createRadioJob({
    required List<String> trackIds,
    String title = '今日 NAS 音乐电台',
  }) async {
    final response = await HttpUtil().post(
      '/radio/jobs',
      data: {
        'title': title,
        'trackIds': trackIds,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> scanLibrary(
      {bool incremental = true}) async {
    final path = incremental
        ? '${Constants.musicApiPath}/admin/scan/incremental'
        : '${Constants.musicApiPath}/admin/scan/full';
    final response = await HttpUtil().post(path);
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> scanLibraryBackground({
    bool incremental = true,
  }) async {
    final path = incremental
        ? '${Constants.musicApiPath}/admin/scan/background/incremental'
        : '${Constants.musicApiPath}/admin/scan/background';
    final response = await HttpUtil().post(path);
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> getScanStatus() async {
    final response =
        await HttpUtil().get('${Constants.musicApiPath}/admin/scan/status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> getSqmusicStatus() async {
    final response = await HttpUtil()
        .get('${Constants.musicApiPath}/download/sqmusic/status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<List<Map<String, dynamic>>> searchSqmusic({
    required String keyword,
    String plugName = '',
    int pageSize = 20,
  }) async {
    final response = await HttpUtil().get(
      '${Constants.musicApiPath}/download/sqmusic/search',
      params: {
        'keyword': keyword,
        'plugName': plugName,
        'pageSize': pageSize,
      },
    );
    final items = _extractList(response.data);
    return items
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  static Future<Map<String, dynamic>> downloadSqmusicTrack(
    Map<String, dynamic> track,
  ) async {
    final response = await HttpUtil().post(
      '${Constants.musicApiPath}/download/sqmusic/song',
      data: {
        'track': track,
        'autoSelectBrType': true,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> rescanSqmusicDownloads() async {
    final response = await HttpUtil().post(
      '${Constants.musicApiPath}/download/sqmusic/rescan',
      data: {
        'incremental': true,
        'scrapeMissingWithQqMusic': true,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static String radioEpisodeStreamUrl(String episodeId) {
    return '${_activeApiUrl()}/radio/episodes/$episodeId/stream';
  }

  static String radioEpisodeOutroStreamUrl(String episodeId) {
    return '${_activeApiUrl()}/radio/episodes/$episodeId/outro/stream';
  }

  static Map<String, dynamic> normalizeRadioEpisode(Map<String, dynamic> raw) {
    final id = raw['id']?.toString() ?? '';
    final title = raw['title']?.toString() ?? '未命名电台';
    final durationSeconds = _asInt(raw['durationSeconds']);
    return {
      ...raw,
      'id': 'radio_$id',
      'radioEpisodeId': id,
      'source': 'radio_episode',
      'name': title,
      'ar': [
        {'id': 'nas-radio', 'name': 'NAS 音乐电台'}
      ],
      'al': {
        'id': 'nas-radio',
        'name': '私人电台',
        'picUrl': '',
      },
      'dt': durationSeconds > 0 ? durationSeconds * 1000 : 0,
      'url': radioEpisodeStreamUrl(id),
      'lyrics': raw['script']?.toString() ?? '',
      'fileFormat': raw['audioFormat']?.toString(),
      'summary': raw['summary']?.toString() ?? '',
    };
  }

  static List<Map<String, dynamic>> normalizeRadioEpisodePlaylist(
      Map<String, dynamic> raw) {
    final rawSegments = raw['segments'];
    if (rawSegments is! List || rawSegments.isEmpty) {
      return _normalizeLegacyRadioEpisodePlaylist(raw);
    }
    final hasFullMix = rawSegments.any((item) =>
        item is Map && item['type']?.toString().toLowerCase() == 'full_mix');
    if (hasFullMix) {
      return [normalizeRadioEpisode(raw)];
    }

    final episodeId = raw['id']?.toString() ?? '';
    final tracks = <Map<String, dynamic>>[];
    for (final item in rawSegments) {
      if (item is! Map) continue;
      final segment = Map<String, dynamic>.from(item);
      final type = segment['type']?.toString() ?? '';
      if (type == 'track') {
        final trackId = segment['id']?.toString() ?? '';
        if (trackId.isEmpty) continue;
        tracks.add(
          normalizeTrack({
            'id': trackId,
            'title': segment['title']?.toString() ?? '未知歌曲',
            'albumArtist': segment['artist']?.toString() ?? '未知歌手',
            'album': {
              'id': segment['album']?.toString() ?? '',
              'title': segment['album']?.toString() ?? '今日电台推荐',
            },
            'durationSeconds': _asInt(segment['durationSeconds']),
          }),
        );
        continue;
      }

      final streamUrl = segment['streamUrl']?.toString();
      final fallbackUrl = type == 'outro'
          ? radioEpisodeOutroStreamUrl(episodeId)
          : radioEpisodeStreamUrl(episodeId);
      final title = segment['title']?.toString() ??
          (type == 'outro' ? '今日电台收尾' : '今日电台开场');
      tracks.add({
        'id': segment['id']?.toString() ?? 'radio_${episodeId}_$type',
        'radioEpisodeId': episodeId,
        'source': 'radio_episode',
        'name': title,
        'ar': [
          {
            'id': 'nas-radio',
            'name': segment['artist']?.toString() ?? 'NAS 音乐电台',
          }
        ],
        'al': {
          'id': 'nas-radio',
          'name': '私人电台',
          'picUrl': '',
        },
        'dt': _asInt(segment['durationSeconds']) * 1000,
        'url': resolveServerUrl(
            streamUrl?.isNotEmpty == true ? streamUrl : fallbackUrl),
        'lyrics': _radioSegmentLyrics(raw, type),
        'fileFormat': segment['audioFormat']?.toString() ??
            raw['audioFormat']?.toString(),
        'summary': raw['summary']?.toString() ?? '',
      });
    }

    return tracks.isEmpty ? [normalizeRadioEpisode(raw)] : tracks;
  }

  static List<Map<String, dynamic>> _normalizeLegacyRadioEpisodePlaylist(
      Map<String, dynamic> raw) {
    final intro = normalizeRadioEpisode(raw);
    intro['name'] = '${raw['title']?.toString() ?? '今日电台'} 串词';
    intro['radioSegmentType'] = 'intro';

    final sourceTrackIds = _radioSourceTrackIds(raw);
    if (sourceTrackIds.isEmpty) return [intro];

    final tracks = <Map<String, dynamic>>[intro];
    for (var index = 0; index < sourceTrackIds.length; index++) {
      final trackId = sourceTrackIds[index];
      tracks.add(
        normalizeTrack({
          'id': trackId,
          'title': '第 ${index + 1} 首推荐歌曲',
          'albumArtist': 'NAS 曲库',
          'album': {
            'id': 'radio-recommendation',
            'title': '电台推荐歌曲',
          },
        }),
      );
    }
    return tracks;
  }

  static List<String> _radioSourceTrackIds(Map<String, dynamic> raw) {
    final rawIds = raw['sourceTrackIds'] ?? raw['source_track_ids'];
    if (rawIds is! List) return <String>[];
    return rawIds
        .map((item) => item?.toString().trim() ?? '')
        .where((id) => id.isNotEmpty && !id.startsWith('radio_'))
        .toList();
  }

  static String streamUrl(String trackId) {
    return '${_activeApiUrl()}/audio/$trackId';
  }

  static String resolveAssetUrl(String? path) {
    final value = (path ?? '').trim();
    if (value.isEmpty) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/v1/music/')) {
      return '${_rootServerUrl()}$value';
    }
    if (value.startsWith('/static/')) {
      return '${_activeApiUrl()}$value';
    }
    if (value.startsWith('/api/proxy-image')) {
      return '${_activeApiUrl()}$value';
    }
    if (value.startsWith('static/')) {
      return '${_activeApiUrl()}/${value.substring(0)}';
    }
    if (value.startsWith('covers/')) {
      return '${_activeApiUrl()}${Constants.staticPath}/$value';
    }
    return '${_activeApiUrl()}${Constants.staticPath}/$value';
  }

  static String resolveServerUrl(String? path) {
    final value = (path ?? '').trim();
    if (value.isEmpty) return '';
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    if (value.startsWith('/v1/music/')) {
      return '${_rootServerUrl()}$value';
    }
    if (value.startsWith('/')) {
      return '${_activeApiUrl()}$value';
    }
    return '${_activeApiUrl()}/$value';
  }

  static Map<String, dynamic> normalizeTrack(Map<String, dynamic> raw) {
    final album = raw['album'] is Map
        ? Map<String, dynamic>.from(raw['album'])
        : <String, dynamic>{};
    final artists = _artistNames(raw);
    final coverUrl = resolveAssetUrl(
      raw['coverArtUrl']?.toString().isNotEmpty == true
          ? raw['coverArtUrl'].toString()
          : album['coverArtUrl']?.toString(),
    );
    final albumTitle =
        album['title']?.toString() ?? raw['albumTitle']?.toString() ?? '未知专辑';
    final durationSeconds = _asInt(raw['durationSeconds']);

    return {
      ...raw,
      'id': raw['id']?.toString() ?? '',
      'name': raw['title']?.toString() ?? raw['name']?.toString() ?? '未知歌曲',
      'ar': artists
          .map((name) => {
                'id': name,
                'name': name,
              })
          .toList(),
      'al': {
        'id': album['id']?.toString() ?? raw['albumId']?.toString() ?? '',
        'name': albumTitle,
        'picUrl': coverUrl,
      },
      'dt': durationSeconds > 0 ? durationSeconds * 1000 : _asInt(raw['dt']),
      'url': streamUrl(raw['id']?.toString() ?? ''),
      'lyrics': raw['lyrics']?.toString() ?? '',
    };
  }

  static Map<String, dynamic> normalizePlaylist(Map<String, dynamic> raw) {
    final rawTracks =
        raw['tracks'] is List ? raw['tracks'] as List : <dynamic>[];
    final tracks = rawTracks
        .map((item) {
          if (item is Map && item['track'] is Map) {
            return normalizeTrack(
                Map<String, dynamic>.from(item['track'] as Map));
          }
          if (item is Map) {
            return normalizeTrack(Map<String, dynamic>.from(item));
          }
          return <String, dynamic>{};
        })
        .where((track) => (track['id'] ?? '').toString().isNotEmpty)
        .toList();
    final cover = resolveAssetUrl(
      raw['coverArtUrl']?.toString().isNotEmpty == true
          ? raw['coverArtUrl'].toString()
          : tracks.isNotEmpty
              ? _trackCoverUrl(tracks.first)
              : '',
    );
    return {
      ...raw,
      'id': raw['id']?.toString() ?? '',
      'name': raw['name']?.toString() ?? raw['title']?.toString() ?? '未命名歌单',
      'coverImgUrl': cover,
      'picUrl': cover,
      'playCount': raw['playCount'] ?? 0,
      'trackCount': tracks.length,
      'tracks': tracks,
    };
  }

  static List<dynamic> _extractList(dynamic data) {
    if (data is List) return data;
    if (data is Map && data['items'] is List) return data['items'] as List;
    if (data is Map && data['tracks'] is List) return data['tracks'] as List;
    if (data is Map && data['playlists'] is List) {
      return data['playlists'] as List;
    }
    return <dynamic>[];
  }

  static List<String> _artistNames(Map<String, dynamic> raw) {
    final artists = raw['artists'];
    if (artists is List && artists.isNotEmpty) {
      return artists
          .map((item) {
            if (item is Map && item['artist'] is Map) {
              return (item['artist'] as Map)['name']?.toString() ?? '';
            }
            if (item is Map) {
              return item['name']?.toString() ?? '';
            }
            return item.toString();
          })
          .where((name) => name.isNotEmpty)
          .toList();
    }
    final albumArtist = raw['albumArtist']?.toString();
    if (albumArtist != null && albumArtist.isNotEmpty) return [albumArtist];
    return ['未知歌手'];
  }

  static int _asInt(dynamic value) {
    if (value is int) return value;
    if (value is num) return value.round();
    return int.tryParse(value?.toString() ?? '') ?? 0;
  }

  static String _trackCoverUrl(Map<String, dynamic> track) {
    final album = track['al'];
    if (album is Map) return album['picUrl']?.toString() ?? '';
    return '';
  }

  static String _radioSegmentLyrics(Map<String, dynamic> raw, String type) {
    final script = raw['script']?.toString() ?? '';
    if (type != 'outro') return script;
    final marker = '--- 收尾 ---';
    final markerIndex = script.indexOf(marker);
    if (markerIndex < 0) return script;
    return script.substring(markerIndex + marker.length).trim();
  }

  static String _rootServerUrl() {
    final uri = Uri.parse(_activeApiUrl());
    return '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
  }

  static String _activeApiUrl() {
    return HttpUtil().activeBaseUrl;
  }
}
