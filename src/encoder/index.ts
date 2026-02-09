import { AILMessage, AILValue, Receiver } from '../types';

/**
 * Encode an AILMessage object into an AI_Language string.
 */
export function encode(msg: AILMessage): string {
  let result = '';

  // Routing header
  if (msg.sender) {
    result += msg.sender + '→';
    if (msg.receiver) {
      result += encodeReceiver(msg.receiver);
    }
    result += ':';
  }

  // Command
  result += msg.command;

  // Payload
  if (msg.payload && Object.keys(msg.payload).length > 0) {
    result += ':';
    const groups = Object.entries(msg.payload).map(
      ([key, value]) => `${key}:${encodeValue(value)}`
    );
    result += groups.join('|');
  }

  return result;
}

function encodeReceiver(receiver: Receiver): string {
  switch (receiver.type) {
    case 'single':
      return receiver.id;
    case 'broadcast':
      return '*';
    case 'multicast':
      return '[' + receiver.ids.join(',') + ']';
    case 'anycast':
      return '<' + receiver.group + '>';
  }
}

function encodeValue(value: AILValue): string {
  if (value === null) return '_';
  if (value === true) return 'T';
  if (value === false) return 'F';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return encodeString(value);
  if (Array.isArray(value)) {
    return '[' + value.map(encodeValue).join(',') + ']';
  }
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(
      ([k, v]) => `${k}:${encodeValue(v)}`
    );
    return '{' + entries.join(',') + '}';
  }
  return String(value);
}

const NEEDS_QUOTING = /[:|,\[\]{}\(\)\s"\\]/;

function encodeString(s: string): string {
  // Special single-char values that conflict with types
  if (s === 'T' || s === 'F' || s === '_') return `"${s}"`;

  // Check if it looks like a number
  if (/^-?\d+(\.\d+)?$/.test(s)) return `"${s}"`;

  // If contains special characters, quote it
  if (NEEDS_QUOTING.test(s)) {
    return '"' + s
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t')
      + '"';
  }

  return s;
}
