import { type ReactNode, useMemo } from "react";
import { CodeBlock } from "./CodeBlock";

interface MarkdownRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function MarkdownRenderer({
  content,
  isStreaming = false,
}: MarkdownRendererProps) {
  const { stableContent, trailingContent } = useMemo(
    () => splitStreamingContent(content, isStreaming),
    [content, isStreaming]
  );
  const blocks = useMemo(() => parseMarkdown(stableContent), [stableContent]);

  return (
    <div className="selectable break-words text-sm leading-6">
      {blocks}
      {trailingContent && <p>{renderInline(trailingContent, "trailing")}</p>}
    </div>
  );
}

function splitStreamingContent(content: string, isStreaming: boolean) {
  if (!isStreaming) return { stableContent: content, trailingContent: "" };
  const lastNewline = content.lastIndexOf("\n");
  if (lastNewline < 0) return { stableContent: "", trailingContent: content };
  return {
    stableContent: content.slice(0, lastNewline + 1),
    trailingContent: content.slice(lastNewline + 1),
  };
}

function parseMarkdown(content: string): ReactNode[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const fence = /^```([\w+-]+)?\s*$/.exec(line);
    if (fence) {
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^```\s*$/.test(lines[index] ?? "")) {
        codeLines.push(lines[index] ?? "");
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push(
        <CodeBlock
          key={`code-${index}`}
          language={fence[1] ?? ""}
          code={codeLines.join("\n")}
        />
      );
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = renderInline(heading[2], `heading-${index}`);
      const className =
        level === 1
          ? "mb-2 mt-5 text-xl font-semibold"
          : level === 2
            ? "mb-2 mt-4 text-lg font-semibold"
            : "mb-1 mt-3 text-base font-semibold";
      const Tag = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
      blocks.push(
        <Tag key={`heading-${index}`} className={className}>
          {text}
        </Tag>
      );
      index += 1;
      continue;
    }

    if (/^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
      blocks.push(<hr key={`rule-${index}`} className="my-4 border-border" />);
      index += 1;
      continue;
    }

    if (isTableDelimiter(lines[index + 1])) {
      const header = splitTableRow(line);
      index += 2;
      const rows: string[][] = [];
      while (index < lines.length && (lines[index] ?? "").includes("|")) {
        rows.push(splitTableRow(lines[index] ?? ""));
        index += 1;
      }
      blocks.push(
        <div key={`table-${index}`} className="my-3 overflow-x-auto">
          <table className="min-w-full border-collapse text-left text-xs">
            <thead className="bg-surface-muted text-content-muted">
              <tr>
                {header.map((cell, cellIndex) => (
                  <th
                    key={`header-${cellIndex}`}
                    className="border border-border px-2.5 py-2 font-medium"
                  >
                    {renderInline(cell, `table-header-${cellIndex}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {header.map((_, cellIndex) => (
                    <td
                      key={`cell-${rowIndex}-${cellIndex}`}
                      className="border border-border px-2.5 py-2 align-top"
                    >
                      {renderInline(
                        row[cellIndex] ?? "",
                        `table-${rowIndex}-${cellIndex}`
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index] ?? "")) {
        quote.push((lines[index] ?? "").replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push(
        <blockquote
          key={`quote-${index}`}
          className="my-3 border-l-2 border-primary-400 pl-3 text-content-muted"
        >
          {renderInline(quote.join("\n"), `quote-${index}`)}
        </blockquote>
      );
      continue;
    }

    const unordered = /^\s*[-*+]\s+(.+)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.+)$/.exec(line);
    if (unordered || ordered) {
      const isOrdered = Boolean(ordered);
      const items: string[] = [];
      while (index < lines.length) {
        const next = isOrdered
          ? /^\s*\d+[.)]\s+(.+)$/.exec(lines[index] ?? "")
          : /^\s*[-*+]\s+(.+)$/.exec(lines[index] ?? "");
        if (!next) break;
        items.push(next[1]);
        index += 1;
      }
      const List = isOrdered ? "ol" : "ul";
      blocks.push(
        <List
          key={`list-${index}`}
          className={
            isOrdered ? "my-2 list-decimal pl-5" : "my-2 list-disc pl-5"
          }
        >
          {items.map((item, itemIndex) => {
            const task = /^\[([ xX])\]\s+(.+)$/.exec(item);
            return (
              <li key={`item-${itemIndex}`} className="my-0.5 pl-1">
                {task && (
                  <input
                    type="checkbox"
                    checked={task[1].toLowerCase() === "x"}
                    readOnly
                    tabIndex={-1}
                    className="mr-1.5 align-middle accent-primary-500"
                  />
                )}
                {renderInline(task?.[2] ?? item, `list-${itemIndex}`)}
              </li>
            );
          })}
        </List>
      );
      continue;
    }

    const paragraph: string[] = [];
    while (
      index < lines.length &&
      !isBlockStart(lines, index, paragraph.length > 0)
    ) {
      paragraph.push(lines[index] ?? "");
      index += 1;
    }
    if (paragraph.length) {
      blocks.push(
        <p key={`paragraph-${index}`} className="my-2 whitespace-pre-wrap">
          {renderInline(paragraph.join("\n"), `paragraph-${index}`)}
        </p>
      );
    } else {
      index += 1;
    }
  }

  return blocks;
}

function isBlockStart(lines: string[], index: number, hasParagraph: boolean) {
  const line = lines[index] ?? "";
  if (!line.trim()) return true;
  if (!hasParagraph) return false;
  return (
    /^```/.test(line) ||
    /^(#{1,4})\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*+]|\d+[.)])\s+/.test(line) ||
    /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/.test(line) ||
    isTableDelimiter(lines[index + 1])
  );
}

function isTableDelimiter(line?: string) {
  return Boolean(
    line && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
  );
}

function splitTableRow(row: string) {
  return row
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const tokenPattern =
    /(`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of text.matchAll(tokenPattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > cursor) nodes.push(text.slice(cursor, start));
    const key = `${keyPrefix}-${start}`;

    if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-surface-subtle px-1 py-0.5 font-code text-[0.85em]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      nodes.push(<s key={key}>{token.slice(2, -2)}</s>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    } else {
      const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      const href = link?.[2] ?? "";
      nodes.push(
        isSafeLink(href) ? (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="text-primary-600 underline decoration-primary-300 underline-offset-2 hover:text-primary-700 dark:text-primary-400"
          >
            {link?.[1]}
          </a>
        ) : (
          <span key={key}>{link?.[1] ?? token}</span>
        )
      );
    }
    cursor = start + token.length;
  }

  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes;
}

function isSafeLink(href: string) {
  return /^(https?:\/\/|mailto:)/i.test(href);
}
