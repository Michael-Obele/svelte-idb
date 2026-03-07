# Sync Plan — `svelte-idb-sync`

> Research, architecture decisions, and implementation plan for adding server synchronization capabilities to the `svelte-idb` ecosystem.

---

## Document Index

| #   | Document                                                     | Purpose                                                                     |
| --- | ------------------------------------------------------------ | --------------------------------------------------------------------------- |
| 01  | [Landscape & Inspiration](./01-landscape-and-inspiration.md) | Zero, ElectricSQL, PowerSync, prisma-idb — what exists, what we can learn   |
| 02  | [Packaging Decision](./02-packaging-decision.md)             | Separate npm package vs. built-in vs. Vite plugin — gains/drawbacks/verdict |
| 03  | [Conflict Resolution](./03-conflict-resolution.md)           | LWW, CRDT, server-authority, custom — strategies and our approach           |
| 04  | [ORM & Backend Adapters](./04-orm-backend-adapters.md)       | Prisma, Drizzle, raw PostgreSQL, raw SQLite — adapter architecture          |
| 05  | [Sync Architecture](./05-sync-architecture.md)               | Data-flow diagrams, change tracking, transport, protocol                    |
| 06  | [API Design](./06-api-design.md)                             | Developer-facing API surface with TypeScript signatures                     |
| 07  | [Implementation Roadmap](./07-implementation-roadmap.md)     | Phased milestones, deliverables, risk assessment                            |

---

## Vision

Build a **Zero-inspired**, adapter-based sync layer for `svelte-idb` that:

1. **Reads from IndexedDB first** — instant UI, exactly like Zero's client-first reads.
2. **Writes optimistically** — mutations land in IndexedDB immediately, then push to server.
3. **Syncs bidirectionally** — server-authoritative state flows back to the client via a configurable transport.
4. **Resolves conflicts intelligently** — pluggable strategies from simple LWW to full CRDT support.
5. **Adapts to any backend** — first-class Prisma and Drizzle adapters, with raw PostgreSQL/SQLite support.

---

## Core Principles

| Principle                                 | Rationale                                                                  |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| **Separate package**                      | Keeps `svelte-idb` zero-dependency and tiny (~4KB). Sync is opt-in.        |
| **Adapter pattern**                       | Backend-agnostic. One sync engine, many targets.                           |
| **Server authority**                      | Server is the source of truth. Clients are optimistic replicas.            |
| **Progressive complexity**                | Simple LWW by default, CRDT opt-in for advanced cases.                     |
| **Svelte-first, framework-agnostic core** | Sync engine is pure TypeScript. Svelte bindings are a thin reactive layer. |
