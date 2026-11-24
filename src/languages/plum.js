/*
Language: Plumlang
Description: Plumlang is a small, fast, memory-safe programming language that ships as one binary.
Author: Elixpo and the Plumlang contributors
Website: https://plum.elixpo.com
Category: common, scripting
*/

/** @type LanguageFn */
export default function(hljs) {
  const regex = hljs.regex;
  const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/;

  // The keyword table of the Plumlang lexer (src/lexer/lexer.c), less the
  // literals and `self` / `super`, which are listed below.
  const KEYWORDS = [
    'and',
    'as',
    'branch',
    'break',
    'catch',
    'continue',
    'else',
    'finally',
    'for',
    'if',
    'in',
    'is',
    'kind',
    'match',
    'not',
    'or',
    'plant',
    'return',
    'root',
    'seed',
    'spawn',
    'throw',
    'trait',
    'tree',
    'try',
    'weak',
    'while'
  ];

  // `true` and `false` are accepted spellings of `good` and `bad`.
  const LITERALS = [
    'good',
    'bad',
    'true',
    'false',
    'none'
  ];

  // Built-in functions: no `seed` needed.
  const BUILT_INS = [
    'drop',
    'ask',
    'len',
    'type_of',
    'assert',
    'exit'
  ];

  // Built-in types, and the built-in error trees. `int`, `float`, `str`,
  // `byte` and `set` are also called as conversion functions.
  const TYPES = [
    'int',
    'float',
    'bool',
    'str',
    'byte',
    'list',
    'map',
    'set',
    'Channel',
    'Json',
    'Error',
    'ValueError',
    'ParseError',
    'IndexError',
    'KeyError',
    'OverflowError',
    'ZeroDivisionError',
    'IOError',
    'NetError',
    'AssertError'
  ];

  const PLUM_KEYWORDS = {
    $pattern: /\b[A-Za-z_][A-Za-z0-9_]*\b/,
    // `plant`, `branch` and `seed` are rarely keywords elsewhere: they count
    // more towards detecting Plumlang (as does `branch name`, below).
    keyword: KEYWORDS.map((word) => ({ plant: 'plant|3', branch: 'branch|3', seed: 'seed|2' })[word] || word),
    literal: LITERALS,
    built_in: BUILT_INS,
    type: TYPES,
    'variable.language': [
      'self',
      'super'
    ]
  };

  // A name being declared: an identifier that is not a reserved word.
  const NAME_RE = regex.concat(
    '\\b(?!',
    regex.either(...KEYWORDS, ...LITERALS, 'self', 'super'),
    '\\b)',
    IDENT_RE
  );

  // Integers: decimal, 0x, 0o, 0b, with `_` between digits. Floats need a
  // digit on both sides of the point (so `1..5` is a range), an exponent, or
  // both.
  const NUMBER = {
    scope: 'number',
    relevance: 0,
    variants: [
      { match: /\b0[xX][0-9a-fA-F](?:_?[0-9a-fA-F])*\b/ },
      { match: /\b0[oO][0-7](?:_?[0-7])*\b/ },
      { match: /\b0[bB][01](?:_?[01])*\b/ },
      { match: /\b[0-9](?:_?[0-9])*(?:\.[0-9](?:_?[0-9])*)?(?:[eE][+-]?[0-9](?:_?[0-9])*)?\b/ }
    ]
  };

  const ESCAPE = {
    scope: 'char.escape',
    match: /\\(?:u\{[0-9a-fA-F]{1,6}\}|[ntr0\\"{}])/,
    relevance: 0
  };

  // `{expression}` inside a string, with an optional format after a `:` at
  // its top level: "{price:.2}", "{name:>6}". A `:` inside nested brackets,
  // as in "{f(a: 1)}" or "{ {"a": 1}["a"] }", is not a format.
  const SUBST = {
    scope: 'subst',
    begin: /\{/,
    end: /\}/,
    keywords: PLUM_KEYWORDS,
    contains: [] // filled in below, once the string modes exist
  };

  const FORMAT_SPEC = {
    scope: 'symbol',
    begin: /:/,
    // The lexer ends a format at `}`, `"` or the end of the line.
    end: /(?=[}"\n])/,
    excludeBegin: true,
    relevance: 0
  };

  const TRIPLE_STRING = {
    scope: 'string',
    begin: /"""/,
    end: /"""/,
    contains: [
      ESCAPE,
      hljs.BACKSLASH_ESCAPE,
      SUBST
    ],
    relevance: 0
  };

  const STRING = {
    scope: 'string',
    begin: /"/,
    end: /"/,
    illegal: /\n/,
    contains: [
      ESCAPE,
      hljs.BACKSLASH_ESCAPE,
      SUBST
    ],
    relevance: 0
  };

  // `seed ./models/user`: a path relative to the importing file.
  const RELATIVE_IMPORT = {
    match: [
      /\bseed/,
      /\s+/,
      /(?:\.\.?\/)+[A-Za-z_][A-Za-z0-9_]*(?:\/[A-Za-z_][A-Za-z0-9_]*)*/
    ],
    scope: {
      1: 'keyword',
      3: 'string'
    }
  };

  const FUNCTION_DEFINITION = {
    match: [
      /\bbranch/,
      /\s+/,
      NAME_RE
    ],
    scope: {
      1: 'keyword',
      3: 'title.function'
    },
    relevance: 3
  };

  // `tree Circle : Shape`, `trait Sized : Shape`, `kind Direction`
  const TYPE_DEFINITION = {
    variants: [
      {
        match: [
          /\b(?:tree|trait)/,
          /\s+/,
          NAME_RE,
          /\s*:\s*/,
          NAME_RE
        ],
        scope: {
          1: 'keyword',
          3: 'title.class',
          5: 'title.class.inherited'
        }
      },
      {
        match: [
          /\b(?:tree|trait|kind)/,
          /\s+/,
          NAME_RE
        ],
        scope: {
          1: 'keyword',
          3: 'title.class'
        }
      }
    ]
  };

  // UPPER_SNAKE_CASE names are constants by convention (spec 2.4).
  const CONSTANT = {
    scope: 'variable.constant',
    match: /\b_*[A-Z][A-Z0-9_]*[A-Z0-9]\b/,
    relevance: 0
  };

  // PascalCase names are types: trees, traits, kinds and their cases.
  const TYPE_NAME = {
    scope: 'title.class',
    match: regex.concat(
      '\\b(?!',
      regex.either(...TYPES),
      '\\b)',
      /_*[A-Z][A-Za-z0-9_]*/
    ),
    relevance: 0
  };

  // `name(`, other than a keyword, built-in function or built-in type
  const FUNCTION_CALL = {
    scope: 'title.function.invoke',
    match: regex.concat(
      '\\b(?!',
      regex.either(...KEYWORDS, ...LITERALS, ...BUILT_INS, ...TYPES, 'self', 'super'),
      '\\b)',
      /_*[a-z][A-Za-z0-9_]*/,
      regex.lookahead(/\s*\(/)
    ),
    relevance: 0
  };

  // `.name` and `?.name`: a method call, or a field, whose name may also be
  // a built-in type or function (`xs.map(...)`, `self.set`).
  const MEMBER = {
    relevance: 0,
    variants: [
      {
        match: [
          /\?\./,
          IDENT_RE,
          /(?=\s*\()/
        ],
        scope: {
          1: 'operator',
          2: 'title.function.invoke'
        }
      },
      {
        match: [
          /\./,
          IDENT_RE,
          /(?=\s*\()/
        ],
        scope: { 2: 'title.function.invoke' }
      },
      {
        match: [
          /\?\./,
          IDENT_RE
        ],
        scope: { 1: 'operator' }
      },
      { match: regex.concat(/\./, IDENT_RE) }
    ]
  };

  // The lexer's operators, longest first: `//=` `**=` `<<=` `>>=` `..=`,
  // `..` `->` `=>` `?.` `??`, then the rest with an optional `=`.
  const OPERATOR = {
    scope: 'operator',
    match: /(?:\/\/|\*\*|<<|>>)=?|\.\.=?|->|=>|\?[.?]?|[=!<>]=|[+\-*/%&|^]=?|[~<>=]/,
    relevance: 0
  };

  // `#[ ... ]#` nests: each `#[` inside needs its own `]#`. Doc comments
  // (`##` lines) are line comments here; highlight.js has no scope of its
  // own for them.
  const BLOCK_COMMENT = hljs.COMMENT(/#\[/, /\]#/, {
    contains: [ 'self' ],
    relevance: 10
  });

  const EXPRESSION = [
    BLOCK_COMMENT,
    hljs.HASH_COMMENT_MODE,
    TRIPLE_STRING,
    STRING,
    NUMBER,
    CONSTANT,
    MEMBER,
    TYPE_NAME,
    FUNCTION_CALL,
    OPERATOR
  ];

  // Brackets nested inside an interpolation, so a `:` in them is not taken
  // as the start of a format.
  const NESTED = [
    {
      begin: /\(/,
      end: /\)/,
      keywords: PLUM_KEYWORDS,
      contains: [ 'self', ...EXPRESSION ]
    },
    {
      begin: /\[/,
      end: /\]/,
      keywords: PLUM_KEYWORDS,
      contains: [ 'self', ...EXPRESSION ]
    },
    {
      begin: /\{/,
      end: /\}/,
      keywords: PLUM_KEYWORDS,
      contains: [ 'self', ...EXPRESSION ]
    }
  ];
  NESTED.forEach((mode) => {
    mode.contains.push(...NESTED.filter((other) => other !== mode));
  });

  SUBST.contains = [
    FORMAT_SPEC,
    ...NESTED,
    ...EXPRESSION
  ];

  return {
    name: 'Plumlang',
    aliases: [ 'plum' ],
    keywords: PLUM_KEYWORDS,
    // Plumlang has no `;`, `'...'` strings, `&&`, `||`, `!` or `++`.
    illegal: /;|'|&&|\|\||!(?!=)|\+\+/,
    contains: [
      RELATIVE_IMPORT,
      FUNCTION_DEFINITION,
      TYPE_DEFINITION,
      ...EXPRESSION
    ]
  };
}
