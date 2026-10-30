### Corrección de portadas — V1.22.1 (29/10/2026)
- Se sustituyeron las cuatro imágenes minúsculas de **112 px de ancho** por recortes de la obra original aportada: Cian **598×845**, Dorado **597×845**, Magenta **627×845** y Equipo **1024×1536**. Se guardaron en WebP de alta calidad sin volver a inventar ni redibujar las ilustraciones.
- El carrusel ahora muestra **una sola portada por vez** en cualquier ancho de pantalla. Cada portada permanece **10 s** y se desplaza hacia la izquierda durante **1 s** mientras la siguiente entra por la derecha. Una quinta diapositiva (copia de la primera) permite repetir el ciclo sin salto visual.
- Las imágenes utilizan `object-fit:contain` para conservar la ilustración completa y el tamaño original. Se actualizaron versiones de caché de HTML, CSS y portadas.
- La página principal (`index.html`) y los enlaces directos a la versión 1.22.0 llevan a **app-v1.22.1.html**.
- Prueba de regresión: `node android/tools/check_cover_carousel_hq.js`.

### Interfaz simplificada y simulación evolutiva — V1.22.0 (29/10/2026)
- Nueva portada: **izquierda** carrusel de las cuatro portadas aportadas (tres recortadas de la imagen triple y una portada de equipo), guardadas como WebP independientes en `assets/cover-blitz-*.webp`. En escritorio se muestran tres a la vez y una sale por la izquierda cada **10 segundos** (con transición lateral de **1 segundo**); las demás entran por la derecha. En móvil se adapta a una portada visible.
- A la **derecha** hay exactamente cuatro accesos: **Jugar** (Prueba Manual Completa directamente), **Decks** (creación manual, perfiles y Deck Catálogo), **Extras** (reglamento y configuración) y **Desarrollador** (historial, importar/exportar y simulación). Prueba Manual Sencilla y Prueba Asistida ya no son opciones del menú.
- **Deck Catálogo**: una copia visual de cada carta oficial y botones +/- por carta. Se respetan 1 HyperCard de cada tipo, hasta 3 Super/Counter y tamaño oficial del Power Deck **20+2H a 30+2H**. Decks e ilustraciones guardados permanecen intactos.
- En **Desarrollador → Simulación** hay cuatro opciones desplegables, con hasta 1000 partidas principales, semillas y asientos rotativos:
  - **Balance**: los decks y las IAs no cambian.
  - **Decks**: cada deck no congelado participa en mejoras y conserva al menos 70% de su composición original; hay casillas para congelar decks concretos y se guardan los ensayos de versiones.
  - **IA**: se entrena cada IA no congelada con el módulo existente y se conservan políticas previas cuando la validación no verifica una mejora.
  - **Nuevo Deck**: J1 se inicia con un proyecto vacío; antes de su primera partida se crea una composición legal y se reevalúan nuevas variantes entre tandas; la versión resultante se guarda en Mis Decks al completar las partidas.
- Los cuatro modos reutilizan el motor de efectos y la generación de resultados/PDF. Los modos evolutivos pueden realizar partidas extra de evaluación además del contador principal. La simulación cancelada no sobrescribe versiones guardadas.
- Prueba de estructura: `node android/tools/check_main_redesign.js`. Se verificaron además partidas de balance, evolución de Decks, entrenamiento de IA con participante congelado, y Nuevo Deck con el motor real. Los resultados no garantizan optimización perfecta.
- Página principal publicada: `app-v1.22.0.html` (archivo `index.html` actualizado). Las URLs anteriores apuntan a esta versión para evitar hojas de inicio obsoletas.

