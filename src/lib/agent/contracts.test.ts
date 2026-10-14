import { describe, it, expect } from "vitest";
import { sourceUrl, sourceKind, validatePack } from "./contracts";
import { sources, fixture } from "./testFixtures";
describe("trusted-source boundary", () => {
  it("allows exact trusted HTTPS hosts", () => { expect(sourceUrl(sources[0].url).hostname).toBe("www.vatican.va"); expect(sourceKind(sources[1].url)).toBe("scripture"); });
  it("does not confuse an external catechism with Catholic primary evidence", () => expect(sourceKind("https://www.opc.org/catechism.html")).toBe("external"));
  it.each(["http://www.vatican.va/test", "https://vatican.va.evil.example/test", "https://evil-vatican.va/test", "https://127.0.0.1/", "https://www.vatican.va:8443/", "https://user:pass@www.vatican.va/", "file:///etc/passwd"])("rejects %s", url => expect(() => sourceUrl(url)).toThrow());
});
describe("evidence and quiz validation", () => {
  it("accepts a sourced, complete pack", () => expect(validatePack(fixture(), sources).claims).toHaveLength(3));
  it("rejects fabricated quotations", () => { const p = fixture(); p.claims[0].evidence[0].quote = "This was never written"; expect(() => validatePack(p, sources)).toThrow(/Quotation/); });
  it("rejects invented sources", () => { const p = fixture(); p.claims[0].evidence[0].sourceId = "invented"; expect(() => validatePack(p, sources)).toThrow(); });
  it("requires Catechism and Scripture evidence", () => { const p = fixture(); p.claims[1].evidence = p.claims[0].evidence; expect(() => validatePack(p, sources)).toThrow(/Catechism/); });
  it("rejects unsourced quiz explanations", () => { const p = fixture(); p.quiz[0].explanationClaimIds = ["fake"]; expect(() => validatePack(p, sources)).toThrow(/Unknown/); });
  it("rejects invalid quiz answers and duplicate options", () => { const p = fixture(); p.quiz[0].correctIndex = 4; expect(() => validatePack(p, sources)).toThrow(); p.quiz[0].correctIndex = 1; p.quiz[0].options[1] = "A"; expect(() => validatePack(p, sources)).toThrow(); });
  it("requires evidence for real attributed objections", () => { const p = fixture(); p.objections[0].attributedTo = "Named denomination"; expect(() => validatePack(p, sources)).toThrow(); });
  it("requires every claim to be taught", () => { const p = fixture(); p.steps[2].claimIds = ["faith"]; expect(() => validatePack(p, sources)).toThrow(/Every claim/); });
  it("bounds aggregate quotation length per source", () => { const p = fixture(); const long = Array.from({length: 26}, (_,i) => `w${i}`).join(" "); p.claims[0].evidence[0].quote = long; expect(() => validatePack(p, [{...sources[0], text: sources[0].text + " " + long}, sources[1]])).toThrow(/allowance/); });
  it("rejects secondary historical sources as the sole basis for Church teaching", () => { expect(() => validatePack(fixture(), [{ ...sources[0], kind: "historical" }, sources[1]])).toThrow(/Church primary/); });
});
