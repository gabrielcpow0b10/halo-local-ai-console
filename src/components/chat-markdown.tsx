import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function ChatMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[[rehypeKatex, { trust: false, strict: "ignore" }]]}
      components={{
        img: ({ alt }) => <span>{alt ? `[image blocked: ${alt}]` : "[image blocked]"}</span>,
        a: ({ href, children, title }) => (
          <a href={href} title={title} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        ),
      }}
    >
      {content || "HALO is thinking..."}
    </ReactMarkdown>
  );
}