### Fondos personalizados para la mesa de pruebas — V1.21.2 (29/10/2026)
- En **Configuración → Fondo de la mesa en pruebas**, se puede elegir entre las cinco texturas proporcionadas: **Verde** (predeterminado), Negro, Rojo, Azul y Morado.
- El ajuste se guarda en `state.testBackground` mediante `localStorage`, permanece entre sesiones y se incluye en importaciones/exportaciones JSON.
- La elección se aplica a **Prueba Manual Completa, Prueba Manual Sencilla y Prueba Asistida** mediante la misma pantalla de mesa; no afecta a cartas, retratos ni motor de juego.
- Las texturas originales se optimizaron como WebP (sin cambiar su composición) y se subieron a `assets/table-texture-*.webp`. La selección incluye vista previa y accesibilidad mediante `aria-pressed`.
- Archivo de entrada `app-v1.21.2.html`; `index.html` y enlaces anteriores llevan a esta versión para evitar cachés de HTML previas.
- Prueba de regresión: `node android/tools/check_table_backgrounds.js`.

### Corrección definitiva de catálogo de decks — V1.21.1 (28/10/2026)
- Se creó `app-v1.21.1.html` y se actualizó la entrada `index.html` para evitar reutilizar una página HTML antigua.
- Se renovó explícitamente la caché del script `presets/default-decks.js`: ahora debe cargar **11 decks predeterminados**, incluidos Arkan, Regulus y Maverick.
- La migración `defaultPresetVersion:3` recupera los presets faltantes incluso si el perfil estaba marcado como versión 2. La reparación se guarda automáticamente en `localStorage` sin sustituir los decks personalizados ni sus modificaciones.
- Si un perfil ya alcanzó v3 con una lista incompleta, hay un botón **Recuperar decks predeterminados faltantes** tanto en Prueba como en Simulación. Un catálogo en caché con menos de 11 no se marca como migrado.
- Prueba de regresión: `node android/tools/check_preset_migration.js`, además de la comprobación de sintaxis de la nueva página.

### Recuperación de decks predeterminados (28/10/2026)
- Las sesiones antiguas que guardaron 8 decks ahora recuperan los 11 predeterminados, incluyendo Arkan, Regulus y Maverick, sin sobrescribir personalizaciones ni inventar cartas.
- El correctivo se aplica una sola vez mediante `defaultPresetVersion: 2`; los decks eliminados intencionadamente después de esta versión no se restauran automáticamente.
- Se aplica también a importaciones JSON de versiones antiguas. La pantalla de configuración muestra el total de decks seleccionables.
- Regresión: `node android/tools/check_preset_migration.js` (migración 8 → 11, preservación de cambios, idempotencia e importación).

### Dado animado y diálogo por párrafos (28/10/2026)
- Dado: giro corto de 800 ms; el resultado se fija antes del giro, usa `crypto.getRandomValues` con rechazo de módulo para evitar sesgos cuando no se introdujo una semilla manual, y conserva la secuencia reproducible si se indicó una semilla. El modificador +/- sigue aplicándose y se registra el valor de la cara y el total.
- Diálogo: ▶ escribe un solo párrafo a ritmo moderado. **Enter** termina el párrafo si aún se está escribiendo y, una vez terminado, muestra el siguiente desde un cuadro limpio. Al pulsar Enter después del último se restaura el texto original completo, listo para editar. El botón **Enter ↵** permite avanzar también en pantallas táctiles. Se conservan las notas originales al cambiar de jugador, al abrir cartas y durante los refrescos de la mesa.
- Prueba automática: `node android/tools/check_dice_dialogue.js` comprueba separación de párrafos, reproducción, Enter, restauración, cambio de jugador y los dos caminos de azar del dado. Se respeta `prefers-reduced-motion`.

## Ajustes de mesa: selección común y Hyper Zone (28/10/2026)

