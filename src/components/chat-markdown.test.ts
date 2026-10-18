import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ChatMarkdown } from "./chat-markdown";

const render = (content: string) =>
  renderToStaticMarkup(createElement(ChatMarkdown, { content }));

describe("chat message rendering", () => {
  it("renders Markdown structure, GFM, and code without interpreting code as math", () => {
    const html = render('### Heading\n\n**Bold** and *italic* with `inline`\n\n1. First\n2. Second\n\n- Item\n\n> Quote\n\n```js\nconst x = "$x$";\n```\n\n~~removed~~');
    for (const tag of ["h3", "strong", "em", "ol", "ul", "li", "blockquote", "pre", "code", "del"]) {
      expect(html).toContain(`<${tag}`);
    }
    expect(html).toContain("$x$");
    expect(html).not.toContain('class="katex"');
  });

  it("renders inline and display equations", () => {
    const html = render('Inline $x^2 + \\pi$.\n\n$$\n\\frac{1}{2}\n$$');
    expect(html).toContain('class="katex"');
    expect(html).toContain('class="katex-display"');
    expect(html).toContain("<math");
    expect(html).toContain("mfrac");
  });

  it("keeps HTML inert, blocks unsafe URLs, and secures links", () => {
    const html = render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[bad](javascript:alert%281%29) [safe](https://example.com)\n\n$\\href{javascript:alert(1)}{click}$');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<img");
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("tolerates every streaming prefix, incomplete math, and invalid LaTeX", () => {
    const message = '### Title\n\n**Bold** $x^2$\n\n$$\n\\frac{1}{2}\n$$\n\n```ts\nconst x = 1;\n```';
    for (let end = 0; end <= message.length; end++) {
      expect(() => render(message.slice(0, end))).not.toThrow();
    }
    expect(() => render('$$\\unknowncommand{ x $$')).not.toThrow();
    expect(render("")).toContain("HALO is thinking...");
  });
});
