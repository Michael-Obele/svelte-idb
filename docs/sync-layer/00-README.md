# svelte-idb Sync Layer — Planning Documents

> **Status:** Planning / Research Phase  
> **Date:** June 2025  
> **Parent:** [svelte-idb](../../../README.md)

## Overview

This folder contains the planning documents for adding a **sync layer** to the svelte-idb ecosystem. The goal is to enable users to synchronize IndexedDB data with backend databases through their choice of ORM (Prisma, Drizzle) or raw SQL (PostgreSQL, SQLite).

Inspired by [Zero (Rocicorp)](https://zero.rocicorp.dev/) but designed for **backend flexibility** — users keep their existing database, ORM, and server infrastructure.

## Documents

| #   | Document                                                       | Description                                                                           |
| --- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| 01  | [Research & Competitive Landscape](./01-research-landscape.md) | Analysis of existing sync solutions (Zero, Triplit, sveltekit-sync, prisma-idb, etc.) |
| 02  | [Architecture Options](./02-architecture-options.md)           | Evaluation of packaging approaches (integrated vs. separate package vs. Vite plugin)  |
| 03  | [Conflict Resolution](./03-conflict-resolution.md)             | Analysis of conflict strategies (LWW, CRDT, server-authoritative, hybrid)             |
| 04  | [Adapter Architecture](./04-adapter-architecture.md)           | Design of server adapters (Drizzle, Prisma, raw SQL) and transport layer              |
| 05  | [Sync Protocol & Data Flow](./05-sync-protocol.md)             | Change log format, push/pull mechanics, sync cursor, offline support                  |
| 06  | [API Design](./06-api-design.md)                               | Full TypeScript API surface for `svelte-idb-sync`                                     |
| 07  | [Implementation Roadmap](./07-implementation-roadmap.md)       | Phased milestones from prerequisites through v1.0                                     |

## Key Decision (TL;DR)

**Recommendation: Separate npm package (`svelte-idb-sync`)**

- svelte-idb stays lightweight and focused on IndexedDB + Svelte reactivity
- `svelte-idb-sync` adds the sync layer as an opt-in addon
- Adapter pattern: pluggable server adapters (Drizzle, Prisma, raw SQL) + pluggable transport (HTTP, WebSocket, SSE, SvelteKit server functions)
- Pluggable conflict resolution: LWW default, custom resolvers per store
- Progressive enhancement: add sync to existing svelte-idb apps without code changes

## Unique Value Proposition

> _"The only sync solution that connects Svelte 5's reactivity with YOUR choice of backend — Prisma, Drizzle, or raw SQL — without forcing a new database, query language, or infrastructure."_

---

**[Next → 01 Research & Landscape](./01-research-landscape.md)**
