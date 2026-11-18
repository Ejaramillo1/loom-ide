/** Shared by material initialization and runtime updates; families match Loom's state semantics. */
export const STATE_COLORS: Record<string, string> = {
  idle: "#8b66bf",
  listening: "#b599e6",
  processing: "#6935b5",
  exploring: "#48a2d6",
  executing: "#345dcc",
  attention: "#d89a34",
  completed: "#398a60",
  error: "#c34e51",
};
