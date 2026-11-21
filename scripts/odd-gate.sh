#!/usr/bin/env bash
# Porta de sortida ODD: s'executa com a hook Stop de Claude Code.
# Si les proves fallen, retorna 2 i Claude Code no pot donar la feina per acabada.
# En acabar, actualitza el tauler de control amb els resultats que s'acaben d'obtenir.
set -uo pipefail

input="$(cat || true)"

# Evita bucles: si Claude Code ja està continuant per culpa d'aquest hook, no el tornis a bloquejar.
if printf '%s' "$input" | grep -q '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/..}" || exit 0

# Encara no hi ha projecte TypeScript: res a comprovar.
if [ ! -f package.json ]; then
  exit 0
fi

if ! grep -q '"check"' package.json; then
  echo "ODD: falta l'script \"check\" a package.json (ha d'executar Vitest i Playwright)." >&2
  exit 2
fi

if [ ! -d node_modules ]; then
  echo "ODD: falten les dependències. Executa npm install." >&2
  exit 2
fi

if ! output="$(npm run --silent check 2>&1)"; then
  node scripts/tauler.mjs --silenci >/dev/null 2>&1 || true
  echo "ODD: les proves no passen. No es pot donar la feina per acabada fins que passin." >&2
  printf '%s\n' "$output" | tail -n 60 >&2
  exit 2
fi

node scripts/tauler.mjs --silenci >/dev/null 2>&1 || true
exit 0
