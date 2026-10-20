// Íconos vectoriales simples. Se dibujan centrados en (0,0) dentro de un
// círculo de ~34 px de radio (escala 1). Para íconos grandes usar drawIcon(nombre, escala).
'use strict';

const ICONS = {
  check() { x.strokeStyle = '#fff'; x.lineWidth = 9; x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); x.moveTo(-16, 2); x.lineTo(-4, 15); x.lineTo(18, -12); x.stroke(); },
  cross() { x.strokeStyle = '#fff'; x.lineWidth = 9; x.lineCap = 'round'; x.beginPath(); x.moveTo(-13, -13); x.lineTo(13, 13); x.moveTo(13, -13); x.lineTo(-13, 13); x.stroke(); },
  down() { x.fillStyle = '#fff'; x.fillRect(-6, -18, 12, 20); x.beginPath(); x.moveTo(-17, 0); x.lineTo(17, 0); x.lineTo(0, 19); x.closePath(); x.fill(); },
  up() { x.save(); x.rotate(Math.PI); ICONS.down(); x.restore(); },
  book() { x.strokeStyle = '#fff'; x.lineWidth = 5; x.lineJoin = 'round'; x.beginPath(); x.moveTo(0, -12); x.lineTo(-19, -17); x.lineTo(-19, 15); x.lineTo(0, 20); x.lineTo(19, 15); x.lineTo(19, -17); x.closePath(); x.moveTo(0, -12); x.lineTo(0, 20); x.stroke(); },
  cycle() {
    x.strokeStyle = '#fff'; x.lineWidth = 6; x.lineCap = 'round';
    x.beginPath(); x.arc(0, 0, 16, -2.6, 0.2); x.stroke(); x.beginPath(); x.arc(0, 0, 16, 0.55, 3.35); x.stroke();
    x.fillStyle = '#fff'; x.beginPath(); x.moveTo(16, 8); x.lineTo(24, -6); x.lineTo(8, -4); x.closePath(); x.fill();
    x.beginPath(); x.moveTo(-16, -8); x.lineTo(-24, 6); x.lineTo(-8, 4); x.closePath(); x.fill();
  },
  warning() {
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.lineJoin = 'round';
    x.beginPath(); x.moveTo(0, -19); x.lineTo(20, 16); x.lineTo(-20, 16); x.closePath(); x.stroke();
    x.fillStyle = '#fff'; x.fillRect(-2.5, -7, 5, 12); x.fillRect(-2.5, 8, 5, 4);
  },
  wrench() {
    x.save(); x.rotate(-0.8); x.fillStyle = '#fff';
    x.fillRect(-4, -4, 30, 8);
    x.beginPath(); x.arc(-10, 0, 12, 0, 7); x.fill();
    x.fillStyle = TH.primary; x.fillRect(-26, -4, 14, 8);
    x.restore();
  },
  clock() {
    x.strokeStyle = '#fff'; x.lineWidth = 5; x.lineCap = 'round';
    x.beginPath(); x.arc(0, 0, 18, 0, 7); x.stroke();
    x.beginPath(); x.moveTo(0, 0); x.lineTo(0, -11); x.moveTo(0, 0); x.lineTo(8, 5); x.stroke();
  },
  drop() {
    x.fillStyle = '#fff';
    x.beginPath(); x.moveTo(0, -20); x.bezierCurveTo(8, -6, 15, 2, 15, 9); x.arc(0, 9, 15, 0, Math.PI); x.bezierCurveTo(-15, 2, -8, -6, 0, -20); x.closePath(); x.fill();
  },
  thermometer() {
    x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineWidth = 4;
    rrect(-6, -20, 12, 28, 6); x.stroke(); x.beginPath(); x.arc(0, 12, 9, 0, 7); x.fill(); x.fillRect(-2, -6, 4, 16);
  },
  gear() {
    x.fillStyle = '#fff';
    for (let i = 0; i < 8; i++) { x.save(); x.rotate(i * Math.PI / 4); x.fillRect(-4, -21, 8, 9); x.restore(); }
    x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill(); x.fillStyle = TH.primary; x.beginPath(); x.arc(0, 0, 6, 0, 7); x.fill();
  },
  bolt() { x.fillStyle = '#fff'; x.beginPath(); x.moveTo(4, -20); x.lineTo(-11, 3); x.lineTo(0, 3); x.lineTo(-4, 20); x.lineTo(11, -3); x.lineTo(0, -3); x.closePath(); x.fill(); },
  oil_can() { x.save(); x.scale(.16, .16); oilCanShape(0, 0, 1, 0, 26); x.restore(); },
};

function drawIcon(name, s = 1) {
  const f = ICONS[name] || ICONS.check;
  x.save(); x.scale(s, s); f(); x.restore();
}

// aceitera estilo testigo del tablero (también sirve como ícono grande)
function oilCanShape(cx, cy, s, fillA, lw = 13) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.lineJoin = 'round'; x.lineCap = 'round';
  x.beginPath();
  x.moveTo(-110, -10); x.lineTo(40, -10); x.lineTo(150, -55); x.lineTo(162, -40); x.lineTo(60, 40); x.lineTo(50, 60); x.lineTo(-110, 60); x.closePath();
  if (fillA > 0) { x.fillStyle = rgba(TH.accent, fillA); x.fill(); }
  x.strokeStyle = '#fff'; x.lineWidth = lw; x.stroke();
  x.beginPath(); x.moveTo(-60, -10); x.lineTo(-60, -32); x.lineTo(-25, -32); x.lineTo(-25, -10); x.stroke();
  x.beginPath(); x.moveTo(-110, 5); x.lineTo(-165, -25); x.lineTo(-165, 25); x.lineTo(-110, 45); x.stroke();
  x.restore();
}
function oilDrop(cx, cy, s, a) {
  x.save(); x.translate(cx, cy); x.scale(s, s); x.globalAlpha *= a;
  x.beginPath(); x.moveTo(0, -30); x.bezierCurveTo(10, -10, 22, 2, 22, 14); x.arc(0, 14, 22, 0, Math.PI); x.bezierCurveTo(-22, 2, -10, -10, 0, -30); x.closePath();
  x.fillStyle = TH.oil; x.fill(); x.restore();
}

// ícono grande para escenas de título: nombre de ICONS (se dibuja en círculo) o 'oil_can'
function heroIcon(name, cx, cy, scale, alert) {
  if (name === 'oil_can') { oilCanShape(cx - 20, cy, 1.75 * scale, alert ? .9 * alert : 0); return; }
  if (name === 'none' || !name) return;
  x.save(); x.translate(cx, cy); x.scale(scale, scale);
  x.fillStyle = alert ? rgba(TH.accent, .35 + .65 * alert) : TH.primary;
  x.beginPath(); x.arc(0, 0, 170, 0, 7); x.fill();
  x.strokeStyle = '#fff'; x.lineWidth = 10; x.stroke();
  drawIcon(name, 4.2);
  x.restore();
}
