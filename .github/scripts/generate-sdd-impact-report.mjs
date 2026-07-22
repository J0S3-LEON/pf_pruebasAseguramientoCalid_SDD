import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const [base, head, output = 'sdd-change-impact-report.md'] = process.argv.slice(2);
if (!base || !head) {
  console.error('Usage: node generate-sdd-impact-report.mjs <base> <head> [output]');
  process.exit(2);
}

const specRoot = '.kiro/specs/';
const requirementPath = '.kiro/specs/mindflow/requirements.md';
const traceabilityPath = '.kiro/specs/mindflow/traceability.md';

function git(args, fallback = '') {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trimEnd();
  } catch {
    return fallback;
  }
}

function fileAt(ref, path) {
  return git(['show', `${ref}:${path}`], '');
}

function canonical(group, criterion) {
  return `REQ-${group}.${criterion}`;
}

function parseRequirements(content) {
  const result = new Map();
  let group = null;
  for (const line of content.split(/\r?\n/)) {
    const heading = line.match(/^###\s+Requisito\s+(\d+)\s*:/i);
    if (heading) {
      group = heading[1];
      continue;
    }
    const criterion = group && line.match(/^\s*(\d+)\.\s+(.+)$/);
    if (criterion) result.set(canonical(group, criterion[1]), criterion[2].trim());
  }
  return result;
}

function extractReferences(text) {
  const ids = new Set();
  for (const match of text.matchAll(/REQ-(\d+)\.(\d+)/gi)) ids.add(canonical(match[1], match[2]));
  for (const match of text.matchAll(/Requisitos?\s*:?\s*(\d+(?:\.\d+)?(?:\s*[,–-]\s*\d+(?:\.\d+)?)*)/gi)) {
    for (const token of match[1].match(/\d+\.\d+/g) ?? []) {
      const [group, criterion] = token.split('.');
      ids.add(canonical(group, criterion));
    }
  }
  return ids;
}

const changedText = git(['diff', '--name-status', base, head, '--', specRoot]);
const changedFiles = changedText
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [status, ...parts] = line.split(/\s+/);
    return { status, path: parts.at(-1) };
  });
const diff = git(['diff', '--unified=1', base, head, '--', specRoot]);

const oldRequirements = parseRequirements(fileAt(base, requirementPath));
const newRequirements = parseRequirements(fileAt(head, requirementPath));
const changes = [];
for (const [id, text] of newRequirements) {
  if (!oldRequirements.has(id)) changes.push({ id, type: 'Nuevo', oldText: '', newText: text });
  else if (oldRequirements.get(id) !== text) {
    changes.push({ id, type: 'Modificado', oldText: oldRequirements.get(id), newText: text });
  }
}
for (const [id, text] of oldRequirements) {
  if (!newRequirements.has(id)) changes.push({ id, type: 'Eliminado', oldText: text, newText: '' });
}

const nonRequirementDiff = changedFiles
  .filter((file) => file.path !== requirementPath)
  .map((file) => git(['diff', '--unified=0', base, head, '--', file.path]))
  .join('\n');
const referencedIds = extractReferences(nonRequirementDiff);
for (const id of referencedIds) {
  if (!changes.some((change) => change.id === id)) {
    changes.push({ id, type: 'Referencia modificada', oldText: '', newText: 'Cambio detectado en diseño, tareas o trazabilidad.' });
  }
}

const traceability = (() => {
  try { return readFileSync(traceabilityPath, 'utf8'); } catch { return ''; }
})();
const traceRows = traceability.split(/\r?\n/).filter((line) => line.startsWith('| REQ-'));

function rowFor(id) {
  const [groupText, criterionText] = id.replace('REQ-', '').split('.');
  const group = Number(groupText);
  const criterion = Number(criterionText);
  return traceRows.find((row) => {
    const range = row.match(/REQ-(\d+)\.(\d+)[–-]REQ-(\d+)\.(\d+)/);
    if (range) {
      return group === Number(range[1]) && group === Number(range[3]) &&
        criterion >= Number(range[2]) && criterion <= Number(range[4]);
    }
    return row.includes(`| ${id} |`);
  });
}

