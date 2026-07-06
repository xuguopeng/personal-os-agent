part of '../desktop_music_home.dart';

class _PlainIcon extends StatelessWidget {
  _PlainIcon({
    required this.icon,
    this.active = false,
    this.size = 20,
  });

  final IconData icon;
  final bool active;
  final double size;

  @override
  Widget build(BuildContext context) {
    final color = active ? AppColors.primaryBtn : AppColors.secondaryText;
    return Icon(
      icon,
      size: size,
      color: color,
    );
  }
}

class _RadioEpisodeItem extends StatelessWidget {
  _RadioEpisodeItem({
    required this.episode,
    required this.onTap,
  });

  final Map<String, dynamic> episode;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final title = episode['title']?.toString() ?? '未命名电台';
    final summary = episode['summary']?.toString() ?? '';
    final generator = episode['generator']?.toString() ?? 'mock';
    final duration = _formatDuration(episode['durationSeconds']);
    final segments = episode['segments'];
    final trackCount = segments is List
        ? segments.where((item) {
            return item is Map && item['type']?.toString() == 'track';
          }).length
        : 0;
    final sourceTrackIds = episode['sourceTrackIds'];
    final fallbackTrackCount =
        sourceTrackIds is List ? sourceTrackIds.length : 0;
    final displayTrackCount = trackCount > 0 ? trackCount : fallbackTrackCount;
    final segmentText = displayTrackCount > 0 ? ' · $displayTrackCount 首歌' : '';
    final generatorText = generator == 'minimax'
        ? (trackCount > 0 ? 'MiniMax 开场/收尾' : 'MiniMax 串词')
        : '测试音频';
    return Padding(
      padding: EdgeInsets.only(bottom: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Container(
          constraints: BoxConstraints(minHeight: 84),
          padding: EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: AppColors.navigationBg.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppColors.borderColor),
          ),
          child: Row(
            children: [
              _PlainIcon(
                icon: Icons.radio,
                active: true,
                size: 48,
              ),
              SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.primaryText,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 5),
                    Text(
                      summary.isEmpty ? 'NAS 生成的私人音乐电台' : summary,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 12,
                        height: 1.3,
                      ),
                    ),
                    SizedBox(height: 6),
                    Text(
                      '$generatorText$segmentText · $duration',
                      style: TextStyle(
                        color: AppColors.secondaryText,
                        fontSize: 11,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: 12),
              Icon(
                Icons.play_arrow,
                color: AppColors.primaryBtn,
                size: 22,
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDuration(dynamic seconds) {
    final value =
        seconds is int ? seconds : int.tryParse(seconds?.toString() ?? '') ?? 0;
    if (value <= 0) return '--:--';
    final minutes = (value ~/ 60).toString().padLeft(2, '0');
    final rest = (value % 60).toString().padLeft(2, '0');
    return '$minutes:$rest';
  }
}
