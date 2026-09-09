import React from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

const safeUrl = (url) => {
  try {
    const parsed = new URL(url, "https://dopamine-dungeon.invalid");
    return ["http:", "https:", "mailto:"].includes(parsed.protocol) ? url : "";
  } catch {
    return "";
  }
};

export function MarkdownContent({ content, placeholder = "", className = "" }) {
  const source = String(content ?? "");
  if (!source.trim()) {
    return placeholder ? <p className="text-sm italic text-zinc-500">{placeholder}</p> : null;
  }

  return (
    <div className={`markdown-content space-y-3 text-sm leading-6 text-zinc-300 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        urlTransform={safeUrl}
        components={{
          a: ({ href, children }) => href ? <a className="break-words text-cyan-300 underline hover:text-cyan-200" href={href} rel="noreferrer">{children}</a> : <>{children}</>,
          img: ({ src, alt }) => src ? <img className="max-w-full rounded-lg" src={src} alt={alt || ""} loading="lazy" /> : null,
          table: ({ children }) => <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left">{children}</table></div>,
          th: ({ children }) => <th className="border border-white/15 px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-white/10 px-3 py-2 align-top">{children}</td>,
          code: ({ className: codeClassName, children, ...props }) => codeClassName ? <code className={`block overflow-x-auto rounded bg-black/30 p-3 font-mono text-xs ${codeClassName}`} {...props}>{children}</code> : <code className="rounded bg-black/30 px-1 font-mono text-xs" {...props}>{children}</code>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-cyan-400/60 pl-3 text-zinc-300">{children}</blockquote>,
          hr: () => <hr className="border-white/15" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
