// Pruebas de los archivos subidos: claves seguras y enlaces firmados (?t=)
// para que el robot los baje sin la galleta de sesión.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { claveArchivo, claveValida, firmaArchivo, firmaArchivoValida, nombreSeguro, seccionArchivos, urlArchivo } from "../src/lib/logic/archivos.ts";
import { cuerpoPedido, validarPedido } from "../src/lib/logic/pedido.ts";

const CLAVE = "subidas/20261020-112455-k3x9-foto-moto.jpg";

test("nombres y claves seguras", () => {
  assert.equal(nombreSeguro("Foto Moto (1).JPG"), "foto-moto-1.jpg");
  assert.equal(nombreSeguro("../../etc/passwd"), "etc-passwd");
  assert.equal(nombreSeguro("Cañón ñandú.mp4"), "canon-nandu.mp4");
  assert.equal(nombreSeguro(""), "archivo");
  // 16:24:55 UTC = 11:24:55 en Bogotá
  assert.equal(claveArchivo("Foto Moto.jpg", new Date("2026-10-20T16:24:55Z"), "k3x9"), CLAVE);
  assert.ok(claveValida(CLAVE));
  assert.ok(claveValida(claveArchivo("video final.MOV")));
  for (const mala of ["subidas/../x", "otra/20261020-112455-k3x9-a.jpg", "subidas/x.jpg", 5, null]) assert.ok(!claveValida(mala), String(mala));
});

test("la firma es HMAC-SHA256(PIN, 'archivo:' + clave), distinta de la de sesión", async () => {
  const t = await firmaArchivo("2468", CLAVE);
  assert.equal(t, createHmac("sha256", "2468").update(`archivo:${CLAVE}`).digest("hex"));
  assert.notEqual(t, createHmac("sha256", "2468").update("sesion").digest("hex"));
  assert.ok(await firmaArchivoValida("2468", CLAVE, t));
  assert.ok(!(await firmaArchivoValida("2468", CLAVE.replace("foto", "otra"), t)), "la firma sirve solo para ese archivo");
  assert.ok(!(await firmaArchivoValida("9999", CLAVE, t)), "si cambia el PIN, el enlace deja de servir");
  assert.ok(!(await firmaArchivoValida("2468", CLAVE, null)));
});

test("enlace firmado y sección del pedido", async () => {
  const u = await urlArchivo("https://motocine.ejemplo.co/", CLAVE, "2468");
  assert.equal(u, `https://motocine.ejemplo.co/api/archivos/${CLAVE}?t=${await firmaArchivo("2468", CLAVE)}`);
  assert.equal(seccionArchivos([]), "");
  const r = validarPedido({ falla: "cadena", archivos: [CLAVE, CLAVE] });
  assert.ok("pedido" in r);
  assert.deepEqual(r.pedido.archivos, [CLAVE]);
  assert.match(cuerpoPedido(r.pedido, [u]), /### Nombre del video \(opcional\)\n\n_No response_\n\n### Archivos\n\nhttps:\/\/motocine\.ejemplo\.co\/api\/archivos\/subidas\/.+\?t=[0-9a-f]{64}$/);
  assert.ok(!cuerpoPedido(r.pedido).includes("Archivos"), "sin archivos, el cuerpo queda igual al formulario");
  assert.ok("error" in validarPedido({ falla: "cadena", archivos: ["subidas/../../x"] }));
  assert.ok("error" in validarPedido({ falla: "cadena", archivos: "no" }));
});
