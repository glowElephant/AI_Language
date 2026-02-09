import { AILMessage } from '../types';
import { decode } from '../decoder';
import { Agent, AgentRouter } from './agent';

export type RouterLogEntry = {
  from: string;
  to: string | string[];
  raw: string;
  message: AILMessage;
  timestamp: number;
};

/**
 * Message Router for multi-agent communication.
 * Handles unicast, broadcast, multicast, and anycast routing.
 */
export class Router implements AgentRouter {
  private agents = new Map<string, Agent>();
  private groups = new Map<string, string[]>();
  private log: RouterLogEntry[] = [];

  /** Register an agent with the router */
  register(agent: Agent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent "${agent.id}" is already registered`);
    }
    this.agents.set(agent.id, agent);
    agent._bind(this);
  }

  /** Unregister an agent */
  unregister(agentId: string): void {
    this.agents.delete(agentId);
    // Remove from all groups
    for (const [groupName, members] of this.groups) {
      const idx = members.indexOf(agentId);
      if (idx !== -1) {
        members.splice(idx, 1);
        if (members.length === 0) {
          this.groups.delete(groupName);
        }
      }
    }
  }

  /** Create a named group of agents for anycast */
  createGroup(name: string, agentIds: string[]): void {
    this.groups.set(name, [...agentIds]);
  }

  /** Get a registered agent by ID */
  getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  /** Get all registered agent IDs */
  getAgentIds(): string[] {
    return Array.from(this.agents.keys());
  }

  /** Route a message from a sender */
  route(raw: string, message: AILMessage, senderId: string): void {
    const receiver = message.receiver;

    if (!receiver) {
      // No receiver specified — drop or handle as needed
      this.log.push({
        from: senderId,
        to: '(none)',
        raw,
        message,
        timestamp: Date.now(),
      });
      return;
    }

    switch (receiver.type) {
      case 'single':
        this.deliverTo(receiver.id, raw, message, senderId);
        break;

      case 'broadcast':
        this.broadcast(raw, message, senderId);
        break;

      case 'multicast':
        this.multicast(receiver.ids, raw, message, senderId);
        break;

      case 'anycast':
        this.anycast(receiver.group, raw, message, senderId);
        break;
    }
  }

  /** Send a raw AI_Language string through the router */
  send(raw: string, senderId?: string): void {
    const message = decode(raw);
    const from = senderId ?? message.sender ?? 'unknown';
    this.route(raw, message, from);
  }

  /** Get the routing log */
  getLog(): ReadonlyArray<RouterLogEntry> {
    return this.log;
  }

  /** Clear the routing log */
  clearLog(): void {
    this.log = [];
  }

  // ── Private delivery methods ──

  private deliverTo(
    targetId: string,
    raw: string,
    message: AILMessage,
    senderId: string,
  ): void {
    const agent = this.agents.get(targetId);
    this.log.push({
      from: senderId,
      to: targetId,
      raw,
      message,
      timestamp: Date.now(),
    });
    if (agent) {
      agent.receive(raw, message);
    }
    // If agent not found, message is logged but silently dropped
  }

  private broadcast(
    raw: string,
    message: AILMessage,
    senderId: string,
  ): void {
    const targets: string[] = [];
    for (const [id, agent] of this.agents) {
      if (id !== senderId) {
        targets.push(id);
        agent.receive(raw, message);
      }
    }
    this.log.push({
      from: senderId,
      to: targets,
      raw,
      message,
      timestamp: Date.now(),
    });
  }

  private multicast(
    targetIds: string[],
    raw: string,
    message: AILMessage,
    senderId: string,
  ): void {
    const delivered: string[] = [];
    for (const id of targetIds) {
      const agent = this.agents.get(id);
      if (agent) {
        agent.receive(raw, message);
        delivered.push(id);
      }
    }
    this.log.push({
      from: senderId,
      to: delivered,
      raw,
      message,
      timestamp: Date.now(),
    });
  }

  private anycast(
    groupName: string,
    raw: string,
    message: AILMessage,
    senderId: string,
  ): void {
    const members = this.groups.get(groupName);
    if (!members || members.length === 0) {
      this.log.push({
        from: senderId,
        to: `<${groupName}>(empty)`,
        raw,
        message,
        timestamp: Date.now(),
      });
      return;
    }

    // Round-robin: pick first member and rotate
    const targetId = members[0];
    members.push(members.shift()!);

    this.deliverTo(targetId, raw, message, senderId);
  }
}
