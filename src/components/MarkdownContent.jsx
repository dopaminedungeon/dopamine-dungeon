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
          h1: ({ children }) => <h1 className="mt-6 break-words text-[1.0625rem] font-semibold leading-6 text-zinc-100 first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-5 break-words text-base font-semibold leading-6 text-zinc-100 first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-4 break-words text-[0.9375rem] font-semibold leading-6 text-zinc-200 first:mt-0">{children}</h3>,
          h4: ({ children }) => <h4 className="mt-4 break-words text-sm font-medium leading-5 text-zinc-200 first:mt-0">{children}</h4>,
          h5: ({ children }) => <h5 className="mt-3 break-words text-[0.8125rem] font-medium leading-5 text-zinc-300 first:mt-0">{children}</h5>,
          h6: ({ children }) => <h6 className="mt-3 break-words text-xs font-medium leading-5 text-zinc-400 first:mt-0">{children}</h6>,
          p: ({ children }) => <p>{children}</p>,
          ul: ({ children }) => <ul className="list-disc space-y-1 pl-5 marker:text-zinc-500">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal space-y-1 pl-5 marker:text-zinc-500">{children}</ol>,
          li: ({ children }) => <li className="break-words pl-0.5">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-zinc-100">{children}</strong>,
          em: ({ children }) => <em className="italic text-zinc-200">{children}</em>,
          del: ({ children }) => <del className="text-zinc-400">{children}</del>,
          a: ({ href, children }) => href ? <a className="break-words text-cyan-300 underline hover:text-cyan-200" href={href} rel="noreferrer">{children}</a> : <>{children}</>,
          img: ({ src, alt }) => src ? <img className="h-auto max-w-full rounded-lg" src={src} alt={alt || ""} loading="lazy" /> : null,
          table: ({ children }) => <div className="overflow-x-auto"><table className="min-w-full border-collapse text-left">{children}</table></div>,
          th: ({ children }) => <th className="border border-white/15 px-3 py-2 font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-white/10 px-3 py-2 align-top">{children}</td>,
          pre: ({ children }) => <pre className="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-5">{children}</pre>,
          code: ({ className: codeClassName, children, ...props }) => codeClassName ? <code className={`font-mono ${codeClassName}`} {...props}>{children}</code> : <code className="rounded bg-black/30 px-1 font-mono text-xs">{children}</code>,
          blockquote: ({ children }) => <blockquote className="border-l-2 border-cyan-400/60 pl-3 italic text-zinc-300">{children}</blockquote>,
          hr: () => <hr className="border-white/15" />,
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}
