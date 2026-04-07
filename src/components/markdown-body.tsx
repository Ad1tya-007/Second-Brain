import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

type MarkdownBodyProps = {
  content: string;
  /** Smaller text sizes for compact contexts (e.g. AI chat panel). */
  compact?: boolean;
  className?: string;
};

export function MarkdownBody({ content, compact = false, className }: MarkdownBodyProps) {
  const prose = compact ? "text-xs" : "text-[15px]";
  return (
    <div className={cn(className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className={cn("mb-2 font-semibold tracking-tight", compact ? "text-sm" : "mb-3 text-lg")}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={cn("mb-1.5 mt-3 font-semibold tracking-tight first:mt-0", compact ? "text-xs" : "mb-2 mt-4 text-base")}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={cn("mb-1 mt-2 font-semibold", compact ? "text-xs" : "mb-2 mt-3 text-sm")}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className={cn("mb-2 leading-relaxed text-foreground last:mb-0", prose)}>
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className={cn("mb-2 list-disc space-y-0.5 pl-4 leading-relaxed last:mb-0", prose)}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={cn("mb-2 list-decimal space-y-0.5 pl-4 leading-relaxed last:mb-0", prose)}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="marker:text-muted-foreground">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              {children}
            </a>
          ),
          code: ({ className: cls, children }) => {
            const isBlock = cls?.includes("language-");
            if (isBlock) {
              return <code className={cls}>{children}</code>;
            }
            return (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground">
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="mb-2 overflow-x-auto rounded-lg border border-border bg-muted/60 p-2.5 text-xs last:mb-0">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="mb-2 overflow-x-auto last:mb-0">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="border-b border-border">{children}</thead>,
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-medium text-muted-foreground">{children}</th>
          ),
          td: ({ children }) => <td className="px-2 py-1 align-top">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
