# BH RCM — Architecture

## Overview

A proof-of-concept Revenue Cycle Management portal for Big Health's billing workflow. The system tracks patients who have enrolled and reached billing points on products, manages claim submissions to PBMs (starting with a stub), and provides visibility into claim lifecycle and resubmission chains.

## Goals

1. **Claim lifecycle visibility** — See every patient/product combination, its current billing status, and the full history of claim submissions and responses.
2. **Batch claim submission** — Select pending claims, group them into a batch, and submit to a PBM endpoint.
3. **Resubmission tracking** — When a claim is rejected, create a resubmission linked to the same enrollment so the full chain of attempts is queryable.
4. **Foundation for NCPDP encoding** — Start with JSON payloads to a stub PBM, but architect for real NCPDP D.0 encoding to be added.

## Tech Stack

| Component | Technology | Location |
|---|---|---|
| Portal | Next.js (deployed to Vercel, `bh-rcm` project) | `~/dev/rcm/bh-rcm` |
| Database | Supabase (`bh_billing` project) | Hosted |
| NCPDP encoding service | Python (FastAPI on Vercel) — `bh-rcm-py` project | `~/dev/rcm/bh-rcm-py` |
| Stub PBM | Next.js API route within the portal | `~/dev/rcm/bh-rcm` |

## Database Schema (Supabase — `bh_billing`)

Informed by the data models in `cvs-integration-service-cluster` (`caremark_member_claim`, `caremark_organization`, `caremark_claim_delivery`), Janus (`billing_claim`, `billing_config`, `eligibility_check`), and `onboarding-core-service-cluster` (`billing_user_level`). The POC schema consolidates these into a cleaner relational model while preserving all data elements needed for NCPDP encoding and claim lifecycle tracking.

### `organizations`

Maps to `caremark_organization` in cvs-integration-service-cluster and `organization` + `billing_config` in Janus. Stores per-org billing configuration and pricing overrides.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | Human-readable name (e.g., "Acme Corp") |
| `slug` | text, unique | URL-safe identifier, matches Janus `organization_slug` |
| `billing_type` | text | `cvs`, `esi`, or `direct` — from Janus `BillingType` enum |
| `client_codes` | text[] | CVS client codes (array), from `caremark_organization.client_codes` |
| `zip_code` | text | Org HQ 5-digit zip — used as billing zip in NCPDP claims |
| `member_exclusive` | boolean | If true, dependants denied — from `caremark_organization.member_exclusive` |
| `legacy_pricing` | boolean | If true, use pre-2024 pricing tier |
| `delivery_paused` | boolean | If true, claims not delivered to PBM |
| `created_at` | timestamptz | Default now() |

### `products`

Three individual products. No bundles for the POC. Carries all fields needed for NCPDP pricing segment.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `name` | text | Sleepio, Daylight, Spark |
| `slug` | text, unique | `sleepio`, `daylight`, `spark` — matches Janus product slugs |
| `product_id_legacy` | integer | Legacy numeric ID: 1=Sleepio, 2=Daylight, 4=Spark |
| `upc` | text | Current active UPC (2024 codes) |
| `upc_legacy` | text | Pre-2024 UPC |
| `ndc_qualifier` | text | `"03"` for true claims, `"01"` for test claims |
| `ingredient_cost` | decimal(10,2) | Default ingredient cost (2024 pricing) |
| `dispensing_fee` | decimal(10,2) | Default dispensing fee (2024 pricing) |
| `usual_and_customary_charge` | decimal(10,2) | Default U&C charge (2024 pricing) |
| `gross_amount_due` | decimal(10,2) | Default gross amount (2024 pricing) |
| `days_supply` | integer | Typically 365 (14 for CVS Health org) |
| `quantity` | integer | Typically 1 |
| `created_at` | timestamptz | Default now() |

Reference pricing from `vbm_codes.py`: Sleepio $400, Daylight $430, Spark $430 (2024 tier).

### `patients`

