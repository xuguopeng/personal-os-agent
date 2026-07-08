/*
 * @Author: 新西兰的肉夹馍
 * @Date: 2025-09-12 07:42:28
 * @LastEditTime: 2025-09-23 13:37:58
 * @FilePath: /mu-music/lib/common/values/constants.dart
 * @Description: 常量
 * 在这个虚拟的空间里，我试图捕捉真实的自我，与世界分享。
 */
/// 常量
class Constants {
  // 服务 api
  static const localApiUrl = 'http://192.168.10.21:8088/v1/music';
  static const loopbackApiUrl = 'http://127.0.0.1:8088/v1/music';
  static const customLocalApiUrl =
      String.fromEnvironment('NAS_LOCAL_API_URL', defaultValue: '');
  static const publicApiUrl = String.fromEnvironment(
    'NAS_PUBLIC_API_URL',
    defaultValue: 'https://os.xuguopeng.com/v1/music',
  );
  static const apiUrl = localApiUrl;
  static const localRootApiUrl = 'http://192.168.10.21:8088/v1';
  static const loopbackRootApiUrl = 'http://127.0.0.1:8088/v1';
  static const customLocalRootApiUrl =
      String.fromEnvironment('NAS_LOCAL_ROOT_API_URL', defaultValue: '');
  static const publicRootApiUrl = String.fromEnvironment(
    'NAS_PUBLIC_ROOT_API_URL',
    defaultValue: 'https://os.xuguopeng.com/v1',
  );
  static const apiUrls = [
    customLocalApiUrl,
    localApiUrl,
    publicApiUrl,
  ];
  static const rootApiUrls = [
    customLocalRootApiUrl,
    localRootApiUrl,
    publicRootApiUrl,
  ];
  static const agentUsername =
      String.fromEnvironment('AGENT_SERVER_USERNAME', defaultValue: '');
  static const agentPassword =
      String.fromEnvironment('AGENT_SERVER_PASSWORD', defaultValue: '');
  static const musicApiPath = '/api';
  static const staticPath = '/static';
}
