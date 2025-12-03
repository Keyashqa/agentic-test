# Workload Identity Federation Binding Command

## Problem Resolved
❌ **Before:** `gcloud iam service-accounts keys create` failed with "Key creation is not allowed"  
✅ **After:** Using Workload Identity Federation - no JSON keys needed

## Files Updated
- ✅ `nextjs/src/lib/config.ts` - Enhanced `getAuthHeaders()` for WIF with logging
- ✅ `nextjs/.env` - Added clear WIF comments
- ✅ `app/config.py` - Updated to log WIF usage
- ✅ Created `WIF_SETUP_GUIDE.md` - Comprehensive guide

## The Binding Command

Your WIF provider (`vercel-provider` in `vercel-pool`) needs to be bound to the service account.

Run this command via the **Google Cloud Console CLI** or have your **Org Admin** run it:

```bash
# Method 1: Using gcloud beta for more flexible IAM bindings
gcloud beta iam service-accounts add-iam-policy-binding \
  vercel-caller@alltest-480009.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member='principalSet://iam.googleapis.com/projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider'

# Method 2: Alternative using gcloud iam service-accounts (standard)
# Note: This uses the exact resource path format
gcloud iam service-accounts add-iam-policy-binding \
  vercel-caller@alltest-480009.iam.gserviceaccount.com \
  --role=roles/iam.workloadIdentityUser \
  --member='principalSet://iam.googleapis.com/projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider'

# Method 3: Via Google Cloud Console (if you prefer UI)
# 1. Go to: console.cloud.google.com
# 2. Navigate: IAM & Admin > Service Accounts
# 3. Click: vercel-caller@alltest-480009.iam.gserviceaccount.com
# 4. Click: GRANT ACCESS or expand the PERMISSIONS tab
# 5. Add Principal:
#    - Principal: principalSet://iam.googleapis.com/projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider
#    - Role: Workload Identity User (roles/iam.workloadIdentityUser)
# 6. Save
```

## Verify the Binding

After running the command, verify it worked:

```bash
gcloud iam service-accounts get-iam-policy \
  vercel-caller@alltest-480009.iam.gserviceaccount.com
```

You should see output that includes:
```yaml
bindings:
- members:
  - principalSet://iam.googleapis.com/projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider
  role: roles/iam.workloadIdentityUser
```

## What This Does

When properly bound:
1. Your **Vercel deployment** (or Cloud Run, local dev) proves its identity via OIDC token
2. **Google Cloud** exchanges that token for a temporary access token
3. **Your app** uses that token to call Agent Engine and other APIs
4. ✅ **No JSON key files needed**

## Testing the Setup

After the binding is created, test it:

### Frontend (Next.js)
```bash
cd nextjs && npm run dev
```

Should show:
```
🔐 [WIF] Getting access token via Workload Identity Federation...
📍 [WIF] Workload Provider: projects/929712038710/locations/global/...
✅ [WIF] Successfully obtained access token
```

### Backend (Python)
```bash
make dev-backend
```

Should show:
```
🔐 [WIF] Using Workload Identity Federation for authentication
   No service account JSON key needed!
✅ Vertex AI initialized successfully!
```

## Troubleshooting

### Command fails with "Invalid principalSet member"
- This error from older gcloud versions means the format isn't recognized yet
- **Solution:** Update gcloud SDK:
  ```bash
  gcloud components update
  ```

### Still getting "Key creation is not allowed"
- This is correct! It means the org policy is working
- WIF doesn't need keys - the binding allows token exchange instead
- The command should be run successfully once

### "PERMISSION_DENIED" when calling Agent Engine
- Ensure the service account has required roles:
  ```bash
  gcloud projects add-iam-policy-binding alltest-480009 \
    --member="serviceAccount:vercel-caller@alltest-480009.iam.gserviceaccount.com" \
    --role="roles/aiplatform.user"
  ```

## Current Status

| Component | Status | Details |
|-----------|--------|---------|
| **Next.js Config** | ✅ Ready | `config.ts` updated with WIF support |
| **Python Config** | ✅ Ready | `config.py` updated with WIF logging |
| **Environment** | ✅ Ready | `.env` configured with WIF variables |
| **Service Account** | ✅ Exists | `vercel-caller@alltest-480009.iam.gserviceaccount.com` |
| **WIF Pool & Provider** | ✅ Exists | Pool: `vercel-pool`, Provider: `vercel-provider` |
| **WIF Binding** | ⏳ Pending | Run command above to complete setup |

## Next Steps

1. **Run the binding command** (copy-paste from above)
2. **Verify with check command** (see "Verify the Binding" section)
3. **Test the setup** (see "Testing the Setup" section)
4. **Deploy to Vercel/Cloud Run** (WIF will work automatically)

## Questions?

See `WIF_SETUP_GUIDE.md` for comprehensive documentation on Workload Identity Federation.

---

**Last Updated:** December 3, 2025  
**Configuration Files Modified:** 3  
**Status:** Ready for WIF binding
