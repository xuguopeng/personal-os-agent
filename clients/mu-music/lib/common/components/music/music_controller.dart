/*
 * @Author: 新西兰的肉夹馍
 * @Date: 2025-01-27 10:00:00
 * @LastEditTime: 2025-10-04 17:25:56
 * @FilePath: /mu-music/lib/common/components/music/music_controller.dart
 * @Description: 全局音乐播放控制器
 * 在这个虚拟的空间里，我试图捕捉真实的自我，与世界分享。
 */
import 'package:get/get.dart';
import 'package:mu_music/common/index.dart';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'dart:async';
import 'package:just_audio/just_audio.dart';

class GlobalMusicController extends GetxController {
  // 当前播放的音乐
  final Rxn<Song> _currentMusic = Rxn<Song>();
  Song? get currentMusic => _currentMusic.value;

  // 歌词列表
  final RxList<LyricData> _lyrics = <LyricData>[].obs;
  RxList<LyricData> get lyrics => _lyrics;

  // 当前高亮的歌词索引
  final RxInt _currentLyricIndex = 0.obs;
  int get currentLyricIndex => _currentLyricIndex.value;

  final ScrollController lyricScrollController = ScrollController();

  // 注入播放列表存储
  final PlaylistStore playlistStore = Get.find<PlaylistStore>();
  // 注入全局播放状态管理器
  final GlobalPlayerStore globalPlayerStore = Get.find<GlobalPlayerStore>();

  // 音频播放器 - 使用后台播放支持
  final AudioPlayer _audioPlayer = AudioPlayer();
  final AudioPlayer _voicePlayer = AudioPlayer();
  final double _musicVolume = 1.0;

  // 播放状态管理
  final RxBool _isPlaying = false.obs;
  bool get isPlaying => _isPlaying.value;

  final RxBool _isDjSpeaking = false.obs;
  bool get isDjSpeaking => _isDjSpeaking.value;

  // 当前播放进度(毫秒)
  final RxInt _currentPosition = 0.obs;
  int get currentPosition => _currentPosition.value;

  // 总时长(毫秒)
  final RxInt _totalDuration = 0.obs;
  int get totalDuration => _totalDuration.value;

  // 流订阅
  StreamSubscription<Duration>? positionSubscription;
  StreamSubscription<Duration?>? durationSubscription;
  StreamSubscription<PlayerState>? playerStateSubscription;

  // 播放列表监听器
  StreamSubscription? playlistSubscription;
  // 播放模式监听器
  StreamSubscription? playModeSubscription;

  // 是否正在切换上下曲的标志位
  bool _isSwitchingTrack = false;
  int _suppressPlaylistAutoLoadUntil = 0;
  final Set<String> _metadataRefreshInFlight = {};
  String _lastNarrationKey = '';
  int _lastNarrationAt = 0;
  Map<String, dynamic>? _pendingNarrationTrack;
  bool _pendingNarrationForce = false;

  void suppressPlaylistAutoLoad({
    Duration duration = const Duration(milliseconds: 250),
  }) {
    _suppressPlaylistAutoLoadUntil =
        DateTime.now().millisecondsSinceEpoch + duration.inMilliseconds;
  }

  bool get _playlistAutoLoadSuppressed {
    return DateTime.now().millisecondsSinceEpoch <
        _suppressPlaylistAutoLoadUntil;
  }

