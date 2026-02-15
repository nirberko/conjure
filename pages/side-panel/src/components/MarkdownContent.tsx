import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import { CodeBlock } from './CodeBlock';

const markdownComponents: Components = {
  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-200">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  h1: ({ children }) => <h1 className="mb-2 mt-3 text-base font-semibold text-slate-200">{children}</h1>,
  h2: ({ children }) => <h2 className="mb-2 mt-3 text-sm font-semibold text-slate-200">{children}</h2>,
  h3: ({ children }) => <h3 className="mb-1.5 mt-2.5 text-sm font-semibold text-slate-300">{children}</h3>,
  ul: ({ children }) => <ul className="mb-2 ml-4 list-disc space-y-0.5 text-slate-400">{children}</ul>,
  ol: ({ children }) => <ol className="mb-2 ml-4 list-decimal space-y-0.5 text-slate-400">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ node, className, children, ...rest }) => {
    const isBlock = className != null;
    if (isBlock) {
      const language = className.replace(/^language-/, '') || 'text';
      return (
        <CodeBlock code={String(children).replace(/\n$/, '')} language={language} className="mb-2" />
      );
    }
    return (
      <code className="rounded bg-slate-800/80 px-1.5 py-0.5 font-mono text-[11px] text-slate-300" {...rest}>
        {children}
      </code>
    );
  },
  pre: ({ children }) => <>{children}</>,
  blockquote: ({ children }) => (
    <blockquote className="border-primary/50 border-l-2 pl-3 text-slate-500">{children}</blockquote>
  ),
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary hover:underline">
      {children}
    </a>
  ),
};

interface MarkdownContentProps {
  content: string;
  className?: string;
}

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  return (
    <div className={`markdown-content text-sm leading-relaxed ${className ?? ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
