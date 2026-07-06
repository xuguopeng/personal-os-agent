import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:get/get.dart';
import 'package:get_storage/get_storage.dart';
import 'package:loading_animation_widget/loading_animation_widget.dart';
import 'package:mu_music/common/index.dart';

part 'desktop_music/desktop_music_models.dart';
part 'desktop_music/desktop_music_background.dart';
part 'desktop_music/desktop_music_reference_widgets.dart';
part 'desktop_music/desktop_music_library_widgets.dart';

enum _VerticalDjPanel { chat, player, profile }

class DesktopMusicHome extends StatefulWidget {
  DesktopMusicHome({super.key});

  @override
  State<DesktopMusicHome> createState() => _DesktopMusicHomeState();
}

class _DesktopMusicHomeState extends State<DesktopMusicHome> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _downloadSearchController =
      TextEditingController();
  final TextEditingController _radioChatController = TextEditingController();
  final ScrollController _radioChatScrollController = ScrollController();
  final GetStorage _storage = GetStorage();
  final PlaylistStore _playlistStore = Get.find<PlaylistStore>();
  final GlobalMusicController _musicController =
      Get.find<GlobalMusicController>();
  final GlobalPlayerStore _globalPlayerStore = Get.find<GlobalPlayerStore>();

  List<Map<String, dynamic>> _tracks = [];
  List<Map<String, dynamic>> _radioEpisodes = [];
  List<Map<String, dynamic>> _radioChatMessages = [];
  List<Map<String, dynamic>> _radioMemories = [];
  Map<String, dynamic>? _radioStatus;
  Map<String, dynamic>? _dailyRadioStatus;
  Set<String> _favoriteTrackIds = {};
  List<String> _playHistoryIds = [];
  _DesktopMusicViewMode _viewMode = _DesktopMusicViewMode.tracks;
  String? _selectedArtistName;
  bool _loading = true;
  bool _radioLoading = false;
  bool _radioGenerating = false;
  bool _dailyRadioGenerating = false;
  bool _scanRunning = false;
  bool _sqmusicSearching = false;
  bool _sqmusicDownloading = false;
  bool _radioChatSending = false;
  String? _error;
  String? _radioError;
  String? _toolMessage;
  String? _hoveredTrackId;
  _VerticalDjPanel _verticalPanel = _VerticalDjPanel.chat;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
    _loadPlaybackHistory();
    _loadTracks();
    _loadRadioStatus();
    _loadRadioEpisodes();
    _loadDailyRadioStatus();
    _loadRadioChat();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _downloadSearchController.dispose();
    _radioChatController.dispose();
    _radioChatScrollController.dispose();
    super.dispose();
  }

  Future<void> _loadTracks([String keyword = '']) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await NasMusicApi.login();
      final tracks = await NasMusicApi.listTracks(
        keyword: keyword,
        limit: 80,
      );
      if (!mounted) return;
      setState(() {
        _tracks = tracks;
        _loading = false;
      });
      if (_globalPlayerStore.currentTrack == null && tracks.isNotEmpty) {
        _globalPlayerStore.setCurrentTrack(tracks.first);
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _loading = false;
      });
    }
  }

  void _loadFavorites() {
    final stored =
        _storage.read<List<dynamic>>('desktop_favorite_track_ids') ?? [];
    _favoriteTrackIds = stored.map((item) => item.toString()).toSet();
  }

  void _loadPlaybackHistory() {
    final stored =
        _storage.read<List<dynamic>>('desktop_play_history_ids') ?? [];
    _playHistoryIds = stored.map((item) => item.toString()).toList();
  }

  void _toggleFavorite(Map<String, dynamic> track) {
    final id = track['id']?.toString() ?? '';
    if (id.isEmpty) return;
    setState(() {
      if (_favoriteTrackIds.contains(id)) {
        _favoriteTrackIds.remove(id);
      } else {
        _favoriteTrackIds.add(id);
      }
    });
    _storage.write('desktop_favorite_track_ids', _favoriteTrackIds.toList());
  }

  Future<void> _playTrack(Map<String, dynamic> track, int index) async {
    final playlist = _visibleTracks();
    _playlistStore.setCurrentPlaylist(playlist, startIndex: index);
    _globalPlayerStore.setCurrentTrack(track);
    _addPlaybackHistory(track);
    await _musicController.initMusicData(track);
  }

  void _addPlaybackHistory(Map<String, dynamic> track) {
    final id = track['id']?.toString() ?? '';
    if (id.isEmpty || id.startsWith('radio_')) return;
    setState(() {
      _playHistoryIds.remove(id);
      _playHistoryIds.insert(0, id);
      if (_playHistoryIds.length > 80) {
        _playHistoryIds = _playHistoryIds.take(80).toList();
      }
    });
    _storage.write('desktop_play_history_ids', _playHistoryIds);
  }

  Future<void> _loadRadioEpisodes() async {
    setState(() {
      _radioLoading = true;
      _radioError = null;
    });
    try {
      final episodes = await NasMusicApi.listRadioEpisodes();
      if (!mounted) return;
      setState(() {
        _radioEpisodes = episodes;
        _radioLoading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _radioError = error.toString();
        _radioLoading = false;
      });
    }
  }

  Future<void> _loadRadioStatus() async {
    try {
      final status = await NasMusicApi.getRadioStatus();
      if (!mounted) return;
      setState(() => _radioStatus = status);
    } catch (_) {
      if (!mounted) return;
      setState(() => _radioStatus = null);
    }
  }

  Future<void> _loadDailyRadioStatus() async {
    try {
      final status = await NasMusicApi.getDailyRadioStatus();
      if (!mounted) return;
      setState(() => _dailyRadioStatus = status);
    } catch (_) {
      if (!mounted) return;
      setState(() => _dailyRadioStatus = null);
    }
  }

  Future<void> _loadRadioChat() async {
    try {
      final result = await NasMusicApi.getRadioChat();
      final messages = result['messages'];
      final memories = result['memories'];
      if (!mounted) return;
      setState(() {
        _radioChatMessages = messages is List
            ? messages
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList()
            : [];
        _radioMemories = memories is List
            ? memories
                .whereType<Map>()
                .map((item) => Map<String, dynamic>.from(item))
                .toList()
            : [];
      });
      _scrollRadioChatToBottom();
    } catch (error) {
      if (!mounted) return;
      setState(() => _radioError = '读取电台对话失败：$error');
    }
  }

  Future<void> _sendRadioChat() async {
    final content = _radioChatController.text.trim();
    if (content.isEmpty || _radioChatSending) return;
    _radioChatController.clear();
    setState(() {
      _radioChatSending = true;
      _radioError = null;
      _radioChatMessages = [
        ..._radioChatMessages,
        {
          'id': 'local_${DateTime.now().millisecondsSinceEpoch}',
          'role': 'user',
          'content': content,
          'intentType': 'sending',
          'effectSummary': '正在发送给私人 DJ...',
        },
      ];
    });
    _scrollRadioChatToBottom();
    try {
      final result = await NasMusicApi.sendRadioChat(content);
      await _loadRadioChat();
      final candidate = result['memoryCandidate'];
      if (candidate is Map && mounted) {
        setState(() {
          final id = candidate['id']?.toString() ?? '';
          if (id.isNotEmpty &&
              !_radioMemories.any((item) => item['id']?.toString() == id)) {
            _radioMemories = [
              Map<String, dynamic>.from(candidate),
              ..._radioMemories,
            ];
          }
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _radioError = '发送给私人 DJ 失败：$error');
    } finally {
      if (mounted) {
        setState(() => _radioChatSending = false);
      }
    }
  }

  Future<void> _updateRadioMemory(String memoryId, bool remember) async {
    if (memoryId.isEmpty) return;
    try {
      final result = await NasMusicApi.updateRadioMemory(
        memoryId: memoryId,
        remember: remember,
      );
      final memory = result['memory'];
      if (!mounted || memory is! Map) return;
      final updated = Map<String, dynamic>.from(memory);
      setState(() {
        _radioMemories = _radioMemories
            .map((item) => item['id']?.toString() == memoryId ? updated : item)
            .toList();
      });
    } catch (error) {
      if (!mounted) return;
      setState(() => _radioError = '更新记忆失败：$error');
    }
  }

  void _scrollRadioChatToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!_radioChatScrollController.hasClients) return;
      _radioChatScrollController.animateTo(
        _radioChatScrollController.position.maxScrollExtent,
        duration: Duration(milliseconds: 220),
        curve: Curves.easeOut,
      );
    });
  }

  void _upsertRadioEpisode(Map<dynamic, dynamic> episode) {
    final nextEpisode = Map<String, dynamic>.from(episode);
    final id = nextEpisode['id']?.toString() ?? '';
    setState(() {
      if (id.isEmpty) {
        _radioEpisodes = [nextEpisode, ..._radioEpisodes];
        return;
      }
      _radioEpisodes = [
        nextEpisode,
        ..._radioEpisodes.where((item) => item['id']?.toString() != id),
      ];
    });
  }

  Future<void> _generateRadioEpisode() async {
    setState(() {
      _radioGenerating = true;
      _radioError = null;
    });
    try {
      final result = await NasMusicApi.buildDailyRadioMix(trackCount: 3);
      final episode = result['episode'];
      if (!mounted) return;
      if (episode is Map) {
        _upsertRadioEpisode(episode);
      }
      await _loadRadioStatus();
      await _loadRadioEpisodes();
    } catch (error) {
      if (!mounted) return;
      setState(() => _radioError = error.toString());
    } finally {
      if (mounted) {
        setState(() => _radioGenerating = false);
      }
    }
  }

  Future<void> _runDailyRadioNow() async {
    setState(() {
      _dailyRadioGenerating = true;
      _radioError = null;
    });
    try {
      final result = await NasMusicApi.buildDailyRadioMix(trackCount: 3);
      final episode = result['episode'];
      if (!mounted) return;
      if (episode is Map) {
        _upsertRadioEpisode(episode);
      }
      await _loadDailyRadioStatus();
      await _loadRadioStatus();
      await _loadRadioEpisodes();
    } catch (error) {
      if (!mounted) return;
      setState(() => _radioError = error.toString());
    } finally {
      if (mounted) {
        setState(() => _dailyRadioGenerating = false);
      }
    }
  }

  Future<void> _runLibraryScan({required bool incremental}) async {
    setState(() {
      _scanRunning = true;
      _toolMessage = incremental ? '正在增量扫描曲库...' : '正在全量扫描曲库...';
      _error = null;
    });
    try {
      final result = await NasMusicApi.scanLibrary(incremental: incremental);
      final imported = result['imported']?.toString() ?? '0';
      final scanned = result['scanned']?.toString() ?? '0';
      if (!mounted) return;
      setState(() {
        _toolMessage =
            '${incremental ? '增量' : '全量'}扫描完成：扫描 $scanned，导入 $imported。';
      });
      await _loadTracks(_searchController.text);
    } catch (error) {
      if (!mounted) return;
      setState(() => _toolMessage = '扫描失败：$error');
    } finally {
      if (mounted) {
        setState(() => _scanRunning = false);
      }
    }
  }

  Future<void> _showSqmusicDownloadDialog() async {
    _downloadSearchController.text =
        _searchController.text.trim().isNotEmpty ? _searchController.text : '';
    var results = <Map<String, dynamic>>[];
    String? dialogMessage;

    await showDialog<void>(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            Future<void> runSearch() async {
              final keyword = _downloadSearchController.text.trim();
              if (keyword.isEmpty) {
                setDialogState(() => dialogMessage = '请输入歌名或歌手。');
                return;
              }
              setDialogState(() {
                _sqmusicSearching = true;
                dialogMessage = null;
              });
              try {
                final items = await NasMusicApi.searchSqmusic(
                  keyword: keyword,
                  pageSize: 20,
                );
                setDialogState(() {
                  results = items;
                  dialogMessage = items.isEmpty ? '没有搜索到可下载歌曲。' : null;
                });
              } catch (error) {
                setDialogState(() => dialogMessage = '搜索失败：$error');
              } finally {
                setDialogState(() => _sqmusicSearching = false);
              }
            }

            Future<void> download(Map<String, dynamic> track) async {
              setDialogState(() {
                _sqmusicDownloading = true;
                dialogMessage = '正在提交下载任务...';
              });
              try {
                final result = await NasMusicApi.downloadSqmusicTrack(track);
                if (result['ok'] == true) {
                  setDialogState(() => dialogMessage = '已提交下载，正在扫描曲库...');
                  await NasMusicApi.rescanSqmusicDownloads();
                  if (mounted) {
                    await _loadTracks(_searchController.text);
                  }
                  setDialogState(() => dialogMessage = '下载任务已提交，曲库已刷新。');
                } else {
                  setDialogState(() {
                    dialogMessage = result['message']?.toString() ?? '下载失败。';
                  });
                }
              } catch (error) {
                setDialogState(() => dialogMessage = '下载失败：$error');
              } finally {
                setDialogState(() => _sqmusicDownloading = false);
              }
            }

            return AlertDialog(
              backgroundColor: AppColors.navigationBg,
              title: Text(
                'sqmusic 下载',
                style: TextStyle(color: AppColors.primaryText),
              ),
              content: SizedBox(
                width: 620,
                height: 500,
                child: Column(
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _downloadSearchController,
                            style: TextStyle(color: AppColors.primaryText),
                            decoration: InputDecoration(
                              hintText: '搜索歌名、歌手或专辑',
                              hintStyle:
                                  TextStyle(color: AppColors.secondaryText),
                            ),
                            onSubmitted: (_) => runSearch(),
                          ),
                        ),
                        SizedBox(width: 10),
                        ElevatedButton.icon(
                          onPressed: _sqmusicSearching ? null : runSearch,
                          icon: _sqmusicSearching
                              ? SizedBox(
                                  width: 14,
                                  height: 14,
                                  child: _buildTinyLoading(Colors.white),
                                )
                              : Icon(Icons.search, size: 17),
                          label: Text(_sqmusicSearching ? '搜索中' : '搜索'),
                        ),
                      ],
                    ),
                    if (dialogMessage != null) ...[
                      SizedBox(height: 10),
                      Align(
                        alignment: Alignment.centerLeft,
                        child: Text(
                          dialogMessage!,
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ],
                    SizedBox(height: 12),
                    Expanded(
                      child: results.isEmpty
                          ? Center(
                              child: Text(
                                '搜索后选择一首歌下载',
                                style:
                                    TextStyle(color: AppColors.secondaryText),
                              ),
                            )
                          : ListView.separated(
                              itemCount: results.length,
                              separatorBuilder: (_, __) =>
                                  Divider(color: AppColors.borderColor),
                              itemBuilder: (context, index) {
                                final item = results[index];
                                final title = item['name']?.toString() ?? '';
                                final artist =
                                    item['artistName']?.toString() ?? '';
                                final album =
                                    item['albumName']?.toString() ?? '';
                                final br =
                                    item['preferredBrType']?.toString() ?? '';
                                return ListTile(
                                  dense: true,
                                  title: Text(
                                    title,
                                    style:
                                        TextStyle(color: AppColors.primaryText),
                                  ),
                                  subtitle: Text(
                                    '$artist · $album · $br',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: AppColors.secondaryText,
                                    ),
                                  ),
                                  trailing: TextButton(
                                    onPressed: _sqmusicDownloading
                                        ? null
                                        : () => download(item),
                                    child: Text(
                                      _sqmusicDownloading ? '处理中' : '下载',
                                    ),
                                  ),
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(context).pop(),
                  child: Text('关闭'),
                ),
              ],
            );
          },
        );
      },
    );
    if (mounted) {
      setState(() {
        _sqmusicSearching = false;
        _sqmusicDownloading = false;
      });
    }
  }

  Future<void> _playRadioEpisode(Map<String, dynamic> episode) async {
    final playlist = NasMusicApi.normalizeRadioEpisodePlaylist(episode);
    if (playlist.isEmpty) return;
    final track = playlist.first;
    _playlistStore.setCurrentPlaylist(playlist, startIndex: 0);
    _globalPlayerStore.setCurrentTrack(track);
    await _musicController.initMusicData(track);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.appBg,
      body: _buildVerticalDjApp(),
    );
  }

  Widget _buildVerticalDjApp() {
    return _ClaudioParticleField(
      interactive: true,
      focusMode: false,
      lyricPulse: false,
      child: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 14,
              right: 14,
              child: _buildThemeSegment(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVerticalTopBar() {
    return Container(
      height: 58,
      padding: EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: (AppColors.isDark ? Color(0xFF111018) : Colors.white)
            .withValues(alpha: AppColors.isDark ? 0.78 : 0.9),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Text(
                  'Muo',
                  style: TextStyle(
                    color: AppColors.primaryBtn,
                    fontSize: 24,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0,
                  ),
                ),
                SizedBox(width: 8),
                Text(
                  'FM',
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontSize: 14,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ],
            ),
          ),
          _buildVerticalPanelButton('CHAT', _VerticalDjPanel.chat),
          _buildVerticalPanelButton('ON AIR', _VerticalDjPanel.player),
          _buildVerticalPanelButton('ME', _VerticalDjPanel.profile),
          SizedBox(width: 8),
          _buildThemeSegment(),
        ],
      ),
    );
  }

  Widget _buildVerticalPanelButton(String label, _VerticalDjPanel panel) {
    final active = _verticalPanel == panel;
    return Padding(
      padding: EdgeInsets.only(left: 4),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: () => setState(() => _verticalPanel = panel),
        child: Container(
          height: 34,
          padding: EdgeInsets.symmetric(horizontal: 10),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: active
                ? AppColors.primaryBtn
                : Colors.white.withValues(alpha: AppColors.isDark ? 0.06 : 0),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: active ? AppColors.primaryBtn : AppColors.borderColor,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: active ? Colors.white : AppColors.secondaryText,
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.4,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildThemeSegment() {
    return GetBuilder<ThemeStore>(
      builder: (themeStore) {
        return Container(
          height: 34,
          padding: EdgeInsets.all(3),
          decoration: BoxDecoration(
            color:
                Colors.black.withValues(alpha: AppColors.isDark ? 0.24 : 0.06),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildThemeChoice(
                label: 'DARK',
                active: themeStore.darkMode,
                onTap: () => themeStore.setDarkMode(true),
              ),
              _buildThemeChoice(
                label: 'LIGHT',
                active: !themeStore.darkMode,
                onTap: () => themeStore.setDarkMode(false),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildThemeChoice({
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        height: 26,
        padding: EdgeInsets.symmetric(horizontal: 9),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active
              ? (AppColors.isDark ? Colors.white : Color(0xFF111111))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active
                ? (AppColors.isDark ? Color(0xFF111111) : Colors.white)
                : AppColors.secondaryText,
            fontSize: 9,
            fontWeight: FontWeight.w900,
          ),
        ),
      ),
    );
  }

  Widget _buildVerticalPanel() {
    switch (_verticalPanel) {
      case _VerticalDjPanel.player:
        return _buildVerticalPlayerPage(key: ValueKey('player'));
      case _VerticalDjPanel.profile:
        return _buildVerticalProfilePage(key: ValueKey('profile'));
      case _VerticalDjPanel.chat:
        return _buildVerticalChatPage(key: ValueKey('chat'));
    }
  }

  Widget _buildClaudioInternalHeader({
    String? trailing,
    bool compact = false,
  }) {
    return Row(
      children: [
        Expanded(child: _buildPixelLogo('Claudio', compact: compact)),
        if (!compact) ...[
          _buildMiniCapsule('CHAT', () {
            setState(() => _verticalPanel = _VerticalDjPanel.chat);
          }, active: _verticalPanel == _VerticalDjPanel.chat),
          SizedBox(width: 6),
          _buildMiniCapsule('ON', () {
            setState(() => _verticalPanel = _VerticalDjPanel.player);
          }, active: _verticalPanel == _VerticalDjPanel.player),
          SizedBox(width: 6),
          _buildMiniCapsule('ME', () {
            setState(() => _verticalPanel = _VerticalDjPanel.profile);
          }, active: _verticalPanel == _VerticalDjPanel.profile),
          SizedBox(width: 8),
          _buildThemeSegment(),
        ],
        if (trailing != null) ...[
          SizedBox(width: 10),
          Text(
            trailing,
            style: TextStyle(
              color: AppColors.primaryText,
              fontSize: 15,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildOnAirBadge() {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: Color(0xFF29FFB8).withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Color(0xFF29FFB8).withValues(alpha: 0.24)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 7,
            height: 7,
            decoration: BoxDecoration(
              color: Color(0xFF29FFB8),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: Color(0xFF29FFB8).withValues(alpha: 0.6),
                  blurRadius: 10,
                ),
              ],
            ),
          ),
          SizedBox(width: 7),
          Text(
            'ON AIR',
            style: TextStyle(
              color: Color(0xFF29FFB8),
              fontSize: 10,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.3,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMiniCapsule(
    String label,
    VoidCallback onTap, {
    bool active = false,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        height: 28,
        padding: EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active
              ? Colors.white.withValues(alpha: AppColors.isDark ? 0.16 : 0.72)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active ? AppColors.primaryBtn : AppColors.borderColor,
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? AppColors.primaryText : AppColors.secondaryText,
            fontSize: 9,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.9,
          ),
        ),
      ),
    );
  }

  Widget _buildTerminalChat(String intro) {
    final messages = _radioChatMessages.take(80).toList();
    if (messages.isEmpty) {
      messages.add({
        'role': 'assistant',
        'content': intro,
      });
    }
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(14, 14, 14, 8),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: AppColors.isDark ? 0.36 : 0.08),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: ListView.builder(
        controller: _radioChatScrollController,
        padding: EdgeInsets.zero,
        itemCount: messages.length,
        itemBuilder: (context, index) {
          final message = messages[index];
          final isUser = message['role']?.toString() == 'user';
          return Align(
            alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              constraints: BoxConstraints(maxWidth: 360),
              margin: EdgeInsets.only(bottom: 12),
              padding: EdgeInsets.fromLTRB(13, 11, 13, 12),
              decoration: BoxDecoration(
                color: isUser
                    ? Color(0xFF1B1414)
                    : (AppColors.isDark ? Color(0xFF030305) : Colors.white),
                borderRadius: BorderRadius.circular(isUser ? 15 : 4),
                border: Border.all(
                  color: isUser
                      ? AppColors.primaryBtn.withValues(alpha: 0.30)
                      : Colors.white
                          .withValues(alpha: AppColors.isDark ? 0.08 : 0.6),
                ),
                boxShadow: [
                  if (!isUser)
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.22),
                      blurRadius: 18,
                      offset: Offset(0, 8),
                    ),
                ],
              ),
              child: Text(
                message['content']?.toString() ?? '',
                style: TextStyle(
                  color: isUser
                      ? AppColors.primaryText
                      : (AppColors.isDark ? Colors.white : Color(0xFF111111)),
                  fontSize: 14,
                  height: 1.42,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildTerminalInput(Map<String, dynamic>? latest, bool live) {
    return Container(
      padding: EdgeInsets.fromLTRB(14, 3, 6, 3),
      decoration: BoxDecoration(
        color: AppColors.isDark ? Color(0xFF030305) : Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _radioChatController,
              minLines: 1,
              maxLines: 3,
              onSubmitted: (_) => _sendRadioChat(),
              style: TextStyle(color: AppColors.primaryText, fontSize: 13),
              decoration: InputDecoration(
                border: InputBorder.none,
                hintText: 'Say something to the DJ...',
                hintStyle: TextStyle(
                  color: AppColors.secondaryText,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          IconButton(
            tooltip: '发送',
            onPressed: _radioChatSending ? null : _sendRadioChat,
            icon: _radioChatSending
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: _buildTinyLoading(AppColors.primaryBtn),
                  )
                : Icon(Icons.arrow_upward_rounded, color: AppColors.primaryBtn),
          ),
        ],
      ),
    );
  }

  Widget _buildVerticalChatPage({required Key key}) {
    final latest = _radioEpisodes.isNotEmpty ? _radioEpisodes.first : null;
    final tracks = _radioEpisodeTracks(latest);
    final current = _globalPlayerStore.currentTrack ?? tracks.firstOrNull;
    final title = current?['title']?.toString() ?? 'If - Bread';
    final artist = current?['artist']?.toString() ?? '私人 DJ';
    final intro = _radioScriptPlan(latest)['intro']?.toString() ??
        'Tell me your mood. I will turn it into a station.';
    return Container(
      key: key,
      decoration: _verticalShellDecoration(),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          children: [
            Container(
              height: 300,
              padding: EdgeInsets.fromLTRB(20, 18, 20, 0),
              decoration: BoxDecoration(
                color: AppColors.isDark ? Color(0xFF050509) : Color(0xFFF3F0ED),
                border: Border(
                  bottom: BorderSide(color: AppColors.borderColor),
                ),
              ),
              child: Column(
                children: [
                  _buildClaudioInternalHeader(),
                  Spacer(),
                  Text(
                    _largeClockLabel(),
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 72,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Monday',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 8),
                  _buildOnAirBadge(),
                  SizedBox(height: 28),
                ],
              ),
            ),
            Container(
              height: 112,
              padding: EdgeInsets.symmetric(horizontal: 18),
              decoration: BoxDecoration(
                color: AppColors.isDark ? Color(0xFF0D0D12) : Color(0xFFFFFFFF),
                border: Border.symmetric(
                  horizontal: BorderSide(color: AppColors.borderColor),
                ),
              ),
              child: Row(
                children: [
                  SizedBox(
                    width: 36,
                    child: _RadioWaveform(
                      active: _musicController.isPlaying,
                      color: AppColors.primaryBtn,
                      inactiveColor: AppColors.secondaryText,
                      barCount: 8,
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          artist,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildMiniCapsule('HIDE', () {
                    setState(() => _verticalPanel = _VerticalDjPanel.player);
                  }),
                  SizedBox(width: 6),
                  _buildMiniCapsule('FAV', () {
                    final track = _globalPlayerStore.currentTrack;
                    if (track != null) _toggleFavorite(track);
                  }),
                  SizedBox(width: 6),
                  _buildRoundPlayerButton(
                    icon: Icons.skip_previous_rounded,
                    onTap: _musicController.playPrevious,
                  ),
                  _buildRoundPlayerButton(
                    icon: _musicController.isPlaying
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded,
                    strong: true,
                    onTap: _musicController.togglePlayPause,
                  ),
                  _buildRoundPlayerButton(
                    icon: Icons.skip_next_rounded,
                    onTap: _musicController.playNext,
                  ),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.fromLTRB(18, 0, 18, 12),
                child: Column(
                  children: [
                    SizedBox(
                      height: 32,
                      child: Row(
                        children: [
                          Text(
                            'QUEUE',
                            style: TextStyle(
                              color: AppColors.secondaryText,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                            ),
                          ),
                          Spacer(),
                          Text(
                            '${tracks.length} TRACKS',
                            style: TextStyle(
                              color: AppColors.secondaryText,
                              fontSize: 10,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1.2,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Expanded(child: _buildTerminalChat(intro)),
                    SizedBox(height: 12),
                    _buildTerminalInput(latest, _musicController.isPlaying),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVerticalPlayerPage({required Key key}) {
    final latest = _radioEpisodes.isNotEmpty ? _radioEpisodes.first : null;
    final tracks = _radioEpisodeTracks(latest);
    final current = _globalPlayerStore.currentTrack ?? tracks.firstOrNull;
    final title = current?['title']?.toString() ??
        latest?['title']?.toString() ??
        'Monday Night Exhale';
    final artist = current?['artist']?.toString() ?? 'Muo FM';
    final intro = _radioScriptPlan(latest)['intro']?.toString() ??
        'This is Muo FM. Your evening station is ready.';
    return Container(
      key: key,
      decoration: _verticalShellDecoration(),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(24),
        child: Column(
          children: [
            Container(
              height: 270,
              padding: EdgeInsets.fromLTRB(20, 18, 20, 0),
              color: AppColors.isDark ? Color(0xFF050608) : Color(0xFFF7F7F5),
              child: Column(
                children: [
                  _buildClaudioInternalHeader(
                    trailing: _musicController.formatDuration(
                      _musicController.currentPosition,
                    ),
                  ),
                  Spacer(),
                  SizedBox(
                    height: 108,
                    child: _RadioWaveform(
                      active: true,
                      color:
                          AppColors.isDark ? Colors.white : Color(0xFF111111),
                      inactiveColor: AppColors.secondaryText,
                      barCount: 64,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: Transform.translate(
                offset: Offset(0, -24),
                child: Container(
                  width: double.infinity,
                  padding: EdgeInsets.fromLTRB(26, 28, 26, 14),
                  decoration: BoxDecoration(
                    color: AppColors.isDark ? Color(0xFFEEECE5) : Colors.white,
                    borderRadius: BorderRadius.vertical(
                      top: Radius.circular(32),
                    ),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: Color(0xFF111111),
                          fontSize: 32,
                          height: 1.02,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      SizedBox(height: 8),
                      Text(
                        artist,
                        style: TextStyle(
                          color: Color(0xFF77736D),
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(height: 18),
                      _buildLivePlayerProgress(),
                      SizedBox(height: 18),
                      Expanded(child: _buildLiveLyrics(intro)),
                      SizedBox(height: 10),
                      _buildPlayerBottomControls(latest),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVerticalProfilePage({required Key key}) {
    final remembered = _radioMemories
        .where((item) => item['status']?.toString() == 'remembered')
        .toList();
    final tags = <String>[
      '90s 华语',
      '夜晚',
      '轻松治愈',
      'JAZZ-HIPHOP',
      'ROCK',
      '雨天白噪音',
      'POST-PUNK',
      'NAS 音乐库',
    ];
    return Container(
      key: key,
      decoration: _verticalShellDecoration(),
      child: Padding(
        padding: EdgeInsets.fromLTRB(26, 24, 26, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildClaudioInternalHeader(compact: true),
            SizedBox(height: 30),
            Row(
              children: [
                Container(
                  width: 102,
                  height: 102,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [
                        AppColors.primaryBtn.withValues(alpha: 0.95),
                        Color(0xFF16161E),
                      ],
                    ),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.16),
                    ),
                  ),
                  child: Icon(Icons.graphic_eq_rounded,
                      color: Colors.white, size: 38),
                ),
                SizedBox(width: 18),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Claudio',
                        style: TextStyle(
                          color: AppColors.primaryText,
                          fontSize: 44,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1.8,
                        ),
                      ),
                      SizedBox(height: 8),
                      Row(
                        children: [
                          Container(
                            width: 8,
                            height: 8,
                            decoration: BoxDecoration(
                              color: Color(0xFF29FFB8),
                              shape: BoxShape.circle,
                            ),
                          ),
                          SizedBox(width: 8),
                          Text(
                            '一开机我就打碟',
                            style: TextStyle(
                              color: Color(0xFF29FFB8),
                              fontSize: 13,
                              fontWeight: FontWeight.w900,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 34),
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.black
                    .withValues(alpha: AppColors.isDark ? 0.18 : 0.04),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '徐郭鹏的私人 DJ，会打碟的 taste.md',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 18,
                      height: 1.45,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                  SizedBox(height: 10),
                  Text(
                    'Your mood is my prompt.\nI hate algorithm. I have taste.',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 15,
                      height: 1.55,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: 26),
            Row(
              children: [
                _buildProfileStat('ON AIR', '24/7'),
                _buildProfileStat('GENRES', '∞'),
                _buildProfileStat('MEMORY', '${remembered.length}'),
              ],
            ),
            SizedBox(height: 28),
            Text(
              'TASTE TAGS',
              style: TextStyle(
                color: AppColors.secondaryText,
                fontSize: 11,
                letterSpacing: 1.6,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(height: 14),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                for (final tag in tags) _buildTasteChip(tag),
              ],
            ),
            Spacer(),
            Container(
              width: double.infinity,
              padding: EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.black
                    .withValues(alpha: AppColors.isDark ? 0.28 : 0.04),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(color: AppColors.borderColor),
              ),
              child: Text(
                remembered.isEmpty
                    ? '还没有确认的长期画像。你在聊天里说“以后晚上多放轻一点”，我会先作为候选，等你确认后再记住。'
                    : remembered
                        .take(2)
                        .map((item) => item['title']?.toString() ?? '音乐偏好')
                        .join('\n'),
                style: TextStyle(
                  color: AppColors.secondaryText,
                  fontSize: 13,
                  height: 1.55,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  BoxDecoration _verticalShellDecoration() {
    return BoxDecoration(
      color: (AppColors.isDark ? Color(0xFF111018) : Color(0xFFFDFDFC))
          .withValues(alpha: AppColors.isDark ? 0.86 : 0.94),
      borderRadius: BorderRadius.circular(24),
      border: Border.all(color: AppColors.borderColor),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: AppColors.isDark ? 0.44 : 0.10),
          blurRadius: 40,
          offset: Offset(0, 20),
        ),
      ],
    );
  }

  Widget _buildPixelLogo(String label, {bool compact = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: compact ? 28 : 34,
          height: compact ? 28 : 34,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.primaryBtn.withValues(alpha: 0.92),
          ),
          child: Icon(Icons.radio_rounded,
              color: Colors.white, size: compact ? 15 : 18),
        ),
        SizedBox(width: compact ? 8 : 10),
        Text(
          label,
          style: TextStyle(
            color: AppColors.primaryText,
            fontSize: compact ? 22 : 30,
            fontWeight: FontWeight.w900,
            letterSpacing: 1.4,
          ),
        ),
      ],
    );
  }

  Widget _buildRoundPlayerButton({
    required IconData icon,
    required VoidCallback onTap,
    bool strong = false,
  }) {
    return Padding(
      padding: EdgeInsets.only(left: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(999),
        onTap: onTap,
        child: Container(
          width: strong ? 38 : 32,
          height: strong ? 38 : 32,
          decoration: BoxDecoration(
            color: strong ? AppColors.primaryBtn : Colors.transparent,
            shape: BoxShape.circle,
            border: Border.all(
              color: strong ? AppColors.primaryBtn : AppColors.borderColor,
            ),
          ),
          child: Icon(
            icon,
            color: strong ? Colors.white : AppColors.primaryText,
            size: strong ? 22 : 18,
          ),
        ),
      ),
    );
  }

  Widget _buildLivePlayerProgress() {
    final total = _musicController.totalDuration > 0
        ? _musicController.totalDuration
        : 207000;
    final current = _musicController.currentPosition.clamp(0, total);
    final progress = total <= 0 ? 0.0 : current / total;
    return Row(
      children: [
        InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: _musicController.togglePlayPause,
          child: Container(
            width: 30,
            height: 30,
            decoration: BoxDecoration(
              color: Color(0xFF111111),
              shape: BoxShape.circle,
            ),
            child: Icon(
              _musicController.isPlaying ? Icons.pause : Icons.play_arrow,
              color: Colors.white,
              size: 16,
            ),
          ),
        ),
        SizedBox(width: 12),
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              minHeight: 3,
              value: progress,
              backgroundColor: Color(0xFFD9D6CF),
              valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF111111)),
            ),
          ),
        ),
        SizedBox(width: 12),
        Text(
          '${_musicController.formatDuration(current)} / ${_musicController.formatDuration(total)}',
          style: TextStyle(
            color: Color(0xFF77736D),
            fontSize: 12,
            fontWeight: FontWeight.w800,
          ),
        ),
      ],
    );
  }

  Widget _buildLiveLyrics(String fallback) {
    final lyrics = _musicController.lyrics;
    final fallbackLines = _splitRadioTranscript(fallback);
    final itemCount = lyrics.isNotEmpty ? lyrics.length : fallbackLines.length;
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(16, 14, 16, 10),
      decoration: BoxDecoration(
        color: Color(0xFFEDEBE5),
        borderRadius: BorderRadius.circular(18),
      ),
      child: itemCount == 0
          ? Center(
              child: Text(
                '歌词会跟随播放滚动。',
                style: TextStyle(color: Color(0xFF8F8D87)),
              ),
            )
          : Obx(
              () {
                final activeIndex = lyrics.isNotEmpty
                    ? _musicController.currentLyricIndex
                    : ((_musicController.currentPosition ~/ 4200) %
                        math.max(1, itemCount));
                return ListView.builder(
                  controller: lyrics.isNotEmpty
                      ? _musicController.lyricScrollController
                      : null,
                  padding: EdgeInsets.zero,
                  itemCount: itemCount,
                  itemBuilder: (context, index) {
                    final text = lyrics.isNotEmpty
                        ? lyrics[index].text
                        : fallbackLines[index];
                    final active = index == activeIndex;
                    return AnimatedContainer(
                      duration: Duration(milliseconds: 220),
                      margin: EdgeInsets.only(bottom: 10),
                      padding:
                          EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                      decoration: BoxDecoration(
                        color: active
                            ? AppColors.primaryBtn.withValues(alpha: 0.16)
                            : Colors.transparent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        text,
                        style: TextStyle(
                          color: active ? Color(0xFF111111) : Color(0xFFB3AFA7),
                          fontSize: active ? 17 : 15,
                          height: 1.35,
                          fontWeight:
                              active ? FontWeight.w900 : FontWeight.w600,
                        ),
                      ),
                    );
                  },
                );
              },
            ),
    );
  }

  Widget _buildPlayerBottomControls(Map<String, dynamic>? latest) {
    return Row(
      children: [
        Text(
          '0:00',
          style: TextStyle(
            color: Color(0xFF111111),
            fontSize: 12,
            fontWeight: FontWeight.w900,
          ),
        ),
        SizedBox(width: 10),
        Expanded(
          child: SizedBox(
            height: 28,
            child: _RadioWaveform(
              active: true,
              color: Color(0xFF111111),
              inactiveColor: Color(0xFFC9C6BE),
              barCount: 42,
            ),
          ),
        ),
        SizedBox(width: 10),
        InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: latest == null
              ? _runDailyRadioNow
              : () => _playRadioEpisode(latest),
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: Color(0xFF111111),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.pause, color: Colors.white, size: 22),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileStat(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: TextStyle(
              color: AppColors.secondaryText,
              fontSize: 11,
              fontWeight: FontWeight.w900,
              letterSpacing: 1.4,
            ),
          ),
          SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              color: AppColors.primaryText,
              fontSize: 25,
              fontWeight: FontWeight.w900,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTasteChip(String label) {
    return Container(
      padding: EdgeInsets.symmetric(horizontal: 13, vertical: 9),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: AppColors.isDark ? 0.18 : 0.04),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: AppColors.primaryText,
          fontSize: 12,
          fontWeight: FontWeight.w900,
        ),
      ),
    );
  }

  String _largeClockLabel() {
    final now = DateTime.now();
    return '${now.hour.toString().padLeft(2, '0')} ${now.minute.toString().padLeft(2, '0')}';
  }

  Widget _buildReferenceSidebar() {
    return Container(
      width: 228,
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: AppColors.isDark ? 0.48 : 0.06),
        border: Border(right: BorderSide(color: AppColors.borderColor)),
      ),
      child: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.fromLTRB(28, 46, 18, 16),
              children: [
                Text(
                  '沐音',
                  style: TextStyle(
                    color: AppColors.primaryBtn,
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0,
                  ),
                ),
                SizedBox(height: 34),
                _ReferenceNavItem(
                  active: _viewMode == _DesktopMusicViewMode.tracks,
                  icon: Icons.music_note_outlined,
                  label: '音乐库',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.tracks;
                    _selectedArtistName = null;
                  }),
                ),
                _ReferenceNavItem(
                  active: _viewMode == _DesktopMusicViewMode.radio,
                  icon: Icons.radio_outlined,
                  label: '今日电台',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.radio;
                    _selectedArtistName = null;
                  }),
                ),
                _ReferenceNavItem(
                  active: _viewMode == _DesktopMusicViewMode.artists,
                  icon: Icons.person_outline,
                  label: '歌手',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.artists;
                    _selectedArtistName = null;
                  }),
                ),
                _ReferenceNavItem(
                  active: false,
                  icon: Icons.album_outlined,
                  label: '专辑',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.tracks;
                    _selectedArtistName = null;
                  }),
                ),
                _ReferenceNavItem(
                  active: _viewMode == _DesktopMusicViewMode.tracks,
                  icon: Icons.queue_music_outlined,
                  label: '歌曲',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.tracks;
                    _selectedArtistName = null;
                  }),
                ),
                _ReferenceNavItem(
                  active: _viewMode == _DesktopMusicViewMode.favorites,
                  icon: Icons.favorite_border,
                  label: '喜欢的音乐',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.favorites;
                    _selectedArtistName = null;
                  }),
                ),
                SizedBox(height: 20),
                Divider(color: AppColors.borderColor, height: 1),
                SizedBox(height: 18),
                _ReferenceNavItem(
                  active: _viewMode == _DesktopMusicViewMode.history,
                  icon: Icons.history,
                  label: '播放记录',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.history;
                    _selectedArtistName = null;
                  }),
                ),
                SizedBox(height: 20),
                Divider(color: AppColors.borderColor, height: 1),
                SizedBox(height: 18),
                Padding(
                  padding: EdgeInsets.only(left: 2, bottom: 10),
                  child: Text(
                    '播放 NAS',
                    style: TextStyle(
                      color: AppColors.secondaryText,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                _ReferenceNavItem(
                  active: false,
                  icon: Icons.storage_outlined,
                  label: 'NAS 音乐库',
                  onTap: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.tracks;
                    _selectedArtistName = null;
                  }),
                ),
                _ReferenceNavItem(
                  active: false,
                  icon: Icons.file_download_outlined,
                  label: '本地导入',
                  onTap: () {},
                ),
                _ReferenceNavItem(
                  active: false,
                  icon: Icons.sd_storage_outlined,
                  label: '外接存储',
                  onTap: () {},
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(28, 10, 18, 18),
            child: _ReferenceNavItem(
              active: false,
              icon: Icons.settings_outlined,
              label: '设置',
              onTap: () => Get.find<ThemeStore>().toggleTheme(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReferenceWorkspace() {
    if (_viewMode == _DesktopMusicViewMode.radio) {
      return _buildClaudioRadioWorkspace();
    }
    return Row(
      children: [
        Expanded(
          child: Padding(
            padding: EdgeInsets.fromLTRB(34, 46, 24, 0),
            child: Column(
              children: [
                _buildReferenceToolbar(),
                if (_toolMessage != null) ...[
                  SizedBox(height: 10),
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      _toolMessage!,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
                SizedBox(height: _toolMessage == null ? 34 : 20),
                _buildReferenceTabs(),
                SizedBox(height: 18),
                Expanded(child: _buildReferenceCenter()),
              ],
            ),
          ),
        ),
        Container(
          width: 330,
          padding: EdgeInsets.fromLTRB(0, 108, 22, 0),
          decoration: BoxDecoration(
            border: Border(left: BorderSide(color: AppColors.borderColor)),
          ),
          child: _buildReferenceRightRail(),
        ),
      ],
    );
  }

  Widget _buildClaudioRadioWorkspace() {
    return _ClaudioParticleField(
      child: Padding(
        padding: EdgeInsets.fromLTRB(28, 30, 22, 0),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 980;
            return Row(
              children: [
                Expanded(
                  child: Column(
                    children: [
                      _buildReferenceToolbar(),
                      SizedBox(height: 18),
                      Expanded(
                        child: Center(
                          child: ConstrainedBox(
                            constraints: BoxConstraints(
                              maxWidth: 460,
                              maxHeight:
                                  math.max(620.0, constraints.maxHeight - 74),
                            ),
                            child: _buildClaudioPhoneCard(),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                if (!compact) ...[
                  SizedBox(width: 22),
                  SizedBox(
                    width: 380,
                    child: Column(
                      children: [
                        Expanded(child: _buildRadioChatPanel()),
                        SizedBox(height: 12),
                        SizedBox(height: 210, child: _buildRadioMemoryPanel()),
                      ],
                    ),
                  ),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildClaudioPhoneCard({bool embeddedChat = false}) {
    final latest = _radioEpisodes.isNotEmpty ? _radioEpisodes.first : null;
    final title = latest?['title']?.toString() ?? 'Monday Night\nExhale';
    final scriptPlan = _radioScriptPlan(latest);
    final intro = scriptPlan['intro']?.toString() ??
        'This is Muo FM. Tell me what tonight should feel like, and I will shape the station around your taste.';
    final tracks = _radioEpisodeTracks(latest);
    final firstTrack = tracks.isNotEmpty ? tracks.first : null;
    final firstTrackTitle = firstTrack?['title']?.toString() ?? '未知歌曲';
    final firstTrackArtist = firstTrack?['artist']?.toString() ?? '未知歌手';
    final subtitle = firstTrack == null
        ? '私人 AI DJ · NAS Radio'
        : '$firstTrackTitle — $firstTrackArtist';
    final live = _globalPlayerStore.currentTrack?['source'] == 'radio_episode';
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(34),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.52),
            blurRadius: 60,
            offset: Offset(0, 24),
          ),
          BoxShadow(
            color: AppColors.primaryBtn.withValues(alpha: 0.22),
            blurRadius: 90,
            spreadRadius: 4,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(34),
        child: Container(
          decoration: BoxDecoration(
            color: Color(0xFFF5F4F0),
            border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
          ),
          child: Column(
            children: [
              Container(
                height: 210,
                padding: EdgeInsets.fromLTRB(28, 24, 28, 0),
                decoration: BoxDecoration(
                  color: Color(0xFF090A0D),
                ),
                child: Column(
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 34,
                          height: 34,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            color: AppColors.primaryBtn,
                          ),
                          child:
                              Icon(Icons.radio, color: Colors.white, size: 18),
                        ),
                        SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Muo FM',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 30,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 1.2,
                                ),
                              ),
                              SizedBox(height: 6),
                              Row(
                                children: [
                                  Container(
                                    width: 7,
                                    height: 7,
                                    decoration: BoxDecoration(
                                      color: Color(0xFF29FFB8),
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          color: Color(0xFF29FFB8)
                                              .withValues(alpha: 0.72),
                                          blurRadius: 10,
                                        ),
                                      ],
                                    ),
                                  ),
                                  SizedBox(width: 7),
                                  Text(
                                    live ? 'Speaking...' : 'Ready...',
                                    style: TextStyle(
                                      color: Color(0xFF29FFB8),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        Text(
                          _clockLabel(),
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.82),
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    Spacer(),
                    _RadioWaveform(
                      active: true,
                      color: Colors.white,
                      inactiveColor: Colors.white,
                      barCount: 54,
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Transform.translate(
                  offset: Offset(0, -28),
                  child: Container(
                    width: double.infinity,
                    padding: EdgeInsets.fromLTRB(28, 30, 28, 0),
                    decoration: BoxDecoration(
                      color: Color(0xFFF7F6F1),
                      borderRadius: BorderRadius.vertical(
                        top: Radius.circular(30),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Color(0xFF111111),
                            fontSize: 34,
                            height: 0.98,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                        SizedBox(height: 10),
                        Text(
                          subtitle,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Color(0xFF707070),
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        SizedBox(height: 20),
                        _buildClaudioPhoneProgress(latest),
                        SizedBox(height: 18),
                        Expanded(
                          child: embeddedChat
                              ? _buildClaudioEmbeddedChat(intro)
                              : _buildClaudioPhoneTranscript(intro),
                        ),
                        SizedBox(height: 16),
                        embeddedChat
                            ? _buildClaudioEmbeddedInput(latest, live)
                            : _buildClaudioPhoneBottomBar(latest, live),
                        SizedBox(height: 18),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildClaudioPhoneProgress(Map<String, dynamic>? episode) {
    final duration = episode?['durationSeconds'];
    final durationText = duration is int && duration > 0
        ? '${(duration ~/ 60).toString().padLeft(2, '0')}:${(duration % 60).toString().padLeft(2, '0')}'
        : '03:27';
    return Row(
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: Color(0xFF111111),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.pause, color: Colors.white, size: 17),
        ),
        SizedBox(width: 13),
        Expanded(
          child: Stack(
            alignment: Alignment.centerLeft,
            children: [
              Container(
                height: 3,
                decoration: BoxDecoration(
                  color: Color(0xFFD8D6D2),
                  borderRadius: BorderRadius.circular(99),
                ),
              ),
              FractionallySizedBox(
                widthFactor: 0.43,
                child: Container(
                  height: 3,
                  decoration: BoxDecoration(
                    color: Color(0xFF111111),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
            ],
          ),
        ),
        SizedBox(width: 12),
        Text(
          '0:48 / $durationText',
          style: TextStyle(
            color: Color(0xFF7D7B76),
            fontSize: 12,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }

  Widget _buildClaudioPhoneTranscript(String intro) {
    final sentences = _splitRadioTranscript(intro);
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(18, 16, 18, 10),
      decoration: BoxDecoration(
        color: Color(0xFFEDEBE5),
        borderRadius: BorderRadius.circular(18),
      ),
      child: ListView.builder(
        padding: EdgeInsets.zero,
        itemCount: math.max(1, sentences.length),
        itemBuilder: (context, index) {
          final text = sentences.isEmpty ? intro : sentences[index];
          final active = index == 0;
          return Padding(
            padding: EdgeInsets.only(bottom: 15),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Muo FM · 0:${(index * 4).toString().padLeft(2, '0')}',
                  style: TextStyle(
                    color: Color(0xFF8F8D87),
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                SizedBox(height: 5),
                Text(
                  text,
                  style: TextStyle(
                    color: active ? Color(0xFF111111) : Color(0xFFB6B2AA),
                    fontSize: 16,
                    height: 1.35,
                    fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildClaudioEmbeddedChat(String intro) {
    final messages = _radioChatMessages.take(80).toList();
    if (messages.isEmpty) {
      return _buildClaudioPhoneTranscript(intro);
    }
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(16, 14, 16, 10),
      decoration: BoxDecoration(
        color: Color(0xFFEDEBE5),
        borderRadius: BorderRadius.circular(18),
      ),
      child: ListView.builder(
        controller: _radioChatScrollController,
        padding: EdgeInsets.zero,
        itemCount: messages.length,
        itemBuilder: (context, index) {
          final message = messages[index];
          final isUser = message['role']?.toString() == 'user';
          return Align(
            alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
            child: Container(
              constraints: BoxConstraints(maxWidth: 330),
              margin: EdgeInsets.only(bottom: 10),
              padding: EdgeInsets.symmetric(horizontal: 13, vertical: 10),
              decoration: BoxDecoration(
                color: isUser ? Color(0xFF111111) : Color(0xFFF8F7F2),
                borderRadius: BorderRadius.circular(15),
                border: Border.all(
                  color: isUser ? Color(0xFF111111) : Color(0xFFDCD8CF),
                ),
              ),
              child: Column(
                crossAxisAlignment:
                    isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                children: [
                  Text(
                    isUser ? '我' : 'Muo FM',
                    style: TextStyle(
                      color: isUser ? Colors.white70 : Color(0xFF88847C),
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  SizedBox(height: 5),
                  Text(
                    message['content']?.toString() ?? '',
                    style: TextStyle(
                      color: isUser ? Colors.white : Color(0xFF111111),
                      fontSize: 14,
                      height: 1.42,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildClaudioEmbeddedInput(
    Map<String, dynamic>? latest,
    bool live,
  ) {
    return Column(
      children: [
        Row(
          children: [
            Text(
              live ? 'LIVE' : '0:03',
              style: TextStyle(
                color: Color(0xFF111111),
                fontSize: 12,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(width: 14),
            Expanded(
              child: SizedBox(
                height: 30,
                child: _RadioWaveform(
                  active: true,
                  color: Color(0xFF111111),
                  inactiveColor: Color(0xFFC9C6BE),
                  barCount: 36,
                ),
              ),
            ),
            SizedBox(width: 12),
            InkWell(
              borderRadius: BorderRadius.circular(999),
              onTap: latest == null
                  ? _runDailyRadioNow
                  : () => _playRadioEpisode(latest),
              child: Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: Color(0xFF111111),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  latest == null ? Icons.auto_awesome : Icons.play_arrow,
                  color: Colors.white,
                  size: 21,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: 12),
        Container(
          padding: EdgeInsets.fromLTRB(14, 2, 4, 2),
          decoration: BoxDecoration(
            color: Color(0xFF111111),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _radioChatController,
                  minLines: 1,
                  maxLines: 3,
                  onSubmitted: (_) => _sendRadioChat(),
                  style: TextStyle(color: Colors.white, fontSize: 13),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    hintText: 'Say something to the DJ...',
                    hintStyle: TextStyle(
                      color: Colors.white.withValues(alpha: 0.38),
                      fontSize: 13,
                    ),
                  ),
                ),
              ),
              IconButton(
                tooltip: '发送',
                onPressed: _radioChatSending ? null : _sendRadioChat,
                icon: _radioChatSending
                    ? SizedBox(
                        width: 18,
                        height: 18,
                        child: _buildTinyLoading(Colors.white),
                      )
                    : Icon(Icons.arrow_upward_rounded, color: Colors.white),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildClaudioPhoneBottomBar(
    Map<String, dynamic>? latest,
    bool live,
  ) {
    return Row(
      children: [
        Text(
          live ? 'LIVE' : '0:03',
          style: TextStyle(
            color: Color(0xFF111111),
            fontSize: 12,
            fontWeight: FontWeight.w900,
          ),
        ),
        SizedBox(width: 14),
        Expanded(
          child: SizedBox(
            height: 34,
            child: _RadioWaveform(
              active: true,
              color: Color(0xFF111111),
              inactiveColor: Color(0xFFC9C6BE),
              barCount: 42,
            ),
          ),
        ),
        SizedBox(width: 16),
        InkWell(
          borderRadius: BorderRadius.circular(999),
          onTap: latest == null
              ? _runDailyRadioNow
              : () => _playRadioEpisode(latest),
          child: Container(
            width: 54,
            height: 54,
            decoration: BoxDecoration(
              color: Color(0xFF111111),
              shape: BoxShape.circle,
            ),
            child: Icon(
              latest == null ? Icons.auto_awesome : Icons.pause,
              color: Colors.white,
              size: 24,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRadioChatPanel() {
    return _ReferencePanel(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          children: [
            Row(
              children: [
                Icon(Icons.smart_toy_outlined,
                    color: AppColors.primaryBtn, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '私人 DJ 对话',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
                Text(
                  '可沉淀画像',
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
            SizedBox(height: 12),
            Expanded(
              child: _radioChatMessages.isEmpty
                  ? Center(
                      child: Text(
                        '告诉我：今天少说话多放歌，或者以后晚上多听周杰伦。',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: AppColors.secondaryText,
                          height: 1.5,
                        ),
                      ),
                    )
                  : ListView.builder(
                      controller: _radioChatScrollController,
                      itemCount: _radioChatMessages.length,
                      itemBuilder: (context, index) {
                        final message = _radioChatMessages[index];
                        return _buildRadioChatBubble(message);
                      },
                    ),
            ),
            SizedBox(height: 12),
            _buildRadioChatInput(),
          ],
        ),
      ),
    );
  }

  Widget _buildRadioChatBubble(Map<String, dynamic> message) {
    final isUser = message['role']?.toString() == 'user';
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(maxWidth: 300),
        margin: EdgeInsets.only(bottom: 10),
        padding: EdgeInsets.symmetric(horizontal: 13, vertical: 11),
        decoration: BoxDecoration(
          color: isUser
              ? AppColors.primaryBtn.withValues(alpha: 0.92)
              : Colors.black.withValues(alpha: AppColors.isDark ? 0.26 : 0.05),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isUser ? Colors.transparent : AppColors.borderColor,
          ),
        ),
        child: Column(
          crossAxisAlignment:
              isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              message['content']?.toString() ?? '',
              style: TextStyle(
                color: isUser ? Colors.white : AppColors.primaryText,
                fontSize: 13,
                height: 1.45,
              ),
            ),
            if ((message['effectSummary']?.toString() ?? '').isNotEmpty) ...[
              SizedBox(height: 6),
              Text(
                message['effectSummary']?.toString() ?? '',
                style: TextStyle(
                  color: isUser
                      ? Colors.white.withValues(alpha: 0.72)
                      : AppColors.secondaryText,
                  fontSize: 10,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildRadioChatInput() {
    return Container(
      padding: EdgeInsets.fromLTRB(12, 4, 6, 4),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: AppColors.isDark ? 0.22 : 0.04),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _radioChatController,
              minLines: 1,
              maxLines: 3,
              onSubmitted: (_) => _sendRadioChat(),
              style: TextStyle(color: AppColors.primaryText, fontSize: 13),
              decoration: InputDecoration(
                border: InputBorder.none,
                hintText: '和 DJ 说：今天想听轻一点，或者以后记住我的偏好...',
                hintStyle:
                    TextStyle(color: AppColors.secondaryText, fontSize: 12),
              ),
            ),
          ),
          IconButton(
            tooltip: '发送',
            onPressed: _radioChatSending ? null : _sendRadioChat,
            icon: _radioChatSending
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: _buildTinyLoading(AppColors.primaryBtn))
                : Icon(Icons.send_rounded, color: AppColors.primaryBtn),
          ),
        ],
      ),
    );
  }

  Widget _buildRadioMemoryPanel() {
    final visible = _radioMemories.take(5).toList();
    return _ReferencePanel(
      child: Padding(
        padding: EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.psychology_alt_outlined,
                    color: AppColors.primaryBtn, size: 20),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '音乐画像',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 10),
            Expanded(
              child: visible.isEmpty
                  ? Text(
                      '长期偏好会先进入候选，不会偷偷写死。',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 12,
                        height: 1.45,
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.zero,
                      itemCount: visible.length,
                      itemBuilder: (context, index) {
                        final memory = visible[index];
                        return _buildRadioMemoryItem(memory);
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRadioMemoryItem(Map<String, dynamic> memory) {
    final status = memory['status']?.toString() ?? 'candidate';
    final id = memory['id']?.toString() ?? '';
    final candidate = status == 'candidate';
    return Container(
      margin: EdgeInsets.only(bottom: 9),
      padding: EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: AppColors.isDark ? 0.20 : 0.04),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  memory['title']?.toString() ?? '音乐偏好',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.primaryText,
                    fontSize: 12,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              Text(
                status == 'remembered'
                    ? '已记住'
                    : status == 'ignored'
                        ? '已忽略'
                        : '待确认',
                style: TextStyle(
                  color: status == 'remembered'
                      ? Color(0xFF29FFB8)
                      : AppColors.secondaryText,
                  fontSize: 10,
                ),
              ),
            ],
          ),
          if (candidate) ...[
            SizedBox(height: 8),
            Row(
              children: [
                TextButton(
                  onPressed: () => _updateRadioMemory(id, true),
                  child: Text('记住'),
                ),
                TextButton(
                  onPressed: () => _updateRadioMemory(id, false),
                  child: Text('忽略'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildReferenceToolbar() {
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 660;
        return Row(
          children: [
            Flexible(
              flex: 10,
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  maxWidth: 360,
                  minWidth: compact ? 180 : 260,
                ),
                child: _buildReferenceSearchField(),
              ),
            ),
            Spacer(),
            _ReferenceToolbarAction(
              icon: Icons.file_download_outlined,
              label: compact ? null : '导入音乐',
              onTap: _showSqmusicDownloadDialog,
            ),
            SizedBox(width: compact ? 8 : 18),
            _ReferenceToolbarAction(
              icon: _scanRunning ? Icons.hourglass_top : Icons.refresh,
              label: compact ? null : (_scanRunning ? '扫描中' : '刷新'),
              onTap: _scanRunning
                  ? null
                  : () => _runLibraryScan(incremental: true),
            ),
            SizedBox(width: compact ? 6 : 16),
            IconButton(
              tooltip: '切换主题',
              onPressed: () => Get.find<ThemeStore>().toggleTheme(),
              icon: Icon(
                AppColors.isDark ? Icons.light_mode_outlined : Icons.dark_mode,
                color: AppColors.secondaryText,
                size: 20,
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildReferenceSearchField() {
    return Container(
      height: 42,
      decoration: BoxDecoration(
        color: AppColors.navigationBg
            .withValues(alpha: AppColors.isDark ? 0.5 : 0.82),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderColor),
        boxShadow: [
          BoxShadow(
            color:
                Colors.black.withValues(alpha: AppColors.isDark ? 0.24 : 0.04),
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: TextField(
        controller: _searchController,
        onSubmitted: _loadTracks,
        style: TextStyle(color: AppColors.primaryText, fontSize: 13),
        decoration: InputDecoration(
          border: InputBorder.none,
          hintText: '搜索歌曲、专辑、歌手、歌词...',
          hintStyle: TextStyle(color: AppColors.secondaryText, fontSize: 13),
          prefixIcon: Icon(
            Icons.search,
            color: AppColors.secondaryText,
            size: 20,
          ),
          contentPadding: EdgeInsets.only(top: 10),
        ),
      ),
    );
  }

  Widget _buildReferenceTabs() {
    final tabs = [
      ('音乐库', _DesktopMusicViewMode.tracks),
      ('专辑', _DesktopMusicViewMode.tracks),
      ('歌手', _DesktopMusicViewMode.artists),
      ('文件夹', _DesktopMusicViewMode.tracks),
    ];
    return Container(
      height: 44,
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: AppColors.borderColor)),
      ),
      child: Row(
        children: [
          for (final tab in tabs)
            _ReferenceTab(
              label: tab.$1,
              active: (_viewMode == tab.$2 &&
                      (tab.$1 == '音乐库' || tab.$1 == '歌手')) ||
                  (_viewMode == _DesktopMusicViewMode.favorites &&
                      tab.$1 == '音乐库') ||
                  (_viewMode == _DesktopMusicViewMode.history &&
                      tab.$1 == '音乐库') ||
                  (_viewMode == _DesktopMusicViewMode.radio && tab.$1 == '音乐库'),
              onTap: () => setState(() {
                _viewMode = tab.$2;
                _selectedArtistName = null;
              }),
            ),
        ],
      ),
    );
  }

  Widget _buildReferenceCenter() {
    if (_viewMode == _DesktopMusicViewMode.radio) {
      return _buildReferenceRadioList();
    }
    if (_loading) return _buildLoadingState('音乐加载中...');
    if (_error != null) return _buildError();
    if (_viewMode == _DesktopMusicViewMode.artists &&
        _selectedArtistName == null) {
      return _buildReferenceArtistGrid();
    }
    final tracks = _visibleTracks();
    return Column(
      children: [
        _buildReferenceActions(tracks),
        SizedBox(height: 22),
        _buildReferenceTableHeader(),
        Expanded(child: _buildReferenceTrackTable(tracks)),
        Padding(
          padding: EdgeInsets.only(top: 12, bottom: 10),
          child: Text(
            '共 ${tracks.length} 首歌曲',
            style: TextStyle(
              color: AppColors.secondaryText,
              fontSize: 12,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildReferenceActions(List<Map<String, dynamic>> tracks) {
    return Row(
      children: [
        _ReferencePrimaryButton(
          icon: Icons.play_arrow,
          label: '播放全部',
          onTap: tracks.isEmpty ? null : () => _playTrack(tracks.first, 0),
        ),
        SizedBox(width: 12),
        _ReferenceGhostButton(
          icon: Icons.shuffle,
          label: '随机播放',
          onTap: tracks.isEmpty
              ? null
              : () {
                  final index =
                      DateTime.now().millisecondsSinceEpoch % tracks.length;
                  _playTrack(tracks[index], index);
                },
        ),
        SizedBox(width: 10),
        _ReferenceIconButton(icon: Icons.more_horiz, onTap: () {}),
      ],
    );
  }

  Widget _buildReferenceTableHeader() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 18),
      child: Row(
        children: [
          _tableCell('#', 42, header: true),
          Expanded(flex: 34, child: _tableText('歌曲', header: true)),
          Expanded(flex: 22, child: _tableText('歌手', header: true)),
          Expanded(flex: 26, child: _tableText('专辑', header: true)),
          Expanded(flex: 16, child: _tableText('时长', header: true)),
          Expanded(flex: 20, child: _tableText('添加时间', header: true)),
          SizedBox(width: 44),
        ],
      ),
    );
  }

  Widget _buildReferenceTrackTable(List<Map<String, dynamic>> tracks) {
    if (tracks.isEmpty) {
      return Center(
        child: Text(
          _emptyText(),
          style: TextStyle(color: AppColors.secondaryText),
        ),
      );
    }
    return ListView.builder(
      padding: EdgeInsets.only(top: 10, bottom: 8),
      itemCount: tracks.length,
      itemBuilder: (context, index) {
        final track = tracks[index];
        return Obx(() {
          final active = _globalPlayerStore.currentTrack?['id'] == track['id'];
          return _buildReferenceTrackRow(track, index, active);
        });
      },
    );
  }

  Widget _buildReferenceTrackRow(
    Map<String, dynamic> track,
    int index,
    bool active,
  ) {
    final id = track['id']?.toString() ?? '';
    final hovered = _hoveredTrackId == id;
    final highlighted = active || hovered;
    final favorite = _favoriteTrackIds.contains(id);
    final addedDay =
        (18 - (index ~/ 3)).clamp(1, 28).toString().padLeft(2, '0');
    return MouseRegion(
      onEnter: (_) => setState(() => _hoveredTrackId = id),
      onExit: (_) => setState(() => _hoveredTrackId = null),
      child: InkWell(
        borderRadius: BorderRadius.circular(6),
        onTap: () => _playTrack(track, index),
        child: AnimatedContainer(
          duration: Duration(milliseconds: 160),
          height: 52,
          margin: EdgeInsets.only(bottom: 2),
          padding: EdgeInsets.symmetric(horizontal: 18),
          decoration: BoxDecoration(
            color: highlighted
                ? AppColors.primaryBtn
                    .withValues(alpha: AppColors.isDark ? 0.10 : 0.08)
                : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
            border: Border(
              bottom: BorderSide(
                color: AppColors.borderColor.withValues(alpha: 0.72),
              ),
            ),
            boxShadow: highlighted
                ? [
                    BoxShadow(
                      color: AppColors.primaryBtn.withValues(alpha: 0.22),
                      blurRadius: 24,
                      offset: Offset(0, 0),
                    ),
                  ]
                : [],
          ),
          child: Row(
            children: [
              SizedBox(
                width: 42,
                child: highlighted
                    ? Icon(
                        active ? Icons.volume_up_outlined : Icons.play_arrow,
                        color: AppColors.primaryBtn,
                        size: 20,
                      )
                    : Text(
                        '${index + 1}',
                        style: TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 13,
                        ),
                      ),
              ),
              Expanded(
                flex: 34,
                child: _tableText(
                  track['name']?.toString() ?? '未知歌曲',
                  active: highlighted,
                ),
              ),
              Expanded(
                flex: 22,
                child: _tableText(_artistName(track), active: highlighted),
              ),
              Expanded(
                flex: 26,
                child: _tableText(_albumField(track, 'name', fallback: '未知专辑')),
              ),
              Expanded(
                flex: 16,
                child: _tableText(_formatTrackDuration(track), numeric: true),
              ),
              Expanded(
                flex: 20,
                child: _tableText('2024-06-$addedDay'),
              ),
              SizedBox(
                width: 44,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    IconButton(
                      tooltip: favorite ? '取消喜欢' : '设为喜欢',
                      padding: EdgeInsets.zero,
                      constraints: BoxConstraints.tight(Size(30, 30)),
                      onPressed: () => _toggleFavorite(track),
                      icon: Icon(
                        favorite ? Icons.favorite : Icons.favorite_border,
                        color: favorite
                            ? AppColors.primaryBtn
                            : AppColors.secondaryText,
                        size: 19,
                      ),
                    ),
                    if (highlighted)
                      Icon(Icons.more_horiz,
                          color: AppColors.primaryText, size: 18),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildReferenceArtistGrid() {
    final groups = _artistGroups();
    final entries = groups.entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    if (entries.isEmpty) {
      return Center(
        child: Text('暂无歌手', style: TextStyle(color: AppColors.secondaryText)),
      );
    }
    return GridView.builder(
      padding: EdgeInsets.only(top: 4, bottom: 18),
      gridDelegate: SliverGridDelegateWithMaxCrossAxisExtent(
        maxCrossAxisExtent: 260,
        mainAxisExtent: 86,
        crossAxisSpacing: 14,
        mainAxisSpacing: 14,
      ),
      itemCount: entries.length,
      itemBuilder: (context, index) {
        final entry = entries[index];
        final firstTrack = entry.value.first;
        return InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: () => setState(() => _selectedArtistName = entry.key),
          child: Container(
            padding: EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.navigationBg.withValues(alpha: 0.42),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.borderColor),
            ),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(9),
                  child: NetImage(
                    _albumField(firstTrack, 'picUrl'),
                    width: 52,
                    height: 52,
                    fit: BoxFit.cover,
                  ),
                ),
                SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        entry.key,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.primaryText,
                          fontSize: 15,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(height: 4),
                      Text(
                        '${entry.value.length} 首歌曲',
                        style: TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right, color: AppColors.secondaryText),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildReferenceRadioList() {
    return Column(
      children: [
        _buildReferenceActions(_tracks),
        SizedBox(height: 18),
        Container(
          padding: EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: AppColors.primaryBtn.withValues(alpha: 0.16),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: AppColors.primaryBtn.withValues(alpha: 0.28),
            ),
          ),
          child: Row(
            children: [
              Icon(Icons.radio_outlined, color: AppColors.primaryBtn, size: 36),
              SizedBox(width: 14),
              Expanded(
                child: Text(
                  '${_dailyRadioSummary()} 生成后按“开场语音、推荐歌曲、收尾语音”顺序加入播放队列。',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: AppColors.secondaryText,
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
              ),
              SizedBox(width: 14),
              _ReferencePrimaryButton(
                icon: Icons.wb_sunny_outlined,
                label: _dailyRadioGenerating ? '生成中' : '今日电台',
                onTap: _dailyRadioGenerating ? null : _runDailyRadioNow,
              ),
            ],
          ),
        ),
        if (_radioError != null)
          Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text(
              _radioError!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: Colors.redAccent, fontSize: 12),
            ),
          ),
        SizedBox(height: 18),
        Expanded(
          child: _radioLoading
              ? _buildLoadingState('电台加载中...')
              : _radioEpisodes.isEmpty
                  ? Center(
                      child: Text(
                        '还没有生成过电台',
                        style: TextStyle(color: AppColors.secondaryText),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.zero,
                      itemCount: _radioEpisodes.length,
                      itemBuilder: (context, index) {
                        final episode = _radioEpisodes[index];
                        return _RadioEpisodeItem(
                          episode: episode,
                          onTap: () => _playRadioEpisode(episode),
                        );
                      },
                    ),
        ),
      ],
    );
  }

  Widget _buildReferenceRightRail() {
    return LayoutBuilder(
      builder: (context, constraints) {
        return SingleChildScrollView(
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Column(
              children: [
                _buildReferenceTodayRadioCard(),
                SizedBox(height: 12),
                SizedBox(
                  height: constraints.maxHeight < 590 ? 210 : 260,
                  child: _buildReferenceRecentCard(),
                ),
                SizedBox(height: 12),
                _buildReferenceFavoriteCard(),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildReferenceTodayRadioCard() {
    final generating = _dailyRadioGenerating || _radioGenerating;
    final latest = _radioEpisodes.isNotEmpty ? _radioEpisodes.first : null;
    final title = latest?['title']?.toString() ?? '轻柔治愈的音乐';
    final summary =
        latest?['summary']?.toString() ?? '根据你的喜好生成中，包含华语、流行、夜晚等多种风格';
    return _ReferencePanel(
      child: Padding(
        padding: EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '今日电台',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                Text(
                  generating ? '生成中 00:18' : '已就绪',
                  style: TextStyle(
                    color: generating
                        ? AppColors.primaryBtn
                        : AppColors.secondaryText,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
            SizedBox(height: 20),
            Row(
              children: [
                Icon(Icons.graphic_eq, color: AppColors.primaryBtn, size: 58),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.primaryText,
                          fontSize: 17,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      SizedBox(height: 7),
                      Text(
                        summary,
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: AppColors.secondaryText,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: _ReferenceGhostButton(
                    icon: generating ? Icons.pause : Icons.wb_sunny_outlined,
                    label: generating ? '生成中' : '今日电台',
                    onTap: generating ? null : _runDailyRadioNow,
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: _ReferenceGhostButton(
                    icon: Icons.skip_next,
                    label: '换一批',
                    onTap: _radioGenerating ? null : _generateRadioEpisode,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReferenceRecentCard() {
    final tracks = _playHistoryTracks().take(5).toList();
    return _ReferencePanel(
      child: Padding(
        padding: EdgeInsets.fromLTRB(18, 16, 18, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '最近播放',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontSize: 17,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() {
                    _viewMode = _DesktopMusicViewMode.history;
                    _selectedArtistName = null;
                  }),
                  child: Text('清空', style: TextStyle(fontSize: 12)),
                ),
              ],
            ),
            SizedBox(height: 12),
            Expanded(
              child: tracks.isEmpty
                  ? Center(
                      child: Text(
                        '暂无播放记录',
                        style: TextStyle(color: AppColors.secondaryText),
                      ),
                    )
                  : ListView.builder(
                      padding: EdgeInsets.zero,
                      itemCount: tracks.length,
                      itemBuilder: (context, index) {
                        final track = tracks[index];
                        return _RightRailTrack(
                          track: track,
                          duration: _formatTrackDuration(track),
                          onTap: () =>
                              _playTrack(track, _tracks.indexOf(track)),
                          artistName: _artistName(track),
                          coverUrl: _albumField(track, 'picUrl'),
                        );
                      },
                    ),
            ),
            Center(
              child: TextButton(
                onPressed: () => setState(() {
                  _viewMode = _DesktopMusicViewMode.history;
                  _selectedArtistName = null;
                }),
                child: Text('查看全部播放记录'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReferenceFavoriteCard() {
    final tracks = _tracks
        .where((track) => _favoriteTrackIds.contains(track['id']?.toString()))
        .take(4)
        .toList();
    return _ReferencePanel(
      child: Padding(
        padding: EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(Icons.favorite, color: AppColors.primaryBtn, size: 19),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    '我喜欢的音乐  ${_favoriteTrackIds.length} 首',
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 16),
            Row(
              children: [
                for (final track in tracks)
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(right: 8),
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(8),
                        child: NetImage(
                          _albumField(track, 'picUrl'),
                          height: 48,
                          fit: BoxFit.cover,
                        ),
                      ),
                    ),
                  ),
                if (tracks.isEmpty)
                  Expanded(
                    child: Text(
                      '还没有喜欢的音乐',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 12,
                      ),
                    ),
                  ),
              ],
            ),
            SizedBox(height: 8),
            Center(
              child: TextButton(
                onPressed: () => setState(() {
                  _viewMode = _DesktopMusicViewMode.favorites;
                  _selectedArtistName = null;
                }),
                child: Text('查看全部'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReferencePlayerBar() {
    return Obx(() {
      final track = _globalPlayerStore.currentTrack;
      return Container(
        height: 108,
        margin: EdgeInsets.fromLTRB(14, 0, 14, 12),
        padding: EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.navigationBg
              .withValues(alpha: AppColors.isDark ? 0.72 : 0.9),
          borderRadius: BorderRadius.circular(13),
          border: Border.all(color: AppColors.borderColor),
          boxShadow: [
            BoxShadow(
              color: Colors.black
                  .withValues(alpha: AppColors.isDark ? 0.38 : 0.08),
              blurRadius: 24,
              offset: Offset(0, -8),
            ),
          ],
        ),
        child: track == null
            ? Center(
                child: Text(
                  '选择一首歌曲开始播放',
                  style: TextStyle(color: AppColors.secondaryText),
                ),
              )
            : Row(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: NetImage(
                      _albumField(track, 'picUrl'),
                      width: 70,
                      height: 70,
                      fit: BoxFit.cover,
                    ),
                  ),
                  SizedBox(width: 20),
                  SizedBox(
                    width: 240,
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          track['name']?.toString() ?? '未知歌曲',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.primaryText,
                            fontSize: 17,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        SizedBox(height: 8),
                        Text(
                          '${_artistName(track)}  ·  ${_albumField(track, 'name', fallback: '未知专辑')}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: AppColors.secondaryText,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: '喜欢',
                    onPressed: () => _toggleFavorite(track),
                    icon: Icon(
                      _favoriteTrackIds.contains(track['id']?.toString())
                          ? Icons.favorite
                          : Icons.favorite_border,
                      color: AppColors.primaryBtn,
                    ),
                  ),
                  IconButton(
                    tooltip: '更多',
                    onPressed: () {},
                    icon: Icon(Icons.more_horiz, color: AppColors.primaryText),
                  ),
                  Expanded(
                    child: GetBuilder<GlobalMusicController>(
                      builder: (controller) {
                        final total = controller.totalDuration > 0
                            ? controller.totalDuration
                            : _trackDurationMilliseconds(track);
                        final current = controller.currentPosition
                            .clamp(0, math.max(total, 1))
                            .toInt();
                        return Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                IconButton(
                                  tooltip: '播放模式',
                                  onPressed: _playlistStore.togglePlayMode,
                                  icon: Icon(
                                    _playModeIcon(),
                                    color: AppColors.primaryText,
                                  ),
                                ),
                                SizedBox(width: 14),
                                IconButton(
                                  tooltip: '上一首',
                                  onPressed: _musicController.playPrevious,
                                  icon: Icon(
                                    Icons.skip_previous,
                                    color: AppColors.primaryText,
                                    size: 28,
                                  ),
                                ),
                                SizedBox(width: 16),
                                Container(
                                  width: 52,
                                  height: 52,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.primaryBtn,
                                    boxShadow: [
                                      BoxShadow(
                                        color: AppColors.primaryBtn
                                            .withValues(alpha: 0.34),
                                        blurRadius: 24,
                                      ),
                                    ],
                                  ),
                                  child: IconButton(
                                    tooltip: controller.isPlaying ? '暂停' : '播放',
                                    onPressed: controller.togglePlayPause,
                                    icon: Icon(
                                      controller.isPlaying
                                          ? Icons.pause
                                          : Icons.play_arrow,
                                      color: Colors.white,
                                      size: 28,
                                    ),
                                  ),
                                ),
                                SizedBox(width: 16),
                                IconButton(
                                  tooltip: '下一首',
                                  onPressed: _musicController.playNext,
                                  icon: Icon(
                                    Icons.skip_next,
                                    color: AppColors.primaryText,
                                    size: 28,
                                  ),
                                ),
                                SizedBox(width: 14),
                                IconButton(
                                  tooltip: '循环',
                                  onPressed: _playlistStore.togglePlayMode,
                                  icon: Icon(
                                    Icons.repeat,
                                    color: AppColors.primaryText,
                                  ),
                                ),
                              ],
                            ),
                            SizedBox(height: 8),
                            Row(
                              children: [
                                Text(
                                  controller.formatDuration(current),
                                  style: TextStyle(
                                    color: AppColors.secondaryText,
                                    fontSize: 12,
                                  ),
                                ),
                                SizedBox(width: 10),
                                Expanded(
                                  child: SliderTheme(
                                    data: SliderTheme.of(context).copyWith(
                                      trackHeight: 3,
                                      thumbShape: RoundSliderThumbShape(
                                        enabledThumbRadius: 6,
                                      ),
                                      overlayShape:
                                          SliderComponentShape.noOverlay,
                                      activeTrackColor: AppColors.primaryBtn,
                                      inactiveTrackColor: AppColors.borderColor,
                                      thumbColor: AppColors.primaryBtn,
                                    ),
                                    child: Slider(
                                      min: 0,
                                      max: math.max(total, 1).toDouble(),
                                      value: current.toDouble(),
                                      onChanged: (value) =>
                                          controller.seekTo(value.round()),
                                    ),
                                  ),
                                ),
                                SizedBox(width: 10),
                                Text(
                                  controller.formatDuration(total),
                                  style: TextStyle(
                                    color: AppColors.secondaryText,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                  SizedBox(width: 28),
                  Icon(Icons.volume_up_outlined,
                      color: AppColors.primaryText, size: 22),
                  SizedBox(
                    width: 130,
                    child: SliderTheme(
                      data: SliderTheme.of(context).copyWith(
                        trackHeight: 3,
                        thumbShape:
                            RoundSliderThumbShape(enabledThumbRadius: 6),
                        overlayShape: SliderComponentShape.noOverlay,
                        activeTrackColor: AppColors.primaryBtn,
                        inactiveTrackColor: AppColors.borderColor,
                        thumbColor: AppColors.primaryBtn,
                      ),
                      child: Slider(
                        value: 0.72,
                        onChanged: (_) {},
                      ),
                    ),
                  ),
                  IconButton(
                    tooltip: '歌词',
                    onPressed: () {},
                    icon: Icon(Icons.lyrics_outlined,
                        color: AppColors.primaryText, size: 21),
                  ),
                  IconButton(
                    tooltip: '播放队列',
                    onPressed: showPlaylistDialog,
                    icon: Icon(Icons.format_list_bulleted,
                        color: AppColors.primaryText, size: 23),
                  ),
                ],
              ),
      );
    });
  }

  Widget _tableCell(String text, double width, {bool header = false}) {
    return SizedBox(width: width, child: _tableText(text, header: header));
  }

  Widget _tableText(
    String text, {
    bool header = false,
    bool active = false,
    bool numeric = false,
  }) {
    return Text(
      text,
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
      textAlign: numeric ? TextAlign.left : TextAlign.left,
      style: TextStyle(
        color: header
            ? AppColors.secondaryText
            : active
                ? AppColors.primaryText
                : AppColors.primaryText.withValues(alpha: 0.82),
        fontSize: header ? 12 : 14,
        fontWeight: header ? FontWeight.w700 : FontWeight.w500,
      ),
    );
  }

  List<Map<String, dynamic>> _playHistoryTracks() {
    final byId = {
      for (final track in _tracks) track['id']?.toString() ?? '': track,
    };
    return _playHistoryIds
        .map((id) => byId[id])
        .whereType<Map<String, dynamic>>()
        .toList();
  }

  String _formatTrackDuration(Map<String, dynamic> track) {
    final milliseconds = _trackDurationMilliseconds(track);
    final minutes = (milliseconds ~/ 60000).toString().padLeft(2, '0');
    final seconds = ((milliseconds ~/ 1000) % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  String _clockLabel() {
    final now = DateTime.now();
    final hour = now.hour.toString().padLeft(2, '0');
    final minute = now.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }

  Map<String, dynamic> _radioScriptPlan(Map<String, dynamic>? episode) {
    if (episode == null) return {};
    final script = episode['script']?.toString() ?? '';
    if (script.trim().isEmpty) return {};
    try {
      final decoded = jsonDecode(script);
      if (decoded is Map) return Map<String, dynamic>.from(decoded);
    } catch (_) {
      return {'intro': script};
    }
    return {};
  }

  List<Map<String, dynamic>> _radioEpisodeTracks(
      Map<String, dynamic>? episode) {
    if (episode == null) return [];
    final plan = _radioScriptPlan(episode);
    final planTracks = plan['tracks'];
    if (planTracks is List && planTracks.isNotEmpty) {
      return planTracks
          .whereType<Map>()
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    final segments = episode['segments'];
    if (segments is List) {
      return segments
          .whereType<Map>()
          .where((item) => item['type']?.toString() == 'track')
          .map((item) => Map<String, dynamic>.from(item))
          .toList();
    }
    return [];
  }

  List<String> _splitRadioTranscript(String text) {
    final cleaned = text.trim();
    if (cleaned.isEmpty) return [];
    final parts = cleaned
        .split(RegExp(r'(?<=[。！？.!?])\s+|\n+'))
        .map((item) => item.trim())
        .where((item) => item.isNotEmpty)
        .toList();
    if (parts.length <= 1 && cleaned.length > 42) {
      final chunks = <String>[];
      for (var index = 0; index < cleaned.length; index += 42) {
        chunks.add(
          cleaned.substring(index, math.min(index + 42, cleaned.length)),
        );
      }
      return chunks;
    }
    return parts;
  }

  int _trackDurationMilliseconds(Map<String, dynamic> track) {
    final raw = track['dt'] ?? track['duration'] ?? track['durationMs'];
    if (raw is int) return raw > 10000 ? raw : raw * 1000;
    final parsed = int.tryParse(raw?.toString() ?? '') ?? 0;
    return parsed > 10000 ? parsed : parsed * 1000;
  }

  IconData _playModeIcon() {
    switch (_playlistStore.playMode) {
      case 1:
        return Icons.shuffle;
      case 2:
        return Icons.repeat_one;
      default:
        return Icons.repeat;
    }
  }

  Widget _buildLoadingState(String text) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          LoadingAnimationWidget.staggeredDotsWave(
            color: AppColors.primaryBtn,
            size: 30,
          ),
          SizedBox(height: 14),
          Text(
            text,
            style: TextStyle(
              color: AppColors.secondaryText,
              fontSize: 14,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTinyLoading(Color color) {
    return LoadingAnimationWidget.staggeredDotsWave(
      color: color,
      size: 18,
    );
  }

  String _dailyRadioSummary() {
    final status = _dailyRadioStatus;
    if (status == null) {
      return '参考当前列表生成一期私人电台，正在读取 NAS 电台状态。';
    }
    final weather = status['weather'];
    final city =
        weather is Map ? weather['city']?.toString() ?? '陕西西安' : '陕西西安';
    final time = status['time']?.toString() ?? '07:30';
    final nextRun = status['nextRunAt']?.toString() ?? '';
    final nextText = nextRun.isEmpty ? '' : '，下次 $nextRun';
    final minimaxReady = _radioStatus?['minimaxConfigured'] == true;
    final voice = _radioStatus?['voiceId']?.toString() ?? '';
    final engine = minimaxReady ? 'MiniMax $voice' : '测试音频';
    return '每天 $time 根据$city天气和最近听歌自动生成，$engine$nextText。';
  }

  String _emptyText() {
    switch (_viewMode) {
      case _DesktopMusicViewMode.favorites:
        return '还没有喜欢的歌曲';
      case _DesktopMusicViewMode.history:
        return '还没有播放记录';
      default:
        return '暂无歌曲';
    }
  }

  Widget _buildError() {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(18),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off, color: AppColors.primaryBtn, size: 42),
            SizedBox(height: 12),
            Text(
              'NAS 音乐服务连接失败',
              style: TextStyle(color: AppColors.primaryText),
            ),
            SizedBox(height: 8),
            Text(
              _error ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppColors.secondaryText, fontSize: 12),
            ),
            SizedBox(height: 14),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primaryBtn,
                foregroundColor: Colors.white,
              ),
              onPressed: () => _loadTracks(_searchController.text),
              child: Text('重试'),
            ),
          ],
        ),
      ),
    );
  }

  String _artistName(Map<String, dynamic> track) {
    final artists = track['ar'];
    if (artists is List && artists.isNotEmpty && artists.first is Map) {
      return artists.first['name']?.toString() ?? '未知歌手';
    }
    return '未知歌手';
  }

  String _albumField(
    Map<String, dynamic> track,
    String key, {
    String fallback = '',
  }) {
    final album = track['al'];
    if (album is Map) return album[key]?.toString() ?? fallback;
    final rawAlbum = track['album'];
    if (rawAlbum is Map) {
      if (key == 'picUrl') {
        return NasMusicApi.resolveAssetUrl(
          rawAlbum['coverArtUrl']?.toString() ?? rawAlbum['picUrl']?.toString(),
        );
      }
      return rawAlbum[key]?.toString() ?? fallback;
    }
    if (key == 'picUrl') {
      return NasMusicApi.resolveAssetUrl(track['coverArtUrl']?.toString());
    }
    return fallback;
  }

  List<Map<String, dynamic>> _visibleTracks() {
    if (_viewMode == _DesktopMusicViewMode.favorites) {
      return _tracks
          .where((track) => _favoriteTrackIds.contains(track['id']?.toString()))
          .toList();
    }
    if (_viewMode == _DesktopMusicViewMode.history) {
      final byId = {
        for (final track in _tracks) track['id']?.toString() ?? '': track,
      };
      return _playHistoryIds
          .map((id) => byId[id])
          .whereType<Map<String, dynamic>>()
          .toList();
    }
    if (_viewMode == _DesktopMusicViewMode.artists &&
        _selectedArtistName != null) {
      return _artistTracks(_selectedArtistName!);
    }
    return _tracks;
  }

  Map<String, List<Map<String, dynamic>>> _artistGroups() {
    final groups = <String, List<Map<String, dynamic>>>{};
    for (final track in _tracks) {
      final artist = _artistName(track);
      groups.putIfAbsent(artist, () => []).add(track);
    }
    return groups;
  }

  List<Map<String, dynamic>> _artistTracks(String artist) {
    return _tracks.where((track) => _artistName(track) == artist).toList();
  }
}
