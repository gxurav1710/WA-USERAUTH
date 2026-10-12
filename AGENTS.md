# AGENTS.md — Integration Guide for AI Coding Agents

> **Audience**: AI Coding Agents, Copilots, and Autonomous Pair Programmers integrating WA-USERAUTH into merchant and developer applications.  
> **Purpose**: Authoritative technical specification on the WA-USERAUTH authentication lifecycle, single-script frontend embed, normalized DOM events, strict 3-field storage, and cryptographic server-to-server token verification.

---

## 1. High-Level Architecture & Lifecycle

WA-USERAUTH is a self-hosted, sovereign WhatsApp OTP authentication service designed for frictionless developer integration:

```
  [ Merchant / Client Website ]
              │
    (1) Adds one script: <script src=".../wa-userauth.js" data-app-key="...">
              │
    (2) Maps login button: <button data-wa-userauth>
              │
    (3) WAUserAuth script renders centered modal (or mobile bottom sheet)
              │
    (4) User selects country (240+ countries), enters mobile, solves visual distorted CAPTCHA
              │
    (5) WA-USERAUTH backend checks user existence, verifies CAPTCHA & rate limits
              │
    (6) BerryProtocol socket pushes cryptographically random 6-digit OTP to user's WhatsApp
              │
    (7) User enters 6-digit OTP into auto-advancing modal digits
              │
    (8) WA-USERAUTH verifies OTP and mints single-use HMAC-SHA256 signed authToken
              │
     ┌────────┴──────────────────────────┐
     ▼                                   ▼
 [ Browser CustomEvents ]      [ Server Token Verification ]
 wa-userauth:success           POST /api/v1/auth/result/verify
 (For instant UI feedback)     (AUTHORITATIVE IDENTITY VALIDATION)
```

---

## 2. Universal One-Script Frontend Integration

### Step 1: Script Inclusion
Place the script tag in the page's HTML `<head>` or `<body>`:

```html
<script 
  src="https://<wa-userauth-host>/wa-userauth.js" 
  data-app-key="YOUR_APP_KEY">
</script>
```

- When running locally, `<wa-userauth-host>` is `http://localhost:3000`.
- In production, it is your canonical self-hosted domain (e.g., `https://auth.yourdomain.com`).
- To override the API endpoint dynamically, use the `data-api-url` attribute.

### Step 2: Zero-JS Declarative Configuration
Tag any clickable button with `data-wa-userauth`:

```html
<button data-wa-userauth class="btn-login">
  Login with WhatsApp
</button>
```

The client script automatically binds click events to elements with `[data-wa-userauth]`, including dynamic elements inserted after initial DOM load.

### Step 3: Programmatic API (`window.WAUserAuth.open`)
For Single Page Applications (React, Next.js, Vue, Nuxt, Svelte, Angular), use the programmatic interface:

```javascript
window.WAUserAuth.open({
  appKey: "YOUR_APP_KEY",
  apiUrl: "https://auth.yourdomain.com", // Optional, defaults to script host
  onSuccess: function(data) {
    console.log("Authentication confirmed in modal:", data);
    // data: { status: "SUCCESS", user: { name, mobile, email }, authToken }
    
    // IMPORTANT: Forward authToken to your backend for authoritative validation
    verifySessionWithBackend(data.authToken);
  },
  onError: function(err) {
    console.error("Authentication error:", err.message);
  },
  onClose: function(detail) {
    console.log("Modal closed:", detail.reason);
  }
});
```

---

## 3. Normalized Browser DOM Events

The frontend script emits normalized DOM `CustomEvent`s on `window`:

| Event Name | Trigger Condition |
| :--- | :--- |
| `wa-userauth:success` | Customer successfully verified their 6-digit WhatsApp OTP |
| `wa-userauth:error` | Network error, rate limit lockout, or verification failure |
| `wa-userauth:close` | Modal dismissed by user (backdrop click, close button, or Escape key) |

### Event Payloads Contract (`event.detail`):

#### 1. `wa-userauth:success`
```json
{
  "status": "SUCCESS",
  "user": {
    "name": "Jane Doe",
    "mobile": "+919876543210",
    "email": "jane@example.com"
  },
  "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "timestamp": "2026-10-12T18:00:00.000Z"
}
```

#### 2. `wa-userauth:error`
```json
{
  "status": "ERROR",
  "message": "Too many requests. Please wait 60 seconds before trying again.",
  "timestamp": "2026-10-12T18:00:00.000Z"
}
```

#### 3. `wa-userauth:close`
```json
{
  "reason": "user_action",
  "timestamp": "2026-10-12T18:00:00.000Z"
}
```

---

## 4. Authoritative Server-to-Server Token Verification

> [!CRITICAL]
> **RULE FOR AI AGENTS**: Browser events (`wa-userauth:success`) are strictly for client UI updates.  
> **NEVER** grant administrative privileges, issue session cookies, or release protected resources solely on browser events. The backend application **MUST** verify the `authToken` with the WA-USERAUTH backend.

### Verification Endpoint Contract:
- **URL**: `POST /api/v1/auth/result/verify`
- **Headers**: `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "authToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "appKey": "YOUR_APP_KEY",
    "appSecret": "YOUR_APP_SECRET"
  }
  ```
