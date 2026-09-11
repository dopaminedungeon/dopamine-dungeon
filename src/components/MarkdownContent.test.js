import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MarkdownContent } from "./MarkdownContent.jsx";

const render = (content, placeholder) =>
  renderToStaticMarkup(React.createElement(MarkdownContent, { content, placeholder }));

describe("MarkdownContent", () => {
  it("renders CommonMark, GFM, and visible single-line breaks without changing source", () => {
    const source = "# Heading\n\n**bold** and ~~gone~~\n\n---\n\n- [x] task\n\n| A | B |\n| - | - |\n| 1 | 2 |";
    const html = render(source);
    expect(html).toContain("<h1 ");
    expect(html).toContain(">Heading</h1>");
    expect(html).toContain("<strong ");
    expect(html).toContain(">bold</strong>");
    expect(html).toContain("<del ");
    expect(html).toContain(">gone</del>");
    expect(html).toContain('<hr class="border-white/15"/>');
    expect(html).toContain("type=\"checkbox\"");
    expect(html).toContain("<table");
    expect(source).toBe("# Heading\n\n**bold** and ~~gone~~\n\n---\n\n- [x] task\n\n| A | B |\n| - | - |\n| 1 | 2 |");
  });

  it("gives every semantic heading level a distinct, contained hierarchy", () => {
    const html = render("# One\n\n## Two\n\n### Three\n\n#### Four\n\n##### Five\n\n###### Six");

    expect(html).toContain('<h1 class="mt-6 break-words text-[1.0625rem]');
    expect(html).toContain('<h2 class="mt-5 break-words text-base');
    expect(html).toContain('<h3 class="mt-4 break-words text-[0.9375rem]');
    expect(html).toContain('<h4 class="mt-4 break-words text-sm');
    expect(html).toContain('<h5 class="mt-3 break-words text-[0.8125rem]');
    expect(html).toContain('<h6 class="mt-3 break-words text-xs');
    expect(html.match(/<h[1-6] /g)).toHaveLength(6);
  });

  it("renders prose, code, links, images, and escaped Markdown semantically", () => {
    const source = "> Quoted\n\n1. first\n   - nested\n\nline one\nline two\n\n`inline`\n\n```js\nconst value = 1;\n```\n\n[docs](https://example.test) <https://example.test>\n\n![map](https://example.test/map.png)\n\n\\*literal asterisk\\*";
    const html = render(source);

    expect(html).toContain("<blockquote");
    expect(html).toContain('class="list-decimal space-y-1 pl-5 marker:text-zinc-500"');
    expect(html).toContain('class="list-disc space-y-1 pl-5 marker:text-zinc-500"');
    expect(html).toContain("<br/>");
    expect(html).toContain('class="overflow-x-auto rounded-lg bg-black/30 p-3 text-xs leading-5"');
    expect(html).toContain("const value = 1;");
    expect(html).toContain('href="https://example.test"');
    expect(html).toContain('src="https://example.test/map.png"');
    expect(html).toContain("*literal asterisk*");
  });

  it("keeps raw HTML and unsafe URLs inert and preserves placeholders", () => {
    const html = render('<script>alert(1)</script> [bad](javascript:alert) ![bad](javascript:alert)');
    expect(html).not.toContain("<script>");
    expect(html).not.toContain('href="javascript:');
    expect(html).not.toContain('src="javascript:');
    expect(render("", "Nothing here.")).toContain("Nothing here.");
  });

  it("is the shared display renderer for persisted narrative surfaces", () => {
    for (const page of [
      "SessionProfile.jsx",
      "LoreProfile.jsx",
      "MapProfile.jsx",
      "NpcProfile.jsx",
      "PCProfile.jsx",
      "PCs.jsx",
      "ItemProfile.jsx",
      "Items.jsx",
      "Maps.jsx",
      "Lore.jsx",
      "Npcs.jsx",
      "DopamineDungeonDashboard.jsx",
    ]) {
      const source = readFileSync(new URL(`../pages/${page}`, import.meta.url), "utf8");
      expect(source).toContain("MarkdownContent");
      expect(source).not.toContain("renderInlineMarkdown");
    }
  });
});
