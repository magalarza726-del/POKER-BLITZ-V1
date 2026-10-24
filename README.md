# POKER BLITZ V1 — GitHub Pages

Versión web estática basada en `DeckCreator_AndroidStudio_v0_13_NEW_CATALOG` y ajustada para escritorio.

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