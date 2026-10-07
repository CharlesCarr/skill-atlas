import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { resolvePath } from '../lib/workspace';
import type { SourceFile } from '../lib/types';
export function Markdown({
  content,
  path,
  files,
  onOpen,
}: {
  content: string;
  path: string;
  files: SourceFile[];
  onOpen: (path: string, fragment?: string) => void;
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href = '', children }) => {
            const local = resolvePath(path, href);
            if (local || href.startsWith('#')) {
              const target = href.startsWith('#') ? path : local!;
              const exists = files.some((f) => f.path === target);
              return (
                <button
                  className={`document-link ${exists ? '' : 'missing-link'}`}
                  title={exists ? `Open ${target}` : `File not imported: ${target}`}
                  onClick={() => onOpen(target, href.split('#')[1])}
                >
                  {children}
                  {exists ? ' ↗' : ' (missing)'}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          img: ({ alt }) => (
            <span className="image-placeholder">
              Image: {alt || 'referenced image'} · media is not imported
            </span>
          ),
          table: ({ children }) => (
            <div className="table-scroll">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
