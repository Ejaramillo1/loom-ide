#!/usr/bin/env bash
# Juez de Loom IDE: tarea -> prompt -> opencode run -> verificación -> veredicto.
# Uso: run-judge.sh <archivo-de-tarea>
# La tarea es texto plano con las palabras de Eduardo. El prompt construido
# queda en /home/ed/judge/runs/<fecha>.prompt.md, el registro completo en
# runs/<fecha>.log y el veredicto en verdicts/<fecha>.md.
#
# IMPORTANTE: ejecútalo desde la terminal del portátil, o desacoplado con
# nohup. NO lo ejecutes a través del shell del harness (mata los trabajos
# a los ~120 s y una pasada de OpenCode dura mucho más).
#
# BORRADOR: antes de confiar en él, comprobar en el portátil:
#   opencode --version
#   una pasada corta con una tarea pequeña.
set -u
REPO=/home/ed/loom-ide-tauri
JUDGE=/home/ed/judge
TASK=${1:?uso: run-judge.sh <archivo-de-tarea>}
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$JUDGE/verdicts" "$JUDGE/runs"
PROMPT=$JUDGE/runs/$STAMP.prompt.md
LOG=$JUDGE/runs/$STAMP.log
VERDICT=$JUDGE/verdicts/$STAMP.md

command -v opencode >/dev/null 2>&1 || { echo "opencode no está instalado" >&2; exit 1; }
[ -f "$TASK" ] || { echo "no existe el archivo de tarea: $TASK" >&2; exit 1; }
BASE=$(git -C "$REPO" rev-parse --short HEAD)

{
  echo "# Tarea para OpenCode — $STAMP"
  echo
  echo "Trabajas en $REPO, rama tauri-prototype, HEAD $BASE."
  echo "Lee AGENTS.md en la raíz del repo y síguelo: no hagas preguntas, decide según los docs, verifica con comandos reales, commits locales solamente, nunca push."
  echo
  echo "## Tarea (palabras de Eduardo)"
  echo
  cat "$TASK"
  echo
  echo "## Criterio de aceptación"
  echo
  echo "- npm test -- --run, npm run build, cargo test (lib y native-app) y cargo fmt --check deben pasar."
  echo "- Unity recompile sin errores y CheckWorkbench en Play Mode en verde."
  echo "- Al terminar, commitea localmente (un commit lógico por paso) e informa: archivos cambiados con SHAs, resultados de verificación con números, decisiones tomadas y qué queda."
} > "$PROMPT"

{
  echo "Juez — inicio $STAMP, base $BASE"
  echo "Prompt: $PROMPT"
  cd "$REPO" || exit 1
  timeout 3000 opencode run "$(cat "$PROMPT")"
  echo "opencode exit: $?"
} > "$LOG" 2>&1

{
  echo "# Veredicto — $STAMP"
  echo
  echo "Base: $BASE — HEAD ahora: $(git -C "$REPO" rev-parse --short HEAD)"
  echo
  echo "## Commits nuevos"
  git -C "$REPO" log --oneline "$BASE"..HEAD || true
  echo
  echo "## Verificación (detalle en $LOG)"
} > "$VERDICT"

cd "$REPO" || exit 1
check() { # check <nombre> <comando...>
  local name=$1; shift
  if "$@" >> "$LOG" 2>&1; then echo "- [x] $name: PASS" >> "$VERDICT"; else echo "- [ ] $name: FAIL" >> "$VERDICT"; fi
}
check "vitest" npm test -- --run
check "npm build" npm run build
check "cargo lib" cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib
check "cargo native-app" cargo test --offline --locked --manifest-path native-app/Cargo.toml
check "cargo fmt" cargo fmt --check --manifest-path src-tauri/Cargo.toml
check "unity recompile" unity recompile --project-path "$PWD/unity-memory-palace" --format json
if [ -x /tmp/check-workbench.sh ]; then check "check-workbench" /tmp/check-workbench.sh; fi
if [ -f src-tauri/target/fold-preview-smoke.mjs ]; then
  (nohup npx vite preview --port 4173 > /tmp/preview-judge.log 2>&1 &)
  sleep 3
  check "preview smoke" node src-tauri/target/fold-preview-smoke.mjs
  fuser -k 4173/tcp >/dev/null 2>&1 || true
fi
{
  echo
  echo "Registro completo: $LOG"
  echo "Prompt usado: $PROMPT"
} >> "$VERDICT"
echo "Veredicto: $VERDICT"
