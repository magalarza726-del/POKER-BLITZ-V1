# POKER BLITZ V1 — GitHub Pages

Versión web estática basada en `DeckCreator_AndroidStudio_v0_13_NEW_CATALOG` y ajustada para escritorio.

## Actualización de cuatro efectos oficiales — 24/10/2026

- **Maestro de Fichas (009):** mantiene el requisito de seleccionar a un rival con 5 fichas o más y jugarse una vez por turno. La opción de fichas ahora roba **1 ficha por cada 10** (parte entera); se mantienen las opciones de robar 2 Poker Cards aleatorias o extraer una Power Card aleatoria y activarla como propia cuando resulte aplicable. Una carta no aplicable regresa al Deck de su dueño; las HyperCards que se activan conservan su titular original. La elección entre las tres alternativas se hace explícitamente en Prueba Asistida o mediante heurística en Simulación.
- **Intercambio Forzado (013):** el jugador puede ver **toda la Poker Hand rival** y seleccionar una carta propia y una carta rival para cada uno de **hasta dos intercambios**, sin escoger cartas al azar. Los vínculos protegidos se muestran pero no pueden elegirse. Hasta 2 activaciones por turno. En Simulación, la IA selecciona cartas válidas según sus criterios.
- **Reino Amable (063):** al tener **Vínculo Noble** activo, no consume Poker Cards; de lo contrario descarta 2 Poker Cards. Después roba **siempre 2 Poker Cards**, sin límite por fichas. Hasta 2 activaciones por turno.
- **Anzuelo de Mejoras (007):** consume **2 Poker Cards y 1 Power Card**, permite buscar en el Deck y elegir **una HyperCard** específica (no una Power Card cualquiera). La lista de búsqueda solo muestra HyperCards presentes en el mazo; la elegida entra en Power Hand. Una vez por turno.
- **Persistencia:** el catálogo inicial actualizado reemplaza automáticamente las descripciones oficiales de estas cartas al restaurar una sesión, manteniendo imágenes personalizadas y decks del usuario.
- **Verificación:** las pruebas dirigidas abarcan pagos, selección de Poker Cards, copia de una Power Card rival, extracción exclusiva de HyperCards, activación de una HyperCard ajena con conservación de propiedad y Reino Amable por encima de 8 fichas. Adicionalmente se ejecutaron 75 partidas de estrés con 25.622 eventos y 0 incidencias detectadas por los controles automáticos tras corregir que Intercambio Forzado pudiera volver a seleccionar una carta recién transferida. Se comprueba que una selección agotada termina el intercambio sin detener el motor. Esto no sustituye todas las pruebas interactivas de navegador.
- **Verificación de HyperCards:** la Simulación ahora comprueba que se haya registrado un evento real de activación; no depende solo del cambio neto de HyperCards, evitando falsos positivos al desaparecer un vínculo simultáneamente.

## Exportación PDF móvil y compresión — 24/10/2026

- **Android / navegadores integrados:** no se intenta guardar automáticamente al finalizar una simulación; los navegadores móviles pueden bloquear esa descarga sin interacción. La pantalla final ofrece **Preparar PDF completo** y, para lotes, **Preparar resumen ligero**.
- **Confirmación visible:** al terminar de generar el documento aparece un panel independiente con enlaces reales de usuario **Descargar PDF** (`a[download]` con Blob URL), **Abrir PDF** y **Compartir PDF** (Web Share API, si está disponible). Android debe ejecutar la descarga o compartir al pulsar el usuario. Nunca se afirma éxito basándose únicamente en que `jsPDF.save()` no lanzó excepción.
- **Compresión antes de exportar:** los PDF de Simulación, Prueba Manual/Asistida e impresión de decks usan `compress:true` (compresión interna de flujos de PDF). Las imágenes de cartas impresas usan JPEG con calidad 0.86 para contener el tamaño, manteniendo salida PDF normal, sin obligar a descomprimir ZIP.
- **Resumen para 1–200 simulaciones:** conserva estadísticas, clasificación y resultados individuales, pero omite los historiales exhaustivos. El informe completo sigue disponible; su generación cede tiempo al navegador cada cinco partidas para evitar bloqueos prolongados.
- **Carga de bibliotecas:** se prueban jsDelivr, cdnjs y unpkg (jsPDF) y jsDelivr/cdnjs (html2canvas) cuando son necesarios. Este flujo web **requiere conexión** para descargar bibliotecas que aún no estén en caché; no certifica un APK totalmente offline.
- **Conservación de datos:** no se modifica el esquema ni se borran los decks o el historial guardado del usuario.
- **Pruebas:** suite de regresión ampliada con escenario móvil simulado de enlace Blob + Web Share, generación de informes compactos y completos de 200 partidas, arranque y simulación con rotación.

