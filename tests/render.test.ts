import { describe, expect, it } from "vitest";
import { escapeHtml, renderTemplate, textToHtml } from "@/lib/messaging/render";

describe("renderTemplate", () => {
  it("substitutes all {{var}} occurrences", () => {
    expect(renderTemplate("Hi {{name}}, welcome!", { name: "Alex" })).toBe(
      "Hi Alex, welcome!"
    );
  });

  it("handles multiple vars + whitespace in braces", () => {
    expect(
      renderTemplate("{{ first_name }} {{last_name}}", {
        first_name: "Alex",
        last_name: "Morgan",
      })
    ).toBe("Alex Morgan");
  });

  it("renders unknown vars as empty string", () => {
    expect(renderTemplate("Hello {{missing}}!", {})).toBe("Hello !");
  });

  it("tolerates null/undefined values", () => {
    expect(
      renderTemplate("A={{a}} B={{b}} C={{c}}", { a: null, b: undefined, c: 0 })
    ).toBe("A= B= C=0");
  });

  it("coerces numbers to strings", () => {
    expect(renderTemplate("Total: {{n}}", { n: 42 })).toBe("Total: 42");
  });
});

describe("escapeHtml", () => {
  it("escapes the dangerous five", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
    );
  });
  it("handles ampersands without double-encoding", () => {
    expect(escapeHtml("A & B")).toBe("A &amp; B");
  });
});

describe("textToHtml", () => {
  it("escapes + turns newlines into <br />", () => {
    expect(textToHtml("one\ntwo\nthree")).toBe("one<br />two<br />three");
  });
});