Patient demographics and PBM member/insurance identifiers. Carries all fields from `caremark_member_claim` needed for NCPDP patient and insurance segments.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `first_name` | text | Max 12 chars safe for ESL — from `caremark_member_claim.first_name` |
| `last_name` | text | Max 15 chars safe for ESL — from `caremark_member_claim.last_name` |
| `date_of_birth` | date | NCPDP patient segment |
| `gender` | text | `M`, `F`, `U`, `X` — NCPDP patient segment (mapped to 1/2/3 for encoding) |
| `zip_code` | text | 5-digit — from `caremark_member_claim.zip_code` |
| `caremark_id` | text | CVS member identifier — NCPDP insurance segment `cardholder_id` |
| `bin_number` | text | Bank Identification Number — NCPDP header |
| `processor_control_number` | text | From eligibility response — NCPDP header |
| `rx_group` | text | Rx group — NCPDP insurance segment `group_id` |
| `group_id` | text | Group ID from eligibility |
| `carrier_id` | text | Carrier from eligibility |
| `account_id` | text | Account from eligibility |
| `person_code` | text | Person code (e.g., "001" = cardholder) — NCPDP insurance segment |
| `relationship_code` | text | Relationship to cardholder — NCPDP insurance segment `patient_relationship_code` |
| `created_at` | timestamptz | Default now() |

### `enrollments`

One row per patient/product/organization combination. The anchor for the claim chain. Consolidates the enrollment-level data from `caremark_member_claim` and Janus `billing_claim`.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `patient_id` | uuid, FK → patients | |
| `product_id` | uuid, FK → products | |
| `organization_id` | uuid, FK → organizations | Which org this patient enrolled through |
| `enrolled_at` | timestamptz | When the patient enrolled |
| `billing_point_hit_at` | timestamptz | When the patient hit the billing milestone — from `true_claim_triggered_utc` / Cortex `billable_date` |
| `reference_number` | bigint | Opaque encoded value for CVS claim matching — from `caremark_member_claim.reference_number`. Used as `prescription_service_reference_number` in NCPDP claim segment |
| `copayment_amount_cents` | integer, nullable | From test claim response — `caremark_member_claim.copayment_amount_cents` |
| `is_billable` | boolean, default true | From Janus `billing_claim.is_billable` — can be set false for dupes or other reasons |
| `not_billable_reason` | text, nullable | From Janus `billing_claim.not_billable_reason` |
| `created_at` | timestamptz | Default now() |
| | UNIQUE | `(patient_id, product_id)` |

The **current status** of an enrollment is derived from its most recent claim's status — no separate status column here.

### `batches`

Groups of claims submitted together to the PBM. Maps to `caremark_claim_delivery` in cvs-integration-service-cluster.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `submitted_at` | timestamptz | When the batch was sent to the PBM |
| `total_claims` | integer | Count of claims in this batch |
| `paid_count` | integer | Populated after PBM response |
| `rejected_count` | integer | Populated after PBM response |
| `duplicate_count` | integer | Populated after PBM response |
| `created_at` | timestamptz | Default now() |

### `claims`

One row per submission attempt. The claim chain for an enrollment is `WHERE enrollment_id = X ORDER BY sequence_number`. Consolidates per-submission data from `caremark_member_claim` status timestamps and rejection fields.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | |
| `enrollment_id` | uuid, FK → enrollments | |
| `batch_id` | uuid, FK → batches, nullable | Null = not yet submitted |
| `sequence_number` | integer | 1 = original, 2+ = resubmission |
| `status` | text | See state machine below |
| `service_date` | date, nullable | Date of service for billing — passed to NCPDP `date_of_service` field |
| `submitted_at` | timestamptz, nullable | When sent to PBM — maps to `true_claim_pending_utc` |
| `responded_at` | timestamptz, nullable | When PBM responded — maps to `true_claim_verified_utc` / `true_claim_rejected_utc` / `true_claim_duplicated_utc` |
| `response_status` | text, nullable | PBM response: `P` (paid), `R` (rejected), `D` (duplicate) — matches NCPDP response codes |
| `reject_codes` | text[], nullable | NCPDP rejection codes — from `caremark_member_claim.claim_reject_detail_reject_codes` |
| `reject_descriptions` | text[], nullable | Human-readable rejection reasons — from `caremark_member_claim.claim_reject_detail_codes_description_text` |
| `settlement_codes` | text[], nullable | Settlement/warning codes — from `caremark_member_claim.claim_settlement_detail_reject_codes` |
| `settlement_descriptions` | text[], nullable | Settlement descriptions — from `caremark_member_claim.claim_settlement_detail_codes_description_text` |
| `settlement_severity_codes` | text[], nullable | Severity of settlement messages — from `caremark_member_claim.claim_settlement_detail_severity_codes` |
| `created_at` | timestamptz | Default now() |

