import { tokenize } from '../lexer';
import {
  Token, TokenType, ParseError,
  MessageNode, RoutingNode, ReceiverNode,
  CommandBlockNode, PayloadNode, PayloadGroupNode,
  KeyValueNode, ValueNode,
} from '../types';

export function parse(source: string): MessageNode {
  const tokens = tokenize(source);
  const parser = new Parser(tokens, source);
  return parser.parseMessage();
}

class Parser {
  private pos = 0;

  constructor(
    private tokens: Token[],
    private source: string,
  ) {}

  // ── Helpers ──

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private advance(): Token {
    const token = this.tokens[this.pos];
    this.pos++;
    return token;
  }

  private expect(type: TokenType): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw new ParseError(
        `Expected ${type} but got ${token.type} ("${token.value}")`,
        token.pos,
        this.source,
      );
    }
    return this.advance();
  }

  private check(type: TokenType): boolean {
    return this.peek().type === type;
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF;
  }

  // ── Lookahead: detect routing (SENDER → RECEIVER :) ──

  private hasRouting(): boolean {
    // Look for ARROW token before any COLON
    for (let i = 0; i < this.tokens.length; i++) {
      const t = this.tokens[i];
      if (t.type === TokenType.ARROW) return true;
      if (t.type === TokenType.COLON) return false;
    }
    return false;
  }

  // ── Parse Message ──

  parseMessage(): MessageNode {
    let routing: RoutingNode | null = null;

    if (this.hasRouting()) {
      routing = this.parseRouting();
    }

    const command = this.parseCommandBlock();

    if (!this.isAtEnd()) {
      const t = this.peek();
      throw new ParseError(
        `Unexpected token ${t.type} ("${t.value}") after message`,
        t.pos,
        this.source,
      );
    }

    return { kind: 'Message', routing, command };
  }

  // ── Parse Routing ──

  private parseRouting(): RoutingNode {
    const senderToken = this.expect(TokenType.COMMAND);
    this.expect(TokenType.ARROW);
    const receiver = this.parseReceiver();
    this.expect(TokenType.COLON);

    return {
      kind: 'Routing',
      sender: senderToken.value,
      receiver,
    };
  }

  private parseReceiver(): ReceiverNode {
    // Broadcast: *
    if (this.check(TokenType.STAR)) {
      this.advance();
      return { type: 'broadcast' };
    }

    // Multicast: [A,B,C]
    if (this.check(TokenType.LBRACKET)) {
      this.advance();
      const ids: string[] = [];
      ids.push(this.expect(TokenType.COMMAND).value);
      while (this.check(TokenType.COMMA)) {
        this.advance();
        ids.push(this.expect(TokenType.COMMAND).value);
      }
      this.expect(TokenType.RBRACKET);
      return { type: 'multicast', ids };
    }

    // Anycast: <GROUP>
    if (this.check(TokenType.LANGLE)) {
      this.advance();
      const group = this.expect(TokenType.COMMAND).value;
      this.expect(TokenType.RANGLE);
      return { type: 'anycast', group };
    }

    // Single receiver
    // Accept both COMMAND (uppercase) and IDENTIFIER (mixed case) as receiver
    const token = this.peek();
    if (token.type === TokenType.COMMAND || token.type === TokenType.IDENTIFIER) {
      this.advance();
      return { type: 'single', id: token.value };
    }

    throw new ParseError(
      `Expected receiver but got ${token.type} ("${token.value}")`,
      token.pos,
      this.source,
    );
  }

  // ── Parse Command Block ──

  private parseCommandBlock(): CommandBlockNode {
    const command = this.parseCommandName();

    let payload: PayloadNode | null = null;
    if (this.check(TokenType.COLON)) {
      this.advance();
      payload = this.parsePayload();
    }

    return { kind: 'CommandBlock', command, payload };
  }

  private parseCommandName(): string {
    // Command can be namespaced: GAME.SPAWN
    let name = this.expect(TokenType.COMMAND).value;
    while (this.check(TokenType.DOT)) {
      this.advance();
      name += '.' + this.expect(TokenType.COMMAND).value;
    }
    return name;
  }

  // ── Parse Payload ──

  private parsePayload(): PayloadNode {
    const groups: PayloadGroupNode[] = [];
    groups.push(this.parsePayloadGroup());

    while (this.check(TokenType.PIPE)) {
      this.advance();
      groups.push(this.parsePayloadGroup());
    }

    return { kind: 'Payload', groups };
  }

  private parsePayloadGroup(): PayloadGroupNode {
    // Try to parse as key:value
    // key is IDENTIFIER or COMMAND (for things like UI.WARN)
    // We need lookahead: if we see IDENTIFIER/COMMAND followed by COLON (and the value isn't another key-value at top level)
    if (this.isKeyValueStart()) {
      return { kind: 'PayloadGroup', entry: this.parseKeyValue() };
    }

    return { kind: 'PayloadGroup', entry: this.parseValue() };
  }

  private isKeyValueStart(): boolean {
    const cur = this.peek();
    if (cur.type !== TokenType.IDENTIFIER && cur.type !== TokenType.COMMAND) return false;

    // Look ahead: identifier (possibly dotted) followed by colon
    let ahead = this.pos + 1;
    // Skip dots and identifiers for dotted keys
    while (
      ahead < this.tokens.length &&
      this.tokens[ahead].type === TokenType.DOT &&
      ahead + 1 < this.tokens.length &&
      (this.tokens[ahead + 1].type === TokenType.IDENTIFIER || this.tokens[ahead + 1].type === TokenType.COMMAND)
    ) {
      ahead += 2;
    }
    return ahead < this.tokens.length && this.tokens[ahead].type === TokenType.COLON;
  }

  private parseKeyValue(): KeyValueNode {
    const key = this.parseKey();
    this.expect(TokenType.COLON);
    const value = this.parseValue();

    return { kind: 'KeyValue', key, value };
  }

  private parseKey(): string {
    let key = '';
    const token = this.peek();
    if (token.type === TokenType.IDENTIFIER || token.type === TokenType.COMMAND) {
      key = this.advance().value;
    } else {
      throw new ParseError(
        `Expected key but got ${token.type} ("${token.value}")`,
        token.pos,
        this.source,
      );
    }

    // Dotted key: ui.color, GAME.entity
    while (this.check(TokenType.DOT)) {
      this.advance();
      const next = this.peek();
      if (next.type === TokenType.IDENTIFIER || next.type === TokenType.COMMAND) {
        key += '.' + this.advance().value;
      } else {
        throw new ParseError(
          `Expected identifier after dot but got ${next.type}`,
          next.pos,
          this.source,
        );
      }
    }

    return key;
  }

  // ── Parse Value ──

  private parseValue(): ValueNode {
    const token = this.peek();

    switch (token.type) {
      case TokenType.STRING:
        this.advance();
        return { kind: 'String', value: token.value };

      case TokenType.NUMBER:
        this.advance();
        return { kind: 'Number', value: parseFloat(token.value) };

      case TokenType.BOOLEAN:
        this.advance();
        return { kind: 'Boolean', value: token.value === 'T' };

      case TokenType.NULL:
        this.advance();
        return { kind: 'Null' };

      case TokenType.HASH:
        return this.parseReference();

      case TokenType.LBRACKET:
        return this.parseList();

      case TokenType.LBRACE:
        return this.parseMap();

      case TokenType.IDENTIFIER:
        // Check for grouped: fn(a,b)
        if (this.pos + 1 < this.tokens.length && this.tokens[this.pos + 1].type === TokenType.LPAREN) {
          return this.parseGrouped();
        }
        this.advance();
        return { kind: 'String', value: token.value };

      case TokenType.COMMAND:
        // A command token used as a value (e.g., in a list of extension names)
        this.advance();
        return { kind: 'String', value: token.value };

      default:
        throw new ParseError(
          `Expected value but got ${token.type} ("${token.value}")`,
          token.pos,
          this.source,
        );
    }
  }

  private parseReference(): ValueNode {
    this.expect(TokenType.HASH);
    const token = this.peek();
    if (token.type === TokenType.IDENTIFIER || token.type === TokenType.COMMAND) {
      this.advance();
      return { kind: 'Reference', id: token.value };
    }
    throw new ParseError(
      `Expected reference ID after # but got ${token.type}`,
      token.pos,
      this.source,
    );
  }

  private parseList(): ValueNode {
    this.expect(TokenType.LBRACKET);
    const items: ValueNode[] = [];

    if (!this.check(TokenType.RBRACKET)) {
      items.push(this.parseValue());
      while (this.check(TokenType.COMMA)) {
        this.advance();
        items.push(this.parseValue());
      }
    }

    this.expect(TokenType.RBRACKET);
    return { kind: 'List', items };
  }

  private parseMap(): ValueNode {
    this.expect(TokenType.LBRACE);
    const entries: KeyValueNode[] = [];

    if (!this.check(TokenType.RBRACE)) {
      entries.push(this.parseKeyValue());
      while (this.check(TokenType.COMMA)) {
        this.advance();
        entries.push(this.parseKeyValue());
      }
    }

    this.expect(TokenType.RBRACE);
    return { kind: 'Map', entries };
  }

  private parseGrouped(): ValueNode {
    const name = this.advance().value; // identifier
    this.expect(TokenType.LPAREN);
    const args: ValueNode[] = [];

    if (!this.check(TokenType.RPAREN)) {
      args.push(this.parseValue());
      while (this.check(TokenType.COMMA)) {
        this.advance();
        args.push(this.parseValue());
      }
    }

    this.expect(TokenType.RPAREN);
    return { kind: 'Grouped', name, args };
  }
}