## Actualización: rotación y semillas — 24/10/2026

- **Simulación automática:** admite entre **1 y 200 partidas**, con cantidad editable desde Configurar partida de IA.
- **Rotación equilibrada:** en la partida n, todos los participantes avanzan una posición (orden circular). Los decks y dificultades pertenecen al participante **P1...P6**, no al número de asiento. En 200 partidas, cada participante de una mesa de seis ocupa cada asiento 33 o 34 veces.
- **Semilla editable:** Simulación, Prueba Manual Completo, Prueba Manual Sencillo y Prueba Asistida incluyen un campo opcional para un número entero entre **0 y 4294967295**. Dejarlo vacío genera una semilla nueva. Con la misma semilla, orden de jugadores, modo y decks, el reparto inicial y los resultados de las decisiones aleatorias reproducibles se repiten.
- **Lotes:** una semilla escrita es la **semilla base**. La partida i emplea `(semillaBase + Math.imul(i, 0x9e3779b9)) >>> 0`, iniciando con i=0. Cambian semilla y orden en cada partida, pero no cambian los decks ni las dificultades elegidas.
- **PDF de lote:** resultados, tasas de victoria y fichas promedio se agrupan por identidad **P1...P6** en vez de por asiento. Se detallan el asiento, orden, rotación y semilla de cada encuentro; se conserva el historial completo de acciones.
- **Pruebas Manual y Asistida:** la semilla se utiliza en el barajado inicial de Power Decks y Poker Deck digital y en decisiones aleatorias posteriores. Queda anotada en el historial y PDF. En Manual Sencillo, el reparto de Poker Cards es físico y no está controlado por la semilla.
- **Semilla fija y modo Seguro:** con una semilla fija se prioriza la reproducibilidad; la secuencia determinista no debe interpretarse como aleatoriedad criptográficamente impredecible.
- **Regresión:** se ejecutan comprobaciones de arranque e inputs, semillas, reparto reproducible, 200 partidas con seis participantes, distribución equilibrada por asiento, límites de HyperCards e integridad de cartas. El motor continúa siendo heurístico y sus combinaciones especiales requieren validación independiente.

## Revisión del motor y simulaciones por lotes — 24/10/2026

- **Lotes editables:** en Configurar Simulación se puede escribir una cantidad de **1 a 200 partidas**. Se mantienen los mismos jugadores, Power Decks, dificultades de IA, barajas de Poker y modo de batalla. Cada partida recibe una semilla distinta y reproducible.
- **PDF consolidado:** para lotes de más de una partida reúne porcentajes/cantidades de victorias, promedios de fichas, resultados individuales, semilla, incidencias, frecuencias por carta e historial de acciones de cada jugador, incluidos sus saldos y tamaños de mano tras cada evento.
- **Integridad:** comprobaciones automáticas de las 52/104 Poker Cards físicas, de las Power Cards por propietario, la cantidad máxima de 3 HyperCards activas, las copias legales de SuperCards y la devolución de ases/comodines virtuales.
- **Correcciones:** Espejador Experto solo copia SuperCards propias de ese turno respetando límites y recursos, sin materializar Sabueso de Ases desde una copia; CounterCards responden al jugador que activó la carta; Números Errantes restaura el valor original al volver al mazo; intercambios circulares simultáneos; protección de comodines vinculados; pagos completos de Secuaz; selección entre alternativas de efectos para Maestro de Fichas, Operación Táctica y Compartir es Ganar; Manipulador y Agujero Negro alteran realmente los dados antes de resolverlos.
- **Pruebas de regresión:** el test `android/tools/check_automatic_simulation.js` cubre catálogo de 64 cartas, partidas de 1–6 jugadores, lotes de 200, repetición de semillas y conservación de inventario. Las pruebas de enlaces `android/tools/check_assisted_links.js` cubren interacciones especiales, incluida Artilugio Legendario.
- **Alcance de la verificación:** comprobar 64 identificadores y ejecutar partidas aleatorias **no equivale a certificar todas las combinaciones posibles** de cartas y reglas. Las IA son heurísticas; no cuentan con una búsqueda exhaustiva de jugadas óptimas. La generación de PDF sigue requiriendo que jsPDF esté disponible.

