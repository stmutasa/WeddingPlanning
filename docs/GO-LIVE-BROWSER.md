# Going live with Claude in Chrome

This file is a set of prompts to paste into **Claude in Chrome** (the browser extension) so that it does most of [GO-LIVE.md](./GO-LIVE.md) for you. Each prompt is one step. Paste them in order, one at a time, and wait for each to finish before sending the next.

## What it can do, and what stays with you

The extension clicks and types in your own Chrome, signed in as you. It can create the Railway project, fill every setting, create the Google sign-in client, create the API keys and paste them where they belong, and check the result.

It will stop and hand back to you for anything that proves who you are or spends money. Expect to step in for:

- **Signing in** to Railway, Google Cloud, OpenAI, Anthropic and Plaid, including two-factor codes and "are you a robot" checks.
- **Payment details and billing limits** on Railway, OpenAI and Anthropic.
- **Browser permission pop-ups**, such as "allow notifications".
- **The phones.** Installing Harusi on your Android and Annette's iPhone is steps 7 and 8 of GO-LIVE.md, done by hand.

**Before you start, sign in yourself** to each of these sites in Chrome, so the extension has fewer interruptions:

1. https://railway.app (with GitHub)
2. https://console.cloud.google.com (as `stmutasa@gmail.com`)
3. https://platform.openai.com, with billing set up and a monthly limit
4. https://console.anthropic.com, with billing or credit set up
5. Optional: https://dashboard.plaid.com

**About secrets.** In this approach the extension copies each key from the site that creates it and pastes it into Railway, so the keys pass through Claude while it works. The prompts tell it never to repeat them in its replies or put them anywhere else. If you would rather no key ever passes through an AI, follow GO-LIVE.md by hand instead.

**If a prompt goes wrong,** reply "stop", check the page yourself, then paste the same prompt again. Every prompt is written to be safe to repeat: it checks what already exists before creating anything.

---

## Prompt 0. Ground rules

Paste this first, at the start of every new Claude in Chrome conversation.

```
I am deploying my private web app "Harusi" and you will do the setup in my browser, one step at a time, when I send each step. Rules for every step:

1. Work in a new tab. Do not close or change my other tabs.
2. Never type, change, or save passwords. If a site asks me to sign in, confirm with a code, solve a CAPTCHA, or enter payment or billing details, stop and tell me exactly what it needs. I will do it and tell you to continue.
3. Secrets (API keys, client secrets, generated keys): paste them only into the Variables page of the Harusi service on Railway. Never write a secret's value in your replies to me, never put it in any other page, file, or note. Refer to them by name, for example "the OpenAI key".
4. Only touch what the step names. Do not delete anything. Do not change other Railway projects, other Google Cloud projects, or any billing settings.
5. Before you click anything that publishes, deletes, or spends money, tell me what you are about to click and wait for me to say yes.
6. Before creating something, check whether it already exists from an earlier attempt. If it does, reuse it instead of making a duplicate.
7. When a step is done, give me a short report: what you did, what you saw, what you could not do, and anything I need to do next.

Reply "Ready" and wait for step 1.
```

---

## Prompt 1. Railway: project, disk, address, base settings

```
Step 1: put the app on Railway.

1. Open https://railway.app/dashboard. If there is already a project deploying the GitHub repository stmutasa/WeddingPlanning, open it and skip to item 4.
2. Create a new project: New Project, then "Deploy from GitHub repo", then choose stmutasa/WeddingPlanning. If Railway asks for access to repositories, grant access to that one repository only. If it needs me to approve something on GitHub, stop and tell me.
3. The first build may fail. That is expected. Ignore it.
4. Open the service in the project (the box named after the repository). In its Settings, under Source, set the branch to exactly:
   claude/wedding-expense-tracker-iiy04j
5. Add a Volume to the project, attached to that service, with mount path exactly:
   /data
   If a volume with mount path /data is already attached, leave it.
6. In the service Settings, under Networking, generate a public domain if there is none. If it asks for a port, use 3000. Tell me the full address it shows, starting with https://.
7. Open the service's Variables tab, switch to the Raw Editor, and make sure these lines are present with exactly these values. Keep any other variables that are already there. Replace YOUR-ADDRESS with the address from item 6, with https:// in front and no slash at the end.

APP_NAME=Harusi
DATABASE_URL=file:/data/app.db
UPLOAD_DIR=/data/uploads
AUTH_URL=https://YOUR-ADDRESS
ALLOWED_EMAILS=annettemugambi@gmail.com,stmutasa@gmail.com
AI_MODEL_MATCH=astra
AI_BACKUP_MODEL=claude-opus-5
PLAID_ENV=sandbox
PLAID_PRODUCTS=transactions
PLAID_COUNTRY_CODES=US
VAPID_SUBJECT=mailto:stmutasa@gmail.com
FEATURE_DRIVE_BRIEF=false
FEATURE_GMAIL_TRIAGE=false

8. Save the variables. Do not wait for the deployment; the next step adds more settings.

Report the app's address and whether the volume is attached at /data.
```