### Schema Lineage

How data elements map from the current system to the POC:

| Current System | Current Field | POC Table.Column |
|---|---|---|
| `caremark_member_claim` | `user_uuid` | `patients.id` |
| `caremark_member_claim` | `first_name`, `last_name`, `date_of_birth`, `gender`, `zip_code` | `patients.*` |
| `caremark_member_claim` | `caremark_id`, `bin_number`, `carrier_id`, `group_id`, etc. | `patients.*` (PBM fields) |
| `caremark_member_claim` | `reference_number` | `enrollments.reference_number` |
| `caremark_member_claim` | `product_id` | `enrollments.product_id` → `products.product_id_legacy` |
| `caremark_member_claim` | `organization_name`, `client_code` | `enrollments.organization_id` → `organizations.*` |
| `caremark_member_claim` | `true_claim_triggered_utc` | `enrollments.billing_point_hit_at` |
| `caremark_member_claim` | `true_claim_pending_utc` | `claims.submitted_at` |
| `caremark_member_claim` | `true_claim_verified_utc` / `rejected` / `duplicated` | `claims.responded_at` + `claims.status` |
| `caremark_member_claim` | `claim_reject_detail_*` | `claims.reject_codes`, `claims.reject_descriptions` |
| `caremark_member_claim` | `claim_settlement_detail_*` | `claims.settlement_*` |
| `caremark_member_claim` | `most_recent_delivery_batch` | `claims.batch_id` |
| `caremark_organization` | `client_codes`, `zip_code`, `legacy_pricing`, `delivery_paused` | `organizations.*` |
| `caremark_claim_delivery` | batch lifecycle | `batches.*` |
| Janus `billing_claim` | `is_billable`, `not_billable_reason` | `enrollments.is_billable`, `enrollments.not_billable_reason` |
| Janus `billing_claim` | `billing_type` | `organizations.billing_type` |
| Janus `billing_config` | `upc`, `billing_type` per org/product | `organizations.billing_type` + `products.upc` |
| Janus `pricing` | `upc`, `price` | `products.upc`, `products.gross_amount_due` |
| `vbm_codes.py` | pharmacy ID, NCPDP number, cert ID | Constants in NCPDP encoder (not in DB) |
| `vbm_codes.py` | `ALLOWABLE_DAYS_SUPPLY`, `ALLOWABLE_QUANTITY` | `products.days_supply`, `products.quantity` |

### NCPDP Encoding Field Sources (Phase 2 Reference)

When NCPDP encoding is added, here's where each NCPDP segment field comes from:

| NCPDP Segment | Field | Source |
|---|---|---|
| **Header** | `bin_number` | `patients.bin_number` |
| **Header** | `date_of_service` | `claims.service_date` |
| **Header** | `processor_control_number` | `patients.processor_control_number` (= rx_group) |
| **Header** | `service_provider_id` | Constant: `BIG_HEALTH_PHARMACY_ID` = `"1316418981"` |
| **Header** | `software_vendor_certification_id` | Constant: `BIG_HEALTH_NCPDP_CERTIFICATION_ID` = `"D0315211BH"` |
| **Insurance** | `cardholder_id` | `patients.caremark_id` |
| **Insurance** | `group_id` | `patients.rx_group` |
| **Insurance** | `patient_relationship_code` | `patients.relationship_code` |
| **Insurance** | `person_code` | `patients.person_code` |
| **Patient** | `date_of_birth` | `patients.date_of_birth` |
| **Patient** | `patient_gender_code` | `patients.gender` (M→1, F→2, U/X→3) |
| **Patient** | `patient_first_name` | `patients.first_name` |
| **Patient** | `patient_last_name` | `patients.last_name` |
| **Claim** | `prescription_service_reference_number` | `enrollments.reference_number` |
| **Claim** | `product_service_id` | `products.upc` (or `upc_legacy` if org is legacy_pricing) |
| **Claim** | `product_service_id_qualifier` | `products.ndc_qualifier` |
| **Claim** | `quantity_dispensed` | `products.quantity` × 1000 (milli-units) |
| **Claim** | `days_supply` | `products.days_supply` |
| **Pricing** | `ingredient_cost_submitted` | `products.ingredient_cost` (or org override) |
| **Pricing** | `dispensing_fee_submitted` | `products.dispensing_fee` (or org override) |
| **Pricing** | `usual_and_customary_charge` | `products.usual_and_customary_charge` (or org override) |
| **Pricing** | `gross_amount_due` | `products.gross_amount_due` (or org override) |

