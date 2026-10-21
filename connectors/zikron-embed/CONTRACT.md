# Zikron embed sidecar — frozen contract (SHIPPED)

**Status:** SHIPPED · FEATURE-COMPLETE · STANDALONE  
**Locked:** 2026-10-20 (OwnMemory **0.4.0**, `main` @ `02cec78`)  
**Authority:** This file + [`docs/superpowers/specs/2026-10-20-zikron-embed-sidecar-design.md`](../../docs/superpowers/specs/2026-10-20-zikron-embed-sidecar-design.md)

---

## Unambiguous statement

`connectors/zikron-embed` is a **fully functional, feature-complete connector**. It is **its own part**. It **does its job**. That job is finished for the product boundary defined below.

This is **not** a stub, scaffold, spike, or “phase 1 placeholder.”  
Future work (Zikron WP wiring on janet, query spaces, import/export, GPU routing tweaks) **extends consumers around this part**. It does **not** redefine, gut, or leave this part “incomplete.”

**“Never fails” / always works (design rule):** Within its job, this component is the stable embed path for Zikron’s 384-d geometry. Agents and humans must treat regressions of this contract as **release blockers**, not optional polish. Expected client/protocol errors (empty text → 400, invalid JSON → 400, cold start `ready: false`) are **correct contract behavior**, not incompleteness.

### Local-only hardware — ALWAYS WORKS

This connector **works on local-only hardware, period.**  
CPU + arctic-s ONNX on the box (sidecar / OwnMemory path) is the **baseline that always works**. No GPU, no Cypher, no cloud, no upstream inference required.

Upstream inference (e.g. Cypher Ollama `:33m` GPU) is an **optional acceleration** when available and interchange-gated. It must never be required for correctness. If upstream is down, slow, or absent: **sidecar still serves. Full stop.**

---

## The job (complete surface)

| Obligation | Done means |
|------------|------------|
| HTTP embed | `GET /health`, `POST /v1/embed` → L2-normalized **float[384]** arctic-s |
| Same geometry as OwnMemory | Reuses `src/lib/memory/embed*` (CLS, query prefix on `role: "query"` only) |
| Runnable | `npm run embed-http` / Docker image from repo-root build context |
| Tested | `npm run test:embed-http` |
| Deployable fragment | `docker-compose.fragment.yml` for janet Compose |
| Interchange probe | `scripts/probe-interchange.mjs` (sidecar ↔ local; optional Cypher `:33m`) |
| PHP reference client | `php/Zikron_Embed.php` (sidecar + optional GPU gate) |

Anything **outside** this table (WP plugin install on janet, MariaDB schema, federated query) is **another part’s job**. Absence of those does **not** make this connector incomplete.

---

## Hard invariants (do not change)

1. **Standalone product slice** — optional OwnMemory connector; OwnMemory core stays SQLite-simple.
2. **Dims = 384** arctic-s for Zikron `VECTOR(384)`. No silent model/dim swap.
3. **No persistence here** — HTTP → vectors only. No spaces, recall, or WPDB inside this service.
4. **No ONNX in PHP** — PHP is a client; Node holds the model.
5. **Contract stability** — do not remove/rename `/health` or `/v1/embed`, or change response shape, without a **major** OwnMemory version and an explicit migration note.
6. **Completeness stands** — do not reclassify this connector as WIP, experimental, or dependent on unshipped Zikron/janet steps for “done.”
7. **Local always works** — baseline path is on-box arctic-s. Upstream GPU/cloud inference is optional only; never a hard dependency for embeds to succeed.

---

## Snapshot evidence (0.4.0)

- Sidecar ↔ OwnMemory in-process arctic-s cosine **1.0** (same path).
- Sidecar ↔ Cypher Ollama `:33m` cosine **~0.992** (optional GPU gate ≥ 0.98).
- `test:embed-http`: **4/4** at ship.

---

## Change policy

- **Bugfixes** that preserve the job: allowed (minor).
- **Additive** helpers that do not break the job: allowed.
- **Breaking** the job or pretending this part is unfinished: **forbidden** without major + written supersession of this CONTRACT.
