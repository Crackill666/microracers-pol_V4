# AGENTE

## Estado general

Proyecto `microracers_v4`.

Es una dapp/juego NFT en Polygon Amoy donde:
- se mintea un auto NFT
- cada auto tiene un limite de carreras segun rareza
- entre carreras hay cooldown
- las carreras ya no pagan al instante
- cada auto acumula POL internamente hasta retiro final

La dapp principal vive en `game.html`.
El runner arcade vive en `PISTA/`.

## Estado real actual

La economia ya fue refactorizada al modelo:
- `accumulatedReturn`
- `maxReturn = 12 POL`
- `claimReward(tokenId)` al final de la vida util del auto

Ya no aplica el esquema viejo de "pago por carrera".

El contrato de juego nuevo desplegado en Amoy es:
- `MR_JUEGO`: `0x03A603631EF5F8137C7247726c2be497aA7cf88A`

La coleccion NFT conectada a ese juego es:
- `MR_AUTOS`: `0x44BDe8b34292768759e11c90E2122CDbaAbF9A57`

Importante:
- `MR_AUTOS` no se modifico en codigo
- para apuntar al juego nuevo se desplego una instancia nueva del NFT
- los autos de la coleccion vieja no migran solos

## Economia actual

En `contracts/game.sol`:
- `race(uint256 tokenId, uint8 position)`
- `claimReward(uint256 tokenId)`

Reglas activas:
- `1ro -> 0.835 POL`
- `2do -> 0.522 POL`
- `3ro -> 0.522 POL`
- `4to o peor -> 0.5 POL`
- `maxReturn = 12 POL`
- si llega a `12 POL` o consume todas sus carreras, pasa a `READY_TO_CLAIM`
- luego puede hacer `claimReward`
- despues queda `RETIRED`

Estados del auto:
- `0 = ACTIVE`
- `1 = READY_TO_CLAIM`
- `2 = RETIRED`

## Frontend actual

`game.html` ya esta adaptado al modelo nuevo:
- llama `game.race(tokenId, position)`
- muestra `accumulatedReturn / maxReturn`
- muestra estado visual `ACTIVE / READY TO CLAIM / RETIRED`
- muestra boton `Retirar Premio` cuando corresponde
- mantiene la logica existente de `maxFeePerGas` y `maxPriorityFeePerGas`

El modal final on-chain:
- usa la posicion real lograda en la carrera
- ya no tiene botones `OK` ni `CLOSE`
- se autocierra con contador de `5s`

## Runner Phaser actual

Tracks disponibles en `PISTA/src/track-data.js`:
- `test_s_circuit`
- `monza_style_circuit`
- `serpentine_straight_circuit`
- `laguna_ring_circuit`
- `indianapolis_oval`

El trial ya no vuelve automaticamente para enviar la tx.
El flujo actual es:
1. `game.html` abre `PISTA/runner.html`
2. el jugador corre el trial real
3. el popup final del runner muestra la posicion lograda
4. si cumple el limite, aparece `Enviar transaccion`
5. ese boton dispara el submit al parent
6. `game.html` ejecuta `game.race(tokenId, position)`
7. luego muestra el modal final on-chain

Mensajes bridge relevantes:
- `READY`
- `DONE`
- `CLOSE`
- `MICRORACERS_TIME_TRIAL_SUBMIT`

Nota:
- el runner ahora soporta pistas cerradas por vueltas usando la misma integracion del submit final

## Tuning reciente de gameplay

Ya quedaron aplicados estos cambios:
- todos los rivales tienen `+10%` sobre la velocidad asignada en `PISTA/src/main.js`
- el auto del jugador tiene `+7%` adicional de velocidad global sobre su tuning anterior en `PISTA/src/main.js`

## Archivos clave

- dapp principal: `game.html`
- runner HTML: `PISTA/runner.html`
- logica Phaser: `PISTA/src/main.js`
- bridge parent/iframe: `PISTA/src/bridge.js`
- catalogo de pistas: `PISTA/src/track-data.js`
- mensajes del popup final: `PISTA/src/result-messages.js`
- contrato juego: `contracts/game.sol`
- contrato autos: `contracts/autos.sol`
- deploy script: `scripts/deploy-microracers.js`

## Comandos utiles

- levantar servidor local:
  - `npm run serve:track`
- abrir runner directo:
  - `http://127.0.0.1:4173/PISTA/runner.html?track=test_s_circuit&limit=35`
- abrir dapp completa:
  - `http://127.0.0.1:4173/game.html`
- validar runner:
  - `node --check PISTA/src/main.js`
- validar track data:
  - `node --check PISTA/src/track-data.js`
- validar bridge:
  - `node --check PISTA/src/bridge.js`
- compilar contratos:
  - `npx hardhat compile`
- deploy en Amoy:
  - `npx hardhat run scripts/deploy-microracers.js --network amoy`

## Repo remoto

El proyecto publico esta en:
- `https://github.com/Crackill666/microracers-pol_V4`

La version actual ya fue subida a `main`.
Commit subido:
- `0631dc4` -> `Update game economy and racing build`

## Notas importantes para retomar

- este workspace local no tiene `.git`; para subir cambios se uso una copia sincronizada del repo
- `.env` no debe subirse al remoto
- `hardhat.config.js` ya fue ajustado para Hardhat 3 con plugin declarado en `plugins`
- hubo un parche local en `node_modules/hardhat` para evitar un problema de compatibilidad con Node 20 al compilar
- si se cambia de entorno o se reinstala `node_modules`, ese parche podria necesitar rehacerse

## Resumen corto

Hoy el proyecto ya tiene:
- economia nueva de POL acumulado + claim final
- frontend conectado al contrato nuevo
- runner Phaser integrado con posicion real
- modal final autocerrable
- varias pistas activas con tuning especifico
- deploy real en Amoy
- repo de GitHub actualizado