  // 解析歌词文本为Lyric列表
  void parseLyrics(String lyricText) {
    final List<LyricData> result = [];
    final lines = LineSplitter.split(lyricText);
    final timestampPattern =
        RegExp(r'\[(\d{1,3}):(\d{1,2})(?:[\.:](\d{1,3}))?\]');
    var plainLineIndex = 0;
    for (final rawLine in lines) {
      final line = rawLine.trim();
      if (line.isEmpty) continue;
      final matches = timestampPattern.allMatches(line).toList();
      final text = line.replaceAll(timestampPattern, '').trim();
      if (matches.isEmpty) {
        if (text.isNotEmpty && !line.startsWith('[')) {
          result.add(LyricData(time: plainLineIndex * 5000, text: text));
          plainLineIndex += 1;
        }
        continue;
      }
      if (text.isEmpty) continue;
      for (final timeMatch in matches) {
        final minute = int.parse(timeMatch.group(1)!);
        final second = int.parse(timeMatch.group(2)!);
        final fraction = timeMatch.group(3) ?? '0';
        final millisecond = switch (fraction.length) {
          1 => int.parse(fraction) * 100,
          2 => int.parse(fraction) * 10,
          _ => int.parse(fraction.padRight(3, '0').substring(0, 3)),
        };
        final time = minute * 60 * 1000 + second * 1000 + millisecond;
        result.add(LyricData(time: time, text: text));
        debugPrint('解析歌词: ${time}ms - $text');
      }
    }
    // 按时间排序
    result.sort((a, b) => a.time.compareTo(b.time));
    _lyrics.value = result;
    debugPrint('解析完成，共${result.length}行歌词');
  }

  /// 加载音乐并开始播放
  Future<void> loadMusic(Song music) async {
    try {
      _currentMusic.value = music;

      // 同步当前歌曲到全局播放状态管理器
      final track = playlistStore.currentTrack;
      if (track != null) {
        globalPlayerStore.setCurrentTrack(track);
      }

      final audioUrl = music.data[0]['url'] as String?;

      if (audioUrl == null || audioUrl.isEmpty) {
        debugPrint('音频链接为空');
        return;
      }

      debugPrint('音频链接: $audioUrl');

      // 检查URL协议
      final uri = Uri.parse(audioUrl);
      if (uri.scheme == 'http') {
        debugPrint('⚠️ 检测到HTTP音频链接，请确保Android网络安全配置允许明文传输');
      }

      // 先设置监听器（必须在加载音频前设置）
      _setupAudioListeners();

      // 设置音频源（添加请求头解决权限问题）
      await _audioPlayer.setAudioSource(
        AudioSource.uri(
          uri,
          headers: {
            'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': 'https://music.163.com/',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            // 添加这些头部来帮助处理HTTP音频流
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            ...HttpUtil().authHeaders,
          },
        ),
      );
      // 设置播放模式
      debugPrint('playlistStore.currentTrack: ${playlistStore.currentTrack}');
      debugPrint('音频源设置完成');
      await _audioPlayer.setVolume(_musicVolume);
      _startAudioPlayback();
      if (track != null) {
        queueAttachedNarrationForTrack(track);
      }
      final trackId = track?['id']?.toString();
      if (trackId != null && trackId.isNotEmpty) {
        await NasMusicApi.notifyPlay(trackId);
      }
    } catch (e) {
      debugPrint('加载音乐失败: $e');
      // 提供更详细的错误信息
      if (e.toString().contains('CleartextNotPermittedException')) {
        debugPrint('❌ 明文HTTP传输被禁止，请检查Android网络安全配置');
        debugPrint(
            '💡 解决方案：确保AndroidManifest.xml中已配置usesCleartextTraffic="true"');
        debugPrint('💡 并确保network_security_config.xml允许相应的域名');
      }
    }
  }

  Future<void> playDuckedNarration(String audioUrl) async {
    if (audioUrl.trim().isEmpty) return;
    final uri = Uri.parse(audioUrl);
    final targetMusicVolume = _isPlaying.value ? 0.28 : _musicVolume;
    try {
      _isDjSpeaking.value = true;
      if (_isPlaying.value) {
        await _fadeMusicVolume(_musicVolume, targetMusicVolume);
      }
      await _voicePlayer.stop();
      await _voicePlayer.setAudioSource(
        AudioSource.uri(
          uri,
          headers: {
            'User-Agent': 'mu-music/1.0',
            'Accept': '*/*',
            ...HttpUtil().authHeaders,
          },
        ),
      );
      await _voicePlayer.setVolume(1.0);
      await _voicePlayer.play();
      await _voicePlayer.processingStateStream.firstWhere(
        (state) =>
            state == ProcessingState.completed || state == ProcessingState.idle,
      );
    } catch (error) {
      debugPrint('DJ 口播播放失败: $error');
    } finally {
      await _voicePlayer.stop();
      if (_isPlaying.value) {
        await _fadeMusicVolume(targetMusicVolume, _musicVolume);
      }
      _isDjSpeaking.value = false;
    }
  }

