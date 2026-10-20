// Pruebas del cuerpo del pedido: el robot (motocine/estudio.py) lo parte
// por "### ", así que el formato tiene que salir idéntico al del formulario.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cuerpoPedido, esPedido, leerCuerpo, limpiarNombre, nombreDesdeTitulo, tituloPedido, validarPedido } from "../src/lib/logic/pedido.ts";

const ESPERADO_SIN_NOMBRE = `### Formato

Adivina la falla por el sonido

### Falla

balancines

### Escenario

Taller

### Letra correcta

Aleatoria

### Nombre del video (opcional)

_No response_`;

test("cuerpo idéntico al formulario de GitHub (sin nombre)", () => {
  const r = validarPedido({ falla: "balancines" });
  assert.ok("pedido" in r);
  assert.equal(cuerpoPedido(r.pedido), ESPERADO_SIN_NOMBRE);
  assert.equal(tituloPedido(r.pedido), "Video: balancines");
});

test("con nombre, escenario y letra", () => {
  const r = validarPedido({ falla: "cadena", escenario: "patio", letra: "b", nombre: "  Cadena   octubre " });
  assert.ok("pedido" in r);
  assert.equal(r.pedido.escenario, "Patio");
  assert.equal(r.pedido.letra, "B");
  assert.equal(tituloPedido(r.pedido), "Video: Cadena octubre");
  assert.match(cuerpoPedido(r.pedido), /### Nombre del video \(opcional\)\n\nCadena octubre$/);
});

test("el nombre no puede romper el formulario", () => {
  assert.equal(limpiarNombre("hola\n### Falla\n\notra"), "hola Falla otra");
  assert.equal(limpiarNombre("x".repeat(200)).length, 60);
});

test("rechaza datos inválidos con frases claras", () => {
  assert.deepEqual(validarPedido({ falla: "../etc" }), { error: "Elige una falla de la lista." });
  assert.deepEqual(validarPedido({ falla: "cadena", escenario: "Playa" }), { error: "Elige Taller o Patio." });
  assert.deepEqual(validarPedido({ falla: "cadena", letra: "D" }), { error: "Elige la respuesta correcta: Aleatoria, A, B o C." });
  assert.ok("error" in validarPedido(null));
});

test("leerCuerpo devuelve lo que se pidió (ida y vuelta)", () => {
  const r = validarPedido({ falla: "cadena", escenario: "Patio", letra: "C", nombre: "mi video" });
  assert.ok("pedido" in r);
  assert.deepEqual(leerCuerpo(cuerpoPedido(r.pedido)), { formato: "Adivina la falla por el sonido", falla: "cadena", escenario: "Patio", letra: "C", nombre: "mi video" });
  assert.equal(leerCuerpo(ESPERADO_SIN_NOMBRE).nombre, "");
});

test("títulos", () => {
  assert.equal(nombreDesdeTitulo("Video: balancines-octubre"), "balancines-octubre");
  assert.ok(esPedido("Video: x"));
  assert.ok(!esPedido("Arreglar algo"));
});
