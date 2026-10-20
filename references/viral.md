# Cómo hacer un video viral (guía de la herramienta, 20-oct-2026)

Investigación en `references/viral.md` (este archivo) — fuentes: Ayuda de YouTube Shorts, TikTok Newsroom y guía de
anuncios (63 % de los anuncios con más clics dan el mensaje en 3 s), Mosseri/Instagram (ene-2025: tiempo visto,
likes por alcance y ENVÍOS por DM por alcance), Todd Sherman/YouTube. [Oficial] vs. [Práctica de creadores].
Lo revisa solo `python -m motocine viral projects/x` (también corre con `stills` y `render`).

## Lo que mide el algoritmo
1. Tiempo visto / video completo (lo que más pesa en las tres plataformas) [Oficial].
2. "Visto vs. pasado" en los primeros segundos (YouTube lo muestra) [Oficial].
3. Envíos por DM (Instagram: la señal más ligada a llegar a no seguidores) [Oficial].
4. Repeticiones (YouTube cuenta cada repetición como vista desde mar-2025), guardados y comentarios.
5. Contenido original: subir el archivo limpio a cada red (sin marca de agua de otra app).

## Gancho (0–3 s)
- Texto grande en el cuadro 0 (≤ 7 palabras), movimiento en el cuadro 0, voz antes de 0,5 s, sin logo ni intro.
- Nombrar el problema (o la moto: NS200, Pulsar, AKT, Yamaha, 125 cc) en la primera frase.
- Tipos: advertencia ("¡No prendas tu moto así!", el mejor medido: 64/100), pregunta directa, curiosidad
  ("una pieza de $8.000 que daña un motor de $3 millones"), contradicción ("lavar la cadena con gasolina la mata"),
  resultado primero, POV ("POV: eres domiciliario y…"), reto ("solo 1 de cada 10 adivina…"), número específico,
  objeto raro en pantalla.

## Retención (30 s)
0–3 gancho (pregunta abierta) → 3–8 lo que está en juego ("$400 mil de taller") → 8–22 dos o tres revelaciones
de menor a mayor ("pero lo peor…") → 22–28 la respuesta prometida → 28–32 cierre / bucle.
Cambio visual cada 1,5–3 s · 2,5–3,2 palabras/s · frases ≤ 12 palabras · una sola idea · 20–35 s.

## Cierre
- Pregunta concreta y fácil: "comenta tu letra", "¿cada cuántos km?", "¿Pulsar o NS? 1 o 2".
- "Guárdalo para tu próximo cambio de aceite" (listas, datos) · "Mándaselo al parcero que…" (envíos = alcance).
- BUCLE: la última frase empalma con la primera ("…y escucha otra vez." → "Escucha este ruido.").

## Formatos (receta en paréntesis)
1. Adivina la falla por el sonido (`adivina`) · 2. Esto pasa si… (consecuencia) · 3. ¿Cuánto cuesta? / lo que te
ahorras · 4. POV del domiciliario · 5. Ranking del 5 al 1 (el 1 al final) · 6. Mito o realidad (quiz) ·
7. Lo que el mecánico ve y tú no (`mecanico`) · 8. 3 señales de que… (`lista`) · 9. Error vs. correcto ·
10. Pregúntale al mecánico (responder un comentario real).

## Contexto Colombia
1,1 millones de motos vendidas en 2025; 52 % de los registros (may-2025) son 101–125 cc: incluir motos de 125.
Domiciliarios: el bolsillo y "quedarse varado con el pedido" duelen. Términos del taller colombiano (`guion.md`).

## Medir después de publicar
% que sigue al segundo 3, % que ve completo, envíos y guardados por video. Lo que gane, se repite.
