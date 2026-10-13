package com.magalarza.pokerblitz

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Base64
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebResourceError
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.view.WindowManager
import java.io.ByteArrayInputStream
import java.io.FileNotFoundException

/**
 * La interfaz y las reglas se ejecutan desde index.html empaquetado.
 * El dominio HTTPS es virtual: se atiende EXCLUSIVAMENTE desde assets/.
 */
class MainActivity : Activity() {
    companion object {
        private const val APP_HOST = "appassets.androidplatform.net"
        private const val APP_URL = "https://appassets.androidplatform.net/index.html"
        private const val REQUEST_IMPORT = 4201
        private const val REQUEST_EXPORT = 4202
        private val VERSIONED_HTML = Regex("""app-v\\d+\\.\\d+\\.\\d+\\.html""")
    }

    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingExport: ExportFile? = null

    private data class ExportFile(val filename: String, val mime: String, val base64: String)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.setFlags(
            WindowManager.LayoutParams.FLAG_FULLSCREEN,
            WindowManager.LayoutParams.FLAG_FULLSCREEN
        )

        webView = WebView(this)
        setContentView(webView)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true // Los decks y las partidas se guardan en el teléfono.
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true // Permite importar JSON e imágenes elegidas por el usuario.
            useWideViewPort = true
            loadWithOverviewMode = true
            builtInZoomControls = true
            displayZoomControls = false
            javaScriptCanOpenWindowsAutomatically = false
            setSupportMultipleWindows(false)
            mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        webView.addJavascriptInterface(AndroidBridge(), "AndroidBridge")

        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                Log.e("PokerBlitzBoot", "Load error ${request?.url}: ${error?.description}")
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                Log.i("PokerBlitzBoot", "Page finished: $url")
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                return !(uri.scheme == "https" && uri.host == APP_HOST)
            }

            override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse {
                val uri = request?.url ?: return errorResponse(400, "Bad Request")
                // Sin llamadas externas, sin CDN y sin permisos de Internet.
                if (uri.scheme != "https" || uri.host != APP_HOST) {
                    return errorResponse(403, "Forbidden")
                }
                val path = Uri.decode(uri.encodedPath.orEmpty()).trimStart('/')
                    .ifEmpty { "index.html" }
                if (path.contains("..") || path.contains('\\') ||
                    !(path == "index.html" || path == "pokerblitz-android.js" ||
                        VERSIONED_HTML.matches(path) ||
                        path.startsWith("assets/") || path.startsWith("presets/") ||
                        path.startsWith("vendor/"))) {
                    return errorResponse(403, "Forbidden")
                }
                return try {
                    WebResourceResponse(mimeType(path), "UTF-8", assets.open(path))
                } catch (_: FileNotFoundException) {
                    Log.e("PokerBlitzBoot", "Missing bundled asset: $path")
                    errorResponse(404, "Not Found")
                }
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                Log.d("PokerBlitzBoot", "JS: ${msg.message()} at ${msg.sourceId()}:${msg.lineNumber()}")
                return true
            }

            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                if (filePathCallback == null) return false
                fileCallback?.onReceiveValue(null)
                fileCallback = filePathCallback
                val wantsJson = fileChooserParams?.acceptTypes?.any {
                    it.contains("json", ignoreCase = true)
                } == true
                val picker = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = if (wantsJson) "*/*" else "image/*"
                    if (wantsJson) putExtra(
                        Intent.EXTRA_MIME_TYPES,
                        arrayOf("application/json", "text/plain", "application/octet-stream")
                    )
                }
                return try {
                    startActivityForResult(picker, REQUEST_IMPORT)
                    true
                } catch (_: Exception) {
                    fileCallback = null
                    filePathCallback.onReceiveValue(null)
                    false
                }
            }
        }

        webView.loadUrl(APP_URL)
    }

    private fun mimeType(path: String): String = when (path.substringAfterLast('.').lowercase()) {
        "html" -> "text/html"
        "js" -> "text/javascript"
        "css" -> "text/css"
        "json" -> "application/json"
        "svg" -> "image/svg+xml"
        "webp" -> "image/webp"
        "jpg", "jpeg" -> "image/jpeg"
        "png" -> "image/png"
        "gif" -> "image/gif"
        else -> "application/octet-stream"
    }

    private fun errorResponse(status: Int, reason: String) =
        WebResourceResponse(
            "text/plain",
            "UTF-8",
            status,
            reason,
            emptyMap(),
            ByteArrayInputStream(ByteArray(0))
        )

    inner class AndroidBridge {
        @JavascriptInterface
        fun reportReady(screen: String) {
            Log.i("PokerBlitzBoot", "POKER_BLITZ_READY:$screen")
        }

        @JavascriptInterface
        fun reportError(message: String) {
            Log.e("PokerBlitzBoot", "POKER_BLITZ_ERROR:${message.take(1200)}")
        }

        @JavascriptInterface
        fun saveFile(filename: String, mimeType: String, base64: String) {
            // Solo la página empaquetada puede navegar en este WebView.
            if (base64.length > 80_000_000) {
                showToast("El archivo es demasiado grande")
                return
            }
            runOnUiThread {
                if (pendingExport != null) {
                    showToast("Termina de guardar el archivo anterior")
                    return@runOnUiThread
                }
                val safeName = filename.substringAfterLast('/').substringAfterLast('\\')
                    .take(160).ifBlank { "poker_blitz.dat" }
                val safeMime = when (mimeType) {
                    "application/pdf", "application/json" -> mimeType
                    else -> "application/octet-stream"
                }
                pendingExport = ExportFile(safeName, safeMime, base64)
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = safeMime
                    putExtra(Intent.EXTRA_TITLE, safeName)
                }
                try {
                    startActivityForResult(intent, REQUEST_EXPORT)
                } catch (ex: Exception) {
                    pendingExport = null
                    showToast("No se pudo abrir el selector de archivos")
                }
            }
        }
    }

    private fun showToast(text: String) {
        runOnUiThread { Toast.makeText(this, text, Toast.LENGTH_LONG).show() }
    }

    @Deprecated("Used to support Android native document picker without a third-party dependency")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_IMPORT) {
            val callback = fileCallback
            fileCallback = null
            val result = if (resultCode == RESULT_OK) {
                WebChromeClient.FileChooserParams.parseResult(resultCode, data)
            } else null
            callback?.onReceiveValue(result)
            return
        }
        if (requestCode == REQUEST_EXPORT) {
            val export = pendingExport
            pendingExport = null
            if (resultCode != RESULT_OK || data?.data == null || export == null) return
            val uri = data.data ?: return
            Thread {
                try {
                    val bytes = Base64.decode(export.base64, Base64.DEFAULT)
                    val stream = contentResolver.openOutputStream(uri, "w")
                        ?: throw IllegalStateException("No se pudo abrir el destino")
                    stream.use { it.write(bytes) }
                    showToast("Archivo guardado: ${export.filename}")
                } catch (ex: Exception) {
                    showToast("Error al guardar: ${ex.localizedMessage}")
                }
            }.start()
        }
    }

    @Deprecated("WebView back navigation compatibility")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        webView.removeJavascriptInterface("AndroidBridge")
        webView.destroy()
        super.onDestroy()
    }
}
