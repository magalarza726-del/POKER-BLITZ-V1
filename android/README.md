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

## Corrección Android de inicio y marca (Android build 1)
- El script del juego dejaba de ejecutarse porque la transformación global del cierre de head insertaba cierres de script dentro de las plantillas PDF.
- Se usa `replaceFirst` y la CI analiza el JavaScript de los HTML generados.
- Pantalla de carga con el logotipo original WebP y nuevo icono Android.
- Si la instalación falla por firma debug distinta, desinstalar versión anterior; **exportar los datos primero si se dispone de decks locales**.

## Interfaz móvil horizontal (layout v2)
- El juego usa `pokerblitz-android-layout.css` **solo dentro de la APK**; la web de escritorio permanece idéntica.
- Cabecera y fases compactas, fila de jugador independiente, herramientas reordenadas en límite/dado/cobro.
- Power Hand, Poker Hand y Hyper Zone disponen de espacio flexible y desplazamiento horizontal para todas las cartas.
- Botones contextuales se mantienen en el pie, ajustados al ancho disponible, y los diálogos son desplazables.
- Con altura inferior a 480px la vista se desplaza verticalmente para evitar que se corte el contenido.
- Probar en teléfonos y tablets en horizontal, incluido texto de varias líneas y accesibilidad.

La CI también comprueba el simulador en Chrome sin internet, a 1200×540, 1560×700 y 900×480, revisando que no se superpongan las filas, controles y manos.

## Ampliación universal de cartas (Android)
- Cualquier carta de Power o Poker en inicio, catálogo, deck, editor, manos o ventanas de selección se amplía al tocarla.
- Visor de solo lectura con carta completa, nombre, descripción sin recorte y controles +/− y cerrar; Escape también cierra.
- El toque en Usar, Descartar, Editar, Eliminar o botones numéricos **no abre** el visor.
- El catálogo muestra tres columnas más grandes, y las manos reciben mayor altura y scroll donde hace falta.
- El inspector funciona sin internet ni pérdida de estado: la versión web de escritorio sigue igual.

## Navegación de modo prueba Android
- Franja **siempre fija** en la parte superior con **← Inicio** y **↑ Arriba**, independiente del scroll y de Power/Poker/Hyper Hand.
- Una única superficie de scroll vertical para la partida completa; se mantiene el scroll horizontal de las cartas.
- **← Inicio** muestra la confirmación ya existente (Salir sin PDF / Salir con PDF / Cancelar): nunca descarta una partida accidentalmente.
- El botón Atrás de Android cierra el zoom o una ventana, o abre la misma confirmación de salida; desde la pantalla principal permite cerrar la app.
- GitHub Actions prueba scroll superior, salida y cancelación además de las tres manos.

## Intercambio manual global
La ventana ⇄ Intercambiar permite seleccionar dos jugadores (hasta 6) y cambiar una carta por otra del mismo tipo en Power Hand o Poker Hand. El modo Visibles muestra la cara de todas las cartas; No visibles muestra el reverso, con intercambio a ciegas. Funciona con arrastrar/soltar (mouse o tacto) y también tocando una carta de cada jugador. Muestra HyperCards activas pero no permite intercambiarlas. Cada movimiento modifica ambas manos y se registra en los historiales; el undo atómico reinicia las pilas previas para evitar duplicaciones.

## Ventana global de ACCIONES (versión actual)
- Botón fijo **⚙ Acciones**: Robar, Intercambiar o Descartar mediante arrastrar/soltar, y alternativa tocando.
- Se abre en **Poker Hands**. Puedes cambiar a Power Hands.
- Cada jugador tiene su propia visibilidad (Visible / Reverso), sin mostrar el valor de sus cartas ocultas en la lista ni durante el arrastre.
- **Robar** transfiere una carta a otro jugador sin sustituirla, soltándola en su panel. **Intercambiar** cambia dos cartas, soltando sobre una carta concreta. **Descartar** lleva la carta a la basura, devolviendo Poker al mazo compartido y Power al mazo del propietario actual.
- Las HyperCards activas se mantienen bloqueadas. Cada acción actualiza las manos y se registra en el historial; Deshacer revierte el último movimiento manual de forma atómica.