  Future<void> _fadeMusicVolume(double from, double to) async {
    const steps = 8;
    for (var index = 1; index <= steps; index += 1) {
      final value = from + (to - from) * (index / steps);
      await _audioPlayer.setVolume(value.clamp(0.0, 1.0));
      await Future.delayed(const Duration(milliseconds: 28));
    }
  }

  void _startAudioPlayback() {
    unawaited(
      _audioPlayer.play().catchError((Object error, StackTrace stackTrace) {
        debugPrint('播放启动失败: $error');
      }),
    );
  }

  Future<void> playAttachedNarrationForTrack(
    Map<String, dynamic> track, {
    Duration delay = const Duration(milliseconds: 420),
    bool force = false,
  }) async {
    final streamUrl = track['radioSpokenStreamUrl']?.toString() ?? '';
    if (streamUrl.trim().isEmpty) return;
    final resolvedUrl = NasMusicApi.resolveServerUrl(streamUrl);
    final key = '${track['id'] ?? ''}|$resolvedUrl';
    final now = DateTime.now().millisecondsSinceEpoch;
    if (!force && key == _lastNarrationKey && now - _lastNarrationAt < 30000) {
      return;
    }
    _lastNarrationKey = key;
    _lastNarrationAt = now;
    await Future.delayed(delay);
    await playDuckedNarration(resolvedUrl);
  }

  void queueAttachedNarrationForTrack(
    Map<String, dynamic> track, {
    bool force = false,
  }) {
    final streamUrl = track['radioSpokenStreamUrl']?.toString() ?? '';
    if (streamUrl.trim().isEmpty) return;
    _pendingNarrationTrack = track;
    _pendingNarrationForce = force;
    _tryPlayPendingNarration();
  }

  void _tryPlayPendingNarration() {
    final track = _pendingNarrationTrack;
    if (track == null) return;
    if (!_audioPlayer.playing) return;
    if (_audioPlayer.processingState != ProcessingState.ready) return;
    final force = _pendingNarrationForce;
    _pendingNarrationTrack = null;
    _pendingNarrationForce = false;
    unawaited(
      playAttachedNarrationForTrack(
        track,
        delay: const Duration(milliseconds: 120),
        force: force,
      ),
    );
  }

  /// 设置音频监听器
  void _setupAudioListeners() {
    // 先清理已有的监听器，避免重复订阅
    clearAudioListeners();

    // 监听播放位置变化
    positionSubscription = _audioPlayer.positionStream.listen((position) {
      _currentPosition.value = position.inMilliseconds;
      _updateCurrentLyricIndex();
    });

    // 监听总时长变化
    durationSubscription = _audioPlayer.durationStream.listen((duration) {
      if (duration != null) {
        _totalDuration.value = duration.inMilliseconds;
      }
    });

    // 监听播放状态变化
    playerStateSubscription = _audioPlayer.playerStateStream.listen((state) {
      _isPlaying.value = state.playing;
      // 同步到全局播放状态管理器
      globalPlayerStore.setPlayingState(state.playing);
      _tryPlayPendingNarration();

      // 播放结束处理
      if (state.processingState == ProcessingState.completed) {
        _currentPosition.value = _totalDuration.value;
        _isPlaying.value = false;
        globalPlayerStore.setPlayingState(false);

        // 自动播放下一首
        playNext();
      }
    });

    debugPrint('音频监听器已设置');
  }

  /// 清理音频监听器
  void clearAudioListeners() {
    positionSubscription?.cancel();
    durationSubscription?.cancel();
    playerStateSubscription?.cancel();
  }

