// ── Token Types (Lexer output) ──

export enum TokenType {
  // Structural
  ARROW = 'ARROW',           // →
  COLON = 'COLON',           // :
  PIPE = 'PIPE',             // |
  DOT = 'DOT',               // .
  COMMA = 'COMMA',           // ,
  EQUALS = 'EQUALS',         // =
  BANG = 'BANG',              // !
  QUESTION = 'QUESTION',     // ?
  HASH = 'HASH',             // #
  AT = 'AT',                  // @
  STAR = 'STAR',              // *

  // Brackets
  LPAREN = 'LPAREN',         // (
  RPAREN = 'RPAREN',         // )
  LBRACKET = 'LBRACKET',     // [
  RBRACKET = 'RBRACKET',     // ]
  LBRACE = 'LBRACE',         // {
  RBRACE = 'RBRACE',         // }
  LANGLE = 'LANGLE',         // <
  RANGLE = 'RANGLE',         // >

  // Literals
  IDENTIFIER = 'IDENTIFIER', // bare word (lowercase or mixed)
  COMMAND = 'COMMAND',        // UPPER_CASE word
  STRING = 'STRING',          // "quoted string"
  NUMBER = 'NUMBER',          // 42, -7, 3.14
  BOOLEAN = 'BOOLEAN',        // T, F
  NULL = 'NULL',              // _

  // Special
  DOUBLE_SEMI = 'DOUBLE_SEMI', // ;; (multi-line separator)
  EOF = 'EOF',
}

export interface Token {
  type: TokenType;
  value: string;
  pos: number; // character offset in source
}

// ── AST Node Types (Parser output) ──

export type ASTNode =
  | MessageNode
  | RoutingNode
  | CommandBlockNode
  | PayloadNode
  | PayloadGroupNode
  | KeyValueNode
  | ValueNode;

export interface MessageNode {
  kind: 'Message';
  routing: RoutingNode | null;
  command: CommandBlockNode;
}

export interface RoutingNode {
  kind: 'Routing';
  sender: string;
  receiver: ReceiverNode;
}

export type ReceiverNode =
  | { type: 'single'; id: string }
  | { type: 'broadcast' }                    // *
  | { type: 'multicast'; ids: string[] }     // [A,B,C]
  | { type: 'anycast'; group: string };      // <GROUP>

export interface CommandBlockNode {
  kind: 'CommandBlock';
  command: string;       // e.g. "REQ", "GAME.SPAWN"
  payload: PayloadNode | null;
}

export interface PayloadNode {
  kind: 'Payload';
  groups: PayloadGroupNode[];
}

export interface PayloadGroupNode {
  kind: 'PayloadGroup';
  entry: KeyValueNode | ValueNode;
}

export interface KeyValueNode {
  kind: 'KeyValue';
  key: string;           // dotted key like "ui.color"
  value: ValueNode;
}

export type ValueNode =
  | StringValue
  | NumberValue
  | BooleanValue
  | NullValue
  | ListValue
  | MapValue
  | GroupedValue
  | ReferenceValue;

export interface StringValue {
  kind: 'String';
  value: string;
}

export interface NumberValue {
  kind: 'Number';
  value: number;
}

export interface BooleanValue {
  kind: 'Boolean';
  value: boolean;
}

export interface NullValue {
  kind: 'Null';
}

export interface ListValue {
  kind: 'List';
  items: ValueNode[];
}

export interface MapValue {
  kind: 'Map';
  entries: KeyValueNode[];
}

export interface GroupedValue {
  kind: 'Grouped';
  name: string;
  args: ValueNode[];
}

export interface ReferenceValue {
  kind: 'Reference';
  id: string;            // #msg42 → "msg42"
}

// ── Message (high-level, encoder/decoder) ──

export interface AILMessage {
  sender?: string;
  receiver?: Receiver;
  command: string;
  payload?: Record<string, AILValue>;
}

export type Receiver =
  | { type: 'single'; id: string }
  | { type: 'broadcast' }
  | { type: 'multicast'; ids: string[] }
  | { type: 'anycast'; group: string };

export type AILValue =
  | string
  | number
  | boolean
  | null
  | AILValue[]
  | { [key: string]: AILValue };

// ── Errors ──

export class AILError extends Error {
  constructor(
    message: string,
    public pos: number,
    public source: string,
  ) {
    super(`${message} at position ${pos}`);
    this.name = 'AILError';
  }
}

export class LexerError extends AILError {
  constructor(message: string, pos: number, source: string) {
    super(message, pos, source);
    this.name = 'LexerError';
  }
}

export class ParseError extends AILError {
  constructor(message: string, pos: number, source: string) {
    super(message, pos, source);
    this.name = 'ParseError';
  }
}

export class ValidationError extends AILError {
  constructor(message: string, pos: number = 0, source: string = '') {
    super(message, pos, source);
    this.name = 'ValidationError';
  }
}
