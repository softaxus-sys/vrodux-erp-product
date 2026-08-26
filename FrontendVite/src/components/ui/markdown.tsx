import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Minimal Markdown renderer for AI assistant replies.
 *
 * The models are told to answer in Markdown, but the chat used to print the raw text, so users saw
 * literal `**asterisks**` and pipe-delimited tables instead of formatting. This renders the subset
 * a chat answer actually uses: headings, bold/italic/strikethrough, inline code, fenced code
 * blocks, bullet and numbered lists, GitHub-style tables, blockquotes, rules and links.
 *
 * Deliberately dependency-free (same call as `lib/pdf.ts`) and — more importantly — it builds React
 * elements rather than an HTML string, so there is no `dangerouslySetInnerHTML` anywhere and model
 * output can never inject markup. Anything it does not recognise falls through as plain text, so an
 * unsupported construct degrades to exactly what was shown before rather than disappearing.
 */
export function Markdown({ content, className }: { content: string; className?: string }) {
  const blocks = React.useMemo(() => parseBlocks(content ?? ""), [content]);
  return <div className={cn("space-y-2 break-words", className)}>{blocks}</div>;
}

/* ── Inline ────────────────────────────────────────────────────────────────
 * One pass over the line, longest-token-first so `**bold**` is never mistaken
 * for two `*italic*` markers.
 *
 * Single-underscore emphasis (`_word_`) is deliberately NOT supported: the assistant's answers are
 * full of snake_case tool and field names, and treating those underscores as emphasis mangles them.
 * `*italic*` still works, which is what the models actually emit.
 *
 * No lookbehind/lookahead here either — an unsupported regex construct is a parse-time SyntaxError
 * that would take down the whole chunk, not just the formatting.
 */
const INLINE = /(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|\[[^\]]+\]\([^)\s]+\)|https?:\/\/[^\s<>()]+)/g;

function inline(text: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let i = 0;

  for (const match of text.matchAll(INLINE)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > last) out.push(text.slice(last, start));
    last = start + token.length;
    const key = `${keyPrefix}-i${i++}`;

    if (token.startsWith("`")) {
      out.push(
        <code key={key} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**") || token.startsWith("__")) {
      out.push(<strong key={key} className="font-semibold">{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("~~")) {
      out.push(<s key={key} className="opacity-70">{token.slice(2, -2)}</s>);
    } else if (token.startsWith("[")) {
      const split = token.indexOf("](");
      out.push(
        <a
          key={key}
          href={safeHref(token.slice(split + 2, -1))}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2"
        >
          {token.slice(1, split)}
        </a>,
      );
    } else if (token.startsWith("http")) {
      out.push(
        <a key={key} href={safeHref(token)} target="_blank" rel="noopener noreferrer"
           className="text-primary underline underline-offset-2 break-all">
          {token}
        </a>,
      );
    } else {
      // single * — emphasis
      out.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Only http(s) and mailto links are rendered as links — never javascript: or data:. */
function safeHref(href: string): string {
  const trimmed = href.trim();
  return /^(https?:|mailto:)/i.test(trimmed) ? trimmed : "#";
}

/* ── Blocks ─────────────────────────────────────────────────────────────── */

const HEADING = /^(#{1,4})\s+(.*)$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*(\d+)[.)]\s+(.*)$/;
const RULE = /^\s*([-*_])\1{2,}\s*$/;
const QUOTE = /^\s*>\s?(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/;

function parseBlocks(src: string): React.ReactNode[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const out: React.ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Blank
    if (!line.trim()) { i++; continue; }

    // Fenced code block
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence (or end of input)
      out.push(
        <pre key={k()} className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
          <code className="font-mono">{body.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (RULE.test(line)) { out.push(<hr key={k()} className="border-border" />); i++; continue; }

    // Heading
    const heading = line.match(HEADING);
    if (heading) {
      const level = heading[1].length;
      const size = level === 1 ? "text-base" : level === 2 ? "text-[0.95rem]" : "text-sm";
      out.push(
        <p key={k()} className={cn("font-semibold", size)}>{inline(heading[2], k())}</p>,
      );
      i++;
      continue;
    }

    // Table: a header row followed by a |---|---| divider
    if (line.includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1])) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      out.push(
        <div key={k()} className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                {header.map((cell, ci) => (
                  <th key={ci} className="border-b border-border px-2 py-1.5 text-left font-semibold">
                    {inline(cell, `h${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="border-b border-border/50 px-2 py-1.5 align-top">
                      {inline(cell, `r${ri}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (QUOTE.test(line)) {
      const body: string[] = [];
      while (i < lines.length && QUOTE.test(lines[i])) body.push(lines[i++].match(QUOTE)![1]);
      out.push(
        <blockquote key={k()} className="border-s-2 border-border ps-3 text-muted-foreground">
          {inline(body.join(" "), k())}
        </blockquote>,
      );
      continue;
    }

    // Lists
    if (BULLET.test(line) || NUMBERED.test(line)) {
      const ordered = NUMBERED.test(line) && !BULLET.test(line);
      const items: string[] = [];
      while (i < lines.length && (BULLET.test(lines[i]) || NUMBERED.test(lines[i]))) {
        const m = lines[i].match(ordered ? NUMBERED : BULLET);
        // A different marker style starts a new list rather than silently joining this one.
        if (!m) break;
        items.push(ordered ? m[2] : m[1]);
        i++;
      }
      const cls = "ms-5 space-y-1 " + (ordered ? "list-decimal" : "list-disc");
      out.push(
        ordered
          ? <ol key={k()} className={cls}>{items.map((it, ii) => <li key={ii}>{inline(it, `l${ii}`)}</li>)}</ol>
          : <ul key={k()} className={cls}>{items.map((it, ii) => <li key={ii}>{inline(it, `l${ii}`)}</li>)}</ul>,
      );
      continue;
    }

    // Paragraph — consecutive plain lines, keeping the model's own line breaks
    const para: string[] = [];
    while (
      i < lines.length && lines[i].trim() &&
      !/^\s*```/.test(lines[i]) && !HEADING.test(lines[i]) && !RULE.test(lines[i]) &&
      !QUOTE.test(lines[i]) && !BULLET.test(lines[i]) && !NUMBERED.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && TABLE_DIVIDER.test(lines[i + 1]))
    ) {
      para.push(lines[i++]);
    }
    out.push(
      <p key={k()} className="whitespace-pre-wrap">{inline(para.join("\n"), k())}</p>,
    );
  }

  return out;
}

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(c => c.trim());
}
