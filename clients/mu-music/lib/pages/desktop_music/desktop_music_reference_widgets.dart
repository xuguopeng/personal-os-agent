part of '../desktop_music_home.dart';

class _ReferenceNavItem extends StatelessWidget {
  _ReferenceNavItem({
    required this.active,
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final bool active;
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: 18),
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: onTap,
        child: Row(
          children: [
            Icon(
              icon,
              color: active ? AppColors.primaryBtn : AppColors.primaryText,
              size: 24,
            ),
            SizedBox(width: 18),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: active ? AppColors.primaryBtn : AppColors.primaryText,
                  fontSize: 15,
                  fontWeight: active ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReferenceToolbarAction extends StatelessWidget {
  _ReferenceToolbarAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String? label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(horizontal: 6, vertical: 6),
        child: Row(
          children: [
            Icon(icon, color: AppColors.primaryText, size: 20),
            if (label != null) ...[
              SizedBox(width: 8),
              Text(
                label!,
                style: TextStyle(
                  color: AppColors.primaryText,
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ReferenceTab extends StatelessWidget {
  _ReferenceTab({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Container(
        width: 86,
        height: 44,
        alignment: Alignment.centerLeft,
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: active ? AppColors.primaryBtn : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? AppColors.primaryBtn : AppColors.primaryText,
            fontSize: 17,
            fontWeight: active ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ),
    );
  }
}

class _ReferencePrimaryButton extends StatelessWidget {
  _ReferencePrimaryButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ElevatedButton.icon(
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primaryBtn,
        disabledBackgroundColor: AppColors.primaryBtn.withValues(alpha: 0.38),
        foregroundColor: Colors.white,
        elevation: 0,
        minimumSize: Size(0, 40),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: EdgeInsets.symmetric(horizontal: 17),
      ),
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(
        label,
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _ReferenceGhostButton extends StatelessWidget {
  _ReferenceGhostButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(
      style: OutlinedButton.styleFrom(
        foregroundColor:
            onTap == null ? AppColors.secondaryText : AppColors.primaryText,
        disabledForegroundColor: AppColors.secondaryText,
        side: BorderSide(color: AppColors.borderColor),
        minimumSize: Size(0, 40),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: EdgeInsets.symmetric(horizontal: 14),
      ),
      onPressed: onTap,
      icon: Icon(icon, size: 18),
      label: Text(
        label,
        style: TextStyle(fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _ReferenceIconButton extends StatelessWidget {
  _ReferenceIconButton({
    required this.icon,
    required this.onTap,
  });

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: AppColors.borderColor),
        ),
        child: Icon(icon, color: AppColors.primaryText, size: 22),
      ),
    );
  }
}

class _ReferencePanel extends StatelessWidget {
  _ReferencePanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.navigationBg
            .withValues(alpha: AppColors.isDark ? 0.54 : 0.86),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.borderColor),
        boxShadow: [
          BoxShadow(
            color:
                Colors.black.withValues(alpha: AppColors.isDark ? 0.22 : 0.05),
            blurRadius: 18,
            offset: Offset(0, 10),
          ),
        ],
      ),
      child: child,
    );
  }
}

class _RadioWaveform extends StatefulWidget {
  _RadioWaveform({
    required this.active,
    this.color,
    this.inactiveColor,
    this.barCount = 46,
  });

  final bool active;
  final Color? color;
  final Color? inactiveColor;
  final int barCount;

  @override
  State<_RadioWaveform> createState() => _RadioWaveformState();
}

class _RadioWaveformState extends State<_RadioWaveform>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(milliseconds: 1400),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return SizedBox(
          height: 72,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: List.generate(widget.barCount, (index) {
              final wave =
                  math.sin(index * 0.58 + _controller.value * math.pi * 2);
              final alt =
                  math.sin(index * 0.23 + _controller.value * math.pi * 3);
              final height = (widget.active
                      ? 10 + (wave.abs() * 34) + (alt.abs() * 18)
                      : 8 + (index % 5) * 4)
                  .toDouble();
              final opacity = widget.active ? 0.82 : 0.34;
              return Expanded(
                child: Align(
                  alignment: Alignment.center,
                  child: Container(
                    margin: EdgeInsets.symmetric(horizontal: 2),
                    height: height,
                    decoration: BoxDecoration(
                      color: (widget.active
                              ? widget.color ?? AppColors.primaryBtn
                              : widget.inactiveColor ??
                                  (widget.color ?? AppColors.primaryBtn))
                          .withValues(alpha: opacity),
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: widget.active
                          ? [
                              BoxShadow(
                                color: (widget.color ?? AppColors.primaryBtn)
                                    .withValues(alpha: 0.32),
                                blurRadius: 10,
                              ),
                            ]
                          : [],
                    ),
                  ),
                ),
              );
            }),
          ),
        );
      },
    );
  }
}

class _RightRailTrack extends StatelessWidget {
  _RightRailTrack({
    required this.track,
    required this.artistName,
    required this.coverUrl,
    required this.duration,
    required this.onTap,
  });

  final Map<String, dynamic> track;
  final String artistName;
  final String coverUrl;
  final String duration;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(8),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.only(bottom: 13),
        child: Row(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: NetImage(
                coverUrl,
                width: 44,
                height: 44,
                fit: BoxFit.cover,
              ),
            ),
            SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    track['name']?.toString() ?? '未知歌曲',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: AppColors.primaryText,
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    artistName,
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
            SizedBox(width: 8),
            Text(
              duration,
              style: TextStyle(
                color: AppColors.secondaryText,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
