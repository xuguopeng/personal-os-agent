import 'dart:io';

import 'package:flutter/services.dart';
import 'package:mu_music/common/values/constants.dart';

class ClientConfig {
  static final Map<String, String> _values = <String, String>{};
  static bool _loaded = false;

  static Future<void> load() async {
    if (_loaded) return;
    _loaded = true;

    for (final file in _candidateFiles()) {
      if (!file.existsSync()) continue;
      _values.addAll(_parseEnv(file.readAsStringSync()));
      return;
    }

    final bundled = await _loadBundledEnv();
    if (bundled.trim().isNotEmpty) {
      _values.addAll(_parseEnv(bundled));
    }
  }

  static String get agentUsername =>
      _value('AGENT_SERVER_USERNAME', Constants.agentUsername);

  static String get agentPassword =>
      _value('AGENT_SERVER_PASSWORD', Constants.agentPassword);

  static String _value(String key, String fallback) {
    final value = _values[key]?.trim() ?? '';
    return value.isNotEmpty ? value : fallback;
  }

  static List<File> _candidateFiles() {
    final paths = <String>[];
    final explicitPath = Platform.environment['MU_MUSIC_CLIENT_CONFIG'] ?? '';
    if (explicitPath.trim().isNotEmpty) {
      paths.add(explicitPath.trim());
    }

    final current = Directory.current.path;
    paths.add('$current/private/client_config.env');
    paths.add('$current/clients/mu-music/private/client_config.env');

    final executableDir = File(Platform.resolvedExecutable).parent.path;
    paths.add('$executableDir/private/client_config.env');
    paths.add('$executableDir/../Resources/private/client_config.env');

    final home = Platform.environment['HOME'] ?? '';
    if (home.isNotEmpty) {
      paths.add('$home/.mu_music/client_config.env');
    }

    return paths.map(File.new).toList();
  }

  static Map<String, String> _parseEnv(String content) {
    final result = <String, String>{};
    for (final rawLine in content.split('\n')) {
      final line = rawLine.trim();
      if (line.isEmpty || line.startsWith('#') || !line.contains('=')) {
        continue;
      }
      final index = line.indexOf('=');
      final key = line.substring(0, index).trim();
      var value = line.substring(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.substring(1, value.length - 1);
      }
      if (key.isNotEmpty) {
        result[key] = value;
      }
    }
    return result;
  }

  static Future<String> _loadBundledEnv() async {
    try {
      return await rootBundle.loadString('private/client_config.env');
    } catch (_) {
      return '';
    }
  }
}
