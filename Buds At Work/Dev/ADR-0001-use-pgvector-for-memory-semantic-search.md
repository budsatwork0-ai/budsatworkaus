---
adr: "0001"
title: "Use pgvector for memory semantic search"
date: "2026-05-17"
status: "accepted"
tags: ["adr", "accepted"]
---
# ADR-0001: Use pgvector for memory semantic search

**Date:** 2026-05-17  
**Status:** ✅ Accepted

## Context

Need semantic search across 500+ vault notes. Native SQL keeps infra simple.

## Decision

Store OpenAI embeddings in Supabase with ivfflat index. Keyword fallback when OPENAI_API_KEY absent.

## Consequences

Costs ~/bin/zsh.0001/query. Requires OPENAI_API_KEY env var. Vector dimension pinned at 1536.

## Related

- [[Dev Log 2026-05-17]]
