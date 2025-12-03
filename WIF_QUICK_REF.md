# WIF Quick Reference

## The Problem
```
❌ gcloud iam service-accounts keys create key.json ...
ERROR: Key creation is not allowed on this service account.
```

## The Solution
**Workload Identity Federation** - No JSON keys needed!

## What Changed

| File | Change | Status |
|------|--------|--------|
| `nextjs/src/lib/config.ts` | Added WIF logging to `getAuthHeaders()` | ✅ Done |
| `nextjs/.env` | Added GOOGLE_CLOUD_WORKLOAD_PROVIDER | ✅ Done |
| `app/config.py` | Added WIF logging to `initialize_vertex_ai()` | ✅ Done |

## One Command Remaining

An Org Admin needs to run:

```bash
gcloud iam service-accounts add-iam-policy-binding \
  vercel-caller@alltest-480009.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member='principalSet://iam.googleapis.com/projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider'
```

## Verify It Worked

```bash
gcloud iam service-accounts get-iam-policy vercel-caller@alltest-480009.iam.gserviceaccount.com
```

Should show the binding with `roles/iam.workloadIdentityUser`.

## Test Your App

```bash
# Frontend
cd nextjs && npm run dev
# Look for: "🔐 [WIF] Getting access token..."

# Backend
make dev-backend
# Look for: "🔐 [WIF] Using Workload Identity Federation..."
```

## Key Points

✅ **No JSON keys created or needed**  
✅ **Automatic token exchange**  
✅ **Works everywhere: local, Vercel, Cloud Run**  
✅ **Secure temporary tokens**  

---

See `WIF_SETUP_GUIDE.md` and `WIF_BINDING_COMMAND.md` for full details.
