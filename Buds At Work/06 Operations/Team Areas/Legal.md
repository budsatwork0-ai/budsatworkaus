# Legal

> Compliance, contracts, licensing, and legal obligations for Buds At Work (QLD, Australia).

**Dashboard entry:** `/dashboard/settings`  
**Domain card shows:** "Compliance active" · ABN · Privacy · ACL · T&Cs

---

## Business Registration

| Item | Status | Notes |
|---|---|---|
| ABN | Active | Confirm in `/dashboard/settings` |
| Business name | Registered | "Buds At Work" |
| ACN | N/A (sole trader or partnership?) | Confirm with accountant |
| GST Registration | Registered | Mandatory if turnover > $75k/yr |
| State: Queensland | ✓ | Local services — Logan & South Brisbane |

---

## Legal Documents Required

| Document | Status | Location |
|---|---|---|
| Terms & Conditions | Check if live | Footer of website / services wizard |
| Privacy Policy | Check if live | Footer + required for CAPTCHA usage |
| Refund Policy | Documented | [[Refund Process]] SOP |
| Cookie Policy | Check | Required if analytics cookies used |
| Contractor Agreements | Required for crew | Store securely — not in this vault |

---

## Australian Consumer Law (ACL) Obligations

- Must honour refunds for services not delivered or substantially not meeting description
- Cannot mislead customers about scope or pricing
- Cancellation policy must be clearly communicated before payment
- 10-day cooling off does **not** apply to services commenced with customer consent

**Practical:**
- Booking Confirmed email = contract formed (service type + amount + date)
- Refund policy = [[Refund Process]] SOP
- Complaint escalation = [[Customer Support]] → P1/P2 matrix

---

## Data Privacy (Privacy Act 1988 + Australian Privacy Principles)

- Customer email, phone, address collected — must be disclosed in Privacy Policy
- Stripe handles card data — PCI DSS compliant (not stored on Buds At Work servers)
- Supabase data is stored in AU region: **ap-southeast-2** (confirm in Supabase settings)
- Right to deletion: if customer requests data deletion, must comply
- **CAPTCHA (Turnstile):** Cloudflare processes data — must be disclosed

---

## Contractor Compliance (ATO)

If crew are contractors (ABN holders):
- [ ] Collect ABN before paying — or withhold 47% under no-ABN rule
- [ ] Do not treat contractors like employees (set hours, supply tools exclusively, etc.)
- [ ] Super guarantee may apply if contractor is "primarily labour" — review with accountant
- [ ] Issue payment summaries if applicable (via STP from 2025)
- [ ] Taxable payments annual report (TPAR) — required for cleaning/courier businesses

---

## Insurance Checklist

| Insurance | Required | Status |
|---|---|---|
| Public Liability | ✅ Yes | Confirm policy # and expiry |
| Workers Compensation | If employees | N/A (contractors) |
| Vehicle Insurance (business use) | ✅ Yes | Confirm crew coverage |
| Professional Indemnity | Optional | Consider if offering consultations |

---

## Automation Opportunities

- [ ] Insurance expiry reminder (annual — calendar alert)
- [ ] ABN validation check on contractor onboarding
- [ ] TPAR data export: annual Supabase query of all contractor payments
- [ ] Privacy Policy "last updated" date auto-stamp

---

## Related
- [[Admin]]
- [[HR & Crew]]
- [[Finance]]
- [[Customer Support]]