---

## Prompt 2. Generate the app's own secrets

The app needs four random values. This prompt has the extension generate them inside the browser with a short script, so you do not need to install anything. If the extension says it cannot run scripts on a page, use step 4 of GO-LIVE.md by hand instead, then continue with prompt 3.

```
Step 2: generate four secret values and put them in Railway.

1. Go to the Railway tab with the Harusi service's Variables page open.
2. Check whether these four variables already exist and have values: AUTH_SECRET, APP_ENCRYPTION_KEY, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY. If all four exist with non-empty values, do nothing and report that. If only some exist, tell me which, and stop.
3. Run this JavaScript in the page and take its result. It only generates random values locally; it does not send anything anywhere.

(async () => {
  const b64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
  const b64url = (bytes) => b64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const random = (n) => crypto.getRandomValues(new Uint8Array(n));
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const publicRaw = await crypto.subtle.exportKey("raw", pair.publicKey);
  const privateJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return [
    "AUTH_SECRET=" + b64(random(32)),
    "APP_ENCRYPTION_KEY=" + b64(random(32)),
    "NEXT_PUBLIC_VAPID_PUBLIC_KEY=" + b64url(publicRaw),
    "VAPID_PRIVATE_KEY=" + privateJwk.d,
  ].join("\n");
})();

4. Paste the four resulting lines into the Variables Raw Editor, keeping every other variable, and save. Do not show me the values.
5. Check each of the four now appears in the Variables list with a value.

Report only which variables you added.
```

---

## Prompt 3. Google sign-in

```
Step 3: set up Google sign-in for the app.

You will need the app's address from Railway. Read it from the Harusi service's Settings, under Networking, if you do not have it.

1. Open https://console.cloud.google.com. Use the project picker at the top. If a project named "Harusi" exists, select it. Otherwise create a new project named Harusi and select it once it exists.
2. Open the OAuth consent screen (it may be under "Google Auth Platform" and called "Branding" or "Audience"). If it is not configured yet:
   - User type: External.
   - App name: Harusi. User support email and developer contact email: stmutasa@gmail.com.
   - Scopes: add nothing.
   - Test users: stmutasa@gmail.com and annettemugambi@gmail.com.
3. Set the publishing status to "In production" (the button may say "Publish app"). Tell me before you click it and wait for my yes. Google may warn that the app is unverified; that is fine for two users.
4. Open APIs & Services, then Credentials. If an OAuth client ID named "Harusi web" already exists, open it. Otherwise create one: Create credentials, OAuth client ID, application type "Web application", name "Harusi web".
5. Under Authorized redirect URIs, make sure this exact URI is present, with the app's address in place of YOUR-ADDRESS, then save:
   https://YOUR-ADDRESS/api/auth/callback/google
   It must match character for character: https, no slash at the end.
6. Copy the client ID and the client secret. In Railway, on the Harusi service's Variables, add or update:
   GOOGLE_CLIENT_ID = the client ID
   GOOGLE_CLIENT_SECRET = the client secret
   Save. Do not show me the secret.

Report: project name used, whether the app is published, the exact redirect URI you saved, and which two Railway variables you set.
```

---

## Prompt 4. OpenAI key

Set up billing and a monthly limit on OpenAI yourself before sending this.

```
Step 4: create the OpenAI key for the app.

1. Open https://platform.openai.com/api-keys. If a key named "Harusi" already exists, do not create another. Tell me, and stop; I will decide whether to replace it.
2. Otherwise create a new secret key named Harusi, with the default project and permissions.
3. The key is shown only once. Copy it and paste it straight into Railway, Harusi service, Variables, as:
   OPENAI_API_KEY = the key
   Save. Do not show me the key.
4. Close the key dialog on OpenAI.

Report that the variable is set, and whether OpenAI showed any billing warning.
```

---

## Prompt 5. Anthropic key

Set up billing or buy credit on Anthropic yourself before sending this.

```
Step 5: create the Anthropic key for the app.

1. Open https://console.anthropic.com and go to API Keys. If a key named "Harusi" already exists, do not create another. Tell me, and stop.
2. Otherwise create a key named Harusi in the default workspace.
3. The key is shown only once. Copy it and paste it straight into Railway, Harusi service, Variables, as:
   ANTHROPIC_API_KEY = the key
   Save. Do not show me the key.

Report that the variable is set, and whether Anthropic showed any billing warning.
```

