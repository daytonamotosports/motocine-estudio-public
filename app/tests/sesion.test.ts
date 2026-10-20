// Pruebas de la galleta de sesión (HMAC-SHA256 del PIN).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { cookieSesion, firmaSesion, iguales, leerCookie, sesionValida } from "../src/lib/logic/sesion.ts";

test("la firma es HMAC-SHA256(PIN, 'sesion') en hexadecimal", async () => {
  assert.equal(await firmaSesion("4321"), createHmac("sha256", "4321").update("sesion").digest("hex"));
});

test("sesión válida solo con la galleta del mismo PIN", async () => {
  const firma = await firmaSesion("4321");
  assert.ok(await sesionValida(`otra=1; mc_sesion=${firma}`, "4321"));
  assert.ok(!(await sesionValida(`mc_sesion=${firma}`, "9999")), "si cambian el PIN, la sesión vieja ya no sirve");
  assert.ok(!(await sesionValida("", "4321")));
  assert.ok(!(await sesionValida(`mc_sesion=${firma}`, "")));
});

test("galleta segura", () => {
  const c = cookieSesion("abc");
  for (const parte of ["HttpOnly", "Secure", "SameSite=Lax", "Max-Age=2592000", "Path=/"]) assert.ok(c.includes(parte), parte);
  assert.equal(leerCookie("a=1; mc_sesion=abc=def"), "abc=def");
  assert.ok(iguales("abc", "abc") && !iguales("abc", "abd") && !iguales("abc", "ab"));
});
