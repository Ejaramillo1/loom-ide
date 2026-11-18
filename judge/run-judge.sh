#!/usr/bin/env bash
# Juez de Loom IDE: tarea -> prompt -> opencode run -> verificación -> veredicto.
# Uso: run-judge.sh <archivo-de-tarea> | --verify-only
# La tarea es texto plano con las palabras de Eduardo. El prompt construido
# queda en judge/runs/<fecha>.prompt.md dentro del repo, el registro completo
# en judge/runs/<fecha>.log y el veredicto en judge/verdicts/<fecha>.md.
#
# IMPORTANTE: ejecútalo desde la terminal del portátil, o desacoplado con
# nohup. NO lo ejecutes a través del shell del harness (mata los trabajos
# a los ~120 s y una pasada de OpenCode dura mucho más).
#
# --verify-only no lanza OpenCode. Babylon inicia su propio preview y Chromium.
set -u
REPO=$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel) || exit 1
JUDGE=$REPO/judge
TASK=${1:?uso: run-judge.sh <archivo-de-tarea> | --verify-only}
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$JUDGE/verdicts" "$JUDGE/runs"
PROMPT=$JUDGE/runs/$STAMP.prompt.md
LOG=$JUDGE/runs/$STAMP.log
VERDICT=$JUDGE/verdicts/$STAMP.md

BASE=$(git -C "$REPO" rev-parse --short HEAD)
if [ "$TASK" != "--verify-only" ]; then
command -v opencode >/dev/null 2>&1 || { echo "opencode no está instalado" >&2; exit 1; }
[ -f "$TASK" ] || { echo "no existe el archivo de tarea: $TASK" >&2; exit 1; }

{
  echo "# Tarea para OpenCode — $STAMP"
  echo
  echo "Trabajas en $REPO, rama $(git -C "$REPO" branch --show-current), HEAD $BASE."
  echo "Lee AGENTS.md en la raíz del repo y síguelo: no hagas preguntas, decide según los docs, verifica con comandos reales, commits locales solamente, nunca push."
  echo
  echo "## Tarea (palabras de Eduardo)"
  echo
  cat "$TASK"
  echo
  echo "## Criterio de aceptación"
  echo
  echo "- npm test -- --run, npm run build, cargo test (lib y native-app) y cargo fmt --check deben pasar."
  echo "- npm run test:spatial: renderer Babylon, colores por estado en ambos temas/calidades, shader failure/retry y workspace en verde."
  echo "- Al terminar, commitea localmente (un commit lógico por paso) e informa: archivos cambiados con SHAs, resultados de verificación con números, decisiones tomadas y qué queda."
} > "$PROMPT"

{
  echo "Juez — inicio $STAMP, base $BASE"
  echo "Prompt: $PROMPT"
  cd "$REPO" || exit 1
  timeout 3000 opencode run "$(cat "$PROMPT")"
  echo "opencode exit: $?"
} > "$LOG" 2>&1

else
  echo "Verification only: no coding agent dispatched." > "$LOG"
  echo "Verification only against $BASE." > "$PROMPT"
fi

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
FAILURES=0
check() { # check <nombre> <comando...>
  local name=$1; shift
  if "$@" >> "$LOG" 2>&1; then echo "- [x] $name: PASS" >> "$VERDICT"; else local status=$?; echo "- [ ] $name: FAIL (exit $status)" >> "$VERDICT"; FAILURES=$((FAILURES + 1)); fi
}
check "vitest" npm test -- --run
check "npm build" npm run build
check "cargo lib" cargo test --offline --locked --manifest-path src-tauri/Cargo.toml --lib
check "cargo native-app" cargo test --offline --locked --manifest-path native-app/Cargo.toml
check "cargo fmt" cargo fmt --check --manifest-path src-tauri/Cargo.toml
check "Babylon renderer, visual states and workspace" npm run test:spatial

{
  echo
  echo "Registro completo: $LOG"
  echo "Prompt usado: $PROMPT"
} >> "$VERDICT"
echo "Veredicto: $VERDICT"

exit "$FAILURES"
