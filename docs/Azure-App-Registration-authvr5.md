# Azure App Registration for Cybersmith Secure Dashboard

Use this document to register a **new** Microsoft Entra ID application for dashboard sign-in (`authvr5`, Case A).

Do **not** create a second app later for production. Register once, then reuse the same Client ID, Tenant ID, and secret.

---

## Application details

| Field | Value |
| --- | --- |
| Suggested app name | Cybersmith Secure Dashboard |
| Account type | Accounts in this organizational directory only (Single tenant) |
| Platform | **Web** |
| Redirect URI (required) | `https://teststat-production.up.railway.app/api/auth/callback` |
| Optional local redirect URI | `http://localhost:5173/api/auth/callback` |
| Client type | Confidential / Web (uses a client secret) |
| Implicit grant | Off. Do not enable Access tokens or ID tokens. |
| Allow public client flows | No |

The production redirect URI must be entered **exactly** as:

```text
https://teststat-production.up.railway.app/api/auth/callback
```

Do not add a trailing slash. Do not change `https` to `http`.

---

## 1. Open App registrations

1. Go to [https://portal.azure.com](https://portal.azure.com).
2. Sign in with an account that can create app registrations in the Cybersmith tenant.
3. Search for **Microsoft Entra ID**.
4. Open **App registrations**.
5. Click **New registration**.

---

## 2. Register the application

Fill the form:

1. **Name:** `Cybersmith Secure Dashboard`
2. **Supported account types:** **Accounts in this organizational directory only (Single tenant)**
3. **Redirect URI**
   - Platform: **Web**
   - URI: `https://teststat-production.up.railway.app/api/auth/callback`
4. Click **Register**.

---

## 3. Copy Tenant ID and Client ID

On the new app **Overview** page, copy:

- **Application (client) ID**
- **Directory (tenant) ID**

These become:

```env
AZURE_CLIENT_ID=<Application (client) ID>
AZURE_TENANT_ID=<Directory (tenant) ID>
```

---

## 4. Create a client secret

1. Open **Certificates & secrets**.
2. Open **Client secrets**.
3. Click **New client secret**.
4. Description: `dashboard-production`
5. Expiry: 6 months or 12 months.
6. Click **Add**.
7. Copy the **Value** immediately. Azure shows it only once.

This becomes:

```env
AZURE_CLIENT_SECRET=<Client secret Value>
```

Do not copy the Secret ID. Only the **Value** works.

---

## 5. Confirm redirect URIs

1. Open **Authentication**.
2. Under **Web**, confirm this URI is present:

   `https://teststat-production.up.railway.app/api/auth/callback`

3. Optional, for local testing, click **Add URI** and add:

   `http://localhost:5173/api/auth/callback`

4. Under **Implicit grant and hybrid flows**, leave **Access tokens** and **ID tokens** unchecked.
5. **Allow public client flows:** No.
6. Click **Save**.

Do not add this app as a **Single-page application (SPA)** platform. The dashboard API is a **Web** client because it uses the client secret.

---

## 6. Add Microsoft Graph permissions

1. Open **API permissions**.
2. Click **Add a permission**.
3. Choose **Microsoft Graph**.
4. Choose **Delegated permissions**.
5. Add:
   - `openid`
   - `profile`
   - `email`
   - `User.Read`
   - `offline_access` (optional)
6. Click **Add permissions**.
7. If you are a tenant admin, click **Grant admin consent for [your organization]**.

`User.Read` is often added automatically. Keep it.

---

## 7. Optional branding

1. Open **Branding & properties**.
2. Display name: `Cybersmith Secure Dashboard`

---

## 8. Values to return after registration

Send these four values back to the person deploying the dashboard. Do not put them in email as a screenshot of the whole Azure page if that also shows other secrets.

```env
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AUTH_REDIRECT_URI=https://teststat-production.up.railway.app/api/auth/callback
```

On Railway, add the same four variables on the dashboard service, then redeploy.

---

## 9. How sign-in should work after this

1. Open `https://teststat-production.up.railway.app/`
2. Click **Sign in with Microsoft (authvr5)**.
3. Sign in with a `@cybersmithsecure.com` Microsoft account.
4. Azure must redirect back to:

   `https://teststat-production.up.railway.app/api/auth/callback`

The dashboard accepts only company emails ending with `@cybersmithsecure.com`.

---

## Common errors

| Error | Cause | Fix |
| --- | --- | --- |
| `AADSTS50011` | Redirect URI mismatch | The URI in Azure must match `AUTH_REDIRECT_URI` exactly, including `https` and `/api/auth/callback`. |
| `AADSTS7000215` or invalid client secret | Wrong secret copied | Use the secret **Value**, not the Secret ID. Create a new secret if the value was lost. |
| Need admin approval | Consent not granted | A tenant admin must grant admin consent on **API permissions**. |
| Account not accepted | Personal Microsoft account or wrong tenant | Use a `@cybersmithsecure.com` work account in this single-tenant directory. |

---

## Checklist before handing over

- [ ] New app registered as **Web**, single tenant
- [ ] Redirect URI is exactly `https://teststat-production.up.railway.app/api/auth/callback`
- [ ] Optional local URI `http://localhost:5173/api/auth/callback` added if local testing is needed
- [ ] Client secret **Value** copied
- [ ] Graph delegated permissions added: `openid`, `profile`, `email`, `User.Read`
- [ ] Admin consent granted, if possible
- [ ] Implicit grant left off
- [ ] Tenant ID, Client ID, secret, and production redirect URI returned to the developer
