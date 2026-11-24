// Checks the grammar against Plumlang's shared highlighting sample
// (plumlang's tests/highlight/: keywords.txt and sample.plum).
//
//   1. every keyword in the lexer's list is highlighted as a keyword
//      (keyword, literal or variable.language);
//   2. sample.plum highlights with no illegal text, and every token
//      `plum tokens` reports in it gets the right scope: keywords as above,
//      numbers `number`, strings `string`, the text after an interpolation
//      `subst`, formats `symbol`, and names and operators are neither
//      strings nor comments;
//   3. every comment is a comment (`#`, `##` and nested `#[ ... ]#` block
//      comments, every character of them), and every `#` in a string is
//      not.
//
// Tokens inside block comments are left out of 2, so a `plum` older than
// block comments (it reads them as code) still checks the rest.
//
// Run from a highlight.js checkout with this repository in
// extra/highlightjs-plum, after `node tools/build.js -t node plum`:
//
//   node extra/highlightjs-plum/test/sample.cjs [dir]
//
// dir holds keywords.txt and sample.plum (e.g. ../plumlang/tests/highlight);
// without it they are downloaded from plumlang's main branch. Needs `plum`
// on the PATH, or its path in $PLUM.
"use strict";
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");
const hljs = require(path.join(process.cwd(), "build"));

const BASE = "https://raw.githubusercontent.com/plumlang/plumlang/main/tests/highlight";

async function load(dir, name) {
  if (dir) return fs.readFileSync(path.join(dir, name), "utf8");
  const res = await fetch(`${BASE}/${name}`);
  if (!res.ok) throw new Error(`${BASE}/${name}: ${res.status}`);
  return res.text();
}

// The scope stack of every character of highlighted HTML, by "line:column"
// (1-based, in code points, as `plum tokens` counts them).
function scopesByPosition(html) {
  const map = new Map();
  const stack = [];
  const entities = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&#x27;": "'" };
  let line = 1, col = 1, i = 0;
  while (i < html.length) {
    if (html.startsWith("<span", i)) {
      const end = html.indexOf(">", i);
      const cls = /class="([^"]*)"/.exec(html.slice(i, end))[1].replace(/hljs-/g, "").replace(/_/g, "").trim();
      stack.push(cls);
      i = end + 1;
      continue;
    }
    if (html.startsWith("</span>", i)) { stack.pop(); i += 7; continue; }
    let ch;
    if (html[i] === "&") { const e = html.indexOf(";", i); ch = entities[html.slice(i, e + 1)]; i = e + 1; }
    else { ch = String.fromCodePoint(html.codePointAt(i)); i += ch.length; }
    map.set(`${line}:${col}`, stack.slice());
    if (ch === "\n") { line++; col = 1; } else col++;
  }
  return map;
}

// Where comments start in Plumlang source (a `#` outside a string), every
// character of block comments, and the `#`s inside strings, as
// "line:column" (1-based, code points): following strings, escapes, """
// strings, {interpolation} with nested brackets and nested #[ ]#.
function hashes(text) {
  const comments = [], inStrings = [], inBlocks = new Set();
  const mode = []; // "s" in a "string, "t" in a """string, a bracket in code
  const chars = Array.from(text);
  let line = 1, col = 0;
  const at = (i, s) => chars.slice(i, i + s.length).join("") === s;
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i], top = mode[mode.length - 1];
    col++;
    if (c === "\n") { line++; col = 0; if (top === "s") mode.pop(); continue; }
    if (top === "s" || top === "t") {
      if (c === "#") inStrings.push(`${line}:${col}`);
      if (c === "\\") { i++; col++; }
      else if (c === "{") mode.push("{");
      else if (top === "t" && at(i, '"""')) { mode.pop(); i += 2; col += 2; }
      else if (top === "s" && c === '"') mode.pop();
      continue;
    }
    if (at(i, "#[")) {
      comments.push(`${line}:${col}`);
      let depth = 0;
      for (; i < chars.length; i++, col++) {
        if (chars[i] === "\n") { line++; col = 0; continue; }
        inBlocks.add(`${line}:${col}`);
        if (at(i, "#[")) { depth++; inBlocks.add(`${line}:${col + 1}`); i++; col++; }
        else if (at(i, "]#")) {
          depth--; inBlocks.add(`${line}:${col + 1}`); i++; col++;
          if (depth === 0) break;
        }
      }
      continue;
    }
    if (c === "#") {
      comments.push(`${line}:${col}`);
      while (i + 1 < chars.length && chars[i + 1] !== "\n") { i++; col++; }
      continue;
    }
    if (at(i, '"""')) { mode.push("t"); i += 2; col += 2; }
    else if (c === '"') mode.push("s");
    else if ("{([".includes(c)) mode.push(c);
    else if ("})]".includes(c)) mode.pop();
  }
  return { comments, inStrings, inBlocks };
}

