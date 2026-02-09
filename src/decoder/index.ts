import { parse } from '../parser';
import {
  AILMessage, AILValue, Receiver,
  MessageNode, ValueNode, KeyValueNode,
  PayloadGroupNode, ReceiverNode,
} from '../types';

/**
 * Decode an AI_Language string into an AILMessage object.
 */
export function decode(source: string): AILMessage {
  const ast = parse(source);
  return astToMessage(ast);
}

function astToMessage(node: MessageNode): AILMessage {
  const msg: AILMessage = {
    command: node.command.command,
  };

  if (node.routing) {
    msg.sender = node.routing.sender;
    msg.receiver = convertReceiver(node.routing.receiver);
  }

  if (node.command.payload) {
    msg.payload = {};
    for (const group of node.command.payload.groups) {
      mergeGroup(msg.payload, group);
    }
  }

  return msg;
}

function convertReceiver(node: ReceiverNode): Receiver {
  switch (node.type) {
    case 'single':
      return { type: 'single', id: node.id };
    case 'broadcast':
      return { type: 'broadcast' };
    case 'multicast':
      return { type: 'multicast', ids: node.ids };
    case 'anycast':
      return { type: 'anycast', group: node.group };
  }
}

function mergeGroup(
  payload: Record<string, AILValue>,
  group: PayloadGroupNode,
): void {
  const entry = group.entry;

  if (entry.kind === 'KeyValue') {
    payload[entry.key] = convertValue(entry.value);
  } else {
    // Standalone value — use index-based key or special "_value" key
    // For simplicity, use positional key
    const idx = Object.keys(payload).length;
    payload[`_${idx}`] = convertValue(entry);
  }
}

function convertValue(node: ValueNode): AILValue {
  switch (node.kind) {
    case 'String':
      return node.value;
    case 'Number':
      return node.value;
    case 'Boolean':
      return node.value;
    case 'Null':
      return null;
    case 'Reference':
      return '#' + node.id;
    case 'List':
      return node.items.map(convertValue);
    case 'Map': {
      const obj: Record<string, AILValue> = {};
      for (const entry of node.entries) {
        obj[entry.key] = convertValue(entry.value);
      }
      return obj;
    }
    case 'Grouped':
      // Represent as object with function name and args
      return {
        _fn: node.name,
        _args: node.args.map(convertValue),
      };
  }
}