- **Poker Hand:** un clic selecciona, un segundo clic rápido amplía; teclado: Intro/Espacio para seleccionar y Z para ampliar. Los botones de cada naipe se sustituyen por una barra común de **Cobrar, Descartar, Encantar y Cancelar**; al seleccionar naipes encantados manualmente también aparece **Desencantar**. Las acciones múltiples mantienen el historial y deshacer.
- **Hyper Zone:** las Poker Cards encantadas se muestran a continuación de las HyperCards en **la misma fila desplazable**, con las mismas dimensiones y diseño que las cartas de Poker Hand. Mantienen su condición de encantadas y siguen contando en la mano. El máximo de HyperCards activas continúa siendo tres.
- **Power Hand sin límite máximo:** todas las formas de robo manual y asistido, así como las simulaciones, permiten conservar más de cuatro Power Cards. La Draw Phase solo repone hasta **cuatro como mínimo** si la mano está por debajo; no roba automáticamente todo el deck.
- **Herramientas:** se elimina el icono de dólar y se muestra un modificador de dado +/- visible. El modificador se conserva al lanzar; la columna de controles se compacta arriba para evitar desplazamiento vertical innecesario.
- **Presentación:** se conservan las proporciones de todas las cartas y la vista completa de los personajes; se eliminan huecos vacíos de Poker Hand que causaban desplazamiento horizontal sin utilidad.
- **Comprobación:** los archivos JavaScript compilan; cinco simulaciones de tres jugadores y HyperCards con semillas reproducibles finalizaron sin incidentes de integridad. La comprobación visual en navegador sigue siendo necesaria.

## Poker Blitz V1.21.0 — Decks, Test y simulación evolutiva (26/10/2026)

### Navegación agrupada
- **Decks:** Nuevo Deck, Ver Decks, Creación de Decks y Mejora de Decks.
- **Test:** Prueba Manual, Prueba Asistida y Simulación.
- Se conserva el reglamento oficial, el catálogo de 50 cartas, los retratos y las ilustraciones individuales.

### Nuevos límites
- Hasta **10 jugadores** en Test; a partir de 8 jugadores se exigen **2 barajas de Poker** para repartir siete Poker Cards privadas por jugador.
- Hasta **1000 partidas** en un lote automático. Para más de 50 partidas, cada resultado conserva estadísticas y resultados pero no todo el historial de eventos de cada turno (resumen para controlar memoria). Los lotes pequeños mantienen el historial completo.
- Simulación usa la **misma IA experta para todos**. Desaparecen los controles de dificultad independientes.
- El Deck Builder muestra los límites **mínimo 20+2H y máximo 30+2H** en función del número de HyperCards, con un indicador del tamaño presente.
- Los decks incompletos se señalan y se omiten de Test, sin añadir automáticamente cartas inexistentes.

### Laboratorio de mejora
- El usuario selecciona el personaje y los rivales fijos. El algoritmo varía SuperCards, CounterCards, HyperCards y sus copias, respetando cantidades máximas y mínimos/máximos.
- Cada versión de prueba debe retener **al menos el 70 % del deck original**, medido como número de copias compartidas (Power Cards + HyperCards) dividido entre el mayor tamaño total de los dos decks.
- Cada candidato se evalúa en partidas completas con semillas y rotación comparables; el objetivo pondera **victorias, derrotas y diferencia de fichas**. Solo se aplica al deck el mejor resultado elegible. El historial contiene también las propuestas rechazadas y permite restaurarlas.
- El deck original queda preservado para que sucesivas rondas de mejora sigan respetando la misma referencia. Las partidas de evaluación **no entrenan** una IA neural; usan búsqueda y simulación comparativa.

### Creación de Decks
- Parámetros de estilo: equilibrado, agresivo, defensivo, combinaciones, economía, control y dados/azar.
- Agresividad 1 a 5 y facilidad fácil, media o avanzada.
- Generación ponderada por descripciones, efectos y complejidad de las cartas, seguida de partidas contra los decks rivales elegidos. Se conserva el candidato mejor evaluado y se guarda su historial.
- Los parámetros son **preferencias heurísticas**, no garantías de victorias ni una prueba de optimalidad matemática.

