import 'package:flutter/foundation.dart';
import 'package:dio/dio.dart';
import 'package:mu_music/common/index.dart';

class NasMusicApi {
  static String get streamBaseUrl =>
      '${_activeApiUrl()}${Constants.musicApiPath}';

  static Future<Map<String, dynamic>> getStatus() async {
    final response = await HttpUtil().get('/status');
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
        if (keyword.trim().isNotEmpty) 'keyword': keyword.trim(),
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
        track['fileName'],
        track['filePath'],
        track['sourcePath'],
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
      debugPrint('NAS 播放状态同步失败: $error');
    }
  }

  static Future<void> notifyPause() async {
    try {
      await HttpUtil().post('${Constants.musicApiPath}/player/pause');
    } catch (error) {
      debugPrint('NAS 暂停状态同步失败: $error');
    }
  }

  static Future<List<Map<String, dynamic>>> listFavoriteTracks() async {
    final response =
        await HttpUtil().get('${Constants.musicApiPath}/favorites/tracks');
    final items = _extractList(response.data);
    return items.map((item) => normalizeTrack(item)).toList();
  }

  static Future<Map<String, dynamic>> setFavoriteTrack({
    required String trackId,
    required bool liked,
  }) async {
    if (liked) {
      final response = await HttpUtil().put(
        '${Constants.musicApiPath}/favorites/tracks/$trackId',
      );
      return Map<String, dynamic>.from(response.data as Map);
    }
    final response = await HttpUtil().delete(
      '${Constants.musicApiPath}/favorites/tracks/$trackId',
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> getDjStatus() async {
    final response = await HttpUtil().getRoot('/dj/status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> getDjChat() async {
    final response = await HttpUtil().getRoot('/dj/chat');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> getDjToday({
    bool autoBuild = false,
  }) async {
    final response = await HttpUtil().getRoot(
      '/dj/today',
      params: {'autoBuild': autoBuild},
      options: Options(
        receiveTimeout: Duration(seconds: autoBuild ? 600 : 30),
        sendTimeout: Duration(seconds: 20),
      ),
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> probeDjTts() async {
    final response = await HttpUtil().postRoot(
      '/dj/tts/probe',
      options: Options(
        receiveTimeout: Duration(seconds: 300),
        sendTimeout: Duration(seconds: 20),
      ),
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> buildDjEpisode({
    bool force = false,
    String message = '生成今天的真人口播电台',
  }) async {
    final response = await HttpUtil().postRoot(
      '/dj/episode/build',
      data: {
        'force': force,
        'message': message,
      },
      options: Options(
        receiveTimeout: Duration(seconds: 650),
        sendTimeout: Duration(seconds: 20),
      ),
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> sendRadioChat(String content) async {
    final response = await HttpUtil().postRoot(
      '/dj/chat',
      data: {'content': content},
      options: Options(
        receiveTimeout: Duration(seconds: 120),
        sendTimeout: Duration(seconds: 20),
      ),
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> updateRadioMemory({
    required String memoryId,
    required bool remember,
  }) async {
    final action = remember ? 'remember' : 'ignore';
    final response =
        await HttpUtil().postRoot('/dj/memories/$memoryId/$action');
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
        .get('${Constants.musicApiPath}/api/download/sqmusic/status');
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<List<Map<String, dynamic>>> searchSqmusic({
    required String keyword,
    String plugName = '',
    int pageSize = 20,
  }) async {
    final response = await HttpUtil().get(
      '${Constants.musicApiPath}/api/download/sqmusic/search',
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
      '${Constants.musicApiPath}/api/download/sqmusic/song',
      data: {
        'track': track,
        'autoSelectBrType': true,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> rescanSqmusicDownloads() async {
    final response = await HttpUtil().post(
      '${Constants.musicApiPath}/api/download/sqmusic/rescan',
      data: {
        'incremental': true,
        'scrapeMissingWithQqMusic': true,
      },
    );
    return Map<String, dynamic>.from(response.data as Map);
  }

  static Future<Map<String, dynamic>> refreshTrackMetadata(
      String trackId) async {
    final response = await HttpUtil().post(
      '${Constants.musicApiPath}/admin/metadata/scrape/jobs',
      data: {
        'providers': ['qqmusic'],
        'missing': ['lyrics', 'cover'],
        'trackIds': [trackId],
        'limit': 10,
        'candidateLimit': 3,
        'autoApply': true,
        'minConfidence': 0.92,
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
    final rawFlow = raw['playbackFlow'];
    final rawSegments =
        rawFlow is List && rawFlow.isNotEmpty ? rawFlow : raw['segments'];
    if (rawSegments is! List || rawSegments.isEmpty) {
      return <Map<String, dynamic>>[];
    }
    final episodeId = raw['id']?.toString() ?? '';
    final tracks = <Map<String, dynamic>>[];
    Map<String, dynamic>? pendingSpoken;
    for (final item in rawSegments) {
      if (item is! Map) continue;
      final segment = Map<String, dynamic>.from(item);
      final type = segment['type']?.toString() ?? '';
      if (type.toLowerCase() == 'full_mix') continue;
      if (type == 'track') {
        final trackId = segment['id']?.toString() ?? '';
        if (trackId.isEmpty) continue;
        final normalized = normalizeTrack({
          ...segment,
          'id': trackId,
          'title': segment['title']?.toString() ?? '未知歌曲',
          'albumArtist': segment['artist']?.toString() ?? '未知歌手',
          'album': {
            'id': segment['album']?.toString() ?? '',
            'title': segment['album']?.toString() ?? '今日电台推荐',
          },
          'durationSeconds': _asInt(segment['durationSeconds']),
        });
        tracks.add({
          ...normalized,
          'radioEpisodeId': episodeId,
          'radioFlowType': 'track',
          'radioStage': segment['stage']?.toString() ?? '',
          'radioStageName': segment['stageName']?.toString() ?? '',
          'radioReason': segment['reason']?.toString() ?? '',
          if (pendingSpoken != null) ...{
            'radioSpokenStreamUrl':
                pendingSpoken['streamUrl']?.toString() ?? '',
            'radioSpokenText': pendingSpoken['text']?.toString() ?? '',
            'radioSpokenTitle': pendingSpoken['title']?.toString() ?? '',
          },
          'lyrics': segment['lyrics']?.toString().trim().isNotEmpty == true
              ? segment['lyrics'].toString()
              : segment['reason']?.toString() ?? '',
        });
        pendingSpoken = null;
        continue;
      }

      pendingSpoken = segment;
    }

    if (tracks.isEmpty) return [normalizeRadioEpisode(raw)];
    return tracks;
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
    if (value.startsWith('/v1/music/') || value.startsWith('/v1/dj/')) {
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
    if (value.startsWith('/v1/music/') || value.startsWith('/v1/dj/')) {
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
    final rawStreamUrl = raw['streamUrl']?.toString() ?? '';

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
      'url': rawStreamUrl.isNotEmpty
          ? resolveServerUrl(rawStreamUrl)
          : NasMusicApi.streamUrl(raw['id']?.toString() ?? ''),
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

  static String _rootServerUrl() {
    final uri = Uri.parse(_activeApiUrl());
    return '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';
  }

  static String _activeApiUrl() {
    return HttpUtil().activeBaseUrl;
  }
}