const KEYWORD_SCOPES = ["keyword", "literal", "variable language"];
const LITERAL = { GOOD: "literal", BAD: "literal", NONE: "literal", SELF: "variable language", SUPER: "variable language" };

(async () => {
  const dir = process.argv[2];
  const keywords = (await load(dir, "keywords.txt")).split("\n").filter(Boolean);
  const sample = await load(dir, "sample.plum");
  const problems = [];

  // 1. Each keyword on its own.
  for (const word of keywords) {
    const html = hljs.highlight(word, { language: "plum" }).value;
    const m = /^<span class="hljs-([^"]+)">([^<]*)<\/span>$/.exec(html);
    const scope = m && m[2] === word ? m[1].replace(/hljs-/g, "").replace(/_/g, "").trim() : null;
    if (!KEYWORD_SCOPES.includes(scope)) problems.push(`keyword '${word}' is not highlighted as a keyword: ${html}`);
  }

  // 2. The sample's tokens.
  const res = hljs.highlight(sample, { language: "plum", ignoreIllegals: false });
  if (res.illegal) problems.push("sample.plum has illegal text");
  const pos = scopesByPosition(res.value);
  const lines = sample.split("\n");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "plum-"));
  fs.writeFileSync(path.join(tmp, "sample.plum"), sample);
  const tokens = execFileSync(process.env.PLUM || "plum", ["tokens", path.join(tmp, "sample.plum")], { encoding: "utf8" });
  fs.rmSync(tmp, { recursive: true });
  const { comments, inStrings, inBlocks } = hashes(sample);
  let checked = 0;
  for (const t of tokens.split(/\r?\n/)) {
    const m = /^(\d+):(\d+) (\w+)(?: (.*))?$/.exec(t);
    if (!m) continue;
    const [, l, c, kind] = m;
    if (kind === "NEWLINE" || kind === "EOF") continue;
    const source = lines[+l - 1];
    // `seed ./path` is one string, like tree-sitter's path node.
    if (/^\s*seed\s+\.\.?\//.test(source) && kind !== "SEED") continue;
    if (inBlocks.has(`${l}:${c}`)) continue;
    const stack = pos.get(`${l}:${c}`) || [];
    const inner = stack[stack.length - 1] || "";
    const text = Array.from(source).slice(+c - 1).join("");
    let want;
    if (kind === "INT" || kind === "FLOAT") want = ["number"];
    else if (kind === "STRING" || kind === "STRING_HEAD") want = ["string"];
    else if (kind === "STRING_MID" || kind === "STRING_TAIL") want = ["subst"];
    else if (kind === "FORMAT") want = ["symbol"];
    else if (kind in LITERAL) want = [LITERAL[kind]];
    else if (!["IDENT", "UNDERSCORE", "ERROR"].includes(kind) && /^[a-z]/.test(text)) want = ["keyword"];
    checked++;
    const ok = want ? want.includes(inner) : !["string", "comment"].includes(inner);
    if (!ok) problems.push(`sample.plum:${l}:${c} ${kind} ${m[4] || ""}: want ${want ? want.join("/") : "code"}, got [${stack.join(" > ")}]`);
  }

  // 3. Comments, and `#` in strings.
  const isComment = (at) => (pos.get(at) || []).includes("comment");
  for (const at of comments) if (!isComment(at)) problems.push(`sample.plum:${at}: '#' should start a comment`);
  for (const at of inBlocks) if (!isComment(at)) problems.push(`sample.plum:${at}: should be in a block comment`);
  for (const at of inStrings) if (isComment(at)) problems.push(`sample.plum:${at}: '#' in a string is highlighted as a comment`);

  for (const p of problems) console.log(p);
  console.log(`${keywords.length} keywords, ${checked} tokens, ${comments.length} comments (${inBlocks.size} characters of block comments) and ${inStrings.length} '#' in strings checked: ${problems.length} problems`);
  process.exitCode = problems.length ? 1 : 0;
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