---

## Prompt 6. Bank feed in test mode (optional)

Skip this if you do not want Plaid yet. Real banks need Plaid's approval later; this sets up test mode only. Kenyan payments never come through Plaid.

```
Step 6: connect Plaid in sandbox (test) mode.

1. Open https://dashboard.plaid.com and go to the page that shows API keys (Developers, then Keys, or Team Settings, then Keys).
2. Copy the client_id and the Sandbox secret. Not the Production secret.
3. In Railway, Harusi service, Variables, add or update:
   PLAID_CLIENT_ID = the client_id
   PLAID_SECRET = the Sandbox secret
   Leave PLAID_ENV as sandbox. Save. Do not show me either value.

Report which variables you set.
```

---

## Prompt 7. Wait for the deploy and check the app

```
Step 7: check the deployment and the app.

1. In Railway, open the Harusi service's Deployments. Wait until the newest deployment finishes. If it fails, open its logs, read the last 40 lines, and tell me in plain words what the error says. If it is clearly a typo in a variable name or value that you set in an earlier step, fix that variable and wait for the next deployment. Do not change anything else.
2. When the newest deployment is Active, open the app's address in a new tab. You should see the Harusi login page.
3. Click "Continue with Google". I will choose my account and approve; wait for me to say "continue".
4. On the app, check each item below and report what you see for each:
   a. Home: the budget card shows "Remaining of $50,000".
   b. Settings, AI card: the primary model id, whether it says it was resolved from "astra", the backup model, and whether there is any red warning banner. Quote the banner's text if there is one.
   c. Press the + button, choose the Type tab, and type exactly: paid florist 800 deposit ruracio
      Wait three seconds. Report the chips that appear (amount, event, payer). Then close the sheet without saving.
   d. Ask tab: send "What is our total budget and how much is left?" and report the answer's first sentence.
   e. Avatar menu, then Brief: confirm the page shows a document with numbered sections. Do not rotate the token.
   f. Settings, Notifications: click "Enable on this device". If Chrome shows a permission pop-up, tell me and I will click Allow. Report the status shown afterwards.
   g. Money, then Inbox: report whether "Connect bank" is available or says the bank is not configured.
5. Do not add, edit, or delete any real data in the app during this check.

Give me the results as a short list, a to g, with pass or problem for each.
```

---

## Prompt 8. Keep the Brief in Google Drive (optional)

```
Step 8: turn on Google Drive sync for the Brief.

1. Open https://console.cloud.google.com with the Harusi project selected. Go to APIs & Services, then Library, search for "Google Drive API", and enable it if it is not already enabled.
2. In Railway, Harusi service, Variables, set FEATURE_DRIVE_BRIEF=true and save. Wait for the new deployment to become Active.
3. Open the app, go to the Brief page, and turn on "Sync to Google Drive". Google will ask me for permission; wait for me to approve and say "continue".
4. Open https://drive.google.com and check that a file named "Harusi Brief.md" exists.

Report whether the file exists and when it was last modified.
```

---

## If something goes wrong

Paste whichever of these fits.

**The deployment keeps failing**

```
Open the Harusi service on Railway, then Deployments, then the newest one, then its logs. Read the last 60 lines. Tell me in plain words what failed and which variable or setting it points to. Do not change anything yet; suggest the fix and wait for my yes.
```

**Google sign-in says redirect_uri_mismatch**

```
Open the Harusi service on Railway and read the public address under Settings, Networking. Then open Google Cloud Console, Harusi project, APIs & Services, Credentials, the "Harusi web" OAuth client. Compare its Authorized redirect URIs against https://ADDRESS/api/auth/callback/google letter by letter and tell me the difference. Fix the URI in Google after telling me what you will change.
```

**Settings shows "The assistant is off" or a red AI banner**

```
Open the app, Settings, AI card. Quote the banner text exactly. Then open Railway, Harusi service, Variables, and tell me which of these exist and are non-empty, without showing values: OPENAI_API_KEY, ANTHROPIC_API_KEY, AI_MODEL, AI_MODEL_MATCH, AI_BACKUP_MODEL. Do not change anything.
```

---

## Still yours to do by hand

1. Install Harusi on your Android phone: GO-LIVE.md step 7.
2. Have Annette install it on her iPhone from Safari's Share menu, then enable notifications from inside the installed app: GO-LIVE.md step 8.
3. In the app, set the exact wedding date when you have one (Settings, Wedding) and the event budgets (Money, Budget).
4. Later, for real bank data: apply for Plaid Production, then swap in the Production secret and set `PLAID_ENV=production`.
