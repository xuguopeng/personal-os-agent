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
