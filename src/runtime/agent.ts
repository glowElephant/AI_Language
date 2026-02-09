import { AILMessage, Receiver } from '../types';
import { encode } from '../encoder';
import { decode } from '../decoder';

export type MessageHandler = (message: AILMessage, raw: string) => void;

export interface AgentOptions {
  id: string;
  onMessage?: MessageHandler;
}

/**
 * An Agent that can send and receive AI_Language messages through a Router.
 */
export class Agent {
  readonly id: string;
  private handler: MessageHandler;
  private router: AgentRouter | null = null;
  private messageLog: Array<{ direction: 'in' | 'out'; raw: string; message: AILMessage }> = [];

  constructor(options: AgentOptions) {
    this.id = options.id;
    this.handler = options.onMessage ?? (() => {});
  }

  /** Set the message handler */
  onMessage(handler: MessageHandler): void {
    this.handler = handler;
  }

  /** Called by router when a message is delivered */
  receive(raw: string, message: AILMessage): void {
    this.messageLog.push({ direction: 'in', raw, message });
    this.handler(message, raw);
  }

  /** Send a raw AI_Language string */
  sendRaw(raw: string): void {
    if (!this.router) {
      throw new Error(`Agent "${this.id}" is not registered with a router`);
    }
    const message = decode(raw);
    this.messageLog.push({ direction: 'out', raw, message });
    this.router.route(raw, message, this.id);
  }

  /** Send a structured message */
  send(msg: Omit<AILMessage, 'sender'>): void {
    const fullMsg: AILMessage = { sender: this.id, ...msg };
    const raw = encode(fullMsg);
    this.messageLog.push({ direction: 'out', raw, message: fullMsg });
    if (!this.router) {
      throw new Error(`Agent "${this.id}" is not registered with a router`);
    }
    this.router.route(raw, fullMsg, this.id);
  }

  /** Get the message log */
  getLog(): ReadonlyArray<{ direction: 'in' | 'out'; raw: string; message: AILMessage }> {
    return this.messageLog;
  }

  /** Clear the message log */
  clearLog(): void {
    this.messageLog = [];
  }

  /** Called by router to bind this agent */
  _bind(router: AgentRouter): void {
    this.router = router;
  }
}

/**
 * Interface for agent routing — implemented by Router
 */
export interface AgentRouter {
  route(raw: string, message: AILMessage, senderId: string): void;
}
