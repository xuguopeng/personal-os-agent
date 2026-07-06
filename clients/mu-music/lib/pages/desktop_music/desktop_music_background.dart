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
  _ClaudioParticleField({required this.child});

  final Widget child;

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
  });

  final double progress;
  final bool isDark;

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

    final center = Offset(size.width * 0.46, size.height * 0.44);
    final particlePaint = Paint()..style = PaintingStyle.fill;
    final glowPaint = Paint()
      ..shader = RadialGradient(
        colors: [
          AppColors.primaryBtn.withValues(alpha: isDark ? 0.16 : 0.10),
          Color(0xFF6D5DFF).withValues(alpha: isDark ? 0.18 : 0.08),
          Colors.transparent,
        ],
      ).createShader(
          Rect.fromCircle(center: center, radius: size.width * 0.34));
    canvas.drawRect(rect, glowPaint);

    final count = isDark ? 1250 : 760;
    for (var i = 0; i < count; i++) {
      final seedA = _noise(i * 17.13);
      final seedB = _noise(i * 41.79);
      final seedC = _noise(i * 9.37);
      final angle =
          seedA * math.pi * 2 + progress * math.pi * (0.24 + seedC * 0.22);
      final radiusBase = math.pow(seedB, 0.58).toDouble();
      final wave = math.sin(progress * math.pi * 2 + i * 0.023) * 0.08;
      final ovalX = size.width * (0.13 + radiusBase * (0.31 + wave));
      final ovalY = size.height * (0.10 + radiusBase * (0.25 - wave * 0.3));
      final swirl = Offset(
        math.cos(angle) * ovalX + math.sin(angle * 1.9) * 18,
        math.sin(angle) * ovalY + math.cos(angle * 1.4) * 16,
      );
      final drift = Offset(
        math.sin(progress * math.pi * 2 + i) * 18 * seedC,
        math.cos(progress * math.pi * 2 + i * 0.7) * 12 * seedA,
      );
      final p = center + swirl + drift;
      if (!rect.inflate(20).contains(p)) continue;
      final alpha = isDark ? 0.10 + seedC * 0.42 : 0.05 + seedC * 0.18;
      final warm = seedA > 0.72;
      particlePaint.color =
          (warm ? AppColors.primaryBtn : Colors.white).withValues(alpha: alpha);
      canvas.drawCircle(p, 0.35 + seedC * 1.15, particlePaint);
    }
  }

  double _noise(double value) {
    final x = math.sin(value) * 43758.5453123;
    return x - x.floorToDouble();
  }

  @override
  bool shouldRepaint(covariant _ClaudioParticlePainter oldDelegate) {
    return oldDelegate.progress != progress || oldDelegate.isDark != isDark;
  }
}
