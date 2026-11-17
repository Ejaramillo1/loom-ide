import type { SphereState } from "./sphere";

/** Port of mechanics::sphere_state: attention outranks transient activity. */
export function loomState(attention: "error" | "attention" | null, processing: boolean, busy: boolean, input: string, completed: boolean): SphereState {
  if (attention) return attention;
  if (processing) return "processing";
  if (busy) return "executing";
  if (input.trim()) return "listening";
  if (completed) return "completed";
  return "idle";
}
