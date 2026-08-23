import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Só `src/` — mesmo escopo do `tsconfig.json` (`include: ["src"]`), que já cobre esse código
// com `strict`/`noUnusedLocals`/`noUnusedParameters`. `supabase/functions/` é Deno (globals e
// imports por URL que não existem aqui) e `scripts/`/configs da raiz já são validados por
// `tsconfig.node.json` no build — não vale a complexidade de mais um bloco de config pra isso.
export default tseslint.config(
  // `.claude/worktrees/<nome>/` é um checkout completo do repo — sem excluir, o glob
  // `src/**/*.{ts,tsx}` (sem `/` na frente) casa em qualquer profundidade e pega o `src/` de
  // dentro do worktree também, dois `tsconfigRootDir` candidatos pro parser de TS (mesmo achado
  // que já forçou o exclude equivalente em `vite.config.ts` pro vitest).
  { ignores: ['dist', 'node_modules', 'supabase/functions', '.claude/worktrees'] },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      // Só as duas regras clássicas (`rules-of-hooks`/`exhaustive-deps`) — o `recommended` do
      // plugin v7 vem com o pacote novo de regras do React Compiler (purity, refs,
      // set-state-in-effect...), pensado pra código que vai passar pelo compiler. Aplicado
      // retroativo num código estável e testado, essas regras acusam padrões intencionais
      // (ex.: `ref.current = valor` direto no corpo do componente pra manter uma ref sempre
      // atualizada sem efeito, usado de propósito em `tokens3d/TokenScene.tsx`) como erro.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // tsc (strict + noUnusedLocals/noUnusedParameters) já pega isso — duplicar aqui só dá
      // dois avisos pro mesmo problema.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    // Teste legitimamente precisa construir fixture inválida de propósito (campo faltando,
    // shape de versão antiga) pra testar código defensivo (migrate/normalizar) — TypeScript
    // não deixa montar isso sem `any`/`as any`. Mesmo raciocínio de `migrate()` em store.ts,
    // só que concentrado aqui em vez de eslint-disable espalhado por cada fixture.
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