### Pruebas
- `android/tools/check_deck_lab.js` valida límite de diez jugadores, igualdad de IA, simetría de semillas, generación legal, 70 % de semejanza y partidas reales.
- `android/tools/check_current_rules.js` verifica el reglamento y la lógica asistida existente.
- Las simulaciones de muchas partidas pueden consumir bastante tiempo según dispositivo. No requieren red mientras se ejecutan en la app.

# POKER BLITZ V1 — GitHub Pages

## Corrección de imágenes individuales — Web 1.20.1 (26/10/2026)

- Se corrigió el recorte erróneo que mezclaba partes de imágenes vecinas (visible especialmente en **Operación Táctica**).
- La aplicación carga cada carta oficial desde **`assets/cards/catalog_v3_XXX.webp`**, con una imagen WebP individual recortada directamente de la lámina original del usuario; ya no usa coordenadas de atlas durante la visualización de cartas.
- Se han verificado las **50 ilustraciones individuales** en una lámina de revisión y se han conservado sus correspondientes textos, colores y nombres. **Secuaz de las Fichas** y **Maestro de Fichas** mantienen ilustraciones distintas.
- Afecta al catálogo, Deck Builder, vistas ampliadas, pruebas manuales/asistidas, simulador y a toda vista que reutilice `cardHTML`. Los retratos de personajes y los paneles de diálogo permanecen intactos.
- La suite `android/tools/check_card_art.js` exige ahora **50 WebP distintos**, todos existentes y vinculados a los 50 IDs oficiales; ya no depende de atlas antiguos. Los antiguos atlas permanecen como recursos históricos, pero su renderizado está desactivado.
- Esta actualización es **estrictamente visual**, sin alterar efectos o reglas. Las auditorías de lógica del simulador y prueba asistida siguen siendo trabajos independientes.

## Paneles de diálogo adicionales — Web 1.20.0 (26/10/2026)

- Se integró **el atlas original de 10 paneles de diálogo** en `assets/poker_character_dialogues.webp`; no sustituye los retratos de personaje.
- Los 10 paneles se asocian por **ID de deck** en orden: Sibaris, Midas, Vórtice, Fortuna, Astra, Némesis, Arkan, Aceron, Regulus y Maverick. Colores originales: cian, rosa en Némesis, dorado en Aceron y Regulus.
- El panel está visible como elemento separado **debajo de la foto en partida**, junto al retrato en el **editor del deck** y en la **lista de decks**. En partida utiliza el estado reciente como texto de diálogo; el nombre se muestra siempre.
- Los decks personalizados sin personaje predeterminado mantienen sus retratos sin asignación errónea de paneles.
- El APK offline empaqueta el atlas automáticamente junto con los demás recursos de `assets/`. La CI revisa el asset, las asociaciones, la conservación de retratos y las pantallas que lo utilizan mediante `android/tools/check_dialogue_panels.js`.
- Los efectos de las cartas, reglas y cantidades de los decks **no cambian** por esta actualización visual.

## Ilustraciones integradas — Web 1.19.9 (26/10/2026)

- Las **50 cartas oficiales** muestran ahora el arte pixelado del usuario, organizado en **7 atlas WebP**, con las imágenes recortadas sin duplicar títulos o descripciones.
- Los **10 personajes predeterminados** incorporan sus retratos ilustrados: Sibaris, Midas, Vórtice, Fortuna, Astra, Némesis, Arkan, Aceron, Regulus y Maverick, en archivos WebP individuales. La restauración de sesiones migra los retratos predeterminados anteriores al nuevo arte.
- Las ilustraciones aparecen automáticamente en catálogo, decks, vista ampliada, manos y reportes que representen visualmente las cartas. No se han modificado nombres ni descripciones durante la **integración gráfica**.
- La imagen de fichas de la primera lámina corresponde a **Secuaz de las Fichas (055)** y la de la tercera a **Maestro de Fichas (009)**, sin intercambiar los efectos.
- El compilador Android copia `assets/` en el APK offline; `android/tools/check_card_art.js` comprueba los 50 vínculos, los 7 atlas y los 10 retratos. Las suites de lógica anteriores todavía necesitan sincronizarse con el nuevo catálogo y pueden fallar independientemente de estas ilustraciones.

