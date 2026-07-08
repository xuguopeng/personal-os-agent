part of '../desktop_music_home.dart';

class _StarFieldBackground extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return CustomPaint(
      painter: _StarFieldPainter(isDark: AppColors.isDark),
      child: SizedBox.expand(),
    );
  }
}

class _StarFieldPainter extends CustomPainter {
  _StarFieldPainter({required this.isDark});

  final bool isDark;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final background = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: isDark
            ? [
                Color(0xFF05070A),
                Color(0xFF0A1016),
                Color(0xFF06080B),
              ]
            : [
                Color(0xFFF8FAFC),
                Color(0xFFF2F5F9),
                Color(0xFFFFFFFF),
              ],
      ).createShader(rect);
    canvas.drawRect(rect, background);

    final starPaint = Paint();
    final count = isDark ? 180 : 90;
    for (var i = 0; i < count; i++) {
      final x = ((i * 97) % math.max(size.width, 1)).toDouble();
      final y = ((i * 53) % math.max(size.height, 1)).toDouble();
      final pulse = ((i * 37) % 100) / 100;
      final radius = 0.45 + pulse * 0.85;
      final alpha = isDark ? 0.16 + pulse * 0.34 : 0.08 + pulse * 0.12;
      starPaint.color = (isDark ? Colors.white : AppColors.primaryBtn)
          .withValues(alpha: alpha);
      canvas.drawCircle(Offset(x, y), radius, starPaint);
    }

    if (isDark) {
      final glowPaint = Paint()
        ..shader = RadialGradient(
          colors: [
            AppColors.primaryBtn.withValues(alpha: 0.16),
            Colors.transparent,
          ],
        ).createShader(
          Rect.fromCircle(
            center: Offset(size.width * 0.55, size.height * 0.45),
            radius: size.width * 0.38,
          ),
        );
      canvas.drawRect(rect, glowPaint);
    }
  }

  @override
  bool shouldRepaint(covariant _StarFieldPainter oldDelegate) {
    return oldDelegate.isDark != isDark;
  }
}

class _ClaudioParticleField extends StatefulWidget {
  _ClaudioParticleField({
    required this.child,
    this.focusMode = false,
    this.lyricPulse = false,
  });

  final Widget child;
  final bool focusMode;
  final bool lyricPulse;

  @override
  State<_ClaudioParticleField> createState() => _ClaudioParticleFieldState();
}

class _ClaudioParticleFieldState extends State<_ClaudioParticleField>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: Duration(seconds: 18),
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
        return CustomPaint(
          painter: _ClaudioParticlePainter(
            progress: _controller.value,
            isDark: AppColors.isDark,
            focusMode: widget.focusMode,
            lyricPulse: widget.lyricPulse,
          ),
          child: widget.child,
        );
      },
    );
  }
}

class _ClaudioParticlePainter extends CustomPainter {
  _ClaudioParticlePainter({
    required this.progress,
    required this.isDark,
    required this.focusMode,
    required this.lyricPulse,
  });

  final double progress;
  final bool isDark;
  final bool focusMode;
  final bool lyricPulse;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawRect(
      rect,
      Paint()
        ..shader = RadialGradient(
          center: Alignment(0.1, -0.05),
          radius: 1.2,
          colors: isDark
              ? [
                  Color(0xFF111019),
                  Color(0xFF06070A),
                  Color(0xFF030406),
                ]
              : [
                  Color(0xFFF7F3F2),
                  Color(0xFFEFF3F6),
                  Color(0xFFFDFDFD),
                ],
        ).createShader(rect),
    );

    _paintDotMatrix(canvas, size);
    _paintSoftTintAndInnerShadow(canvas, size);
  }

  void _paintDotMatrix(Canvas canvas, Size size) {
    final dotPaint = Paint()..style = PaintingStyle.fill;
    const spacing = 18.0;
    const radius = 1.25;
    final color = isDark ? Colors.white : Color(0xFF111827);
    final alpha = isDark ? 0.105 : 0.075;

    for (var y = spacing / 2; y < size.height; y += spacing) {
      for (var x = spacing / 2; x < size.width; x += spacing) {
        dotPaint.color = color.withValues(alpha: alpha);
        canvas.drawCircle(Offset(x, y), radius, dotPaint);
      }
    }
  }

  void _paintSoftTintAndInnerShadow(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final tintColor = isDark ? Colors.white : Colors.black;
    canvas.drawRect(
      rect,
      Paint()..color = tintColor.withValues(alpha: 0.15),
    );

    final shadowColor = Color(0xFF7B5CFF);
    const shadowSize = 44.0;
    final topRect = Rect.fromLTWH(0, 0, size.width, shadowSize);
    final bottomRect =
        Rect.fromLTWH(0, size.height - shadowSize, size.width, shadowSize);
    final leftRect = Rect.fromLTWH(0, 0, shadowSize, size.height);
    final rightRect =
        Rect.fromLTWH(size.width - shadowSize, 0, shadowSize, size.height);

    canvas.drawRect(
      topRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            shadowColor.withValues(alpha: isDark ? 0.24 : 0.13),
            Colors.transparent,
          ],
        ).createShader(topRect),
    );
    canvas.drawRect(
      bottomRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            shadowColor.withValues(alpha: isDark ? 0.20 : 0.11),
            Colors.transparent,
          ],
        ).createShader(bottomRect),
    );
    canvas.drawRect(
      leftRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [
            shadowColor.withValues(alpha: isDark ? 0.22 : 0.12),
            Colors.transparent,
          ],
        ).createShader(leftRect),
    );
    canvas.drawRect(
      rightRect,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.centerRight,
          end: Alignment.centerLeft,
          colors: [
            shadowColor.withValues(alpha: isDark ? 0.22 : 0.12),
            Colors.transparent,
          ],
        ).createShader(rightRect),
    );
  }

  @override
  bool shouldRepaint(covariant _ClaudioParticlePainter oldDelegate) {
    return oldDelegate.progress != progress ||
        oldDelegate.isDark != isDark ||
        oldDelegate.focusMode != focusMode ||
        oldDelegate.lyricPulse != lyricPulse;
  }
}
