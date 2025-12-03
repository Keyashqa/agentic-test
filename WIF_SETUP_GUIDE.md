# Workload Identity Federation (WIF) Setup Guide

This project is configured to use **Workload Identity Federation** for secure authentication with Google Cloud. This means **no JSON service account keys are needed**.

## Overview

Instead of creating and managing long-lived JSON keys, WIF allows secure token exchange:
- Your deployment environment (Vercel, Cloud Run, local dev) proves its identity
- Google Cloud exchanges that identity for a temporary access token
- Your application uses the access token to call Agent Engine and other Google Cloud APIs

## Why WIF?

✅ **No JSON keys to manage or expose**  
✅ **Works seamlessly across environments** (local, staging, production)  
✅ **Automatic token refresh** (no manual key rotation)  
✅ **Better security posture** (temporary tokens, not long-lived keys)  
✅ **Meets enterprise security requirements**

## Current Configuration

Your `.env` file is already configured with WIF settings:

```env
# Workload Identity Pool Provider
# Format: projects/{PROJECT_NUMBER}/locations/{LOCATION}/workloadIdentityPools/{POOL_ID}/providers/{PROVIDER_ID}
GOOGLE_CLOUD_WORKLOAD_PROVIDER=projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider

# Service account that will be impersonated (requires binding)
GOOGLE_CLOUD_SERVICE_ACCOUNT=vercel-caller@alltest-480009.iam.gserviceaccount.com
```

## How It Works in This Project

### Next.js Frontend (`config.ts`)

```typescript
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { GoogleAuth } = await import("google-auth-library");

  const auth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });

  // GoogleAuth automatically detects GOOGLE_CLOUD_WORKLOAD_PROVIDER
  // and exchanges workload identity for access token
  const authClient = await auth.getClient();
  const accessToken = await authClient.getAccessToken();
  
  return {
    "Authorization": `Bearer ${accessToken.token}`,
    "Content-Type": "application/json",
  };
}
```

### Python Backend (`config.py`)

```python
# google.auth.default() automatically uses WIF when GOOGLE_CLOUD_WORKLOAD_PROVIDER is set
vertexai.init(
    project=config.project_id,
    location=config.location,
    staging_bucket=config.staging_bucket,
)
```

## Setup Steps

### 1. Bind the Workload Identity Provider to the Service Account

Run this command to allow the workload identity provider to impersonate the service account:

```bash
gcloud iam service-accounts add-iam-policy-binding vercel-caller@alltest-480009.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "principalSet://iam.googleapis.com/projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider"
```

### 2. Verify the Binding

```bash
gcloud iam service-accounts get-iam-policy vercel-caller@alltest-480009.iam.gserviceaccount.com
```

You should see a binding that includes the workload identity pool provider.

### 3. Environment Setup

#### Local Development

1. Set up Application Default Credentials:
   ```bash
   gcloud auth application-default login
   ```

2. Ensure `.env` has `GOOGLE_CLOUD_WORKLOAD_PROVIDER` set (it already does)

3. Set your project:
   ```bash
   gcloud config set project alltest-480009
   ```

#### Vercel Deployment

1. The environment variables are automatically configured:
   - `GOOGLE_CLOUD_PROJECT=alltest-480009`
   - `GOOGLE_CLOUD_WORKLOAD_PROVIDER=projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider`
   - `GOOGLE_CLOUD_SERVICE_ACCOUNT=vercel-caller@alltest-480009.iam.gserviceaccount.com`

2. Vercel's runtime automatically provides the workload identity (OIDC token)

3. GoogleAuth library exchanges it for an access token transparently

#### Cloud Run Deployment

1. Cloud Run automatically provides workload identity if you deploy with:
   ```bash
   gcloud run deploy your-service \
     --service-account vercel-caller@alltest-480009.iam.gserviceaccount.com
   ```

2. Set the environment variables in Cloud Run:
   ```bash
   gcloud run deploy your-service \
     --update-env-vars GOOGLE_CLOUD_WORKLOAD_PROVIDER="projects/929712038710/locations/global/workloadIdentityPools/vercel-pool/providers/vercel-provider"
   ```

## Testing Your Setup

### Test WIF in Node.js

```bash
node -e "
const { GoogleAuth } = require('google-auth-library');
const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
auth.getClient().then(client => client.getAccessToken()).then(token => console.log('✅ Token:', token?.token?.substring(0, 20) + '...'));
"
```

### Test WIF in Python

```bash
python -c "
import google.auth
credentials, project = google.auth.default(scopes=['https://www.googleapis.com/auth/cloud-platform'])
print('✅ Project:', project)
print('✅ Credentials type:', type(credentials).__name__)
"
```

### Run Backend

```bash
make dev-backend
```

Should show:
```
🔐 [WIF] Using Workload Identity Federation for authentication
   No service account JSON key needed!
✅ Vertex AI initialized successfully!
```

### Run Frontend

```bash
cd nextjs && npm run dev
```

On first Agent Engine call, should show:
```
🔐 [WIF] Getting access token via Workload Identity Federation...
📍 [WIF] Workload Provider: projects/929712038710/locations/global/...
✅ [WIF] Successfully obtained access token
```

## Troubleshooting

### Error: "Key creation is not allowed on this service account"

This is **expected and correct**! WIF doesn't require JSON keys. This error means:
- Your organization enforces `constraints/iam.disableServiceAccountKeyCreation`
- WIF setup is the right solution (no JSON key needed)

### Error: "No credentials found" or "Not authenticated"

**Check:**
1. `GOOGLE_CLOUD_WORKLOAD_PROVIDER` is set in `.env`
2. `gcloud auth application-default login` has been run (for local dev)
3. WIF binding has been created (see Setup Steps above)
4. Service account has required roles (should have `roles/aiplatform.user`)

### Error: "PERMISSION_DENIED" when calling Agent Engine

**Check:**
1. Service account (`vercel-caller@...`) has `roles/aiplatform.user` role:
   ```bash
   gcloud projects get-iam-policy alltest-480009 \
     --flatten="bindings[].members" \
     --filter="bindings.members:vercel-caller@"
   ```

2. If missing, add the role:
   ```bash
   gcloud projects add-iam-policy-binding alltest-480009 \
     --member="serviceAccount:vercel-caller@alltest-480009.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"
   ```

## Comparison: WIF vs JSON Keys

| Aspect | WIF | JSON Keys |
|--------|-----|-----------|
| **Key Files** | None needed ✅ | Must manage `.json` file ❌ |
| **Token Lifetime** | Temporary (1 hour) ✅ | Long-lived ❌ |
| **Key Rotation** | Automatic ✅ | Manual ❌ |
| **Exposure Risk** | Low ✅ | High ❌ |
| **Multi-Environment** | Works everywhere ✅ | Different setup per env ❌ |
| **Local + Cloud** | Same code ✅ | Conditional logic ❌ |

## Learn More

- [Workload Identity Federation Docs](https://cloud.google.com/docs/authentication/workload-identity-federation)
- [GoogleAuth Library (Node.js)](https://github.com/googleapis/google-auth-library-nodejs)
- [Vertex AI Authentication](https://cloud.google.com/python/docs/reference/google-auth/latest)
- [Vercel + Google Cloud Integration](https://vercel.com/docs/integrations/google-cloud)

## Summary

✅ Your project is configured to use WIF  
✅ No JSON key files are needed or created  
✅ Authentication is automatic across all environments  
✅ Changes made to `config.ts`, `config.py`, and `.env` to support WIF

You're all set! Run your app and WIF will handle authentication automatically.
