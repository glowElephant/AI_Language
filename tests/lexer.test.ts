import { describe, it, expect } from 'vitest';
import { tokenize } from '../src/lexer';
import { TokenType } from '../src/types';

function types(source: string): TokenType[] {
  return tokenize(source).map((t) => t.type).filter((t) => t !== TokenType.EOF);
}

function values(source: string): string[] {
  return tokenize(source).map((t) => t.value).filter((_, i, arr) => i < arr.length - 1);
}

describe('Lexer', () => {
  describe('basic tokens', () => {
    it('should tokenize a simple command', () => {
      expect(types('ACK')).toEqual([TokenType.COMMAND]);
    });

    it('should tokenize arrow (unicode)', () => {
      expect(types('A→B')).toEqual([
        TokenType.COMMAND,
        TokenType.ARROW,
        TokenType.COMMAND,
      ]);
    });

    it('should tokenize arrow (ascii fallback ->)', () => {
      expect(types('A->B')).toEqual([
        TokenType.COMMAND,
        TokenType.ARROW,
        TokenType.COMMAND,
      ]);
    });

    it('should tokenize colon, pipe, dot, comma', () => {
      expect(types('a:b|c.d,e')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.IDENTIFIER,
        TokenType.PIPE,
        TokenType.IDENTIFIER,
        TokenType.DOT,
        TokenType.IDENTIFIER,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
      ]);
    });

    it('should tokenize special single chars', () => {
      expect(types('!?#@*=()[]{}<>')).toEqual([
        TokenType.BANG,
        TokenType.QUESTION,
        TokenType.HASH,
        TokenType.AT,
        TokenType.STAR,
        TokenType.EQUALS,
        TokenType.LPAREN,
        TokenType.RPAREN,
        TokenType.LBRACKET,
        TokenType.RBRACKET,
        TokenType.LBRACE,
        TokenType.RBRACE,
        TokenType.LANGLE,
        TokenType.RANGLE,
      ]);
    });
  });

  describe('numbers', () => {
    it('should tokenize integers', () => {
      const tokens = tokenize('42');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('42');
    });

    it('should tokenize negative integers', () => {
      const tokens = tokenize('-7');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('-7');
    });

    it('should tokenize floats', () => {
      const tokens = tokenize('3.14');
      expect(tokens[0].type).toBe(TokenType.NUMBER);
      expect(tokens[0].value).toBe('3.14');
    });

    it('should tokenize numbers with unit suffixes as identifiers', () => {
      const tokens = tokenize('3s');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('3s');
    });

    it('should tokenize complex unit values', () => {
      const tokens = tokenize('500ms');
      expect(tokens[0].type).toBe(TokenType.IDENTIFIER);
      expect(tokens[0].value).toBe('500ms');
    });
  });

  describe('booleans and null', () => {
    it('should tokenize T as boolean', () => {
      const tokens = tokenize('T');
      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
    });

    it('should tokenize F as boolean', () => {
      const tokens = tokenize('F');
      expect(tokens[0].type).toBe(TokenType.BOOLEAN);
    });

    it('should tokenize _ as null', () => {
      const tokens = tokenize('_');
      expect(tokens[0].type).toBe(TokenType.NULL);
    });
  });

  describe('strings', () => {
    it('should tokenize quoted strings', () => {
      const tokens = tokenize('"hello world"');
      expect(tokens[0].type).toBe(TokenType.STRING);
      expect(tokens[0].value).toBe('hello world');
    });

    it('should handle escape sequences in strings', () => {
      const tokens = tokenize('"a\\:b"');
      expect(tokens[0].value).toBe('a:b');
    });

    it('should handle newline escape', () => {
      const tokens = tokenize('"line1\\nline2"');
      expect(tokens[0].value).toBe('line1\nline2');
    });
  });

  describe('identifiers vs commands', () => {
    it('should classify lowercase words as identifiers', () => {
      expect(types('hello')).toEqual([TokenType.IDENTIFIER]);
    });

    it('should classify UPPERCASE words as commands', () => {
      expect(types('REQ')).toEqual([TokenType.COMMAND]);
    });

    it('should classify mixed case as identifiers', () => {
      expect(types('userId')).toEqual([TokenType.IDENTIFIER]);
    });

    it('should handle commands with digits', () => {
      expect(types('V1')).toEqual([TokenType.COMMAND]);
    });

    it('should handle commands with underscores', () => {
      expect(types('GAME_V1')).toEqual([TokenType.COMMAND]);
    });
  });

  describe('double semicolon', () => {
    it('should tokenize ;; as DOUBLE_SEMI', () => {
      expect(types('line1;;line2')).toEqual([
        TokenType.IDENTIFIER,
        TokenType.DOUBLE_SEMI,
        TokenType.IDENTIFIER,
      ]);
    });
  });

  describe('complex messages', () => {
    it('should tokenize a routed request', () => {
      const tokens = types('A→B:REQ:action:build');
      expect(tokens).toEqual([
        TokenType.COMMAND,    // A
        TokenType.ARROW,      // →
        TokenType.COMMAND,    // B
        TokenType.COLON,      // :
        TokenType.COMMAND,    // REQ
        TokenType.COLON,      // :
        TokenType.IDENTIFIER, // action
        TokenType.COLON,      // :
        TokenType.IDENTIFIER, // build
      ]);
    });

    it('should tokenize key-value pairs with pipes', () => {
      const tokens = types('SET:color:red|size:lg|visible:T');
      expect(tokens).toEqual([
        TokenType.COMMAND,    // SET
        TokenType.COLON,      // :
        TokenType.IDENTIFIER, // color
        TokenType.COLON,      // :
        TokenType.IDENTIFIER, // red
        TokenType.PIPE,       // |
        TokenType.IDENTIFIER, // size
        TokenType.COLON,      // :
        TokenType.IDENTIFIER, // lg
        TokenType.PIPE,       // |
        TokenType.IDENTIFIER, // visible
        TokenType.COLON,      // :
        TokenType.BOOLEAN,    // T
      ]);
    });

    it('should tokenize list syntax', () => {
      const tokens = types('[a,b,c]');
      expect(tokens).toEqual([
        TokenType.LBRACKET,
        TokenType.IDENTIFIER,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.RBRACKET,
      ]);
    });

    it('should tokenize map syntax', () => {
      const tokens = types('{k:v,k2:v2}');
      expect(tokens).toEqual([
        TokenType.LBRACE,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.IDENTIFIER,
        TokenType.COMMA,
        TokenType.IDENTIFIER,
        TokenType.COLON,
        TokenType.IDENTIFIER,
        TokenType.RBRACE,
      ]);
    });

    it('should tokenize broadcast', () => {
      const tokens = types('A→*:PING');
      expect(tokens).toEqual([
        TokenType.COMMAND,
        TokenType.ARROW,
        TokenType.STAR,
        TokenType.COLON,
        TokenType.COMMAND,
      ]);
    });

    it('should tokenize reference with hash', () => {
      expect(values('ACK:#msg42')).toEqual([
        'ACK', ':', '#', 'msg42',
      ]);
    });
  });

  describe('error handling', () => {
    it('should throw on unterminated string', () => {
      expect(() => tokenize('"hello')).toThrow('Unterminated string');
    });

    it('should throw on invalid escape', () => {
      expect(() => tokenize('"\\x"')).toThrow('Invalid escape sequence');
    });
  });
});
