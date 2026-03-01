-- BH RCM schema — see Architecture.md for full documentation

-- ============================================================
-- organizations
-- ============================================================
create table organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  billing_type  text not null check (billing_type in ('cvs', 'esi', 'direct')),
  client_codes  text[] not null default '{}',
  zip_code      text,
  member_exclusive boolean not null default false,
  legacy_pricing   boolean not null default false,
  delivery_paused  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- products
-- ============================================================
create table products (
  id                          uuid primary key default gen_random_uuid(),
  name                        text not null,
  slug                        text not null unique,
  product_id_legacy           integer not null unique,
  upc                         text not null,
  upc_legacy                  text,
  ndc_qualifier               text not null default '03',
  ingredient_cost             decimal(10,2) not null,
  dispensing_fee              decimal(10,2) not null,
  usual_and_customary_charge  decimal(10,2) not null,
  gross_amount_due            decimal(10,2) not null,
  days_supply                 integer not null default 365,
  quantity                    integer not null default 1,
  created_at                  timestamptz not null default now()
);

-- ============================================================
-- patients
-- ============================================================
create table patients (
  id                        uuid primary key default gen_random_uuid(),
  first_name                text not null,
  last_name                 text not null,
  date_of_birth             date not null,
  gender                    text not null check (gender in ('M', 'F', 'U', 'X')),
  zip_code                  text,
  caremark_id               text,
  bin_number                text,
  processor_control_number  text,
  rx_group                  text,
  group_id                  text,
  carrier_id                text,
  account_id                text,
  person_code               text,
  relationship_code         text,
  created_at                timestamptz not null default now()
);

-- ============================================================
-- enrollments
-- ============================================================
create table enrollments (
  id                      uuid primary key default gen_random_uuid(),
  patient_id              uuid not null references patients(id),
  product_id              uuid not null references products(id),
  organization_id         uuid not null references organizations(id),
  enrolled_at             timestamptz not null,
  billing_point_hit_at    timestamptz,
  reference_number        bigint,
  copayment_amount_cents  integer,
  is_billable             boolean not null default true,
  not_billable_reason     text,
  created_at              timestamptz not null default now(),

  unique (patient_id, product_id)
);

-- ============================================================
-- batches
-- ============================================================
create table batches (
  id              uuid primary key default gen_random_uuid(),
  submitted_at    timestamptz,
  total_claims    integer not null default 0,
  paid_count      integer not null default 0,
  rejected_count  integer not null default 0,
  duplicate_count integer not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- claims
-- ============================================================
create table claims (
  id                        uuid primary key default gen_random_uuid(),
  enrollment_id             uuid not null references enrollments(id),
  batch_id                  uuid references batches(id),
  sequence_number           integer not null default 1,
  status                    text not null default 'pending'
                            check (status in ('pending', 'submitted', 'paid', 'rejected', 'duplicate')),
  service_date              date,
  submitted_at              timestamptz,
  responded_at              timestamptz,
  response_status           text check (response_status in ('P', 'R', 'D')),
  reject_codes              text[],
  reject_descriptions       text[],
  settlement_codes          text[],
  settlement_descriptions   text[],
  settlement_severity_codes text[],
  created_at                timestamptz not null default now()
);

-- ============================================================
-- Indexes for common query patterns
-- ============================================================
create index idx_claims_enrollment_id on claims(enrollment_id);
create index idx_claims_status on claims(status);
create index idx_claims_batch_id on claims(batch_id);
create index idx_enrollments_patient_id on enrollments(patient_id);
create index idx_enrollments_product_id on enrollments(product_id);
create index idx_enrollments_organization_id on enrollments(organization_id);
create index idx_organizations_slug on organizations(slug);