## Claim Status State Machine

Claims are created at submission time, not at billing point hit. This matches the legacy system where `caremark_member_claim` exists from eligibility but true claim delivery only happens when the batch pipeline picks up triggered claims. In our POC, enrollments with `billing_point_hit_at` set and no claims (or only rejected claims) are the "ready to bill" pool.

```
billing_point_hit
       │
       ▼
  ready to bill ─────► submitted ──────────► paid
  (no claim row yet;  (claim + batch        (PBM accepted)
   enrollment has      created, sent
   billing_point_hit   to PBM)
   _at set)                       ──────────► rejected
                                              (PBM denied — rejection code recorded)
                                  ──────────► duplicate
                                              (PBM already paid this patient/product)

If rejected:
    user initiates resubmission
       │
       ▼
    new claim row (sequence_number + 1) at status "submitted"
```

An enrollment's derived status is:
- **ready to bill** — has `billing_point_hit_at` but no claims (or latest claim is `rejected`)
- Otherwise — its latest claim's status

## Claim Submission Architecture

Three-layer architecture that separates orchestration, routing, and PBM-specific logic. Designed so the submission service behaves identically regardless of whether the PBM adapter responds synchronously (stubs) or asynchronously (real CVS).

```
  TRIGGERS
  ════════

  Portal UI                    Cron / Event
  (user selects                (e.g., every 6 hours —
   enrollments,                 submit everything
   clicks "Submit")             ready to bill)
       │                            │
       │ POST /api/claims/submit    │ POST /api/claims/submit-scheduled
       │ { enrollmentIds: [...] }   │ (no body — queries for ready enrollments)
       │                            │
       ▼                            ▼
  ┌──────────────────────────────────────────────────┐
  │            SUBMISSION SERVICE                     │
  │            lib/claims/submission-service.ts       │
  │                                                  │
  │  1. Resolve enrollments (by IDs or by filter)    │
  │  2. Group by org.billing_type                    │
  │  3. Create one batch per group                   │
  │  4. Create claim rows (status: submitted)        │
  │  5. Call gateway.submitBatch() for each batch    │
  │  6. Return batch IDs to caller                   │
  │                                                  │
  │  Never writes results. Never polls. Never waits. │
  └───────────────────┬──────────────────────────────┘
                      │
                      │ gateway = registry.get(org.billing_type)
                      │ gateway.submitBatch(batch)
                      │
  ┌───────────────────▼──────────────────────────────┐
  │            PBM GATEWAY INTERFACE                  │
  │                                                  │
  │  interface PbmGateway {                          │
  │    submitBatch(batch: BatchSubmission): void     │
  │  }                                               │
  │                                                  │
  │  Contract: adapter will write results to the DB  │
  │  when it has them — immediately for stubs,       │
  │  hours/days later for real PBMs.                 │
  └───────┬──────────────┬───────────────┬───────────┘
          │              │               │
  ┌───────▼──────┐ ┌─────▼──────┐ ┌─────▼──────────┐
  │ STUB         │ │ CVS STUB   │ │ CVS REAL       │
  │ ADAPTER      │ │ ADAPTER    │ │ ADAPTER        │
  │              │ │            │ │ (Phase 2)      │
  │ Coin flip    │ │ Enriches   │ │                │
  │ adjudication │ │ w/ NCPDP   │ │ submitBatch(): │
  │              │ │ fields,    │ │  Encode NCPDP  │
  │ Writes       │ │ validates  │ │  SFTP upload   │
  │ results to   │ │ complete-  │ │  Return        │
  │ claims table │ │ ness       │ │                │
  │ immediately  │ │            │ │ Results        │
  │              │ │ Writes     │ │ written by     │
  │              │ │ results    │ │ separate       │
  │              │ │ immediately│ │ Inngest poller │
  └──────────────┘ └────────────┘ └────────────────┘
          │              │               │
          ▼              ▼               ▼
  ┌──────────────────────────────────────────────────┐
  │                    SUPABASE                       │
  │                                                  │
  │  Portal reads claims table on each page load.    │
  │  Shows "submitted" until adapter writes results. │
  │  No communication channel needed — DB is the     │
  │  shared state between submission and response.   │
  └──────────────────────────────────────────────────┘
```

