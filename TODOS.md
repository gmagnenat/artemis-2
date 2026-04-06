# TODOS

## Research: AROW API format investigation
**Priority:** P1 (blocks OEM parser implementation)
**What:** Research the exact AROW API response format before writing the OEM parser.
**Why:** The parser design depends on whether AROW returns raw OEM text or structured JSON, what CORS headers it sends, and how frequently data updates.
**Context:** NASA AROW was built for Artemis I. Check the official tracking page for Artemis II API docs. The API format may have changed. Key questions: JSON vs OEM file? CORS headers present? Update frequency?
**Reference:** https://www.nasa.gov/missions/artemis/artemis-2/track-nasas-artemis-ii-mission-in-real-time/
**Depends on:** Nothing. Should be done before `td-da3a31` (Three.js scene) and `td-1a7d60` (mission status bar).
**Added:** 2026-04-06 by /plan-eng-review
