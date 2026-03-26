'use client';

import { Link } from '@/i18n/navigation';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold tracking-tight mt-10 mb-4 first:mt-0 scroll-mt-20">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-xl font-semibold tracking-tight mt-9 mb-3 pb-2 border-b border-border">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-lg font-semibold mt-7 mb-2">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-base font-semibold mt-6 mb-2">{children}</h4>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-7 text-foreground/90 mb-4 last:mb-0">{children}</p>
  ),
  a: ({ href, children }) => {
    const raw = href ?? '';
    const isExternal = /^https?:\/\//i.test(raw);
    if (isExternal) {
      return (
        <a
          href={raw}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    }
    if (raw.startsWith('/')) {
      return (
        <Link
          href={raw}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
        >
          {children}
        </Link>
      );
    }
    return (
      <span className="text-muted-foreground">{children}</span>
    );
  },
  ul: ({ children }) => (
    <ul className="list-disc pl-6 my-4 space-y-2 text-sm leading-7 text-foreground/90">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal pl-6 my-4 space-y-2 text-sm leading-7 text-foreground/90">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-1">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/30 pl-4 my-4 text-muted-foreground text-sm italic">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-8 border-border" />,
  table: ({ children }) => (
    <div className="my-4 w-full overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-muted/80">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr className="border-b border-border last:border-0">{children}</tr>
  ),
  th: ({ children }) => (
    <th className="border border-border px-3 py-2 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border border-border px-3 py-2 align-top text-foreground/90">{children}</td>
  ),
  code: ({ className, children, ...props }) => {
    const isBlock = className?.includes('language-');
    if (!isBlock) {
      return (
        <code
          className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground before:content-none after:content-none"
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-lg border border-border bg-muted/50 p-4 text-[13px] leading-relaxed font-mono">
      {children}
    </pre>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
};

export function DocsMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
      {content}
    </ReactMarkdown>
  );
}