### Gateway Registry

Routes to the correct adapter based on `organizations.billing_type` (`cvs`, `esi`, `direct`). A batch maps to one PBM — if a user selects enrollments across orgs with different billing types, the submission service creates multiple batches and routes each to the right adapter.

```
lib/claims/gateway-registry.ts

  const gateways: Record<string, PbmGateway> = {
    cvs:    new CvsStubAdapter(),   // swap for CvsRealAdapter in Phase 2
    esi:    new StubAdapter(),      // generic stub for now
    direct: new StubAdapter(),
  }
```

### Submission Service

A TypeScript module (not a server or container) with exported functions that run inside Vercel serverless functions at request time.

```
lib/claims/submission-service.ts

  submitClaims(enrollmentIds: string[])   — called by portal UI
  submitReady()                           — called by cron trigger
```

Both resolve enrollments, group by billing type, create batches/claims, and delegate to the gateway. The only difference is how enrollments are selected — by explicit IDs or by querying for "ready to bill."

### API Routes

Two thin Vercel serverless functions. Each validates the request and delegates to the submission service.

```
app/api/claims/submit/route.ts            — POST, called by portal UI
app/api/claims/submit-scheduled/route.ts  — POST, called by Vercel cron
```

### Stub Adapter

Default adapter for all billing types in Phase 1. Unblocks the full UI flow.

- ~50% of claims are paid, ~50% rejected (random)
- **Duplicate detection**: If a claim for the same patient/product has already been paid, returns `duplicate`
- **Rejection codes**: Random NCPDP-style codes: `75` (Prior Auth Required), `70` (Product Not Covered), `65` (Patient Not Covered), `25` (Plan Limitations Exceeded)
- Writes results directly to `claims` and `batches` tables inside `submitBatch()`

### CVS Stub Adapter

Exercises the **full NCPDP encode-transmit-decode pipeline** end-to-end via HTTP calls to `bh-rcm-py`:

1. **Duplicate detection** — queries `claims` table for enrollments already paid; partitions batch into duplicates (marked immediately) vs sendable claims; de-duplicates within-batch (first claim per enrollment wins)
2. **Enrich from Supabase** — joins `enrollments` → `patients`, `products`, `organizations` to gather all NCPDP segment fields
3. **Map to `NcpdpClaimInput`** — builds the JSON shape that `bh-rcm-py` expects
4. **Encode** — `POST /api/claims/ncpdp/batch` → NCPDP D.0 batch text
5. **Submit to CVS PBM Stub** — `POST /api/claims/ncpdp/stub-adjudicate` → NCPDP batch response text
6. **Decode** — `POST /api/claims/ncpdp/parse-response-text` → parsed JSON with transmission dicts
7. **Match responses** — extracts `prescription_service_reference_number` from segment 22, looks up claim via reference map
8. **Write results** — updates each `claims` row (status, response_status, reject_codes) and `batches` summary counts

The **CVS PBM Stub** endpoint in `bh-rcm-py` (`/api/claims/ncpdp/stub-adjudicate`):
- Accepts NCPDP batch text (output of `format_batch()`)
- Parses each transmission, builds a response with: `ResponseHeader` (status `"A"`), `ResponseStatusSegment` (50/50 paid/rejected coin flip, random reject code if rejected), `ResponseClaimSegment` (echoes `prescription_service_reference_number`), `ResponsePricingSegment` (echoes submitted pricing if paid)
- Returns NCPDP-formatted batch response as plain text

This proves the entire NCPDP encode/decode chain works with realistic data before touching real CVS SFTP infrastructure.

### CVS Real Adapter (Phase 2)

Replaces the CVS stub. NCPDP encoding is already built in `bh-rcm-py` — the remaining work is replacing HTTP calls with file-based delivery. Two independent processes:

