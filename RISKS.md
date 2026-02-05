# RISKS

1) Market data staleness / downtime
- Mitigation: caching + stale flags + fail-safe.

2) Fill-time estimation accuracy
- Mitigation: conservative defaults + calibration.

3) Limit tracking correctness
- Mitigation: only count confirmed fills; rolling 4h ledger.
