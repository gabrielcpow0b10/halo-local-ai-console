import { deflateSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { extractPdfText } from "./pdf-extractor";

function stream(data: string, dictionary = "") {
  return `<<${dictionary}>>\nstream\n${data}\nendstream`;
}

function pdf(...parts: string[]) {
  return Buffer.from(`%PDF-1.4\n${parts.join("\n")}\n%%EOF`, "latin1");
}

function cmap(body: string) {
  return stream(body);
}

describe("extractPdfText", () => {
  it("extracts simple literal text from a Tj operation inside BT/ET", () => {
    expect(extractPdfText(pdf(stream("BT (Hello, HALO!) Tj ET")))).toBe(
      "Hello, HALO!"
    );
  });

  it("decodes escaped literal characters", () => {
    const content = String.raw`BT (A\(B\)\\C\nD\rE\tF) Tj ET`;

    expect(extractPdfText(pdf(stream(content)))).toBe(
      "A(B)\\C\nD\rE\tF"
    );
  });

  it("decodes octal escapes in literal strings", () => {
    const content = String.raw`BT (\110\101\114\117) Tj ET`;

    expect(extractPdfText(pdf(stream(content)))).toBe("HALO");
  });

  it("extracts text from hexadecimal PDF strings", () => {
    expect(extractPdfText(pdf(stream("BT <48656c6c6f> Tj ET")))).toBe(
      "Hello"
    );
  });

  it("keeps multiple Tj and TJ-style text fragments", () => {
    const content = "BT (First) Tj [(Second) -120 (Part)] TJ (Last) Tj ET";

    expect(extractPdfText(pdf(stream(content)))).toBe(
      "First SecondPart Last"
    );
  });

  it.each(["Td", "TD", "Tm"])(
    "separates text around the %s positioning operator",
    (operator) => {
      const content = `BT (First) ${operator} (Second) Tj ET`;

      expect(extractPdfText(pdf(stream(content)))).toBe("First Second");
    }
  );

  it("decodes UTF-16BE hexadecimal strings with a BOM", () => {
    expect(
      extractPdfText(pdf(stream("BT <FEFF00480061006C006F> Tj ET")))
    ).toBe("Halo");
  });

  it("applies a beginbfchar ToUnicode mapping", () => {
    const unicodeMap = cmap(`1 beginbfchar
<41> <03A9>
endbfchar`);

    expect(extractPdfText(pdf(unicodeMap, stream("BT <41> Tj ET")))).toBe(
      "Ω"
    );
  });

  it("applies a sequential beginbfrange mapping", () => {
    const unicodeMap = cmap(`1 beginbfrange
<41> <43> <0058>
endbfrange`);

    expect(extractPdfText(pdf(unicodeMap, stream("BT <414243> Tj ET")))).toBe(
      "XYZ"
    );
  });

  it("applies an array-form beginbfrange mapping", () => {
    const unicodeMap = cmap(`1 beginbfrange
<41> <43> [<03B1> <03B2> <03B3>]
endbfrange`);

    expect(extractPdfText(pdf(unicodeMap, stream("BT <414243> Tj ET")))).toBe(
      "αβγ"
    );
  });

  it("uses the selected named font resource's ToUnicode map", () => {
    const fontOne = "1 0 obj\n<< /Type /Font /ToUnicode 3 0 R >>\nendobj";
    const fontTwo = "2 0 obj\n<< /Type /Font /ToUnicode 4 0 R >>\nendobj";
    const mapOne = `3 0 obj\n${cmap(`1 beginbfchar
<41> <0058>
endbfchar`)}\nendobj`;
    const mapTwo = `4 0 obj\n${cmap(`1 beginbfchar
<41> <0059>
endbfchar`)}\nendobj`;
    const resources = "<< /Font << /FOne 1 0 R /FTwo 2 0 R >> >>";
    const content = stream("BT /FOne 12 Tf <41> Tj ET");

    expect(
      extractPdfText(pdf(fontOne, fontTwo, mapOne, mapTwo, resources, content))
    ).toBe("X");
  });

  it("extracts a FlateDecode-compressed content stream", () => {
    const compressed = deflateSync(Buffer.from("BT (Compressed) Tj ET", "latin1"));
    const bytes = Buffer.concat([
      Buffer.from("%PDF-1.4\n<< /Filter /FlateDecode >>\nstream\n", "latin1"),
      compressed,
      Buffer.from("\nendstream\n%%EOF", "latin1"),
    ]);

    expect(extractPdfText(bytes)).toBe("Compressed");
  });

  it("ignores malformed FlateDecode content without throwing", () => {
    const malformed = pdf(
      stream("this is not deflated data", " /Filter /FlateDecode "),
      stream("BT (Readable) Tj ET")
    );

    expect(() => extractPdfText(malformed)).not.toThrow();
    expect(extractPdfText(malformed)).toBe("Readable");
  });

  it("returns an empty string when there are no readable text streams", () => {
    expect(extractPdfText(pdf("1 0 obj\n<< /Type /Catalog >>\nendobj"))).toBe(
      ""
    );
  });

  it("ignores text-like strings outside BT/ET blocks", () => {
    expect(
      extractPdfText(pdf(stream("(Outside) Tj BT (Inside) Tj ET (Also outside)")))
    ).toBe("Inside");
  });
});
