# POKER BLITZ V1 — GitHub Pages

Versión web estática basada en `DeckCreator_AndroidStudio_v0_13_NEW_CATALOG` y ajustada para escritorio.

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