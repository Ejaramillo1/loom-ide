// Monaco wiring for Code mode. This is the single place that owns the
// monaco-editor import, the web-worker factory, the theme, and the language
// mapping — so main.ts only talks to a small handle instead of Monaco's API.

import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import cssWorker from "monaco-editor/language/css/css.worker.js?worker";
import htmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    switch (label) {
      case "json":
        return new jsonWorker();
      case "css":
      case "scss":
      case "less":
        return new cssWorker();
      case "html":
      case "handlebars":
      case "razor":
        return new htmlWorker();
      case "typescript":
      case "javascript":
        return new tsWorker();
      default:
        return new editorWorker();
    }
  },
};

export type CodeEditor = monaco.editor.IStandaloneCodeEditor;

const EDITOR_FONT =
  '"JetBrains Mono", ui-monospace, "DejaVu Sans Mono", monospace';

/** Read a `--theme-{name}-rgb` token ("r g b") set by theme.ts and return hex. */
function tokenHex(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(`--theme-${name}-rgb`)
    .trim();
  return rgbToHex(value || fallback);
}

function rgbToHex(rgb: string): string {
  const parts = rgb.split(/\s+/).map(Number);
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return "#ffffff";
  return `#${hex(parts[0])}${hex(parts[1])}${hex(parts[2])}`;
}

/** Define (or re-define) the "loom" theme from the current appearance tokens. */
export function applyCodeTheme(): void {
  const bg = tokenHex("deep", "29 27 26");
  const reading = tokenHex("reading", "36 33 31");
  const surface = tokenHex("surface", "44 40 37");
  const text = tokenHex("text", "240 233 226");
  const muted = tokenHex("muted", "197 185 174");
  const border = tokenHex("border", "89 80 73");
  const borderSubtle = tokenHex("border-subtle", "63 56 51");
  const selection = tokenHex("selection", "83 69 58");
  const purple = tokenHex("purple", "185 164 144");
  const blue = tokenHex("blue", "139 166 204");
  const green = tokenHex("green", "147 177 159");
  const amber = tokenHex("amber", "217 166 95");
  const red = tokenHex("red", "211 146 138");

  monaco.editor.defineTheme("loom", {
    base: getComputedStyle(document.documentElement).colorScheme === "light" ? "vs" : "vs-dark",
    inherit: true,
    rules: [
      { token: "comment", foreground: muted, fontStyle: "italic" },
      { token: "keyword", foreground: purple },
      { token: "string", foreground: green },
      { token: "number", foreground: amber },
      { token: "type", foreground: blue },
      { token: "type.identifier", foreground: blue },
      { token: "identifier", foreground: text },
      { token: "function", foreground: blue },
      { token: "tag", foreground: purple },
      { token: "attribute.name", foreground: blue },
      { token: "delimiter", foreground: muted },
      { token: "operator", foreground: muted },
      { token: "constant", foreground: amber },
      { token: "variable", foreground: text },
      { token: "annotation", foreground: red },
    ],
    colors: {
      "editor.background": bg,
      "editor.foreground": text,
      "editor.lineHighlightBackground": reading,
      "editor.lineHighlightBorder": "#00000000",
      "editorCursor.foreground": text,
      "editor.selectionBackground": selection,
      "editor.inactiveSelectionBackground": `${selection}66`,
      "editor.selectionHighlightBackground": `${selection}33`,
      "editor.wordHighlightBackground": `${selection}33`,
      "editorIndentGuide.background": borderSubtle,
      "editorIndentGuide.activeBackground": border,
      "editorLineNumber.foreground": muted,
      "editorLineNumber.activeForeground": text,
      "editorGutter.background": bg,
      "editorWidget.background": surface,
      "editorWidget.border": border,
      "editorSuggestWidget.background": surface,
      "editorSuggestWidget.border": border,
      "editorSuggestWidget.selectedBackground": selection,
      "editorHoverWidget.background": surface,
      "editorHoverWidget.border": border,
      "editorBracketMatch.background": selection,
      "editorBracketMatch.border": border,
      "minimap.background": bg,
      "scrollbarSlider.background": `${muted}33`,
      "scrollbarSlider.hoverBackground": `${muted}55`,
      "scrollbarSlider.activeBackground": `${muted}77`,
      "editorError.foreground": red,
      "editorWarning.foreground": amber,
      "editorInfo.foreground": blue,
    },
  });
  monaco.editor.setTheme("loom");
}

/** File-extension → Monaco language id. Only ids shipped with monaco-editor. */
const EXT_LANGUAGE: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  mts: "typescript",
  cts: "typescript",
  js: "javascript",
  jsx: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  json: "json",
  jsonc: "json",
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  less: "less",
  md: "markdown",
  markdown: "markdown",
  mdx: "mdx",
  rs: "rust",
  py: "python",
  rb: "ruby",
  go: "go",
  java: "java",
  cs: "csharp",
  c: "cpp",
  h: "cpp",
  cc: "cpp",
  cpp: "cpp",
  hpp: "cpp",
  php: "php",
  sh: "shell",
  bash: "shell",
  zsh: "shell",
  yml: "yaml",
  yaml: "yaml",
  toml: "ini",
  ini: "ini",
  xml: "xml",
  sql: "sql",
  swift: "swift",
  kt: "kotlin",
  lua: "lua",
  r: "r",
  dart: "dart",
  proto: "protobuf",
};

/** Guess the Monaco language for a workspace path; plaintext when unknown. */
export function languageForPath(path: string): string {
  const name = path.split("/").pop() ?? "";
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "plaintext";
  return EXT_LANGUAGE[name.slice(dot + 1).toLowerCase()] ?? "plaintext";
}

export function createCodeEditor(
  container: HTMLElement,
  options: { value?: string; language?: string } = {},
): CodeEditor {
  applyCodeTheme();
  return monaco.editor.create(container, {
    value: options.value ?? "",
    language: options.language ?? "plaintext",
    theme: "loom",
    automaticLayout: true,
    minimap: { enabled: true, maxColumn: 100 },
    fontSize: 13.5,
    fontFamily: EDITOR_FONT,
    lineHeight: 1.65,
    fontLigatures: true,
    scrollBeyondLastLine: false,
    fixedOverflowWidgets: true,
    renderWhitespace: "selection",
    tabSize: 2,
    insertSpaces: true,
    wordWrap: "off",
    padding: { top: 6, bottom: 6 },
    overviewRulerBorder: false,
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
  });
}

/** Change the language of the editor's model (e.g. on file open). */
export function setCodeLanguage(editor: CodeEditor, language: string): void {
  const model = editor.getModel();
  if (model) monaco.editor.setModelLanguage(model, language);
}
