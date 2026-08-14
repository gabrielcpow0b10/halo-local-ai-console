import { inflateSync } from "node:zlib";

type PdfStream = {
  objectNumber: number | null;
  dictionary: string;
  data: string;
};

function normalizeText(value: string) {
  return value
    .replace(/\r\n/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, " ")
    .trim();
}

function decodePdfLiteralString(value: string) {
  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];

    if (char !== "\\") {
      output += char;
      continue;
    }

    const next = value[index + 1];
    if (!next) break;

    if (next === "n") output += "\n";
    else if (next === "r") output += "\r";
    else if (next === "t") output += "\t";
    else if (next === "b") output += "\b";
    else if (next === "f") output += "\f";
    else if (next === "\r" || next === "\n") {
      if (next === "\r" && value[index + 2] === "\n") index += 1;
    } else if (/[0-7]/.test(next)) {
      const octal = value.slice(index + 1).match(/^[0-7]{1,3}/)?.[0] ?? "";
      output += String.fromCharCode(parseInt(octal, 8));
      index += octal.length - 1;
    } else {
      output += next;
    }

    index += 1;
  }

  return output;
}

function unicodeFromHex(value: string) {
  const normalized = value.replace(/\s+/g, "");

  if (normalized.length >= 4 && normalized.length % 4 === 0) {
    let output = "";

    for (let index = 0; index < normalized.length; index += 4) {
      output += String.fromCharCode(parseInt(normalized.slice(index, index + 4), 16));
    }

    return output;
  }

  return Buffer.from(normalized.match(/.{1,2}/g)?.map((pair) => parseInt(pair, 16)) ?? [])
    .toString("latin1");
}

function parseToUnicodeCMap(stream: string) {
  const mappings = new Map<number, string>();

  for (const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const line of block[1].split(/\r?\n/)) {
      const match = line.match(/<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/);
      if (!match) continue;

      mappings.set(parseInt(match[1], 16), unicodeFromHex(match[2]));
    }
  }

  for (const block of stream.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const line of block[1].split(/\r?\n/)) {
      const arrayMatch = line.match(
        /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+\[([^\]]+)\]/
      );

      if (arrayMatch) {
        const start = parseInt(arrayMatch[1], 16);
        const values = Array.from(arrayMatch[3].matchAll(/<([0-9A-Fa-f]+)>/g));

        values.forEach((value, index) => {
          mappings.set(start + index, unicodeFromHex(value[1]));
        });
        continue;
      }

      const rangeMatch = line.match(
        /<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>/
      );

      if (!rangeMatch) continue;

      const start = parseInt(rangeMatch[1], 16);
      const end = parseInt(rangeMatch[2], 16);
      const destinationStart = parseInt(rangeMatch[3], 16);

      for (let code = start; code <= end; code += 1) {
        mappings.set(code, String.fromCharCode(destinationStart + code - start));
      }
    }
  }

  return mappings;
}

function mergeToUnicodeMaps(streams: PdfStream[]) {
  const mappings = new Map<number, string>();

  for (const stream of streams) {
    if (!/beginbf(?:char|range)/.test(stream.data)) continue;

    for (const [code, value] of parseToUnicodeCMap(stream.data)) {
      mappings.set(code, value);
    }
  }

  return mappings;
}

function getPdfFontMaps(pdfBytes: Buffer, streams: PdfStream[]) {
  const binary = pdfBytes.toString("latin1");
  const streamByObject = new Map(
    streams
      .filter((stream): stream is PdfStream & { objectNumber: number } =>
        typeof stream.objectNumber === "number"
      )
      .map((stream) => [stream.objectNumber, stream])
  );
  const fontObjectToUnicode = new Map<number, Map<number, string>>();
  const fontResourceMaps = new Map<string, Map<number, string>>();

  for (const objectMatch of binary.matchAll(/(\d+)\s+\d+\s+obj([\s\S]*?)endobj/g)) {
    const fontObjectNumber = Number(objectMatch[1]);
    const objectBody = objectMatch[2];
    const unicodeObjectNumber = Number(
      objectBody.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/)?.[1]
    );
    const unicodeStream = streamByObject.get(unicodeObjectNumber);

    if (!unicodeStream) continue;

    fontObjectToUnicode.set(fontObjectNumber, parseToUnicodeCMap(unicodeStream.data));
  }

  for (const resourceMatch of binary.matchAll(/\/([A-Za-z0-9_.-]+)\s+(\d+)\s+\d+\s+R/g)) {
    const resourceName = resourceMatch[1];
    const fontObjectNumber = Number(resourceMatch[2]);
    const unicodeMap = fontObjectToUnicode.get(fontObjectNumber);

    if (unicodeMap) {
      fontResourceMaps.set(resourceName, unicodeMap);
    }
  }

  return {
    fallbackMap: mergeToUnicodeMaps(streams),
    fontResourceMaps,
  };
}