## Versión 1.19.8 — Simulación automática

La pantalla principal incorpora **Simulación**, independiente de **Prueba Manual** y **Prueba Asistida**.

- **Configuración:** 1 a 6 jugadores, Power Deck independiente por jugador, dificultad individual (Principiante, Intermedio, Experto), 1 o 2 barajas de Poker y Blitz Battle (30 fichas) / Rush Battle (15 fichas).
- **Juego sin intervención:** un motor local reproduce turnos, manos de Poker, fichas, robos, costes, HyperCards activas, respuestas de CounterCards, reacciones simuladas y resolución de efectos utilizando los motores ya compartidos de Prueba Asistida.
- **Comportamiento según deck:** la IA evalúa las cartas disponibles y prioriza fichas, dados, Artilugios, ases, combos, HyperCards y respuestas según la composición de su deck. Principiante es casi aleatorio; Intermedio utiliza heurísticas; Experto prioriza recursos y combinaciones y no garantiza optimalidad matemática.
- **PDF como único entregable:** se genera automáticamente al finalizar y se puede solicitar otra descarga en la pantalla final. Incluye ganador o empate (cuando esté confirmado), clasificaciones, fichas, cantidad de eventos, dificultades, efectos registrados, historial por jugador, semilla reproducible e incidencias. No se muestra una segunda interfaz con las cartas durante la simulación.
- **Seguridad:** ejecución con semilla, límites de acciones y rondas, opción de cancelar y auditoría del inventario de Power Cards. El motor comparte los efectos existentes, que aún requieren pruebas extensivas de interacciones excepcionales.
- **Pruebas:** `android/tools/check_automatic_simulation.js` se ejecuta en GitHub Actions, junto a la suite existente.

## Versión 1.19.7 — Efectos vinculados en Prueba Asistida

- El catálogo oficial de **64 cartas** está incluido ahora en el registro de ejecución asistida. Los 13 efectos que estaban inhabilitados se han integrado al motor.
- **Reglas Antiguas (001):** devuelve cartas para pagar la activación y permite intercambiar 1 Poker Card con el mazo una vez por turno mediante un botón en la Hyper Zone.
- **Escudo Resplandeciente (004):** copia una SuperCard compatible *después* de resolver la carta original. No se ofrece la copia de una carta que requiere materializar su propia Power Card como As.
- **Artilugio Legendario (005):** comprueba tres Artilugios activos de distintos colores, entrega 5 fichas y devuelve uno al Power Deck correspondiente.
- **Simbionte (029), Cambio de Color (030), Joker (035):** crean vínculos con instancias físicas de Poker Cards (por ID); durante Charge Phase el evaluador admite valores y/o símbolos comodín. Los costes se descuentan y las HyperCards regresan al Deck cuando el objetivo abandona la Poker Hand.
- **Sabueso de Ases (040):** una SuperCard jugada legalmente pasa a estar representada por un As real en Poker Hand; se selecciona palo. Al descartarse o usarse, se devuelve al Power Deck del propietario original y no al mazo de Poker.
- **Artilugios (042, 043, 044, 058, 059, 060):** se vinculan a Poker Cards elegidas, otorgan protección cuando procede, disparan premios al cobrarlas y programan efectos en fases futuras. Con varios rivales, el usuario puede elegir a quién aplicar las penalizaciones.
- Se añadieron pruebas específicas de comodines, desvinculación, recompensas, Sabueso, copias de CounterCards y destinos correctos en `android/tools/check_assisted_links.js`.
- **Alcance:** este es un motor asistido, no una IA. Las decisiones siguen siendo del usuario. Aunque las 64 cartas constan como compatibles, algunas combinaciones de múltiples modificaciones y reglas especiales seguirán requiriendo pruebas de partida y ajustes antes de considerar la implementación íntegramente validada. No afecta Prueba Manual Completo ni Sencillo.

## Versión 1.19.6 — Dos botones de pruebas

