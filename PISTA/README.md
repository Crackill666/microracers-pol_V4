# Phaser Track V1

Esta carpeta ya incluye una primera pista jugable en Phaser.

## Como probarla

1. Ejecuta `npm run serve:track`
2. Abre `http://127.0.0.1:4173/PISTA/runner.html?track=test_s_circuit&limit=35`

Tambien podes abrir la dapp completa en:

- `http://127.0.0.1:4173/game.html`

## Controles

- `W` o `ArrowUp`: acelerar
- `S` o `ArrowDown`: frenar
- `A` o `ArrowLeft`: girar izquierda
- `D` o `ArrowRight`: girar derecha
- En movil: botones tactiles en pantalla

## Que incluye esta version

- Runner Phaser local en `PISTA/runner.html`
- Una pista de prueba `test_s_circuit`
- Checkpoints en orden
- Countdown, cronometro y limite de tiempo
- Feedback visual con particulas
- Integracion con `game.html` mediante `postMessage`

## Archivos principales

- `PISTA/runner.html`
- `PISTA/src/main.js`
- `PISTA/src/bridge.js`
- `PISTA/src/track-data.js`
- `PISTA/vendor/phaser.min.js`

## Nota

Esta es la primera base jugable. La parte modular/generativa de pistas todavia no esta implementada; la pista actual es una referencia para validar:

- look and feel
- control del auto
- HUD
- bridge con la dapp
