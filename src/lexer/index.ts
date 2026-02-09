import { Token, TokenType, LexerError } from '../types';

const SINGLE_CHAR_TOKENS: Record<string, TokenType> = {
  ':': TokenType.COLON,
  '|': TokenType.PIPE,
  '.': TokenType.DOT,
  ',': TokenType.COMMA,
  '=': TokenType.EQUALS,
  '!': TokenType.BANG,
  '?': TokenType.QUESTION,
  '#': TokenType.HASH,
  '@': TokenType.AT,
  '*': TokenType.STAR,
  '(': TokenType.LPAREN,
  ')': TokenType.RPAREN,
  '[': TokenType.LBRACKET,
  ']': TokenType.RBRACKET,
  '{': TokenType.LBRACE,
  '}': TokenType.RBRACE,
  '<': TokenType.LANGLE,
  '>': TokenType.RANGLE,
};

const ESCAPE_MAP: Record<string, string> = {
  ':': ':',
  '|': '|',
  ',': ',',
  '\\': '\\',
  '"': '"',
  'n': '\n',
  't': '\t',
};

const SPECIAL_CHARS = new Set(Object.keys(SINGLE_CHAR_TOKENS));
SPECIAL_CHARS.add('\\');
SPECIAL_CHARS.add('"');
SPECIAL_CHARS.add('→');
SPECIAL_CHARS.add(';');

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9';
}

function isLetter(ch: string): boolean {
  return (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z');
}

function isUpper(ch: string): boolean {
  return ch >= 'A' && ch <= 'Z';
}

function isIdentChar(ch: string): boolean {
  return isLetter(ch) || isDigit(ch) || ch === '_';
}

function isSafeChar(ch: string): boolean {
  return isIdentChar(ch) || ch === '-' || ch === '/' || ch === '+' || ch === '~';
}

export function tokenize(source: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const len = source.length;

  while (i < len) {
    const ch = source[i];

    // Skip whitespace (space only — tabs/newlines are not expected in single messages)
    if (ch === ' ') {
      i++;
      continue;
    }

    // Arrow →  (UTF-8 multi-byte) or  -> (ASCII fallback)
    if (ch === '→') {
      tokens.push({ type: TokenType.ARROW, value: '→', pos: i });
      i++;
      continue;
    }
    if (ch === '-' && i + 1 < len && source[i + 1] === '>') {
      tokens.push({ type: TokenType.ARROW, value: '→', pos: i });
      i += 2;
      continue;
    }

    // Double semicolon ;; (multi-line separator)
    if (ch === ';' && i + 1 < len && source[i + 1] === ';') {
      tokens.push({ type: TokenType.DOUBLE_SEMI, value: ';;', pos: i });
      i += 2;
      continue;
    }

    // Single-character tokens
    if (SINGLE_CHAR_TOKENS[ch]) {
      tokens.push({ type: SINGLE_CHAR_TOKENS[ch], value: ch, pos: i });
      i++;
      continue;
    }

    // Quoted string
    if (ch === '"') {
      const start = i;
      i++; // skip opening quote
      let str = '';
      while (i < len && source[i] !== '"') {
        if (source[i] === '\\') {
          i++;
          if (i >= len) {
            throw new LexerError('Unterminated escape in string', start, source);
          }
          const esc = ESCAPE_MAP[source[i]];
          if (esc === undefined) {
            throw new LexerError(`Invalid escape sequence: \\${source[i]}`, i - 1, source);
          }
          str += esc;
        } else {
          str += source[i];
        }
        i++;
      }
      if (i >= len) {
        throw new LexerError('Unterminated string', start, source);
      }
      i++; // skip closing quote
      tokens.push({ type: TokenType.STRING, value: str, pos: start });
      continue;
    }

    // Number: starts with digit, or minus followed by digit
    if (isDigit(ch) || (ch === '-' && i + 1 < len && isDigit(source[i + 1]))) {
      const start = i;
      if (ch === '-') i++;
      while (i < len && isDigit(source[i])) i++;
      // Fractional part — but only if followed by digit (not DOT accessor like "ui.color")
      if (i < len && source[i] === '.' && i + 1 < len && isDigit(source[i + 1])) {
        i++; // skip dot
        while (i < len && isDigit(source[i])) i++;
      }
      // Check if followed by a letter — then it's a bare string with suffix (e.g., "3s", "10mb")
      if (i < len && isLetter(source[i])) {
        // It's a bare string like "3s", "500ms", "12mb"
        while (i < len && isSafeChar(source[i])) i++;
        tokens.push({ type: TokenType.IDENTIFIER, value: source.slice(start, i), pos: start });
      } else {
        tokens.push({ type: TokenType.NUMBER, value: source.slice(start, i), pos: start });
      }
      continue;
    }

    // Identifier or command or boolean/null
    if (isLetter(ch) || ch === '_') {
      const start = i;
      while (i < len && isIdentChar(source[i])) i++;
      const word = source.slice(start, i);

      // Check for unit-suffixed values attached: handled as identifier
      // Boolean: standalone T or F
      if ((word === 'T' || word === 'F') && word.length === 1) {
        tokens.push({ type: TokenType.BOOLEAN, value: word, pos: start });
        continue;
      }

      // Null: standalone _
      if (word === '_' && word.length === 1) {
        tokens.push({ type: TokenType.NULL, value: '_', pos: start });
        continue;
      }

      // Command: all uppercase (may contain digits/underscores)
      if (isAllUpperOrDigitUnderscore(word) && isUpper(word[0])) {
        tokens.push({ type: TokenType.COMMAND, value: word, pos: start });
      } else {
        tokens.push({ type: TokenType.IDENTIFIER, value: word, pos: start });
      }
      continue;
    }

    // Backslash escape outside of quoted string (bare string escape)
    if (ch === '\\') {
      i++;
      if (i >= len) {
        throw new LexerError('Unexpected end after escape', i - 1, source);
      }
      const esc = ESCAPE_MAP[source[i]];
      if (esc === undefined) {
        throw new LexerError(`Invalid escape sequence: \\${source[i]}`, i - 1, source);
      }
      // Treat as identifier with the escaped char
      tokens.push({ type: TokenType.IDENTIFIER, value: esc, pos: i - 1 });
      i++;
      continue;
    }

    throw new LexerError(`Unexpected character: ${ch}`, i, source);
  }

  tokens.push({ type: TokenType.EOF, value: '', pos: i });
  return tokens;
}

function isAllUpperOrDigitUnderscore(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!(isUpper(c) || isDigit(c) || c === '_')) return false;
  }
  return true;
}
