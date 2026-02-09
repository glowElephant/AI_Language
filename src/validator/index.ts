import { parse } from '../parser';
import { MessageNode, ValidationError } from '../types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const BUILTIN_COMMANDS = new Set([
  // Request/Response
  'REQ', 'RES', 'GET', 'SET', 'DEL', 'PUT',
  // Acknowledgment/Control
  'ACK', 'NAK', 'PING', 'PONG', 'NOP',
  // Notification/Event
  'EVT', 'LOG', 'WARN', 'NOTE',
  // Error
  'ERR', 'FAIL',
  // Pub/Sub
  'SUB', 'UNSUB', 'PUB',
  // Task/Workflow
  'DO', 'DONE', 'CANCEL', 'WAIT', 'RETRY',
  // Data Transfer
  'DATA', 'STREAM', 'CHUNK', 'END',
  // Meta/Session
  'HELLO', 'BYE', 'SYNC', 'META',
]);

const RESERVED_NAMESPACES = new Set(['SYS', 'CORE', 'DBG', 'SEC']);

/**
 * Validate an AI_Language message string.
 * Returns a ValidationResult with any errors found.
 */
export function validate(
  source: string,
  options: { strictCommands?: boolean; customCommands?: Set<string> } = {},
): ValidationResult {
  const errors: string[] = [];

  // 1. Syntax validation — can it be parsed?
  let ast: MessageNode;
  try {
    ast = parse(source);
  } catch (err: any) {
    return { valid: false, errors: [`Syntax error: ${err.message}`] };
  }

  // 2. Routing validation
  if (ast.routing) {
    const { sender, receiver } = ast.routing;

    if (!sender || sender.length === 0) {
      errors.push('Sender ID is empty');
    }

    if (receiver.type === 'multicast' && receiver.ids.length === 0) {
      errors.push('Multicast receiver list is empty');
    }

    if (receiver.type === 'single' && receiver.id === sender) {
      errors.push(`Sender and receiver are the same: "${sender}"`);
    }
  }

  // 3. Command validation
  const command = ast.command.command;
  const isNamespaced = command.includes('.');

  if (isNamespaced) {
    const parts = command.split('.');
    const namespace = parts[0];

    if (RESERVED_NAMESPACES.has(namespace) && !BUILTIN_COMMANDS.has(command)) {
      errors.push(`Namespace "${namespace}" is reserved and cannot be used for custom commands`);
    }
  } else if (options.strictCommands) {
    const allKnown = new Set([...BUILTIN_COMMANDS, ...(options.customCommands ?? [])]);
    if (!allKnown.has(command)) {
      errors.push(`Unknown command: "${command}". Use a namespace prefix for custom commands (e.g., EXT.${command})`);
    }
  }

  // 4. Payload structure validation
  if (ast.command.payload) {
    const keys = new Set<string>();
    for (const group of ast.command.payload.groups) {
      if (group.entry.kind === 'KeyValue') {
        if (keys.has(group.entry.key)) {
          errors.push(`Duplicate payload key: "${group.entry.key}"`);
        }
        keys.add(group.entry.key);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
