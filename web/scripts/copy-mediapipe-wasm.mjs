import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const targetDir = join(root, 'public', 'mediapipe', 'wasm');

const files = [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
];

if (!existsSync(sourceDir)) {
  console.error(
    `[mediapipe] No se encontró ${sourceDir}. Ejecuta 'npm install' primero.`,
  );
  process.exit(1);
}

mkdirSync(targetDir, { recursive: true });

for (const file of files) {
  copyFileSync(join(sourceDir, file), join(targetDir, file));
}

console.log(
  `[mediapipe] WASM copiado a public/mediapipe/wasm (${files.length} archivos).`,
);