  /// 设置播放列表监听器
  void _setupPlaylistListener() {
    playlistSubscription?.cancel();
    playModeSubscription?.cancel();

    // 监听播放列表索引变化
    playlistSubscription = playlistStore.currentIndexStream.listen((index) {
      debugPrint('播放列表索引变化: $index');
      if (_playlistAutoLoadSuppressed) {
        debugPrint('忽略一次手动加载期间的播放列表自动加载');
        return;
      }
      final track = playlistStore.currentTrack;
      if (track != null) {
        loadMusicFromTrack(track);
      }
    });

    // 监听播放模式变化
    playModeSubscription = playlistStore.playModeStream.listen((mode) {
      debugPrint('播放模式变化: $mode');
      // 更新UI以反映播放模式变化
      update();
    });
  }

  /// 更新当前歌词索引
  void _updateCurrentLyricIndex() {
    final currentPos = _currentPosition.value;
    if (_lyrics.isEmpty) return;

    for (int i = 0; i < _lyrics.length; i++) {
      // 找到当前时间对应的歌词
      if (currentPos >= _lyrics[i].time &&
          (i == _lyrics.length - 1 || currentPos < _lyrics[i + 1].time)) {
        if (_currentLyricIndex.value != i) {
          _currentLyricIndex.value = i;

          // 立即更新UI
          update();

          // 延迟滚动，确保UI更新完成
          Future.delayed(Duration(milliseconds: 100), () {
            _scrollToCurrentLyric(i);
          });
        }
        break;
      }
    }
  }

  /// 滚动歌词到当前位置
  void _scrollToCurrentLyric(int index) {
    if (lyricScrollController.hasClients) {
      final itemHeight = 50.0;

      // 计算当前歌词在屏幕中的位置
      final targetPosition = index * itemHeight;

      // 获取当前滚动位置
      final currentPosition = lyricScrollController.position.pixels;

      // 获取可视区域高度
      final viewportHeight = lyricScrollController.position.viewportDimension;

      // 计算目标位置，让当前歌词居中显示
      final centerPosition =
          targetPosition - viewportHeight / 2 + itemHeight / 2;

      // 确保滚动位置在有效范围内
      final clampedPosition = centerPosition.clamp(
          0.0, lyricScrollController.position.maxScrollExtent);

      // 只有当目标位置与当前位置差距较大时才滚动
      if ((clampedPosition - currentPosition).abs() > 10) {
        lyricScrollController.animateTo(
          clampedPosition,
          duration: Duration(milliseconds: 300),
          curve: Curves.easeInOut,
        );
      }
    }
  }

  /// 切换播放/暂停
  Future<void> togglePlayPause() async {
    try {
      debugPrint('切换播放状态: 当前状态=${_isPlaying.value}');
      if (_isPlaying.value) {
        debugPrint('执行暂停');
        await _audioPlayer.pause();
        await NasMusicApi.notifyPause();
      } else {
        debugPrint('执行播放');
        _startAudioPlayback();
        _tryPlayPendingNarration();
        final trackId = playlistStore.currentTrack?['id']?.toString();
        if (trackId != null && trackId.isNotEmpty) {
          await NasMusicApi.notifyPlay(trackId);
        }
      }
    } catch (e) {
      debugPrint('播放控制失败: $e');
    }
  }

  /// 跳转到指定歌词
  Future<void> jumpToLyric(int index) async {
    if (index < 0 || index >= _lyrics.length) return;
    await seekTo(_lyrics[index].time);
  }

  /// 跳转到指定进度
  Future<void> seekTo(int position) async {
    if (position < 0 || position > _totalDuration.value) return;
    try {
      await _audioPlayer.seek(Duration(milliseconds: position));
    } catch (e) {
      debugPrint('跳转失败: $e');
    }
  }

  /// 格式化时长(毫秒 -> mm:ss)
  String formatDuration(int milliseconds) {
    final totalSeconds = milliseconds ~/ 1000;
    final minutes = (totalSeconds ~/ 60).toString().padLeft(2, '0');
    final seconds = (totalSeconds % 60).toString().padLeft(2, '0');
    return "$minutes:$seconds";
  }

