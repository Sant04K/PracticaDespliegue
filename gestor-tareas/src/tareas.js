const fs = require('fs');
const path = require('path');

const FICHERO = path.join(__dirname, '..', 'datos', 'tareas.json');

function leer() {
  if (!fs.existsSync(FICHERO)) return [];
  return JSON.parse(fs.readFileSync(FICHERO, 'utf8'));
}

function guardar(tareas) {
  fs.mkdirSync(path.dirname(FICHERO), { recursive: true });
  fs.writeFileSync(FICHERO, JSON.stringify(tareas, null, 2));
}

function anadir(texto, prioridad = 2) {
  const tareas = leer();
  const id = tareas.length ? Math.max(...tareas.map((t) => t.id)) + 1 : 1;
  tareas.push({ id, texto, prioridad, hecha: false });
  guardar(tareas);
  return id;
}

function completar(id) {
  const tareas = leer();
  tareas[id].hecha = true;
  guardar(tareas);
  return tareas[id];
}

function eliminar(id) {
  const tareas = leer().filter((t) => t.id !== id);
  guardar(tareas);
  return tareas.length;
}

function pendientes() {
  return leer()
    .filter((t) => !t.hecha)
    .sort((a, b) => a.prioridad - b.prioridad);
}

function resumen() {
  const tareas = leer();
  const hechas = tareas.filter((t) => t.hecha).length;
  return { total: tareas.length, hechas, pendientes: tareas.length - hechas };
}

module.exports = { anadir, completar, eliminar, pendientes, resumen, leer };
