## Assets V1 curados para Phaser

Esta carpeta contiene una seleccion minima y util de assets para la V1 del runner Phaser.

Objetivo:
- separar el material "listo para integrar" del material bruto descargado
- tener una base estable para prototipar pista, auto, props, controles y FX
- evitar depender directamente de cientos de archivos dispersos en los packs originales

Origen de los packs:
- `assets_external/kenney/kenney_racing-pack`
- `assets_external/kenney/kenney_road-textures`
- `assets_external/kenney/kenney_particle-pack`
- `assets_external/kenney/mobile-controls-1`
- `assets_external/kenney/kenney_pixel-vehicle-pack`
- `assets_external/kenney/kenney_top-down-tanks-redux`

Licencia:
- Todos estos assets provienen de packs oficiales de Kenney descargados dentro del proyecto.
- Segun la pagina oficial de soporte de Kenney, los game assets de sus asset pages son `CC0 / public domain`.
- Referencia: https://www.kenney.nl/support

Estructura:
- `cars/`
  - autos base estilo arcade de `Racing Pack`
  - dos referencias pixel (`formula_pixel`, `kart_pixel`) para exploracion visual
- `controls/`
  - joystick, botones e iconos minimos para UX movil
- `fx/`
  - humo, polvo, chispas, flare y glow
- `props/`
  - barreras, conos, luces, neumaticos, aceite, tiendas, arboles, tribunas y props top-down extra
- `sheets/`
  - spritesheets curados para tiles, objetos y vehiculos
- `terrain/`
  - tilesheets de texturas y terreno para pista

Seleccion pensada para V1:
- pista arcade top-down
- una primera migracion a Phaser
- soporte movil
- visual mas fuerte que la version canvas actual
- base para sistema modular de pistas

Uso sugerido:
- `terrain/` y `sheets/` para construir la base modular de pista
- `props/` para decoracion automatica del circuito
- `cars/` para el prototipo del vehiculo y skins simples
- `fx/` para derrape, choque y meta
- `controls/` para overlay tactil en movil

Nota:
- Esta carpeta no reemplaza los packs originales.
- Si mas adelante necesitamos mas variantes, se agregan desde `assets_external/kenney/` sin mezclar material crudo con material curado.
