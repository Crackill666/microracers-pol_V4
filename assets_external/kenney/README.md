## Kenney Assets descargados

Origen oficial:
- https://www.kenney.nl/assets/racing-pack
- https://www.kenney.nl/assets/particle-pack
- https://www.kenney.nl/assets/mobile-controls
- https://www.kenney.nl/assets/pixel-vehicle-pack
- https://www.kenney.nl/assets/road-textures
- https://www.kenney.nl/assets/top-down-tanks-redux

Licencia:
- Los assets de las paginas oficiales de Kenney son `CC0 / public domain`.
- Referencia oficial: https://www.kenney.nl/support

Estructura:
- `zips/`: archivos ZIP originales descargados desde Kenney.
- `kenney_racing-pack/`: pack principal para circuito, props, senales y piezas base.
- `kenney_particle-pack/`: efectos visuales para humo, impactos, polvo, nitro y feedback.
- `mobile-controls-1/`: controles tactiles para movil.
- `kenney_pixel-vehicle-pack/`: vehiculos pixel para prototipos o variantes estilizadas.
- `kenney_road-textures/`: superficies, asfalto y materiales de pista.
- `kenney_top-down-tanks-redux/`: props top-down reutilizables para barreras, obstaculos y decoracion.

Uso sugerido en este proyecto:
- `kenney_racing-pack`
  - Base principal para modulos de pista.
  - Senales, lineas, conos, barreras y decoracion del circuito.
- `kenney_road-textures`
  - Variantes de asfalto, bordes y materiales del tema visual.
- `kenney_particle-pack`
  - Humo de derrape, polvo, choque, meta y feedback arcade.
- `mobile-controls-1`
  - Botones tactiles del runner Phaser para movil.
- `kenney_pixel-vehicle-pack`
  - Vehiculos alternativos o prototipos rapidos.
- `kenney_top-down-tanks-redux`
  - Props top-down, obstaculos, barreras y elementos de ambientacion.

Notas:
- Cada pack incluye su propio `License.txt`.
- Mantener los ZIP originales facilita auditoria y reemplazo futuro.
- Antes de integrarlos al juego conviene crear una capa propia de assets curados en una carpeta nueva, por ejemplo `PISTA/assets_v1/`.
