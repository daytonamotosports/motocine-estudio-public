# Cómo escribir el guion y armar las escenas

## Estructura de 30 segundos
| Tramo | Segundos | Qué pasa | Escena típica |
|---|---|---|---|
| Gancho | 0–3 | Pregunta o dato que detiene el scroll | `title` |
| Explicación | 3–22 | Cómo funciona / qué pasa (una idea por escena) | `engine_cutaway`, `oil_film`, `gauge`, `dry_friction`, `photo` |
| Aprendizaje | 22–27 | Qué debe hacer la persona | `checklist`, `sight_glass` |
| Cierre | 27–30 | Frase corta + marca | `outro` |

## Narración
- **55–75 palabras** para 30 s con la voz Gonzalo a velocidad normal (≈ 2.8 palabras/s).
  Si `check` avisa que la voz se pasa del video, recorta texto o usa `"rate": "+6%"`.
- Español latinoamericano neutro, tuteo, frases cortas. Nada de "vosotros" ni modismos de España.
- Público de Colombia: usar los términos del taller colombiano (pedido del usuario, 20-oct): "en mínima" (no "en
  mínimo"), "tanqueada", "bujía", "llantas lisas". Si dudas de un término, pregúntale al usuario.
- El gancho no puede contradecir el contenido: si el video termina revisando el motor, no abras con "no es el
  motor" (usa "no es lo que crees").
- Evita palabras que suenan a otras ("delata" se oye "de lata") y pegues ("suena en mínimo" → "suenen mínimo").
- Escribe los números como se dicen si importa la sincronía ("ocho mil", no "8.000").
- Evita palabras que el motor de voz pronuncie mal; si una falla, cámbiala por un sinónimo o escríbela separada.
- Termina con una frase de cierre con fuerza ("Tu motor te lo va a agradecer").

## Exactitud técnica (obligatorio)
- Verifica cada afirmación mecánica con el manual del fabricante o fuentes técnicas serias.
- No conviertas simplificaciones en reglas universales: di "como indica tu manual" en vez de cifras fijas
  (intervalos de cambio, presiones, viscosidades) salvo que el video sea para un modelo concreto.
- Los números ilustrativos (contador de RPM, medidores) deben ser realistas y presentarse como ilustración.

## Del guion a las escenas
1. Escribe la narración en `video.json`.
2. `python -m motocine words projects/<slug>` → genera la voz y lista cada palabra con su segundo.
3. Asigna una escena a cada idea y ánclala a la palabra donde empieza esa idea (`"start": "Adentro-0.25"`).
   Adelanta 0.15–0.3 s el inicio de escena para que la imagen llegue un poco antes que la palabra.
4. Ancla cada etiqueta/insignia a la palabra que la nombra (`"at": "cigüeñal"`).
5. `python -m motocine check ...` → corrige advertencias (anclas repetidas: usa `#2`, `#3`).
6. `python -m motocine stills ...` → revisa un cuadro por escena **antes** del render completo.
7. `python -m motocine render ...` → video + hoja de contacto + reporte de calidad.

## Reglas visuales
- Una idea visual fuerte por escena; las etiquetas aparecen cuando la voz las nombra, no antes.
- Máximo 2 insignias a la vez en pantalla; textos de insignias de 2–4 palabras en MAYÚSCULAS.
- Zona segura de Reels/TikTok/Shorts: la app tapa los ~350 px de abajo (usuario y descripción), la
  columna derecha entre y≈900 y y≈1600 (botones) y los ~130 px de arriba. Por eso los subtítulos van en
  y≈1400 (con fondo oscuro suave), el logo arriba a la derecha (y≈300) y nada importante debajo de
  y=1440 (TikTok tapa ~480 px abajo con el nombre y la descripción).
- No uses marcas, logos o diseños de terceros. No copies videos de otros creadores.
