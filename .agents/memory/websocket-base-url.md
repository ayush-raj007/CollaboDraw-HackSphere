---
name: WebSocket URL construction with BASE_URL
description: Stripping trailing slashes from Vite's import.meta.env.BASE_URL before appending a path can merge host and path with no separator, silently breaking WebSocket connections.
---

When building a WebSocket URL from `import.meta.env.BASE_URL` (Vite), do not strip
trailing slashes and then directly concatenate a path segment. If `BASE_URL` is `"/"`
(the common case for an artifact mounted at the root path), `.replace(/\/+$/, "")`
turns it into `""`, and `${host}${base}api/ws` collapses to `${host}api/ws` —
merging the host and path with no separator (e.g. `ws://localhost:5000api/ws`).

The browser's `WebSocket` constructor does not throw on this malformed URL in all
cases, and the failure mode looks like "always offline" / collaborators never show
as connected, with no obvious client-side error — easy to misdiagnose as a backend
auth or session issue.

**Why:** This caused a real bug where live presence/collaboration always reported
"Offline" even though the backend WS server, session auth, and role checks were all
correct — the client just never successfully connected.

**How to apply:** When constructing a WS (or any) URL from a base path, always ensure
exactly one `/` between the host and the path, regardless of whether the base is `/`
or `/some-prefix/`. E.g. normalize the base to guarantee a trailing slash rather than
stripping it: `base.endsWith("/") ? base : base + "/"`.
