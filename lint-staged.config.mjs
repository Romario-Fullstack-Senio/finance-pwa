/**
 * Pre-commit (husky → `npx lint-staged`).
 * - ESLint solo sobre los archivos del commit.
 * - Las pruebas corren una vez por commit: la función evita que lint-staged
 *   agregue los archivos como argumentos (`ng lint`/`ng test` no los aceptan).
 */
export default {
  '*.{ts,html}': 'eslint',
  '*.{ts,html,css}': () => 'ng test --watch=false',
};