> **Nota de vigencia:** Las secciones históricas del registro relativas a imágenes sin ilustración, 64 cartas y efectos sustituidos describen versiones anteriores. El catálogo y el reglamento de 50 cartas de octubre de 2026 tienen precedencia.

## Catálogo oficial y reglas de construcción — 26/10/2026

- Catálogo vigente: **50 cartas** (32 SuperCards, 12 HyperCards y 6 CounterCards). Todas incluyen sus ilustraciones oficiales en estilo pixel art.
- **Power Deck:** exclusivamente SuperCards y CounterCards, entre `20+2H` y `30+2H` cartas. Máximo **3 copias de cada SuperCard o CounterCard**.
- **HyperZone:** de **0 a 3 HyperCards distintas**, máximo **1 copia de cada una**. Se preparan boca abajo, separadas del Power Deck. No se roban durante la Draw Phase.
- Los 10 decks predeterminados se limpiaron: se quitaron cartas eliminadas, se separaron las HyperCards, y **no se añadió ningún sustituto**. Algunos quedaron bajo el mínimo legal y deberán completarse manualmente. Los decks incompletos permanecen en el editor, pero no se seleccionan para partida.
- El editor, la carga de partidas guardadas y la importación JSON aplican los límites de copias y eliminan referencias a cartas oficiales retiradas.
- El modo de prueba y la simulación usan **3 Power Cards y 7 Poker Cards** de inicio. La End Phase repone Poker Cards hasta siete y las HyperCards utilizadas regresan a la HyperZone al cerrar el turno.
- **Correcciones de efectos asistidos incluidas:** Sobrecarga de Mejoras (007), Maestro de Fichas (009), Neo-Blackjack (041), Caballería de Refuerzo (057), Compartir es Ganar (026), Operación Táctica (010), Ojo del Más Allá (016) y otras adaptaciones. La distinción entre **Maestro de Fichas (009)** y **Secuaz de las Fichas (055)** se conserva.
- **Limitación conocida:** algunos efectos del nuevo catálogo aún no se han reprogramado fielmente y quedan deshabilitados en Prueba Asistida. Las suites antiguas fueron diseñadas para 64 cartas y precisan actualización antes de certificar el nuevo catálogo por CI; la presencia de código no debe confundirse con validación exhaustiva.


Versión web estática basada en `DeckCreator_AndroidStudio_v0_13_NEW_CATALOG` y ajustada para escritorio.

## IA estratégica y táctica por deck — 24/10/2026

