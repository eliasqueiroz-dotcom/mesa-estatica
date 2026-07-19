// Copia os assets 3D do dice-box-threejs de node_modules para public/ (que fica fora do git).
// Roda automaticamente no postinstall — um clone limpo + `npm install` deixa tudo pronto.
// Ver .claude/docs/arquitetura.md: usamos dice-box-threejs (não o Babylon dice-box) porque
// ele suporta rolagem forçada nativa (notação `1d20@15`), necessária para o modo determinístico
// do mestre. Os assets são texturas (envmap/superfícies) + sons de impacto.
import { cpSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const origem = join(raiz, 'node_modules', '@3d-dice', 'dice-box-threejs', 'public');
const destino = join(raiz, 'public', 'assets', 'dice-box-threejs');

if (!existsSync(origem)) {
  console.error(`[dice-assets] origem não encontrada: ${origem} — rode npm install primeiro.`);
  process.exit(1);
}

cpSync(origem, destino, { recursive: true });
console.log(`[dice-assets] copiado para ${destino}`);
