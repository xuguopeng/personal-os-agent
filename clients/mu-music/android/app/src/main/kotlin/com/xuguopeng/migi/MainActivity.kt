package com.xuguopeng.migi

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.webkit.CookieManager
import android.os.Build

class MainActivity: FlutterActivity() {
    private val CHANNEL = "cookie_channel"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "getCookies" -> {
                    val url = call.argument<String>("url")
                    if (url.isNullOrEmpty()) {
                        result.error("INVALID_ARGUMENT", "url is required", null)
                        return@setMethodCallHandler
                    }

                    try {
                        val cookieManager = CookieManager.getInstance()
                        // Enable accepting cookies to ensure access (usually already true if WebView used)
                        cookieManager.setAcceptCookie(true)

                        val cookieString = cookieManager.getCookie(url) ?: ""
                        val map = HashMap<String, String>()
                        if (cookieString.isNotEmpty()) {
                            val pairs = cookieString.split(";")
                            for (pair in pairs) {
                                val idx = pair.indexOf('=')
                                if (idx > 0) {
                                    val name = pair.substring(0, idx).trim()
                                    val value = pair.substring(idx + 1).trim()
                                    map[name] = value
                                }
                            }
                        }
                        result.success(map)
                    } catch (e: Exception) {
                        result.error("COOKIE_ERROR", e.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