**Submission** (runs inside `submitBatch()`):
1. Same enrichment and `NcpdpClaimInput` mapping as CVS stub adapter
2. Calls `bh-rcm-py /api/claims/ncpdp/batch` to encode to NCPDP D.0 batch text
3. Uploads encoded file to CVS inbound SFTP folder (replaces the HTTP call to `stub-adjudicate`)
4. Returns — claim rows already marked `submitted` by submission service

**Response polling** (separate Inngest cron function, replaces synchronous decode):
1. Checks CVS outbound SFTP folder for new response files
2. Calls `bh-rcm-py /api/claims/ncpdp/parse-response-text` to decode
3. Matches to claims via `prescription_service_reference_number` (same logic as CVS stub adapter)
4. Writes paid/rejected/duplicate results to `claims` table
5. Updates `batches` summary counts

The portal doesn't know or care which process wrote the results. It reads from the DB on each page load.

### Implementation

```
lib/claims/submission-service.ts    — Orchestrator (create batch/claims, delegate to gateway)
lib/claims/gateway-registry.ts      — Routes billing_type → adapter
lib/claims/types.ts                 — PbmGateway interface, BatchSubmission type
lib/pbm/stub-adapter.ts             — Generic stub (coin flip, write to DB)
lib/pbm/cvs-stub-adapter.ts         — CVS stub (full NCPDP pipeline via bh-rcm-py)
lib/pbm/cvs-adapter.ts              — CVS real (Phase 2 — SFTP upload + Inngest poller)
app/api/claims/submit/route.ts      — Vercel fn, called by portal UI
app/api/claims/submit-scheduled/route.ts — Vercel fn, called by cron

# bh-rcm-py (NCPDP encoding service)
lib/ncpdp/adjudicator.py           — CVS PBM Stub adjudication logic
lib/ncpdp/batch.py                 — + format_response_batch()
api/index.py                       — + stub-adjudicate, parse-response-text endpoints
```

## Portal Views

### Dashboard

Summary metrics:
- Total enrollments
- Claims pending / submitted / paid / rejected / duplicate
- Paid rate (%)
- Total revenue (paid claims × product price)

### Enrollments List

Filterable table of patient/product combinations.

| Column | Filterable |
|---|---|
| Patient name | |
| Product | Yes |
| Enrolled date | |
| Billing point date | |
| Current status (derived) | Yes |
| # of attempts | |

**Bulk action**: Select enrollments by filter (e.g., "ready to bill" or "rejected") → "Submit Claims" → creates claim rows, groups them into a batch, and submits to stub PBM.

### Enrollment Detail

Click into an enrollment to see:
- Patient and product info
- Full claim chain: every submission attempt, its batch, PBM response, timestamps
- "Resubmit" button on rejected claims → creates and submits a new claim row (sequence_number + 1)

## Claim Submission Flow

### Portal-triggered (user clicks "Submit Claims")

1. User filters enrollments list (e.g., status = "ready to bill" or "rejected")
2. User selects enrollments and clicks "Submit Claims"
3. Portal POSTs `{ enrollmentIds: [...] }` to `/api/claims/submit`
4. Submission service resolves enrollments, groups by `org.billing_type`
5. For each group: creates a `batch` row, creates `claim` rows (sequence_number = 1 for new, +1 for resubmissions, status = `submitted`)
6. For each batch: calls `gateway.submitBatch()` via the registry
7. Adapter adjudicates and writes results to `claims` and `batches` tables
8. API returns batch IDs to portal
9. Portal refreshes — claims now show paid/rejected/duplicate

### Cron-triggered (scheduled submission)

1. Vercel cron POSTs to `/api/claims/submit-scheduled`
2. Submission service queries for all enrollments that are "ready to bill"
3. Same steps 4–7 as above
4. No UI refresh needed — portal picks up results on next page load

### Resubmission (user clicks "Resubmit" on rejected claim)

1. Portal POSTs `{ enrollmentIds: [enrollmentId] }` to `/api/claims/submit`
2. Submission service sees enrollment already has claims, creates new claim with `sequence_number + 1`
3. Same gateway flow — adapter adjudicates and writes results
4. Portal refreshes enrollment detail to show updated claim chain