function decodeGlyphString(value: string, toUnicodeMap: Map<number, string>) {
  if (toUnicodeMap.size === 0) return value;

  let output = "";

  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    output += toUnicodeMap.get(code) ?? value[index];
  }

  return output;
}

function decodePdfHexString(value: string) {
  const normalized = value.replace(/\s+/g, "");
  const pairs = normalized.match(/.{1,2}/g) ?? [];
  const bytes = pairs.map((pair) => parseInt(pair.padEnd(2, "0"), 16));

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return String.fromCharCode(
      ...bytes
        .slice(2)
        .reduce<number[]>((chars, byte, index, source) => {
          if (index % 2 === 0) chars.push((byte << 8) + (source[index + 1] ?? 0));
          return chars;
        }, [])
    );
  }

  return Buffer.from(bytes).toString("latin1");
}

function parsePdfTextFromContentStream(
  stream: string,
  fontResourceMaps: Map<string, Map<number, string>>,
  fallbackMap: Map<number, string>
) {
  const textParts: string[] = [];
  let pendingText: string[] = [];
  let index = 0;
  let inTextBlock = false;
  let activeToUnicodeMap = fallbackMap;

  function flushText(addSpace = false) {
    if (pendingText.length === 0) return;
    textParts.push(pendingText.join(""));
    if (addSpace) textParts.push(" ");
    pendingText = [];
  }

  while (index < stream.length) {
    const char = stream[index];

    if (char === "(") {
      let depth = 1;
      let value = "";
      index += 1;

      while (index < stream.length && depth > 0) {
        const current = stream[index];
        if (current === "\\") {
          value += current;
          if (index + 1 < stream.length) {
            value += stream[index + 1];
            index += 2;
            continue;
          }
        }

        if (current === "(") depth += 1;
        if (current === ")") depth -= 1;
        if (depth > 0) value += current;
        index += 1;
      }

      if (inTextBlock) {
        pendingText.push(
          decodeGlyphString(decodePdfLiteralString(value), activeToUnicodeMap)
        );
      }
      continue;
    }

    if (char === "<" && stream[index + 1] !== "<") {
      const end = stream.indexOf(">", index + 1);
      if (end !== -1) {
        if (inTextBlock) {
          pendingText.push(
            decodeGlyphString(
              decodePdfHexString(stream.slice(index + 1, end)),
              activeToUnicodeMap
            )
          );
        }
        index = end + 1;
        continue;
      }
    }

    if (/[A-Za-z'"]/.test(char)) {
      const operator = stream.slice(index).match(/^[A-Za-z'"]+/)?.[0] ?? "";

      if (operator === "BT") {
        inTextBlock = true;
        pendingText = [];
      } else if (operator === "ET") {
        flushText(true);
        inTextBlock = false;
      } else if (["Tj", "TJ", "'", "\""].includes(operator)) {
        flushText(true);
      } else if (["Td", "TD", "T*", "Tm"].includes(operator)) {
        flushText(true);
      } else if (operator === "Tf") {
        const fontName = stream
          .slice(Math.max(0, index - 80), index)
          .match(/\/([A-Za-z0-9_.-]+)\s+[-+]?\d*\.?\d+\s*$/)?.[1];

        if (fontName) {
          activeToUnicodeMap = fontResourceMaps.get(fontName) ?? fallbackMap;
        }
      }

      index += operator.length;
      continue;
    }

    index += 1;
  }

  flushText();
  return textParts.join("").replace(/[ \t]+\n/g, "\n").replace(/[ \t]{2,}/g, " ");
}

function extractPdfStreams(pdfBytes: Buffer) {
  const binary = pdfBytes.toString("latin1");
  const streamMatches = Array.from(
    binary.matchAll(
      /(?:(\d+)\s+\d+\s+obj\s*)?<<(.*?)>>\s*stream\r?\n?([\s\S]*?)\r?\n?endstream/g
    )
  );

  return streamMatches.map((match) => {
    const objectNumber = match[1] ? Number(match[1]) : null;
    const dictionary = match[2];
    const streamData = Buffer.from(match[3], "latin1");
    let data = streamData.toString("latin1");

    if (/\/FlateDecode\b/.test(dictionary)) {
      try {
        data = inflateSync(streamData).toString("latin1");
      } catch {
        data = "";
      }
    }

    return { objectNumber, dictionary, data };
  });
}

export function extractPdfText(bytes: Buffer) {
  const streams = extractPdfStreams(bytes);
  const { fallbackMap, fontResourceMaps } = getPdfFontMaps(bytes, streams);
  const text = streams
    .map((stream) =>
      parsePdfTextFromContentStream(stream.data, fontResourceMaps, fallbackMap)
    )
    .join("\n");

  return normalizeText(text.replace(/\s+\n/g, "\n").replace(/\n{3,}/g, "\n\n"));
}