const missingTraceability = changes.filter((change) => !rowFor(change.id));
const impact = new Map([
  ['Arquitectura', []], ['Base de datos', []], ['Backend', []],
  ['Frontend', []], ['API', []], ['Pruebas', []], ['Documentación', []],
]);
for (const change of changes) {
  const row = rowFor(change.id);
  for (const area of impact.keys()) {
    if (row?.toLowerCase().includes(area.toLowerCase())) impact.get(area).push(change.id);
  }
}

const statusNames = { A: 'Agregado', M: 'Modificado', D: 'Eliminado', R: 'Renombrado' };
const lines = [
  '# SDD Change Impact Report', '',
  `> Generado automáticamente para \`${base}\` → \`${head}\`.`, '',
  '## Cambio detectado', '',
  ...(changedFiles.length
    ? changedFiles.map((file) => `- ${statusNames[file.status[0]] ?? file.status}: \`${file.path}\``)
    : ['- No se detectaron cambios dentro de `.kiro/specs/**`.']), '',
  '## Requerimiento afectado', '',
  '| ID | Tipo | Comportamiento anterior | Comportamiento nuevo |',
  '| --- | --- | --- | --- |',
  ...(changes.length
    ? changes.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })).map((change) =>
      `| ${change.id} | ${change.type} | ${change.oldText.replaceAll('|', '\\|') || '—'} | ${change.newText.replaceAll('|', '\\|') || '—'} |`)
    : ['| — | Sin cambios identificables | — | — |']), '',
  '## Tipo de cambio', '',
  `- Nuevos: ${changes.filter((item) => item.type === 'Nuevo').length}`,
  `- Modificados: ${changes.filter((item) => item.type === 'Modificado').length}`,
  `- Eliminados: ${changes.filter((item) => item.type === 'Eliminado').length}`,
  `- Referencias modificadas: ${changes.filter((item) => item.type === 'Referencia modificada').length}`, '',
  '## Impacto', '',
];
for (const [area, ids] of impact) {
  lines.push(`### ${area}`, '', ids.length ? `Revisar: ${[...new Set(ids)].join(', ')}.` : 'Sin impacto identificado automáticamente.', '');
}
lines.push('## Trazabilidad', '');
if (missingTraceability.length) {
  lines.push(`**TRAZABILIDAD INCOMPLETA:** ${missingTraceability.map((item) => item.id).join(', ')}.`, '');
} else {
  lines.push(changes.length ? 'Todos los requisitos detectados tienen una entrada en la matriz.' : 'No hubo requisitos que validar.', '');
}
for (const change of changes) {
  const row = rowFor(change.id);
  if (row) lines.push(`- ${change.id}: ${row.split('|').slice(2, 6).map((cell) => cell.trim()).join(' · ')}`);
}
lines.push('', '## Acciones requeridas', '',
  '- [ ] Confirmar que el cambio es inequívoco.',
  '- [ ] Revisar y actualizar diseño, tareas y trazabilidad.',
  '- [ ] Actualizar primero las pruebas que representan el requisito.',
  '- [ ] Implementar el cambio únicamente después del análisis.',
  '- [ ] Ejecutar pruebas afectadas y regresión.',
  '- [ ] Revisar documentación, compatibilidad, migración y despliegue.', '',
  '## Diff de especificaciones', '', '<details>', '<summary>Mostrar diff</summary>', '', '```diff',
  diff || '# Sin diferencias', '```', '', '</details>', '');

writeFileSync(output, `${lines.join('\n')}\n`, 'utf8');
console.log(`Report written to ${output}`);
if (missingTraceability.length) process.exitCode = 1;
