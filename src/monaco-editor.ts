// Monaco editor for Code mode. Replaces the plain <textarea id="code-editor">
// with the VS Code editor: workers wired for Vite, chrome colours matched to
// the app's design tokens (dark/white), and the language chosen from the path
// of the open file. Syntax token colours are inherited from Monaco's vs-dark
// and vs base themes so the editor reads as part of the bench, not a foreign
// surface.

import * as monaco from "monaco-editor";
import editorWorker from "monaco-editor/editor/editor.worker.js?worker";
import jsonWorker from "monaco-editor/language/json/json.worker.js?worker";
import cssWorker from "monaco-editor/language/css/css.worker.js?worker";
import htmlWorker from "monaco-editor/language/html/html.worker.js?worker";
import tsWorker from "monaco-editor/language/typescript/ts.worker.js?worker";

// Monaco runs its language services in web workers; Vite bundles each worker
// as its own chunk. The labels are the language ids Monaco asks for.
self.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string): Worker {
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

const MONO = `"JetBrains Mono", ui-monospace, "DejaVu Sans Mono", monospace`;

type Appearance = "dark" | "white";

// Editor chrome colours from design-tokens.json (dark/white surfaces). The
// panel behind Code mode is `--reading`; the editor background matches it so
// Monaco sits flush instead of drawing its own darker/lighter box.
const DARK_COLORS: Record<string, string> = {
  "editor.background": "#24211F",
  "editor.foreground": "#F0E9E2",
  "editorLineNumber.foreground": "#8A7F74",
  "editorLineNumber.activeForeground": "#C5B9AE",
  "editorCursor.foreground": "#F0E9E2",
  "editor.selectionBackground": "#53453A",
  "editor.inactiveSelectionBackground": "#53453A80",
  "editor.lineHighlightBackground": "#2E2A27",
  "editorIndentGuide.background": "#3F3833",
  "editorIndentGuide.activeBackground": "#595049",
  "editorGutter.background": "#24211F",
  "editorWidget.background": "#35302C",
  "editorWidget.border": "#595049",
  "editorSuggestWidget.background": "#35302C",
  "editorSuggestWidget.border": "#595049",
  "editorSuggestWidget.selectedBackground": "#3E3530",
  "editorHoverWidget.background": "#35302C",
  "editorHoverWidget.border": "#595049",
  "input.background": "#35302C",
  "input.border": "#595049",
  "focusBorder": "#8BA6CC",
  "editorBracketMatch.background": "#53453A80",
  "editorBracketMatch.border": "#8BA6CC",
  "minimap.background": "#24211F",
  "scrollbarSlider.background": "#59504966",
  "scrollbarSlider.hoverBackground": "#595049",
  "scrollbarSlider.activeBackground": "#8A7F74",
};

const WHITE_COLORS: Record<string, string> = {
  "editor.background": "#F8F4F0",
  "editor.foreground": "#292725",
  "editorLineNumber.foreground": "#A09890",
  "editorLineNumber.activeForeground": "#645D57",
  "editorCursor.foreground": "#292725",
  "editor.selectionBackground": "#E9D7CA",
  "editor.inactiveSelectionBackground": "#E9D7CA80",
  "editor.lineHighlightBackground": "#F1EBE6",
  "editorIndentGuide.background": "#E9E1DC",
  "editorIndentGuide.activeBackground": "#DDD5D0",
  "editorGutter.background": "#F8F4F0",
  "editorWidget.background": "#FFFAF6",
  "editorWidget.border": "#DDD5D0",
  "editorSuggestWidget.background": "#FFFAF6",
  "editorSuggestWidget.border": "#DDD5D0",
  "editorSuggestWidget.selectedBackground": "#F1EAE5",
  "editorHoverWidget.background": "#FFFAF6",
  "editorHoverWidget.border": "#DDD5D0",
  "input.background": "#FFFFFF",
  "input.border": "#DDD5D0",
  "focusBorder": "#6A91CC",
  "editorBracketMatch.background": "#E9D7CA80",
  "editorBracketMatch.border": "#6A91CC",
  "minimap.background": "#F8F4F0",
  "scrollbarSlider.background": "#DDD5D066",
  "scrollbarSlider.hoverBackground": "#DDD5D0",
  "scrollbarSlider.activeBackground": "#A09890",
};

monaco.editor.defineTheme("loom-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [],
  colors: DARK_COLORS,
});
monaco.editor.defineTheme("loom-white", {
  base: "vs",
  inherit: true,
  rules: [],
  colors: WHITE_COLORS,
});

