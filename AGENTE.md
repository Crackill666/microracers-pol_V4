# AGENTE

## Estado general

Proyecto `microracers_v4`.

Es una dapp/juego NFT donde:
- se compra un auto NFT
- cada auto tiene una cantidad limitada de carreras
- entre carreras hay cooldown
- cada carrera paga recompensa
- al llegar al ROI maximo o quedarse sin carreras, el auto queda retirado/inutilizado

La dapp principal vive en `game.html`.
El runner arcade vive en `PISTA/`.

## Estado real actual

Ya no hay una sola pista de prueba.
Hoy existe un pool de circuitos Phaser y `game.html` ya selecciona uno aleatorio para el Time Trial.

Tracks disponibles en `PISTA/src/track-data.js`:
- `test_s_circuit`
- `monza_style_circuit`
- `suzuka_style_circuit`
- `indianapolis_oval`
- `thunder_loop_circuit`

La seleccion aleatoria de circuito para el trial se esta resolviendo desde `game.html`, pasando `track` y `seed` al runner.

## Archivos clave

- dapp principal: `game.html`
- runner HTML: `PISTA/runner.html`
- logica Phaser: `PISTA/src/main.js`
- bridge parent/iframe: `PISTA/src/bridge.js`
- catalogo de pistas: `PISTA/src/track-data.js`
- mensajes del popup final: `PISTA/src/result-messages.js`

## Comandos utiles

- levantar servidor de prueba del runner:
  - `npm run serve:track`
- abrir runner directo:
  - `http://127.0.0.1:4173/PISTA/runner.html?track=test_s_circuit&limit=35`
- abrir dapp completa:
  - `http://127.0.0.1:4173/game.html`
- validar sintaxis runner:
  - `node --check PISTA/src/main.js`
- validar bridge:
  - `node --check PISTA/src/bridge.js`

## Estado del runner Phaser

### Manejo / gameplay
- control arcade funcional
- HUD compacto para desktop y mobile
- velocidad en HUD expresada en `km/h`
- countdown, checkpoints, meta y popup final funcionando
- posicion del jugador en carrera implementada
- penalidad de `+1s` por choque con rival implementada
- autos mas chicos y varias pasadas de tuning de velocidad ya hechas

### Rivales
- hay grilla de rivales y posiciones relativas en carrera
- tienen velocidad base y variacion entre NPCs
- hacen cambios de carril aleatorios en rectas
- siguen siendo la parte mas fragil del gameplay
- el movimiento visual todavia necesita pulido fino

### Pistas / contenido
- ya hay varias pistas con personalidades distintas
- se agregaron decoraciones, tribunas, props y safe placement basico
- checkpoints ocupan toda la trazada para detectar tambien por bordes
- los rivales cruzan la meta y siguen un tramo para no bloquear al jugador

## Integracion actual con `game.html`

El flujo esperado sigue siendo este:
1. en `game.html`, tocar `Run Race`
2. si el trial no esta aprobado, abrir `PISTA/runner.html` embebido en overlay
3. si el jugador termina en menos de `35s`, cerrar la pista
4. volver a `game.html`
5. tocar `Run Race`
6. enviar `game.race(...)` on-chain
7. mostrar modal final con premio, posicion inferida y datos de retorno

Ese es el flujo historico que el usuario quiere conservar.

## Problema abierto principal

El flujo `Time Trial -> volver a game.html -> Run Race -> transaccion -> premio` sigue roto.

Comportamiento esperado:
- al aprobar el trial, la pista debe cerrarse sola
- `game.html` debe mostrar mensaje tipo `Time Trial passed: XX.XXs (limit 35s). Now press Run Race.`
- el boton `Run Race` debe usar ese unlock y enviar la transaccion a blockchain
- luego debe aparecer el modal de premio

Comportamiento actual observado por el usuario:
- el runner termina pero el retorno de control no quedo estable
- en varias iteraciones se abrio popup, luego se saco otra vez
- hubo un experimento con boton `Enviar transaccion` dentro del runner que no resolvio el problema
- al volver a `game.html`, `Run Race` puede quedar en loop o no enviar la tx como antes
- hoy el sistema no reproduce de forma confiable el flujo viejo

## Hipotesis tecnicas importantes para la proxima sesion

Puntos a revisar primero en `game.html`:
- bloque Time Trial alrededor de `2179+`
- `handleTimeTrialMessageData(...)`
- `runRaceTx(...)`
- `runRace(...)`
- `clearTimeTrialUnlock()`

Puntos delicados:
- el unlock del Time Trial se limpia en varios lugares del archivo
- `selectCar(...)` y `loadGarage()` llaman `clearTimeTrialUnlock()`
- hubo cambios recientes moviendo el `clearTimeTrialUnlock()` cerca del `game.race(...)`
- el bridge ahora mezcla callback directo a parent/opener y `postMessage`
- todavia quedaron restos del experimento de submit interno

## Restos / deuda tecnica actual

En este estado quedaron restos que conviene limpiar antes de seguir iterando el flujo:
- en `PISTA/src/bridge.js` todavia existe `sendSubmit(...)`, aunque el flujo deseado ya no deberia depender de ese boton interno
- en `PISTA/runner.html` y `PISTA/src/main.js` sigue existiendo infraestructura de `submitTxBtn`, pero hoy deberia quedar desactivada o removerse si se confirma que no va mas
- `AGENTE.md` anterior estaba muy desactualizado: decia que habia una sola pista y no reflejaba la integracion random actual

## Recomendacion concreta para retomar

No seguir agregando parches al mismo tiempo en runner y `game.html`.
La siguiente sesion deberia hacer esto en orden:
1. dejar un solo flujo oficial: `game.html` controla el gating, el runner solo manda `READY`, `DONE` y `CLOSE`
2. eliminar o desactivar por completo el submit interno del runner
3. instrumentar logs visibles en `game.html` para confirmar si llega `DONE`
4. una vez confirmado el unlock, validar que `Run Race` entre directo a `runRaceTx()` sin reabrir el trial
5. recien despues limpiar codigo experimental sobrante

## Resumen de lo que si quedo bien

- pool de pistas aleatorias funcionando
- varias pistas nuevas listas
- HUD y resultado del runner funcionando
- posicion del jugador y mensajes finales funcionando
- premio/modal on-chain de `game.html` sigue existiendo en codigo
- la parte realmente pendiente no es el premio, sino volver a conectar correctamente el paso previo: aprobar trial y habilitar de forma confiable `Run Race`
