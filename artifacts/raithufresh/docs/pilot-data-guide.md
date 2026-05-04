# RaithuFresh Pilot Data Guide

This document provides guidance on preparing realistic sample data for the RaithuFresh pilot phase. The goal is to ensure the platform feels professional, trustworthy, and locally relevant to farmers and buyers in Telangana.

## 1. Target Locations (Telangana Districts)
Focus on these districts for the initial pilot to ensure realistic clustering:
- **Rangareddy** (High urban demand proximity)
- **Vikarabad** (Strong vegetable production)
- **Medak** (Diverse crops)
- **Siddipet** (Progressive farming clusters)
- **Sangareddy**

## 2. Recommended Realistic Test Accounts

### Test Buyer Accounts
| Name | Role | Purpose |
| :--- | :--- | :--- |
| `Buyer Test One` | `buyer` | General testing of browse/reserve flow. |
| `Local Retailer` | `buyer` | Testing larger quantity reservations. |

### Test Farmer Accounts (Verified)
| Name | Role | Village | District |
| :--- | :--- | :--- | :--- |
| `Lakshmi Devi` | `farmer` | Moinabad | Rangareddy |
| `Srinivas Rao` | `farmer` | Marpalle | Vikarabad |
| `Anitha Reddy` | `farmer` | Toopran | Medak |

## 3. Realistic Produce Listings
Avoid generic names like "Test Mango". Use specific local varieties:
- **Mango**: Banganapalli, Totapuri, Dasheri
- **Tomato**: Local Desi, Hybrid
- **Rice/Paddy**: BPT 5204 (Sona Masuri), RNR 15048 (Telangana Sona)
- **Chilli**: Guntur Red, Teja
- **Vegetables**: Okra (Bhendi), Brinjal (Vankaya), Bitter Gourd (Kakarakaya)

## 4. Phone Number Pattern for Testing
Use the following pattern for clearly identified test numbers:
- `9000000001` to `9000000099`
- Avoid using real random numbers to prevent accidental calls to real people.

## 5. Cleanup Strategy Before Launch
Before sharing with the first real user:
1. Run `supabase/pilot-readiness-cleanup.sql` to identify and remove "QA" and "Test" records.
2. Ensure at least 5-10 verified farmer profiles are visible with 2-3 listings each to avoid an "empty" feel.
3. Verify that all listed produce items have valid photorealistic images (no broken fallbacks).

## 6. Pilot Risk Checklist
- [ ] **No Online Payments**: Ensure every reservation modal clearly states "Payment on Pickup".
- [ ] **Direct Contact**: Confirm the WhatsApp/Call links work for the test farmer accounts.
- [ ] **Bilingual Clarity**: Check that Telugu labels don't overlap on small screens (320px-360px).
- [ ] **Routing fallback**: Ensure `404.html` is present on the live site to handle page refreshes.
