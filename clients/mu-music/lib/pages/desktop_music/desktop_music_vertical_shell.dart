part of '../desktop_music_home.dart';

extension _DesktopMusicVerticalShell on _DesktopMusicHomeState {
  Widget _buildVerticalDjApp() {
    return _ClaudioParticleField(
      focusMode: false,
      lyricPulse: false,
      child: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 52,
              left: 36,
              child: _buildMigiIdentity(),
            ),
            Positioned(
              top: 136,
              left: 0,
              right: 0,
              child: SizedBox(
                height: 190,
                child: _buildClockPanel(),
              ),
            ),
            Positioned(
              top: 14,
              right: 14,
              child: _buildThemeSegment(),
            ),
            Positioned(
              top: 326,
              left: 0,
              right: 0,
              child: _buildNowPlayingStrip(),
            ),
            Positioned.fill(
              top: 430,
              child: _buildVerticalContentPanel(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMigiIdentity() {
    final textColor = AppColors.isDark ? Colors.white : Color(0xFF111827);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: 66,
          height: 66,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(
              color: AppColors.isDark
                  ? Colors.white.withValues(alpha: 0.16)
                  : Color(0xFF111827).withValues(alpha: 0.12),
            ),
            boxShadow: [
              BoxShadow(
                color: Color(0xFF7B5CFF).withValues(alpha: 0.16),
                blurRadius: 14,
                spreadRadius: 1,
              ),
            ],
          ),
          child: ClipOval(
            child: Image.asset(
              'assets/images/avatar/migi_avatar.png',
              fit: BoxFit.cover,
            ),
          ),
        ),
        SizedBox(width: 14),
        SizedBox(
          height: 66,
          child: Align(
            alignment: Alignment.centerLeft,
            child: _DotMatrixWord(
              text: 'migi',
              color: textColor,
              dotRadius: 1.65,
              pitch: 5.0,
              letterSpacing: 4.0,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildClockPanel() {
    return StreamBuilder<DateTime>(
      initialData: DateTime.now(),
      stream: Stream.periodic(Duration(seconds: 1), (_) => DateTime.now()),
      builder: (context, snapshot) {
        final now = snapshot.data ?? DateTime.now();
        final textColor = AppColors.isDark ? Colors.white : Color(0xFF111827);
        final mutedColor = AppColors.isDark
            ? Colors.white.withValues(alpha: 0.48)
            : Color(0xFF111827).withValues(alpha: 0.48);
        final month = now.month.toString().padLeft(2, '0');
        final day = now.day.toString().padLeft(2, '0');
        final colon = now.second.isEven ? ':' : ' ';
        final time =
            '${now.hour.toString().padLeft(2, '0')}$colon${now.minute.toString().padLeft(2, '0')}';
        final date = '${now.year} · $month · $day';

        return _ClockPanelBackground(
          isDark: AppColors.isDark,
          child: Container(
            width: double.infinity,
            height: double.infinity,
            alignment: Alignment.center,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _DotMatrixWord(
                  text: time,
                  color: textColor,
                  dotRadius: 2.35,
                  pitch: 7.4,
                  letterSpacing: 10.0,
                ),
                SizedBox(height: 14),
                Text(
                  '星期${_weekdayNumberLabel(now.weekday)}',
                  style: TextStyle(
                    color: mutedColor,
                    fontSize: 12,
                    fontWeight: FontWeight.w900,
                    height: 1,
                    letterSpacing: 0.1,
                    fontFamily: 'Menlo',
                    fontFamilyFallback: [
                      'SF Mono',
                      'monospace',
                      'Courier New',
                    ],
                  ),
                ),
                SizedBox(height: 8),
                Text(
                  date,
                  style: TextStyle(
                    color: mutedColor.withValues(alpha: 0.72),
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    height: 1,
                    letterSpacing: 0.4,
                    fontFamily: 'Menlo',
                    fontFamilyFallback: [
                      'SF Mono',
                      'monospace',
                      'Courier New',
                    ],
                  ),
                ),
                SizedBox(height: 11),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: Color(0xFF22C55E),
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: Color(0xFF22C55E).withValues(alpha: 0.38),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                    ),
                    SizedBox(width: 7),
                    Text(
                      'ONLINE',
                      style: TextStyle(
                        color: Color(0xFF22C55E),
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        height: 1,
                        letterSpacing: 1.1,
                        fontFamily: 'Menlo',
                        fontFamilyFallback: [
                          'SF Mono',
                          'monospace',
                          'Courier New',
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  String _weekdayNumberLabel(int weekday) {
    const labels = ['一', '二', '三', '四', '五', '六', '日'];
    return labels[(weekday - 1).clamp(0, labels.length - 1)];
  }

  Widget _buildNowPlayingStrip() {
    return Obx(() {
      final track = _verticalCurrentTrack();
      final title = track == null ? '选择一首歌曲开始播放' : _verticalTrackTitle(track);
      final artist = track == null ? 'Migi' : _verticalArtistName(track);
      final album = track == null ? 'NAS RADIO' : _verticalAlbumName(track);
      final current = _musicController.currentPosition;
      final total = _musicController.totalDuration > 0
          ? _musicController.totalDuration
          : (track == null ? 0 : _trackDurationMilliseconds(track));
      final clampedCurrent = total <= 0 ? 0 : current.clamp(0, total);
      final liked =
          track != null && _favoriteTrackIds.contains(track['id']?.toString());
      final showingLyrics = _verticalPanel == _VerticalDjPanel.player;
      final primary = AppColors.isDark ? Colors.white : Color(0xFF111827);
      final secondary = AppColors.isDark
          ? Colors.white.withValues(alpha: 0.56)
          : Color(0xFF111827).withValues(alpha: 0.56);

      return _PanelCutoutBackground(
        isDark: AppColors.isDark,
        child: SizedBox(
          height: 104,
          child: Padding(
            padding: EdgeInsets.fromLTRB(26, 10, 22, 9),
            child: Column(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      SizedBox(
                        width: 38,
                        height: 34,
                        child: _RadioWaveform(
                          active: _musicController.isPlaying,
                          color: AppColors.primaryBtn,
                          inactiveColor: secondary,
                          barCount: 5,
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
                                color: primary,
                                fontSize: 13,
                                fontWeight: FontWeight.w900,
                                height: 1,
                                fontFamily: 'LXGWWenKai',
                              ),
                            ),
                            SizedBox(height: 5),
                            Text(
                              '$artist  ·  $album',
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: secondary,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                height: 1,
                              ),
                            ),
                          ],
                        ),
                      ),
                      _verticalPlayerIcon(
                        Icons.skip_previous_rounded,
                        _musicController.playPrevious,
                      ),
                      _verticalPlayerIcon(
                        _musicController.isPlaying
                            ? Icons.pause_rounded
                            : Icons.play_arrow_rounded,
                        _toggleVerticalPlayback,
                        prominent: true,
                      ),
                      _verticalPlayerIcon(
                        Icons.skip_next_rounded,
                        _musicController.playNext,
                      ),
                      _verticalPlayerIcon(
                        Icons.favorite_rounded,
                        track == null ? null : () => _toggleFavorite(track),
                        active: liked,
                      ),
                      _verticalPlayerIcon(
                        Icons.favorite_border_rounded,
                        _showVerticalFavoritesSheet,
                      ),
                      _verticalModePill(
                        showingLyrics ? 'CHAT' : 'LYRIC',
                        () {
                          _setVerticalPanel(
                            showingLyrics
                                ? _VerticalDjPanel.chat
                                : _VerticalDjPanel.player,
                          );
                        },
                        active: showingLyrics,
                      ),
                      _verticalPlayerIcon(
                        Icons.playlist_play_rounded,
                        _showVerticalPlaylistSheet,
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 7),
                Row(
                  children: [
                    Text(
                      _musicController.formatDuration(clampedCurrent),
                      style: TextStyle(
                        color: secondary,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    SizedBox(width: 10),
                    Expanded(
                      child: SliderTheme(
                        data: SliderTheme.of(context).copyWith(
                          trackHeight: 2.5,
                          thumbShape: RoundSliderThumbShape(
                            enabledThumbRadius: 4.5,
                          ),
                          overlayShape: SliderComponentShape.noOverlay,
                          activeTrackColor: AppColors.primaryBtn,
                          inactiveTrackColor: secondary.withValues(alpha: 0.18),
                          thumbColor: AppColors.primaryBtn,
                        ),
                        child: Slider(
                          min: 0,
                          max: total <= 0 ? 1 : total.toDouble(),
                          value: total <= 0 ? 0 : clampedCurrent.toDouble(),
                          onChanged: total <= 0
                              ? null
                              : (value) => _musicController.seekTo(
                                    value.round(),
                                  ),
                        ),
                      ),
                    ),
                    SizedBox(width: 10),
                    Text(
                      total <= 0
                          ? '--:--'
                          : _musicController.formatDuration(total),
                      style: TextStyle(
                        color: secondary,
                        fontSize: 10,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      );
    });
  }

  Widget _buildVerticalContentPanel() {
    return Padding(
      padding: EdgeInsets.fromLTRB(18, 14, 18, 18),
      child: _PanelCutoutBackground(
        isDark: AppColors.isDark,
        child: AnimatedSwitcher(
          duration: Duration(milliseconds: 220),
          child: _verticalPanel == _VerticalDjPanel.player
              ? _buildVerticalLyricsPanel(key: ValueKey('lyrics'))
              : _buildVerticalChatPanel(key: ValueKey('chat')),
        ),
      ),
    );
  }

  Widget _buildVerticalLyricsPanel({required Key key}) {
    final mutedColor = AppColors.isDark
        ? Colors.white.withValues(alpha: 0.42)
        : Color(0xFF111827).withValues(alpha: 0.42);

    return Obx(() {
      final currentTrack = _verticalCurrentTrack();
      final currentLyrics = currentTrack?['lyrics']?.toString().trim() ?? '';
      final reason = currentTrack?['radioReason']?.toString().trim() ?? '';
      final intro = _radioEpisodes.isNotEmpty
          ? _radioScriptPlan(_radioEpisodes.first)['intro']?.toString() ?? ''
          : '';
      final fallbackText = currentLyrics.isNotEmpty
          ? currentLyrics
          : reason.isNotEmpty
              ? reason
              : (intro.isEmpty ? '歌词会在播放时跟随当前位置滚动。' : intro);
      final fallbackLines = _splitRadioTranscript(fallbackText);
      final lyrics = _musicController.lyrics;
      final itemCount =
          lyrics.isNotEmpty ? lyrics.length : fallbackLines.length;
      final activeIndex = lyrics.isNotEmpty
          ? _musicController.currentLyricIndex
          : _fallbackLyricActiveIndex(itemCount);
      if (lyrics.isEmpty) {
        _scrollFallbackLyricsTo(activeIndex);
      }
      return ListView.builder(
        key: key,
        controller: lyrics.isNotEmpty
            ? _musicController.lyricScrollController
            : _fallbackLyricScrollController,
        padding: EdgeInsets.fromLTRB(18, 18, 18, 18),
        itemCount: itemCount,
        itemBuilder: (context, index) {
          final line =
              lyrics.isNotEmpty ? lyrics[index].text : fallbackLines[index];
          final active = index == activeIndex;
          return AnimatedContainer(
            duration: Duration(milliseconds: 180),
            margin: EdgeInsets.only(bottom: 13),
            padding: EdgeInsets.symmetric(horizontal: 12, vertical: 9),
            decoration: BoxDecoration(color: Colors.transparent),
            child: Text(
              line,
              style: TextStyle(
                color: active ? AppColors.primaryBtn : mutedColor,
                fontSize: active ? 17 : 14,
                height: 1.46,
                fontWeight: active ? FontWeight.w900 : FontWeight.w700,
                fontFamily: 'LXGWWenKai',
              ),
            ),
          );
        },
      );
    });
  }

  Widget _buildVerticalChatPanel({required Key key}) {
    final messages = _radioChatMessages.length > 80
        ? _radioChatMessages.skip(_radioChatMessages.length - 80).toList()
        : _radioChatMessages.toList();
    final textColor = AppColors.isDark ? Colors.white : Color(0xFF111827);
    final mutedColor = AppColors.isDark
        ? Colors.white.withValues(alpha: 0.52)
        : Color(0xFF111827).withValues(alpha: 0.52);

    return Column(
      key: key,
      children: [
        Expanded(
          child: messages.isEmpty
              ? Center(
                  child: Text(
                    'Say something to Migi...',
                    style: TextStyle(
                      color: mutedColor,
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                )
              : LayoutBuilder(
                  builder: (context, constraints) {
                    return SingleChildScrollView(
                      controller: _radioChatScrollController,
                      padding: EdgeInsets.fromLTRB(18, 18, 18, 12),
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          minHeight: math.max(0, constraints.maxHeight - 30),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.end,
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            for (final message in messages)
                              Align(
                                alignment: message['role']?.toString() == 'user'
                                    ? Alignment.centerRight
                                    : Alignment.centerLeft,
                                child: Container(
                                  constraints: BoxConstraints(maxWidth: 360),
                                  margin: EdgeInsets.only(bottom: 12),
                                  padding: EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 9,
                                  ),
                                  decoration: BoxDecoration(
                                    color: message['role']?.toString() == 'user'
                                        ? AppColors.primaryBtn
                                            .withValues(alpha: 0.22)
                                        : (AppColors.isDark
                                            ? Colors.black
                                                .withValues(alpha: 0.28)
                                            : Colors.white
                                                .withValues(alpha: 0.52)),
                                    borderRadius: BorderRadius.circular(9),
                                    border: Border.all(
                                      color: AppColors.isDark
                                          ? Colors.white.withValues(alpha: 0.08)
                                          : Color(0xFF111827)
                                              .withValues(alpha: 0.08),
                                    ),
                                  ),
                                  child: Text(
                                    message['content']?.toString() ?? '',
                                    style: TextStyle(
                                      color: textColor,
                                      fontSize: 14,
                                      height: 1.42,
                                      fontWeight: FontWeight.w700,
                                      fontFamily: 'LXGWWenKai',
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
        _buildVerticalChatInput(),
      ],
    );
  }

  Widget _buildVerticalChatInput() {
    return Container(
      margin: EdgeInsets.fromLTRB(12, 0, 12, 12),
      padding: EdgeInsets.fromLTRB(13, 2, 4, 2),
      decoration: BoxDecoration(
        color: AppColors.isDark
            ? Colors.black.withValues(alpha: 0.38)
            : Colors.white.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(7),
        border: Border.all(
          color: AppColors.isDark
              ? Colors.white.withValues(alpha: 0.10)
              : Color(0xFF111827).withValues(alpha: 0.10),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _radioChatController,
              minLines: 1,
              maxLines: 1,
              textInputAction: TextInputAction.send,
              inputFormatters: _radioChatInputFormatters,
              onSubmitted: _sendRadioChat,
              style: TextStyle(
                color: AppColors.primaryText,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                fontFamily: 'LXGWWenKai',
              ),
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

  Widget _verticalPlayerIcon(
    IconData icon,
    VoidCallback? onTap, {
    bool prominent = false,
    bool active = false,
  }) {
    final color = active
        ? AppColors.primaryBtn
        : (AppColors.isDark ? Colors.white : Color(0xFF111827));
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: SizedBox(
        width: prominent ? 34 : 28,
        height: 34,
        child: Icon(
          icon,
          color: onTap == null ? color.withValues(alpha: 0.26) : color,
          size: prominent ? 22 : 18,
        ),
      ),
    );
  }

  Widget _verticalModePill(String label, VoidCallback onTap,
      {bool active = false}) {
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: onTap,
      child: Container(
        height: 26,
        margin: EdgeInsets.only(left: 4),
        padding: EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active
              ? AppColors.primaryBtn.withValues(alpha: 0.18)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: active
                ? AppColors.primaryBtn.withValues(alpha: 0.46)
                : (AppColors.isDark
                    ? Colors.white.withValues(alpha: 0.12)
                    : Color(0xFF111827).withValues(alpha: 0.12)),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? AppColors.primaryBtn : AppColors.secondaryText,
            fontSize: 9,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.6,
          ),
        ),
      ),
    );
  }

  Map<String, dynamic>? _verticalCurrentTrack() {
    return _globalPlayerStore.currentTrack ??
        _playlistStore.currentTrack ??
        _tracks.firstOrNull;
  }

  String _verticalTrackTitle(Map<String, dynamic> track) {
    return track['title']?.toString() ??
        track['name']?.toString() ??
        track['mainTitle']?.toString() ??
        '未知歌曲';
  }

  String _verticalArtistName(Map<String, dynamic> track) {
    final direct = track['artist']?.toString();
    if (direct != null && direct.isNotEmpty) return direct;
    final artists = track['ar'] ?? track['artists'];
    if (artists is List && artists.isNotEmpty) {
      final names = artists
          .whereType<Map>()
          .map((item) => item['name']?.toString() ?? '')
          .where((name) => name.isNotEmpty)
          .toList();
      if (names.isNotEmpty) return names.join(' / ');
    }
    return '未知歌手';
  }

  String _verticalAlbumName(Map<String, dynamic> track) {
    final direct = track['albumName']?.toString();
    if (direct != null && direct.isNotEmpty) return direct;
    final album = track['album'];
    if (album is Map) {
      return album['name']?.toString() ?? album['title']?.toString() ?? '未知专辑';
    }
    final al = track['al'];
    if (al is Map) return al['name']?.toString() ?? '未知专辑';
    return '未知专辑';
  }

  Future<void> _toggleVerticalPlayback() async {
    final track = _verticalCurrentTrack();
    if (track == null) {
      await _runDailyRadioNow();
      return;
    }
    final currentMusic = _musicController.currentMusic;
    if (currentMusic == null) {
      final currentPlaylist = _playlistStore.currentPlaylist;
      if (currentPlaylist.isEmpty) {
        _musicController.suppressPlaylistAutoLoad();
        _playlistStore.setCurrentPlaylist([track], startIndex: 0);
      }
      _globalPlayerStore.setCurrentTrack(track);
      await _musicController.initMusicData(track);
      return;
    }
    await _musicController.togglePlayPause();
  }

  Widget _buildThemeSegment() {
    return GetBuilder<ThemeStore>(
      builder: (themeStore) {
        return Container(
          height: 30,
          padding: EdgeInsets.zero,
          decoration: BoxDecoration(
            color: AppColors.isDark
                ? Color(0xFF090B10).withValues(alpha: 0.88)
                : Colors.white.withValues(alpha: 0.82),
            borderRadius: BorderRadius.circular(3),
            border: Border.all(
              color: AppColors.isDark
                  ? Colors.white.withValues(alpha: 0.08)
                  : Color(0xFF111827).withValues(alpha: 0.10),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildThemeChoice(
                label: 'DARK',
                active: themeStore.darkMode,
                darkChoice: true,
                onTap: () => themeStore.setDarkMode(true),
              ),
              _buildThemeChoice(
                label: 'LIGHT',
                active: !themeStore.darkMode,
                darkChoice: false,
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
    required bool darkChoice,
    required VoidCallback onTap,
  }) {
    return InkWell(
      borderRadius: BorderRadius.circular(2),
      onTap: onTap,
      child: Container(
        height: 30,
        width: 46,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: active
              ? (AppColors.isDark ? Colors.white : Color(0xFF111111))
              : Colors.transparent,
          borderRadius: BorderRadius.circular(2),
          border: active
              ? Border(
                  right: darkChoice
                      ? BorderSide(
                          color: AppColors.isDark
                              ? Colors.white.withValues(alpha: 0.22)
                              : Color(0xFF111827).withValues(alpha: 0.22),
                        )
                      : BorderSide.none,
                  left: !darkChoice
                      ? BorderSide(
                          color: AppColors.isDark
                              ? Colors.white.withValues(alpha: 0.22)
                              : Color(0xFF111827).withValues(alpha: 0.22),
                        )
                      : BorderSide.none,
                )
              : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active
                ? (AppColors.isDark ? Color(0xFF111111) : Colors.white)
                : AppColors.secondaryText,
            fontSize: 10,
            fontWeight: FontWeight.w900,
            letterSpacing: 0.15,
          ),
        ),
      ),
    );
  }
}

class _ClockPanelBackground extends _PanelCutoutBackground {
  _ClockPanelBackground({
    required super.child,
    required super.isDark,
  });
}

class _PanelCutoutBackground extends StatelessWidget {
  _PanelCutoutBackground({
    required this.child,
    required this.isDark,
  });

  final Widget child;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _ClockPanelBackgroundPainter(isDark: isDark),
      child: child,
    );
  }
}

class _ClockPanelBackgroundPainter extends CustomPainter {
  _ClockPanelBackgroundPainter({required this.isDark});

  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final baseColor = isDark ? Color(0xFF06070A) : Color(0xFFF7F3F2);
    canvas.drawRect(
      rect,
      Paint()..color = baseColor.withValues(alpha: 0.96),
    );

    final dotPaint = Paint()..style = PaintingStyle.fill;
    const spacing = 14.0;
    const radius = 1.05;
    final dotColor = isDark ? Colors.white : Color(0xFF111827);
    final alpha = isDark ? 0.11 : 0.07;
    for (var y = spacing / 2; y < size.height; y += spacing) {
      for (var x = spacing / 2; x < size.width; x += spacing) {
        dotPaint.color = dotColor.withValues(alpha: alpha);
        canvas.drawCircle(Offset(x, y), radius, dotPaint);
      }
    }

    final edgePaint = Paint()
      ..color =
          (isDark ? Colors.white : Color(0xFF111827)).withValues(alpha: 0.035)
      ..strokeWidth = 1;
    canvas.drawLine(Offset(0, 0), Offset(size.width, 0), edgePaint);
    canvas.drawLine(
      Offset(0, size.height),
      Offset(size.width, size.height),
      edgePaint,
    );
  }

  @override
  bool shouldRepaint(covariant _ClockPanelBackgroundPainter oldDelegate) {
    return oldDelegate.isDark != isDark;
  }
}

class _DotMatrixWord extends StatelessWidget {
  _DotMatrixWord({
    required this.text,
    required this.color,
    required this.dotRadius,
    required this.pitch,
    required this.letterSpacing,
  });

  final String text;
  final Color color;
  final double dotRadius;
  final double pitch;
  final double letterSpacing;

  static const Map<String, List<String>> _glyphs = {
    '0': [
      '01110',
      '10001',
      '10011',
      '10101',
      '11001',
      '10001',
      '01110',
    ],
    '1': [
      '00100',
      '01100',
      '00100',
      '00100',
      '00100',
      '00100',
      '01110',
    ],
    '2': [
      '01110',
      '10001',
      '00001',
      '00010',
      '00100',
      '01000',
      '11111',
    ],
    '3': [
      '11110',
      '00001',
      '00001',
      '01110',
      '00001',
      '00001',
      '11110',
    ],
    '4': [
      '00010',
      '00110',
      '01010',
      '10010',
      '11111',
      '00010',
      '00010',
    ],
    '5': [
      '11111',
      '10000',
      '10000',
      '11110',
      '00001',
      '00001',
      '11110',
    ],
    '6': [
      '01110',
      '10000',
      '10000',
      '11110',
      '10001',
      '10001',
      '01110',
    ],
    '7': [
      '11111',
      '00001',
      '00010',
      '00100',
      '01000',
      '01000',
      '01000',
    ],
    '8': [
      '01110',
      '10001',
      '10001',
      '01110',
      '10001',
      '10001',
      '01110',
    ],
    '9': [
      '01110',
      '10001',
      '10001',
      '01111',
      '00001',
      '00001',
      '01110',
    ],
    ' ': [
      '00000',
      '00000',
      '00000',
      '00000',
      '00000',
      '00000',
      '00000',
    ],
    ':': [
      '00000',
      '00000',
      '00100',
      '00000',
      '00100',
      '00000',
      '00000',
    ],
    'm': [
      '10001',
      '11011',
      '10101',
      '10101',
      '10101',
      '10101',
      '10101',
    ],
    'i': [
      '00100',
      '00000',
      '01100',
      '00100',
      '00100',
      '00100',
      '01110',
    ],
    'g': [
      '01110',
      '10001',
      '10000',
      '10111',
      '10001',
      '01111',
      '00001',
    ],
  };

  @override
  Widget build(BuildContext context) {
    const columns = 5;
    const rows = 7;
    final gapCount = math.max(0, text.length - 1).toDouble();
    final width = text.length * columns * pitch + gapCount * letterSpacing;
    final height = rows * pitch;
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: _DotMatrixWordPainter(
          text: text.toLowerCase(),
          color: color,
          dotRadius: dotRadius,
          pitch: pitch,
          letterSpacing: letterSpacing,
        ),
      ),
    );
  }
}

class _DotMatrixWordPainter extends CustomPainter {
  _DotMatrixWordPainter({
    required this.text,
    required this.color,
    required this.dotRadius,
    required this.pitch,
    required this.letterSpacing,
  });

  final String text;
  final Color color;
  final double dotRadius;
  final double pitch;
  final double letterSpacing;

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.fill
      ..color = color.withValues(alpha: 0.92);
    var offsetX = 0.0;
    for (final char in text.split('')) {
      final glyph = _DotMatrixWord._glyphs[char];
      if (glyph == null) {
        offsetX += 5 * pitch + letterSpacing;
        continue;
      }
      for (var row = 0; row < glyph.length; row++) {
        final line = glyph[row];
        for (var col = 0; col < line.length; col++) {
          if (line.codeUnitAt(col) != 49) continue;
          canvas.drawCircle(
            Offset(offsetX + col * pitch + pitch / 2, row * pitch + pitch / 2),
            dotRadius,
            paint,
          );
        }
      }
      offsetX += 5 * pitch + letterSpacing;
    }
  }

  @override
  bool shouldRepaint(covariant _DotMatrixWordPainter oldDelegate) {
    return oldDelegate.text != text ||
        oldDelegate.color != color ||
        oldDelegate.dotRadius != dotRadius ||
        oldDelegate.pitch != pitch ||
        oldDelegate.letterSpacing != letterSpacing;
  }
}