- **Success Response (HTTP 200)**:
  ```json
  {
    "success": true,
    "user": {
      "name": "Jane Doe",
      "mobile": "+919876543210",
      "email": "jane@example.com"
    },
    "verifiedAt": "2026-10-12T18:00:00.000Z"
  }
  ```
- **Failure Response (HTTP 401)**:
  ```json
  {
    "success": false,
    "error": "Authentication token expired or already consumed."
  }
  ```

### Backend Implementation Patterns:

#### Node.js / Express:
```javascript
import express from 'express';

const app = express();
app.use(express.json());

app.post('/api/auth/callback', async (req, res) => {
  const { authToken } = req.body;

  try {
    const verifyRes = await fetch('http://localhost:3000/api/v1/auth/result/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        authToken,
        appKey: process.env.WA_APP_KEY,
        appSecret: process.env.WA_APP_SECRET
      })
    });

    const data = await verifyRes.json();
    if (!verifyRes.ok || !data.success) {
      return res.status(401).json({ error: data.error || 'Authentication verification failed' });
    }

    // Authoritative user profile
    const { name, mobile, email } = data.user;
    req.session.user = { name, mobile, email };

    return res.json({ success: true, user: req.session.user });
  } catch (err) {
    return res.status(500).json({ error: 'Internal verification error' });
  }
});
```

#### Python / FastAPI:
```python
from fastapi import FastAPI, HTTPException
import httpx
import os

app = FastAPI()

@app.post("/api/auth/callback")
async def auth_callback(payload: dict):
    auth_token = payload.get("authToken")
    if not auth_token:
        raise HTTPException(status_code=400, detail="Missing authToken")

    async with httpx.AsyncClient() as client:
        res = await client.post(
            f"{os.getenv('WA_AUTH_URL', 'http://localhost:3000')}/api/v1/auth/result/verify",
            json={
                "authToken": auth_token,
                "appKey": os.getenv("WA_APP_KEY"),
                "appSecret": os.getenv("WA_APP_SECRET")
            }
        )

    data = res.json()
    if not data.get("success"):
        raise HTTPException(status_code=401, detail=data.get("error", "Verification failed"))

    user = data["user"] # Guaranteed exactly {"name": "...", "mobile": "+E.164", "email": "..."}
    return {"status": "authenticated", "user": user}
```

---

## 5. Non-Negotiable Architectural Invariants

When working with or extending WA-USERAUTH, AI Coding Agents **MUST NOT** violate the following architectural invariants:

### Invariant 1: Exactly ONE User Database File (`data/users.json`)
- There is only **ONE** persistent user database file: `data/users.json`.
- Every user record contains **strictly and only 3 fields**: `name`, `mobile`, `email`.
- **PROHIBITED FIELDS**: Never insert `id`, `uuid`, `role`, `password`, `created_at`, `updated_at`, `meta`, or any other fields. The user store enforces a strict schema whitelist and rejects records containing extraneous fields.
- **AUTHORITATIVE IMMUTABILITY**: When an existing user logs in, their profile is returned as stored and **never overwritten** by form values.

### Invariant 2: Mobile Normalization to E.164
- Mobile numbers must **always** be normalized to the international E.164 format (e.g. `+919876543210`, `+14155552671`).
- All rate-limiting and user lookups key on normalized E.164 numbers.

### Invariant 3: Single-Use Security Guarantees
- OTP challenges are valid for **5 minutes** and for a maximum of **3 attempts**.
- Once an OTP is verified, its challenge is immediately consumed to prevent replay attacks.
- The minted `authToken` is valid for **10 minutes** and can be verified **EXACTLY ONCE**. Subsequent verification attempts are rejected.

### Invariant 4: Rate Limiting State Persistence
- Rate limits are stored in `data/rate_limits.json` and must survive application restarts.
- Shared quota across send, signup, and resend endpoints: 60s cooldown, max 3 in 15 min, max 5 in 1 hr, max 10 in 24 hr.
- Per-IP rate limiting: max 30 requests per 15 min.

### Invariant 5: Distorted Visual CAPTCHA Gate
- An alphanumeric visual CAPTCHA must be solved before an initial OTP or resend is dispatched.
- Distorted SVG generator produces ambiguous-free 5-character codes (`23456789ABCDEFGHJKLMNPQRSTUVWXYZ`) with Bezier noise lines and rotation.

---

## 6. Agent Checklist & Pitfalls to Avoid

| Pitfall to Avoid | Correct Implementation |
| :--- | :--- |
| **Parsing raw body as JSON before webhook HMAC check** | Always verify token using backend secret before granting session |
| **Adding timestamps or IDs to `data/users.json`** | Reject all extra fields; only `{ name, mobile, email }` allowed |
| **Using unnormalized mobile numbers for rate limits** | Always normalize to E.164 format using `normalizeMobile()` |
| **Relying exclusively on browser DOM events** | Treat browser events as UI triggers only; verify `authToken` server-side |
| **Overwriting existing user profiles on login** | Existing profiles in `data/users.json` are authoritative and untouchable |
| **Storing session state in memory only** | Ensure rate limits persist to `data/rate_limits.json` across restarts |