In all cases, the submission service creates the DB rows and delegates to the adapter. The adapter writes results back to the DB. The portal reads from the DB. No direct communication between adapter and portal.

## Seed Data

~100 patient/product combinations populated in Supabase:
- 33 patients, each enrolled in 1–3 products across 5 organizations
- All have `billing_point_hit_at` set (all are ready to bill)
- No claims seeded — claims are created when a user submits from the portal
- Realistic patient names, dates of birth, and PBM identifiers
- Real UPC codes and pricing from `vbm_codes.py`

## NCPDP Encoding Service (`bh-rcm-py`)

The NCPDP D.0 encoding/decoding logic has been **extracted from** `cvs-integration-service-cluster` and deployed as a standalone FastAPI service (`bh-rcm-py`). 102 tests including golden-file certification passing.

Endpoints:
- `POST /api/claims/ncpdp/encode` — single claim → encoded NCPDP string
- `POST /api/claims/ncpdp/batch` — `NcpdpClaimInput[]` → NCPDP batch text
- `POST /api/claims/ncpdp/parse-response` — multipart file upload → parsed transmissions
- `POST /api/claims/ncpdp/parse-response-text` — plain text body → parsed transmissions
- `POST /api/claims/ncpdp/stub-adjudicate` — NCPDP batch text → NCPDP response text (CVS PBM Stub)

The encoding is consumed by both the **CVS Stub Adapter** (full NCPDP pipeline via HTTP) and will be consumed by the **CVS Real Adapter** (SFTP upload replaces `stub-adjudicate` call). The submission service, gateway interface, and portal are all unaware of encoding format.

## What's Intentionally Skipped

- **Eligibility verification / test claims** — all seed patients are assumed eligible
- **SFTP delivery** — stubs write results directly to DB; real SFTP is Phase 2 (CVS Real Adapter)
- **835 reconciliation** — stubs adjudicate immediately; async response polling is Phase 2 (Inngest cron)
- **Bundle pricing / resolvers** — individual products only
- **Auth / RLS** — single-user portal
- **Real-time subscriptions** — portal reads from DB on page load; no push needed

## Status

### Done

- **Database schema** — 6 tables (organizations, products, patients, enrollments, batches, claims) with indexes, deployed to Supabase
- **Seed data** — 33 patients, 5 orgs, 3 products, ~100 enrollments, all with `billing_point_hit_at` set (ready to bill)
- **Dashboard** — 8 metric cards (total enrollments, claim counts by status, paid rate, total revenue)
- **Enrollments list** — Paginated table with product & status multi-select filters
- **Enrollment detail** — Patient/product info card + claim history table
- **UI component library** — 55+ Radix/shadcn primitives, Tailwind v4 with OKLCH, dark mode, sidebar nav
- **Supabase integration** — SSR client, query layer (`getEnrollments`, `getEnrollmentById`, `getDashboardMetrics`), auto-generated TypeScript types
- **Submission service + gateway plumbing** — `PbmGateway` interface, gateway registry, `submission-service.ts` with `submitClaims()` and `submitReady()`, two API routes, plus 13 unit tests
- **Stub adapter** — Generic `PbmGateway` with coin-flip adjudication, duplicate detection (cross-batch and within-batch), writes results to `claims` and `batches` tables, plus 4 unit tests
- **Portal UI wiring** — "Submit Claims" bulk action on enrollments table, "Resubmit" button on enrollment detail, both POST to `/api/claims/submit` with loading states and router refresh
- **NCPDP encoding service (`bh-rcm-py`)** — Battle-tested D.0 encoder/decoder extracted from cvs-integration-service-cluster, FastAPI endpoints for single/batch encode and response parsing, 102 tests including golden-file certification
- **CVS stub adapter** — Full NCPDP encode-transmit-decode pipeline via `bh-rcm-py`: duplicate detection, Supabase enrichment, NCPDP encoding, PBM stub adjudication, response decoding, result matching and DB writes

### Remaining

1. **Vercel cron config** — Add `vercel.json` with cron schedule hitting `/api/claims/submit-scheduled` (route already exists).
2. **CVS real adapter (Phase 2)** — NCPDP encoding is done; remaining is SFTP upload replacing HTTP call + Inngest response poller replacing synchronous decode. One-line swap in gateway registry.