  /// 播放下一首
  void playNext() {
    if (!playlistStore.hasPlaylist) {
      debugPrint('没有播放列表');
      return;
    }

    // 设置切换标志位
    _isSwitchingTrack = true;

    // 先暂停当前播放
    if (_isPlaying.value) {
      _audioPlayer.pause();
    }

    playlistStore.nextTrack();
    final nextTrack = playlistStore.currentTrack;
    if (nextTrack != null) {
      loadMusicFromTrack(nextTrack);
    }
  }

  /// 播放上一首
  void playPrevious() {
    if (!playlistStore.hasPlaylist) {
      debugPrint('没有播放列表');
      return;
    }

    // 设置切换标志位
    _isSwitchingTrack = true;

    // 先暂停当前播放
    if (_isPlaying.value) {
      _audioPlayer.pause();
    }

    playlistStore.previousTrack();
    final previousTrack = playlistStore.currentTrack;
    if (previousTrack != null) {
      loadMusicFromTrack(previousTrack);
    }
  }

  /// 从播放列表曲目加载音乐
  Future<void> loadMusicFromTrack(Map<String, dynamic> track) async {
    try {
      if (track['source'] == 'radio_episode') {
        await _loadDirectTrack(track, setupPlaylistListener: false);
        if (_isSwitchingTrack) {
          _startAudioPlayback();
          _isSwitchingTrack = false;
        }
        return;
      }

      // 获取音频URL
      final trackId = track['id']?.toString() ?? '';
      if (trackId.isEmpty) {
        debugPrint('歌曲 ID 为空，无法播放');
        return;
      }
      final playbackTrack = await _freshTrackForPlayback(track);
      final songData = _songFromTrack(playbackTrack);
      if (songData.data.isNotEmpty) {
        _currentMusic.value = songData;

        final lyricText = await _ensureLyricsForTrack(playbackTrack);
        parseLyrics(lyricText);
        _syncCurrentTrack(playbackTrack, lyricText);

        // 加载并播放音乐
        await loadMusic(songData);

        // 如果正在切换上下曲，自动开始播放
        if (_isSwitchingTrack) {
          _startAudioPlayback();
          _isSwitchingTrack = false; // 重置标志位
        } else if (!_isPlaying.value) {
          // 非切换情况下，如果当前没有播放则开始播放
          _startAudioPlayback();
        }

        update();
      }
    } catch (e) {
      debugPrint('加载播放列表歌曲失败: $e');
      _isSwitchingTrack = false; // 出错时也要重置标志位
    }
  }

  /// 初始化音乐数据
  Future<void> initMusicData(Map<String, dynamic> track) async {
    try {
      if (track['source'] == 'radio_episode') {
        await _loadDirectTrack(track);
        return;
      }

      final trackId = track['id']?.toString() ?? '';
      if (trackId.isEmpty) {
        debugPrint('歌曲 ID 为空，无法初始化');
        return;
      }
      final playbackTrack = await _freshTrackForPlayback(track);
      final songData = _songFromTrack(playbackTrack);
      final lyricText = await _ensureLyricsForTrack(playbackTrack);

      _currentMusic.value = songData;
      parseLyrics(lyricText);
      _syncCurrentTrack(playbackTrack, lyricText);

      await loadMusic(songData);

      // 设置播放列表监听器
      _setupPlaylistListener();

      update();
    } catch (e) {
      debugPrint('初始化音乐数据失败: $e');
    }
  }

  Future<void> _loadDirectTrack(
    Map<String, dynamic> track, {
    bool setupPlaylistListener = true,
  }) async {
    final audioUrl = track['url']?.toString() ?? '';
    if (audioUrl.isEmpty) {
      debugPrint('直接播放音频链接为空');
      return;
    }
    final songData = Song.fromJson({
      'code': 200,
      'data': [
        {
          'id': track['id'],
          'url': audioUrl,
          'level': 'radio',
          'type': track['fileFormat'],
          'size': track['fileSize'],
          'time': track['dt'],
        }
      ],
    });

    _currentMusic.value = songData;
    final lyricText = await _ensureLyricsForTrack(track);
    parseLyrics(lyricText);
    _syncCurrentTrack(track, lyricText);
    await loadMusic(songData);
    if (setupPlaylistListener) {
      _setupPlaylistListener();
    }
    update();
  }

