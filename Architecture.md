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
| NCPDP encoding (Phase 2) | Python function extracted from cvs-integration-service-cluster | `~/dev/rcm/bh-rcm_py` |
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

```
billing_point_hit
       │
       ▼
    pending ──────────► submitted ──────────► paid
  (claim created,     (in a batch,          (PBM accepted)
   not yet sent)       sent to PBM)
                                  ──────────► rejected
                                              (PBM denied — rejection code recorded)
                                  ──────────► duplicate
                                              (PBM already paid this patient/product)

If rejected:
    user initiates resubmission
       │
       ▼
    new claim row (sequence_number + 1) at status "pending"
```

An enrollment's derived status is its latest claim's status.

## Stub PBM Endpoint

A Next.js API route at `/api/pbm/submit` that simulates PBM claim adjudication.

**Behavior:**
- Accepts a batch of claims (JSON)
- ~50% of claims are paid, ~50% rejected
- **Duplicate detection**: If a claim for the same patient/product has already been paid, returns `duplicate` instead of randomly adjudicating
- **Rejection reason codes**: Returns realistic NCPDP-style codes:
  - `75` — Prior Authorization Required
  - `70` — Product Not Covered
  - `65` — Patient Not Covered
  - `25` — Plan Limitations Exceeded
- Responds synchronously (no batch file / SFTP simulation needed for POC)

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
| Current claim status (derived) | Yes |
| # of attempts | |

**Bulk action**: Select claims by filter → "Submit Claims" → creates a batch and submits to stub PBM.

### Enrollment Detail

Click into an enrollment to see:
- Patient and product info
- Full claim chain: every submission attempt, its batch, PBM response, timestamps
- "Resubmit" button on rejected claims → creates a new claim row at `pending`

## Claim Submission Flow

1. User filters enrollments list (e.g., status = `pending` or status = `rejected`)
2. User clicks "Submit Claims"
3. System creates a `batch` row
4. System assigns selected pending claims to the batch, sets `batch_id`
5. System POSTs claims to `/api/pbm/submit`
6. System updates each claim with PBM response (status, response_code, response_message, responded_at)
7. System updates batch summary counts (paid_count, rejected_count, duplicate_count)
8. Portal refreshes to show results

Synchronous for the POC — 100 claims is fast enough.

## Seed Data

100 patient/product combinations populated in Supabase:
- ~30 patients, each enrolled in 1–3 products
- All have `billing_point_hit_at` set (all are billable)
- Each enrollment gets an initial claim at status `pending`
- Realistic patient names, dates of birth, and PBM identifiers

## NCPDP Encoding (Phase 2)

The NCPDP D.0 encoding logic will be **extracted from** `cvs-integration-service-cluster`'s `CaremarkMemberClaimService.ncpdp_billing_claim` method (not just referenced — the actual code will be ported). It will be installed as a Python function in `~/dev/rcm/bh-rcm_py`.

Phase 1: Portal sends JSON to stub PBM.
Phase 2: Portal calls `bh-rcm_py` to encode claims as NCPDP D.0, then sends encoded claims to PBM.

The claim submission interface will be designed so swapping JSON for NCPDP encoding is a straightforward change.

## What's Intentionally Skipped

- **Eligibility verification / test claims** — all seed patients are assumed eligible
- **SFTP delivery** — direct HTTP to stub PBM
- **835 reconciliation** — stub PBM responds immediately
- **Bundle pricing / resolvers** — individual products only
- **Auth / RLS** — single-user portal
- **Real-time subscriptions** — standard request/response
- **Inngest / async orchestration** — synchronous submission is sufficient at this scale
