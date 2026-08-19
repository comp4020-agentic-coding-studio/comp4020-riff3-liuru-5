import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Structural contracts for this week's brief: "an interactive explainer of
// something more people should know" turned into six stations sharing one
// mechanic (summon a phenomenon, try to hold it). These check the built page
// against that contract, not against how it happens to be implemented.
const distPath = resolve("dist/index.html");
const doc = new JSDOM(readFileSync(distPath, "utf8")).window.document;

const STATIONS = ["dream", "illusion", "bubble", "shadow", "dew", "lightning"];

describe("the six as-ifs", () => {
  it("names all six similes as distinct stations", () => {
    for (const station of STATIONS) {
      const el = doc.querySelector(`[data-testid="station-${station}"]`);
      expect(el, `station-${station} is missing`).toBeTruthy();
    }
  });

  it("gives every station at least one interactive, keyboard-reachable control", () => {
    for (const station of STATIONS) {
      const section = doc.querySelector(`[data-testid="station-${station}"]`);
      const controls = section?.querySelectorAll('button, [tabindex="0"]') ?? [];
      expect(controls.length, `station-${station} has no interactive control`).toBeGreaterThan(0);
    }
  });

  it("keeps the shared hold-count tally on the page, starting at zero", () => {
    const counter = doc.querySelector("#hold-count");
    expect(counter?.textContent?.trim()).toBe("0");
  });

  it("announces the tally to assistive tech as it changes", () => {
    const counter = doc.querySelector(".counter");
    expect(counter?.getAttribute("aria-live")).toBe("polite");
  });

  it("quotes the Diamond Sūtra verse the page is built from", () => {
    const blockquote = doc.querySelector("blockquote");
    expect(blockquote?.textContent).toContain("如夢幻泡影");
  });

  it("names real sources for its translation instead of asserting one unchecked", () => {
    const outro = doc.querySelector(".outro");
    expect(outro?.textContent).toMatch(/Muller/);
    expect(outro?.textContent).toMatch(/Red Pine/);
  });

  it("gives every button an explicit type, so none submit a form by accident", () => {
    for (const button of doc.querySelectorAll("button")) {
      expect(button.getAttribute("type")).toBe("button");
    }
  });

  it("gives every station-note a status role so its updates are announced", () => {
    for (const station of STATIONS) {
      const note = doc.querySelector(`#${station}-note`);
      expect(note?.getAttribute("role"), `#${station}-note`).toBe("status");
    }
  });

  it("gives every station a way to not grasp, alongside the way to hold on", () => {
    for (const station of STATIONS) {
      const button = doc.querySelector(`#${station}-let-go`);
      expect(button, `#${station}-let-go is missing`).toBeTruthy();
      expect(button?.getAttribute("type")).toBe("button");
    }
  });

  it("keeps the let-go tally separate from the hold tally, starting at zero", () => {
    const counter = doc.querySelector("#let-go-count");
    expect(counter?.textContent?.trim()).toBe("0");
  });
});
