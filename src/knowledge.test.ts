import { describe, expect, it } from "vitest";
import { graphLayout, kindColour, matchingNotes } from "./knowledge";
import type { KnowledgeNote } from "./api";

const note = (id: string, kind = "note", body = "", folder = "10 Fleeting Notes"): KnowledgeNote => ({
  meta: { id, title: id, kind, created: 1, modified: 1, author: "human", source: "test input", status: "working", version: 1 },
  body, path: `${folder}/${id}.md`, original: "",
});
describe("knowledge navigation", () => {
  it("searches title, body and kind together with exact kind and folder filters", () => {
    const notes = [note("Alpha", "experiment", "Measured result", "50 Projects/Agent Memory/Experiments"), note("Beta", "decision", "ALPHA evidence")];
    expect(matchingNotes(notes, "alpha")).toHaveLength(2);
    expect(matchingNotes(notes, "MEASURED").map(n => n.meta.id)).toEqual(["Alpha"]);
    expect(matchingNotes(notes, "decision").map(n => n.meta.id)).toEqual(["Beta"]);
    expect(matchingNotes(notes, "", "experiment", "50 Projects/Agent Memory/Experiments")).toEqual([notes[0]]);
    expect(matchingNotes(notes, "", "experiment", "50 Projects/Agent Memory/Experiment")).toEqual([]);
  });
  it("centres the selected node and shows only it and incoming/outgoing neighbours", () => {
    const notes = [note("focus"), note("incoming"), note("outgoing"), note("unrelated")];
    const edges = [{ from: "incoming", to: "focus", kind: "supports" }, { from: "focus", to: "outgoing", kind: "tests" }];
    const layout = graphLayout(notes, edges, "focus");
    expect(layout.map(n => n.note.meta.id)).toEqual(["focus", "incoming", "outgoing"]);
    expect(layout[0]).toMatchObject({ x: 450, y: 280 });
    expect(layout.every(n => Number.isFinite(n.x) && Number.isFinite(n.y))).toBe(true);
    expect(graphLayout(notes, edges, null)).toHaveLength(4);
    expect(graphLayout([], [], null)).toEqual([]);
    expect(graphLayout([note("focus")], [], "focus")[0]).toMatchObject({ x: 450, y: 280 });
  });
  it("uses the native kind colour rule", () => {
    expect(["memory", "result", "experiment", "question", "decision"].map(kindColour)).toEqual(["green", "green", "blue", "amber", "purple"]);
  });
});