function currentAppearance(): Appearance {
  return document.documentElement.dataset.theme === "white" ? "white" : "dark";
}

function themeFor(appearance: Appearance): string {
  return appearance === "white" ? "loom-white" : "loom-dark";
}

// Keep Monaco's theme in step with the app switch (header button, View menu,
// or a storage event in another tab). theme.ts writes the choice to
// <html data-theme>, so observing that attribute covers every path.
monaco.editor.setTheme(themeFor(currentAppearance()));
new MutationObserver(() => {
  monaco.editor.setTheme(themeFor(currentAppearance()));
}).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["data-theme"],
});

export interface CodeEditorHandle {
  getValue(): string;
  setValue(value: string): void;
  setReadOnly(readOnly: boolean): void;
  setLanguage(languageId: string): void;
  layout(): void;
  focus(): void;
  onDidChange(callback: () => void): () => void;
  dispose(): void;
}

/** Mount a Monaco editor into `container` and return a small facade that the
    Code view drives. Programmatic `setValue` never fires the change callback,
    matching the old textarea's `input` semantics. */
export function createMonacoEditor(container: HTMLElement): CodeEditorHandle {
  const editor = monaco.editor.create(container, {
    value: "",
    language: "plaintext",
    theme: themeFor(currentAppearance()),
    fontFamily: MONO,
    fontSize: 13.5,
    lineHeight: 22,
    automaticLayout: true,
    minimap: { enabled: true },
    scrollBeyondLastLine: false,
    smoothScrolling: true,
    cursorBlinking: "smooth",
    fixedOverflowWidgets: true,
    tabSize: 2,
    insertSpaces: true,
    scrollbar: { useShadows: false },
  });

  let onChange: (() => void) | null = null;
  let silent = false;
  const subscription = editor.onDidChangeModelContent(() => {
    if (!silent) onChange?.();
  });

  return {
    getValue: () => editor.getValue(),
    setValue(value) {
      if (editor.getValue() === value) return;
      silent = true;
      try {
        editor.setValue(value);
        editor.setScrollPosition({ scrollTop: 0, scrollLeft: 0 });
      } finally {
        silent = false;
      }
    },
    setReadOnly(readOnly) {
      editor.updateOptions({ readOnly });
    },
    setLanguage(languageId) {
      const model = editor.getModel();
      if (model) monaco.editor.setModelLanguage(model, languageId);
    },
    layout() {
      editor.layout();
    },
    focus() {
      editor.focus();
    },
    onDidChange(callback) {
      onChange = callback;
      return () => {
        if (onChange === callback) onChange = null;
      };
    },
    dispose() {
      subscription.dispose();
      editor.dispose();
    },
  };
}

/** Pick a Monaco language id for a workspace file path. */
export function detectLanguageId(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const filename = normalized.slice(normalized.lastIndexOf("/") + 1).toLowerCase();
  const dot = filename.lastIndexOf(".");
  const extension = dot >= 0 ? filename.slice(dot + 1) : "";
  if (!extension) return "plaintext";
  for (const language of monaco.languages.getLanguages()) {
    if (language.extensions?.some((ext) => ext.slice(1).toLowerCase() === extension)) {
      return language.id;
    }
    if (language.filenames?.some((name) => name.toLowerCase() === filename)) {
      return language.id;
    }
  }
  return "plaintext";
}
