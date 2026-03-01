-- Claims are created at submission time, not at billing point hit.
-- Remove any pre-seeded claims.
delete from claims;
