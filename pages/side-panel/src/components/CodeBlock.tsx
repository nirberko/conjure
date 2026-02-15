import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  code: string;
  language?: string;
  showLineNumbers?: boolean;
  maxHeight?: string;
  className?: string;
}

/** Syntax-highlighted code block with line numbers and dark theme */
export const CodeBlock = ({
  code,
  language = 'text',
  showLineNumbers = true,
  maxHeight,
  className = '',
}: CodeBlockProps) => (
  <div
    className={`code-block overflow-x-auto overflow-y-auto rounded-md ${className}`}
    style={maxHeight ? { maxHeight } : undefined}>
    <SyntaxHighlighter
      language={language}
      style={oneDark}
      showLineNumbers={showLineNumbers}
      customStyle={{
        margin: 0,
        padding: '12px 16px',
        fontSize: '11px',
        lineHeight: 1.5,
        background: 'transparent',
        border: 'none',
      }}
      codeTagProps={{ style: { fontFamily: 'inherit' } }}
      lineNumberStyle={{
        minWidth: '2em',
        paddingRight: '1em',
        color: '#64748b',
        userSelect: 'none',
      }}
      PreTag="div">
      {code}
    </SyntaxHighlighter>
  </div>
);