- **Prueba Manual → Completo:** conserva Poker Hand digital, Charge Phase con combinaciones validadas, fichas, Power Hand, Hyper Zone, CounterCards, reacciones y acciones entre jugadores.
- **Prueba Manual → Sencillo:** solo gestiona Power Cards y las fichas. Las Poker Cards se llevan físicamente: no hay Poker Hand ni controles de robo, búsqueda o intercambio de Poker Cards, ni ventana de CounterCards o de reacción de *Entendí la referencia*. Los cobros de pareja/trío/escalera/color/póker regresan al sistema anterior de botones manuales durante Charge Phase.
- **Prueba Asistida:** activa un motor separado que ejecuta efectos compatibles sobre los decks, Poker Cards, HyperCards, dados y fichas reales. En efectos con selección de rival aparece un diálogo. Los efectos sin implementación segura quedan deshabilitados, sin consumir cartas ni fingir su resolución.
- La **ventana de CounterCards** se mantiene en Completo y Asistida; en Sencillo no aparece.
- El modo elegido se guarda en los registros y se identifica en el PDF.
- El motor asistido **aún no cubre los 64 efectos** del catálogo: faltan especialmente imitaciones de SuperCards ajenas, algunos comodines, vínculos de Artilugios y conversiones de cartas entre Power/Poker. Estos están bloqueados en Asistida mientras no exista resolución fiel. La modalidad Completo mantiene las herramientas manuales para esas cartas.
- El flujo de GitHub Actions ejecuta `android/tools/check_assisted_effects.js` para comprobar cambios reales de estado, objetivos, recursos y enlaces entre modos.

## Versión 1.19.5 — Modo Prueba, reglas manuales verificables

- **Charge Phase**: seleccionar Poker Cards concretas y cobrar solo con una pareja, trío, escalera, color o póker válido. Las cartas usadas regresan al mazo compartido y se reponen al inicio de End Phase.
- **Turnos**: Main → Charge → End → Finalizar turno. Sin Draw Phase en el primer turno; en los siguientes se roba automáticamente hasta el límite. El modo manual tiene una meta base de 30 fichas.
- **CounterCards**: ventana de respuesta, respuestas encadenadas y negación de la carta anterior (He Dicho Que No). Las otras cartas que precisan interpretación siguen siendo **efectos manuales**, no automatizados.
- **Entendí la Referencia**: ventana de reacción de los oponentes, entrega de la Poker Card revelada al primero y descarte efectivo del último.
- **Propiedad**: una Power Card robada o intercambiada conserva el registro de su propietario original para regresar al deck correspondiente cuando sale de juego.
- **Reglamento**: máximo de 3 HyperCards activas por jugador. Se aclara que "robar una carta" (sin especificar el tipo) se refiere a una Poker Card.
- **Pruebas**: `android/tools/check_manual_rules.js` y comprobaciones Android/PDF en CI.

**Alcance importante**: esta actualización mejora la legalidad y el registro de las herramientas manuales. No implementa todavía los 64 efectos de las cartas como reglas automáticas. Cuando se resuelva una carta fuera de los casos anteriores, el usuario aplica su efecto manualmente mediante las herramientas de Prueba.

## Versión 1.1.0

- 56 cartas iniciales y sus artes.
- Biblioteca de cartas con panel de detalle a la derecha y sin ampliación automática al seleccionar.
- Corrección del solapamiento vertical de cartas en la cuadrícula.
- Botón **Ver reglas** con el reglamento oficial integrado.
- Editor de cartas: nombre, texto, color, foto, recorte/zoom, desplazamiento, tinte, duplicado y guardado.
- Creación y edición de decks con múltiples copias por carta.
- Configuración de mano inicial de 3, 4 o 5 cartas.
- Modo prueba multidDeck: cambio de deck, robo, uso, bloqueo, dado, dos dados, moneda y contador.
- Historial del modo prueba y salida con reporte PDF mediante impresión del navegador.
- Tres modos de randomización, incluyendo `crypto.getRandomValues` para el modo Seguro y herramientas de azar.
- Exportación de decks a PDF mediante impresión.
- Importación / exportación JSON.
- Persistencia local con `localStorage`.
- `.nojekyll` para publicación directa en GitHub Pages.

## Publicación

Publicar el contenido de esta carpeta en la raíz de la rama `main`.