- **Astra (Bruja de las Reliquias):** identifica como objetivo prioritario buscar y activar *Cambio de Color*, si está disponible y no está ya activado. Retrasa costes que dejarían insuficientes Poker Cards para formar Color; selecciona cartas de palos minoritarios para vincularlas y no consume recursos estratégicos de forma indiscriminada. También valora Simbionte y Joker según oportunidades.
- **Vórtice (Torbellino):** Intercambio Forzado utiliza la información completa revelada por el efecto y evalúa el aumento de potencial de ambas manos. Experto simula dos intercambios consecutivos (búsqueda limitada de profundidad dos) y evita reutilizar cartas previamente intercambiadas; Intermedio usa un enfoque más simple y Principiante escoge entre opciones legales. No se inspeccionan manos ocultas fuera de lo permitido por las cartas.
- **Aceron (Maldito de los Ases):** coordina Sabueso de Ases, Maldición y Artimaña del As con robos y protección de ases; estima su valor futuro antes de cobrar combinaciones normales o pagar costes.
- **Regulus (Caballero Real):** prioriza robos amplios y figura J/Q/K, Vínculo Noble, Reino Amable y Caballero Real. Evita gastar el cobro de figuras cuando todavía no ofrece valor efectivo y protege las figuras que necesita.
- **Todos los niveles:** el motor actualiza objetivos en cada turno (registrados como `Plan IA`); elegir `pasar` o conservar Power Cards es legal y se evalúa frente a jugar inmediatamente. Los descartes End Phase priorizan las cartas con menor utilidad prevista y pueden liberar espacio de robo; los pagos de costes intentan preservar cartas vinculadas y combinaciones.
- **Planificación:** la evaluación de Poker Hand combina parejas/tríos, concentración de palos, proximidad a escaleras y sinergias de As/J/Q/K. Los cobros incorporan una segunda combinación estimada y la pérdida de potencial por descartar. Las reglas y probabilidades se ajustan por nivel, sin suponer optimalidad global.
- **Precisión de término:** esto es **planificación heurística adaptada al estado de cada turno**, no entrenamiento persistente de aprendizaje automático entre partidas. Las semillas reproducibles se mantienen para comparar desempeños.
- **Pruebas:** 40 enfrentamientos completos entre los cuatro decks Expertos (22 rondas máximo) sin incidencias; 60 partidas adicionales con niveles Principiante, Intermedio y Experto alternados, 20.998 eventos y cero incidencias detectadas. La prueba automatizada incluye 12 enfrentamientos dirigidos donde comprueba búsqueda de Cambio de Color, cobros de Color, intercambios, cobros de ases y figuras, conservación selectiva de cartas y descartes End Phase. Las pruebas no demuestran que todos los planes sean matemáticamente óptimos.

## IA estratégica calibrada — 24/10/2026

- **Astra / Bruja de las Reliquias:** identifica el símbolo predominante, conserva recursos útiles para formar Color y prioriza `Cambio de Color` (030) en el Deck a través de `Anzuelo de Mejoras` (007) cuando tiene sentido. Pospone HyperCards costosas si todavía no dispone de Poker Cards suficientes para aprovecharlas.
- **Vórtice / Torbellino:** planifica los intercambios dirigidos con valoración del impacto sobre ambas manos y anticipa un segundo intercambio; prioriza adversarios con fichas y manos intercambiables y puede conservar cartas de intercambio para otro turno. El orden del intercambio respeta la información revelada por el efecto, no proporciona cartas ocultas antes de seleccionar al rival.
- **Aceron / Maldito de los Ases:** valora el robo amplio, acumula ases, protege ases estratégicos durante pagos y prioriza `Artimaña del As` cuando la cantidad cobrada supera la oportunidad de conservarlos. Evita crear ases virtuales sin beneficio.
- **Regulus:** valora J/Q/K, conserva la búsqueda selectiva y retrasa `Vínculo Noble` o `Caballero Real` si el coste o la reducción del limitador perjudicarían el plan.
- **IA global:** Principiante, Intermedio y Experto emplean el mismo marco básico de objetivos con distinta selectividad, profundidad y aleatoriedad. Eligen entre jugar, reservar una Power Card y descartarla al final para liberar espacio; también consideran combinaciones de Poker futuras. Este mecanismo **adapta decisiones al estado actual**, no utiliza entrenamiento automático persistente ni garantiza juego óptimo.
- **Pago de HyperCards vinculadas:** la IA ahora elige la Power Card menos valiosa para pagar, en lugar de descartar siempre la primera de la mano.
- **Validación:** pruebas dirigidas de los cuatro decks oficiales con distintas dificultades, rotaciones y semillas idénticas, además de la suite de integridad de 200 partidas. En una comparación exploratoria de 24 encuentros con cuatro decks y semillas idénticas, Vórtice pasó de 459 a 479 fichas acumuladas con la política recalibrada; los resultados por deck dependen de rivales, asiento, mano inicial y tamaño de muestra. No es prueba estadística de superioridad general.

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