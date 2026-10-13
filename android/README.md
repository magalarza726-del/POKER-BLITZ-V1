# POKER BLITZ V1 — APK Android sin conexión

Esta carpeta es un proyecto Android Studio (Kotlin + Android WebView), **no una reescritura del juego**.

## Cómo genera la app
- Lee el `index.html` de la raíz y selecciona automáticamente la versión principal: `app-v1.19.4.html` al momento de crear esta integración.
- Copia la aplicación web y todos sus `presets/` y `assets/` al APK.
- Descarga **durante la compilación** las versiones fijas de jsPDF 2.5.2 y html2canvas 1.4.1. Las empaqueta en `vendor/` y sustituye sus URL CDN por rutas internas.
- La aplicación final **no tiene permiso INTERNET**, ni necesita servidor o conexión.
- Conserva decks, cartas y configuraciones en el almacenamiento local de WebView (su propia instalación; **no migra automáticamente** datos de GitHub Pages).
- Abre selector de Android para importar imágenes o backups JSON y para guardar JSON/PDF. Las imágenes preestablecidas se copian al APK.
- Muestra la interfaz original en **horizontal** para facilitar el uso del simulador.

## Compilar desde GitHub
1. Abre **Actions** > **Android APK (offline)** > **Run workflow**.
2. Abre la ejecución completada.
3. Descarga el artifact **Poker-Blitz-V1-Offline-APK**, descomprímelo e instala `app-debug.apk` en Android.

La ejecución también sucede automáticamente para commits en main y pull requests que cambien el juego.
La APK Debug ya viene firmada con una llave de prueba; para distribución pública se necesita una firma Release privada.

## Compilar con Android Studio
1. Abre la carpeta `android/` como proyecto Gradle.
2. Usa JDK 17 y Gradle 8.9 (compatible con Android Gradle Plugin 8.7.3).
3. Instala Android SDK Platform 35.
4. Ejecuta `assembleDebug` (menú Build > Build APK(s)), o desde terminal con Gradle 8.9:
   `gradle -p android assembleDebug`
5. APK: `android/app/build/outputs/apk/debug/app-debug.apk`.

**Importante:** la primera compilación requiere internet para descargar plugins, SDK y bibliotecas PDF. *El APK instalado no necesita internet.* Para recompilación sin conexión, esos componentes ya deben estar en la caché de Gradle.

## Actualizar versión
Cuando se cambie la versión principal en `index.html`, el proceso utiliza automáticamente el HTML señalado. No hace falta modificar `MainActivity.kt` para añadir nuevas cartas o reglas.

## Limitaciones que deben probarse en un dispositivo real
- Importación/exportación de archivos grandes (especialmente PDF con muchas cartas).
- Visualización de las pantallas de escritorio en móviles pequeños.
- Persistencia de partidas al cerrar/abrir la app.
- Seguridad y volumen de datos del historial PDF y el contenido de los backups.
- La compilación de este branch debe pasar GitHub Actions antes de afirmar que el APK está verificado.

No modifica `index.html` ni `app-v*.html` en el proyecto web existente.

## Versión corregida: pantalla de carga e icono
- Permite rutas `app-vX.Y.Z.html` y empaqueta tanto `index.html` como el HTML versionado.
- Integra el logo original `APP_LOGO` de Poker Blitz como icono launcher y en la pantalla de carga.
- Logcat Android `PokerBlitzBoot` informa si terminó el renderizado (`POKER_BLITZ_READY:home`) o hubo fallo.
- Un aviso reemplaza la carga infinita si JavaScript no inicia tras 15 segundos.
- IMPORTANTE: cada compilación Debug de GitHub puede estar firmada con otra clave. Exporta un JSON de tus decks antes de desinstalar una APK anterior.
