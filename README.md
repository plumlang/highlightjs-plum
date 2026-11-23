# Plumlang for highlight.js

[Plumlang](https://plum.elixpo.com) syntax highlighting for
[highlight.js](https://highlightjs.org) 11, for `.plum` code.

The grammar follows the Plumlang lexer and covers:

- **Keywords**: `plant`, `root`, `branch`, `tree`, `trait`, `kind`, `seed`,
  `if` / `else` / `match`, `for` / `in` / `while` / `break` / `continue`,
  `return`, `try` / `catch` / `finally` / `throw`, `spawn`, `weak`, and the
  word operators `and`, `or`, `not`, `is`, `as`.
- **Literals**: `good` / `bad` (and `true` / `false`), `none`; integers in
  decimal, `0x`, `0o` and `0b` with `_` separators; floats with exponents.
  `1..5` is a range, not a float.
- **Strings**: `"..."` and `"""..."""`, escapes (`\n`, `\{`, `\u{1F351}`, ...),
  and `{interpolation}` with the expression highlighted inside it, nested
  strings included, and its `{value:format}` spec.
- **Comments**: `#` to the end of the line. There are no block comments, and a
  `#` inside a string is text.
- **Declarations and names**: function, tree, trait and kind names, the tree a
  tree extends, built-in types (`int`, `str`, `list`, `map`, `Channel`, ...)
  and error trees, built-in functions (`drop`, `len`, `type_of`, ...), `self`
  and `super`, calls and method calls, `UPPER_CASE` constants, `PascalCase`
  types, relative `seed ./path` imports, and operators.

It uses only the standard highlight.js scopes, so every highlight.js theme
styles it.

## Usage

The language is registered as `plum`, with the name "Plumlang". Mark code
blocks with `class="language-plum"`.

### In a web page

Load `dist/plum.min.js` after highlight.js. It registers the language itself.

```html
<link rel="stylesheet"
  href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/styles/default.min.css">
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.11.1/build/highlight.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/plumlang/highlightjs-plum@main/dist/plum.min.js"></script>
<script>hljs.highlightAll();</script>

<pre><code class="language-plum">plant name = "Ada"
drop("Hello, {name}!")</code></pre>
```

### With npm

```sh
npm install highlight.js highlightjs-plum
# or, straight from this repository:
npm install highlight.js github:plumlang/highlightjs-plum
```

```js
import hljs from 'highlight.js/lib/core';
import plum from 'highlightjs-plum';

hljs.registerLanguage('plum', plum);
hljs.highlightAll();
```

With CommonJS (Node.js 20.19 or later, which can `require` ES modules):

```js
const hljs = require('highlight.js/lib/core');
hljs.registerLanguage('plum', require('highlightjs-plum').default);
```

The grammar source is `src/languages/plum.js`, if your build compiles
grammars itself.

## Developing

The grammar is built and tested with highlight.js's own tools, from a
highlight.js checkout with this repository in its `extra/` folder:

```sh
git clone https://github.com/highlightjs/highlight.js.git
cd highlight.js
git clone https://github.com/plumlang/highlightjs-plum.git extra/highlightjs-plum
npm install

node tools/build.js -t node plum
ONLY_EXTRA=true npx mocha test/markup    # the markup tests in test/markup/plum

node tools/build.js -t cdn plum          # writes extra/highlightjs-plum/dist/
```

Each test is a `.txt` file of Plumlang and the `.expect.txt` file with the
HTML highlight.js should produce for it. After changing the grammar, rebuild
`dist/` and commit it with the change.

The [Plumlang language documentation](https://plum.elixpo.com/docs/language/) and the
[Tree-sitter grammar](https://github.com/plumlang/tree-sitter-plum) are the
references for what each construct is.

## License

MIT, see [LICENSE](LICENSE). The Plumlang name and marks are not licensed by
it; see [NOTICE](NOTICE).
