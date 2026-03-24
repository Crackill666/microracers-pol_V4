const RESULT_MESSAGE_POOLS = {
  winner: [
    "Eres un piloto excelente.",
    "Victoria impecable, dominaste la carrera.",
    "Primero absoluto, manejo de elite.",
    "Ganaste con autoridad, gran nivel.",
    "P1 merecido, corriste como un campeon.",
    "Tu ritmo fue demoledor, gran triunfo.",
    "Nadie pudo seguirte el paso.",
    "Carrera perfecta, te llevaste todo.",
    "Mostraste reflejos y precision de sobra.",
    "Conduccion brillante, resultado de campeon.",
  ],
  podium: [
    "Bien hecho, ya tienes dominada la pista.",
    "Gran carrera, estuviste entre los mejores.",
    "Muy buen resultado, ritmo de podio.",
    "Se nota que le tomaste la mano al circuito.",
    "Buen trabajo, manejo firme y constante.",
    "Top 3 solido, vas por muy buen camino.",
    "Rendimiento fuerte, casi para pelear la victoria.",
    "Condujiste con criterio, gran resultado.",
    "Muy buena vuelta de carrera, segui asi.",
    "Estuviste fino en los sectores clave.",
  ],
  upperMidfield: [
    "Vas mejorando, pero aun falta pulir detalles.",
    "Buen intento, todavia hay margen para subir.",
    "Aun falta mejorar habilidades, pero vas bien.",
    "Se ven progresos, ahora toca afinar la trazada.",
    "Resultado correcto, aunque hay tiempo por encontrar.",
    "Te acercaste a los de arriba, falta un poco mas.",
    "Hay base, ahora toca ser mas consistente.",
    "Buen esfuerzo, con una vuelta mas limpia subes seguro.",
    "Estas competitivo, pero todavia no alcanza para el podio.",
    "La carrera fue decente, toca mejorar precision.",
  ],
  lowerMidfield: [
    "Aun falta mejorar habilidades.",
    "Todavia queda trabajo para dominar esta pista.",
    "No fue tu mejor carrera, pero sirve para aprender.",
    "Hay que seguir practicando frenadas y salidas.",
    "La base esta, ahora toca ganar consistencia.",
    "Cada intento suma, sigue ajustando tu manejo.",
    "Falto ritmo en varios sectores, a seguir mejorando.",
    "Todavia puedes encontrar mucho tiempo por vuelta.",
    "Necesitas una trazada mas limpia para escalar posiciones.",
    "No te rendiste, eso tambien cuenta.",
  ],
  lastPlace: [
    "Toca seguir practicando, la proxima sera mejor.",
    "Hoy costo, pero cada carrera deja aprendizaje.",
    "No salio como esperabas, vuelve a intentarlo.",
    "Esta pista aun te desafia, pero la vas a dominar.",
    "Hace falta mas ritmo, pero hay margen de mejora.",
    "No fue el resultado ideal, a preparar la revancha.",
    "Cada intento te acerca a una mejor carrera.",
    "La siguiente puede ser muy distinta, sigue empujando.",
    "Cuesta, pero estas construyendo experiencia.",
    "Levanta la cabeza, la mejora llega corriendo.",
  ],
};

function getTier(position, totalRacers) {
  if (position <= 1) return "winner";
  if (position <= 3) return "podium";
  if (position <= 5) return "upperMidfield";
  if (position >= totalRacers) return "lastPlace";
  return "lowerMidfield";
}

export function getRandomResultMessage(position, totalRacers, previousMessage = "") {
  const tier = getTier(position, totalRacers);
  const pool = RESULT_MESSAGE_POOLS[tier];
  if (!pool || pool.length === 0) {
    return "Carrera completada.";
  }

  if (pool.length === 1) {
    return pool[0];
  }

  const available = previousMessage ? pool.filter((message) => message !== previousMessage) : pool;
  const source = available.length ? available : pool;
  return source[Math.floor(Math.random() * source.length)];
}
