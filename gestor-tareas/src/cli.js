const t = require('./tareas');

const [orden, ...resto] = process.argv.slice(2);

switch (orden) {
  case 'anadir':
    console.log('Tarea creada con id', t.anadir(resto.join(' ')));
    break;
  case 'completar':
    console.log(t.completar(Number(resto[0])));
    break;
  case 'eliminar':
    t.eliminar(Number(resto[0]));
    console.log('Eliminada');
    break;
  case 'listar':
    for (const tarea of t.pendientes()) {
      console.log(`[${tarea.id}] (p${tarea.prioridad}) ${tarea.texto}`);
    }
    break;
  case 'resumen':
    console.log(t.resumen());
    break;
  default:
    console.log('Uso: node src/cli.js anadir|completar|eliminar|listar|resumen');
}
