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

class DesktopMusicHome extends StatefulWidget {
  DesktopMusicHome({super.key});

  @override
  State<DesktopMusicHome> createState() => _DesktopMusicHomeState();
}

class _DesktopMusicHomeState extends State<DesktopMusicHome> {
  final TextEditingController _searchController = TextEditingController();
  final TextEditingController _downloadSearchController =
      TextEditingController();
  final GetStorage _storage = GetStorage();
  final PlaylistStore _playlistStore = Get.find<PlaylistStore>();
  final GlobalMusicController _musicController =
      Get.find<GlobalMusicController>();
  final GlobalPlayerStore _globalPlayerStore = Get.find<GlobalPlayerStore>();

  List<Map<String, dynamic>> _tracks = [];
  List<Map<String, dynamic>> _radioEpisodes = [];
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
  String? _error;
  String? _radioError;
  String? _toolMessage;
  String? _hoveredTrackId;

  @override
  void initState() {
    super.initState();
    _loadFavorites();
    _loadPlaybackHistory();
    _loadTracks();
    _loadRadioStatus();
    _loadRadioEpisodes();
    _loadDailyRadioStatus();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _downloadSearchController.dispose();
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
        setState(() {
          _radioEpisodes = [
            Map<String, dynamic>.from(episode),
            ..._radioEpisodes,
          ];
        });
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
        setState(() {
          _radioEpisodes = [
            Map<String, dynamic>.from(episode),
            ..._radioEpisodes,
          ];
        });
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
      body: Stack(
        children: [
          Positioned.fill(child: _StarFieldBackground()),
          Column(
            children: [
              Expanded(
                child: Row(
                  children: [
                    _buildReferenceSidebar(),
                    Expanded(child: _buildReferenceWorkspace()),
                  ],
                ),
              ),
              _buildReferencePlayerBar(),
            ],
          ),
        ],
      ),
    );
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
