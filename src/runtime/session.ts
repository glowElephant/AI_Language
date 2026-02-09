import { AILValue } from '../types';

/**
 * Session & Context Manager for multi-agent conversations.
 */
export class SessionManager {
  private sessions = new Map<string, Session>();

  /** Create a new session */
  create(id: string, options: { ttl?: number } = {}): Session {
    if (this.sessions.has(id)) {
      throw new Error(`Session "${id}" already exists`);
    }
    const session = new Session(id, options.ttl);
    this.sessions.set(id, session);
    return session;
  }

  /** Get a session by ID */
  get(id: string): Session | undefined {
    const session = this.sessions.get(id);
    if (session && session.isExpired()) {
      this.sessions.delete(id);
      return undefined;
    }
    return session;
  }

  /** Get or create a session */
  getOrCreate(id: string, options: { ttl?: number } = {}): Session {
    return this.get(id) ?? this.create(id, options);
  }

  /** Destroy a session */
  destroy(id: string): boolean {
    return this.sessions.delete(id);
  }

  /** Get all active session IDs */
  getActiveIds(): string[] {
    const ids: string[] = [];
    for (const [id, session] of this.sessions) {
      if (!session.isExpired()) {
        ids.push(id);
      }
    }
    return ids;
  }

  /** Clean up expired sessions */
  cleanup(): number {
    let removed = 0;
    for (const [id, session] of this.sessions) {
      if (session.isExpired()) {
        this.sessions.delete(id);
        removed++;
      }
    }
    return removed;
  }
}

/**
 * A single conversation session with shared context.
 */
export class Session {
  readonly id: string;
  private context: Record<string, AILValue> = {};
  private createdAt: number;
  private lastActivity: number;
  private ttl: number | null; // milliseconds, null = no expiry

  constructor(id: string, ttlMs?: number) {
    this.id = id;
    this.createdAt = Date.now();
    this.lastActivity = this.createdAt;
    this.ttl = ttlMs ?? null;
  }

  /** Get the full context */
  getContext(): Readonly<Record<string, AILValue>> {
    this.touch();
    return { ...this.context };
  }

  /** Get a specific context value */
  getContextValue(key: string): AILValue | undefined {
    this.touch();
    return this.context[key];
  }

  /** Set a context value */
  setContext(key: string, value: AILValue): void {
    this.touch();
    this.context[key] = value;
  }

  /** Merge context from an object */
  mergeContext(data: Record<string, AILValue>): void {
    this.touch();
    Object.assign(this.context, data);
  }

  /** Delete a context key */
  deleteContext(key: string): boolean {
    this.touch();
    if (key in this.context) {
      delete this.context[key];
      return true;
    }
    return false;
  }

  /** Clear all context */
  clearContext(): void {
    this.touch();
    this.context = {};
  }

  /** Check if session is expired */
  isExpired(): boolean {
    if (this.ttl === null) return false;
    return Date.now() - this.lastActivity > this.ttl;
  }

  /** Touch the session to reset activity timer */
  private touch(): void {
    this.lastActivity = Date.now();
  }
}