  Future<Map<String, dynamic>> _freshTrackForPlayback(
    Map<String, dynamic> track,
  ) async {
    final trackId = track['id']?.toString() ?? '';
    if (trackId.isEmpty || trackId.startsWith('radio_')) return track;
    try {
      final fresh = await NasMusicApi.getTrack(trackId);
      final merged = <String, dynamic>{...fresh, ...track};
      for (final key in [
        'url',
        'coverArtUrl',
        'fileFormat',
        'fileSize',
        'dt',
        'durationSeconds',
      ]) {
        final current = merged[key]?.toString() ?? '';
        final freshValue = fresh[key];
        if (current.trim().isEmpty && freshValue != null) {
          merged[key] = freshValue;
        }
      }
      final freshLyrics = fresh['lyrics']?.toString() ?? '';
      if (_hasUsefulLyrics(freshLyrics)) {
        merged['lyrics'] = freshLyrics;
      }
      return merged;
    } catch (error) {
      debugPrint('刷新 NAS 歌曲信息失败: $error');
      return track;
    }
  }

  Song _songFromTrack(Map<String, dynamic> track) {
    return Song.fromJson({
      'code': 200,
      'data': [
        {
          'id': track['id'],
          'url': track['url'],
          'level': track['level'] ?? 'nas',
          'type': track['fileFormat'],
          'size': track['fileSize'],
          'time': track['dt'],
        }
      ],
    });
  }

  Future<String> _ensureLyricsForTrack(Map<String, dynamic> track) async {
    var lyricText = track['lyrics']?.toString() ?? '';
    if (_hasUsefulLyrics(lyricText)) return lyricText;

    final trackId = track['id']?.toString() ?? '';
    if (trackId.isEmpty || trackId.startsWith('radio_')) return lyricText;

    try {
      final fresh = await NasMusicApi.getTrack(trackId);
      lyricText = fresh['lyrics']?.toString() ?? '';
      if (_hasUsefulLyrics(lyricText)) return lyricText;
    } catch (_) {
      // Continue to targeted scrape fallback.
    }

    unawaited(_refreshLyricsForTrackInBackground(trackId));
    return '';
  }

  Future<void> _refreshLyricsForTrackInBackground(String trackId) async {
    if (_metadataRefreshInFlight.contains(trackId)) return;
    _metadataRefreshInFlight.add(trackId);
    try {
      await NasMusicApi.refreshTrackMetadata(trackId);
      for (var attempt = 0; attempt < 8; attempt += 1) {
        await Future<void>.delayed(const Duration(seconds: 2));
        final fresh = await NasMusicApi.getTrack(trackId);
        final lyricText = fresh['lyrics']?.toString() ?? '';
        if (!_hasUsefulLyrics(lyricText)) continue;
        final currentTrackId =
            globalPlayerStore.currentTrack?['id']?.toString() ?? '';
        if (currentTrackId == trackId) {
          parseLyrics(lyricText);
          _syncCurrentTrack(fresh, lyricText);
          update();
        }
        return;
      }
    } catch (error) {
      debugPrint('后台刷新歌词失败: $error');
    } finally {
      _metadataRefreshInFlight.remove(trackId);
    }
  }

  bool _hasUsefulLyrics(String value) {
    final text = value.trim();
    if (text.isEmpty) return false;
    if (text == '歌词会在播放时跟随当前位置滚动。') return false;
    return text.length > 8;
  }

  void _syncCurrentTrack(Map<String, dynamic> track, String lyricText) {
    final nextTrack = {
      ...track,
      if (lyricText.trim().isNotEmpty) 'lyrics': lyricText,
    };
    globalPlayerStore.setCurrentTrack(nextTrack);
  }

  @override
  void onInit() {
    super.onInit();
    // 注册到全局播放状态管理器
    globalPlayerStore.setMusicController(this);
  }

  @override
  void onClose() {
    // 不清理音频播放器，保持播放状态
    clearAudioListeners();
    _voicePlayer.dispose();
    lyricScrollController.dispose();
    super.onClose();
  }
}
