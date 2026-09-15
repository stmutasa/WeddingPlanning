# Putting Harusi online, step by step

This is the walkthrough for turning the code in this repository into a working app on your phones. It assumes you have never deployed anything before. Budget about an hour, plus waiting time for Plaid if you want the bank feed.

**What you will need before you start**

- Your Google account (`stmutasa@gmail.com`). Annette does not need to do anything until step 8.
- A credit or debit card. Railway, OpenAI and Anthropic all bill by usage. Expect a few dollars a month for two people.
- A computer with a web browser. Step 5 also needs a small free program called Node installed on it; the step explains how.

**The one rule.** Several steps produce secret strings (keys, passwords). They go into Railway's "Variables" page and nowhere else. Never paste them into a chat, an email, a text message, or this repository.

**How the steps fit together.** Step 1 puts the app online and gives you its web address. Steps 2 to 5 give the app the keys it needs, one feature at a time. Step 6 checks everything. Steps 7 and 8 are the phones. Step 9 is optional.

---

## Step 1. Put the app on Railway and get its web address

Railway is a hosting company. It takes the code from GitHub, builds it, and runs it on its computers so the app has a public address.

1. Go to https://railway.app and click **Login**. Choose **Login with GitHub** and approve the request. Railway will ask you to add a payment method; the "Hobby" plan is enough.
2. On the Railway home page click **New Project**, then **Deploy from GitHub repo**.
3. If it asks which repositories Railway may see, choose **Only select repositories** and pick **WeddingPlanning**, then **Install & Authorize**.
4. Pick **stmutasa/WeddingPlanning** from the list. Railway creates a project and starts building immediately. **The first build will fail or the app will not start.** That is expected; it has no settings yet. Ignore any red status for now.
5. You are now looking at your project. There is one box in the middle, called a *service*, named something like `WeddingPlanning`. Click it. A panel opens on the right with tabs: **Deployments**, **Variables**, **Metrics**, **Settings**.
6. **Choose the branch.** Open **Settings**. Under **Source**, find **Branch**. It probably says `main`. Change it to `claude/wedding-expense-tracker-iiy04j`, which is where the app lives. (If you later merge that branch into `main`, change this back.)
7. **Add the storage disk.** The app keeps its database and receipt photos on a disk that must survive restarts. Right-click the empty canvas area of the project (or click **+ Create** at the top right) and choose **Volume**. When it asks which service to attach to, pick your service. When it asks for a **mount path**, type exactly:
   ```
   /data
   ```
   and confirm. A small disk icon now sits next to your service.
8. **Give the app a web address.** Back in the service panel, open **Settings** and scroll to **Networking**. Click **Generate Domain**. If it asks for a port, type `3000`. Railway shows an address that looks like `weddingplanning-production-1a2b.up.railway.app`. **Copy it and keep it somewhere handy: you need it in steps 2 and 3.** Your app's full address is `https://` followed by that.
9. **Enter the first settings.** Open the **Variables** tab. Click **Raw Editor** (top right of the variables list). Paste the block below, then replace the two `PASTE-...` parts. Click **Update Variables**.
   ```
   APP_NAME=Harusi
   DATABASE_URL=file:/data/app.db
   UPLOAD_DIR=/data/uploads
   AUTH_URL=https://PASTE-YOUR-RAILWAY-ADDRESS-HERE
   ALLOWED_EMAILS=annettemugambi@gmail.com,stmutasa@gmail.com
   AI_MODEL_MATCH=astra
   AI_BACKUP_MODEL=claude-opus-5
   PLAID_ENV=sandbox
   PLAID_PRODUCTS=transactions
   PLAID_COUNTRY_CODES=US
   VAPID_SUBJECT=mailto:stmutasa@gmail.com
   FEATURE_DRIVE_BRIEF=false
   FEATURE_GMAIL_TRIAGE=false
   AUTH_SECRET=PASTE-A-LONG-RANDOM-STRING-HERE
   ```
   For `AUTH_SECRET`, any long random string works for now, for example 40 letters and numbers mashed on the keyboard. Step 5 replaces it with a properly generated one. `AUTH_URL` must start with `https://` and have no slash at the end.

10. Railway redeploys on its own every time variables change. Wait about two minutes, then open **Deployments**. The top entry should turn green and say **Active**. Open your address in a browser. You should see the Harusi login page with a proverb under the name. Signing in does not work yet; that is step 2.

**If the deployment is red:** click it, then **View logs**. The last few lines say what went wrong. The usual cause is a typo in a variable name. Fix it in Variables and Railway will try again.

---

## Step 2. Let the two of you sign in with Google

The app has no passwords. Google confirms who you are, and the app only lets in the two addresses in `ALLOWED_EMAILS`. For this, Google needs to know the app exists.

1. Go to https://console.cloud.google.com and sign in with `stmutasa@gmail.com`. If it is your first visit, accept the terms.
2. At the top of the page there is a project picker (it may say **Select a project**). Click it, then **New Project**. Name it `Harusi` and click **Create**. Wait for the notification, then make sure `Harusi` is the selected project in the picker.
3. In the search bar at the top type **OAuth consent screen** and open it. (Newer consoles call this **Google Auth Platform → Branding**; the fields are the same.)
   - If asked for a user type, choose **External**, then **Create**.
   - App name: `Harusi`. User support email: your address. Developer contact email: your address. Leave the rest blank. **Save and Continue** through the remaining pages (Scopes: nothing to add. Test users: add both `stmutasa@gmail.com` and `annettemugambi@gmail.com`). Finish.
   - Back on the consent screen overview, click **Publish App** and confirm. This is what stops Google logging you out every seven days. Google may show a note that the app is "unverified". That is fine for an app used by two people; nobody else can sign in anyway.
4. In the search bar type **Credentials** and open **APIs & Services → Credentials**.
5. Click **+ Create Credentials → OAuth client ID**.
   - Application type: **Web application**.
   - Name: `Harusi web`.
   - Under **Authorized redirect URIs** click **+ Add URI** and paste your Railway address with this exact ending:
     ```
     https://YOUR-RAILWAY-ADDRESS/api/auth/callback/google
     ```
     Example: `https://weddingplanning-production-1a2b.up.railway.app/api/auth/callback/google`. No trailing slash. This must match your address character for character.
   - Click **Create**.
6. A window shows **Your Client ID** and **Your Client Secret**. Keep this window open.
7. In Railway → your service → **Variables**, click **+ New Variable** twice and add:
   - `GOOGLE_CLIENT_ID` = the Client ID (ends in `.apps.googleusercontent.com`)
   - `GOOGLE_CLIENT_SECRET` = the Client Secret
8. Wait for the redeploy to go green, open your address, click **Continue with Google**, and pick your account. You should land on the Harusi home screen with a budget of $50,000 and nothing spent.

**If Google says "redirect_uri_mismatch":** the URI in step 5 does not match your address exactly. Compare them letter by letter, including `https://` and `/api/auth/callback/google`.

---

## Step 3. Turn on the assistant (AI keys)

The app uses two AI providers: OpenAI as the main one, Anthropic as the backup if OpenAI is down or rejects the key. Each needs an API key, which is a long string that lets the app bill your account. Both companies charge per use, not a monthly fee. For two people this is typically a few dollars a month.

**OpenAI**

1. Go to https://platform.openai.com and sign in (or create an account). This is the developer site, separate from the ChatGPT app; a ChatGPT subscription does not cover it.
2. Open **Settings → Billing** and add a payment method. Put in a small prepaid amount, for example $10, and set a monthly limit under **Limits** so a mistake cannot run up a bill.
3. Open **API keys** (left menu, or https://platform.openai.com/api-keys). Click **+ Create new secret key**. Name it `Harusi`. Click **Create secret key**. Copy the key that starts with `sk-`. **It is shown only once.** If you lose it, delete it and make another.
4. In Railway → Variables, add `OPENAI_API_KEY` = that key.

**Anthropic**

1. Go to https://console.anthropic.com and sign in (or create an account).
2. Open **Billing** (or **Plans & Billing**) and add a payment method or buy a small amount of prepaid credit.
3. Open **API Keys** and click **Create Key**. Name it `Harusi`. Copy the key that starts with `sk-ant-`. Shown once, same as above.
4. In Railway → Variables, add `ANTHROPIC_API_KEY` = that key.

**Which OpenAI model runs.** You asked for "ChatGPT Astra 6". The app looks at OpenAI's live list of models when it starts and picks the newest one whose name contains `astra`. You can see what it picked in the app under **Settings → AI**, and change it there from a dropdown at any time. If the dropdown does not show the model you expect, type its exact id into the **override** box on that card.

After the redeploy, open the app, tap **＋**, choose the **Type** tab and type `paid florist 800 deposit ruracio`. Chips for amount, event and payer should appear within a second or two. If instead you see "The assistant is off", check **Settings → AI** for a red banner; it names the problem.

---

## Step 4. Generate the app's own secrets (needs Node on your computer)

Two settings must be properly random and one pair of keys must be generated by a program. The repository includes a tiny script for the key pair. This step installs Node, a free program that runs it.

1. Go to https://nodejs.org and download the **LTS** version for your computer. Run the installer with all defaults.
2. Get the code onto your computer. Easiest: on the GitHub page https://github.com/stmutasa/WeddingPlanning click the green **Code** button, then **Download ZIP**. Make sure the branch shown at the top left is `claude/wedding-expense-tracker-iiy04j` before downloading. Unzip it somewhere you can find, for example your Desktop.
3. Open a terminal in that folder:
   - **Mac:** open the **Terminal** app, type `cd ` (with a space), drag the unzipped folder onto the window, press Enter.
   - **Windows:** open the unzipped folder in File Explorer, click the address bar, type `cmd`, press Enter.
4. Type each line below and press Enter after each. The first one downloads the app's dependencies and takes a minute or two.
   ```
   npm install
   npm run vapid
   node -e "console.log('AUTH_SECRET=' + require('crypto').randomBytes(32).toString('base64'))"
   node -e "console.log('APP_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))"
   ```
   You will see four lines of the form `NAME=value`:
   ```
   NEXT_PUBLIC_VAPID_PUBLIC_KEY=B...
   VAPID_PRIVATE_KEY=...
   AUTH_SECRET=...
   APP_ENCRYPTION_KEY=...
   ```
5. In Railway → Variables → **Raw Editor**, paste those four lines at the bottom. Delete the older `AUTH_SECRET=` line from step 1 so there is only one. Click **Update Variables**.

What these do: `AUTH_SECRET` signs your login session. `APP_ENCRYPTION_KEY` scrambles bank tokens stored on the disk. The two VAPID keys let the app send notifications to your phones. Changing `AUTH_SECRET` later signs everyone out once, which is harmless.

---

## Step 5. Bank feed through Plaid (optional; skip it and come back later)

Plaid connects the app to a US bank or card so that transactions land in the Inbox for you to tag. Two honest limits first:

- It only works with US, Canadian and European banks. Money sent to Kenyan vendors by M-Pesa or wire will not show up here. Use the **Photo** tab on a receipt or M-Pesa confirmation screenshot instead; that works today with no setup.
- Plaid's free "sandbox" mode only shows fake test banks. Real banks need Plaid to approve your account, which involves a short application and, after a free allowance, a fee. If that sounds like more than you want, skip this whole step.

1. Go to https://dashboard.plaid.com/signup and create an account. Company name can be `Harusi`, use case "personal finance".
2. In the dashboard open **Developers → Keys** (or **Team Settings → Keys**). You will see a **client_id** and a **Sandbox** secret.
3. In Railway → Variables, add `PLAID_CLIENT_ID` = the client_id and `PLAID_SECRET` = the Sandbox secret. `PLAID_ENV` is already `sandbox` from step 1.
4. In the app go to **Money → Inbox → Connect bank**. Plaid's window opens. Pick any bank, and sign in with the test login `user_good` and password `pass_good`. After a moment, tap **Sync now**. Fake transactions appear in the Inbox with AI guesses next to them. That proves the plumbing works.
5. For real banks, later: in the Plaid dashboard apply for **Production** access (they call it "Request access" or "Production"), wait for approval, then swap `PLAID_SECRET` for the **Production** secret and change `PLAID_ENV` to `production`.

---

## Step 6. Check everything in the app

Open your Railway address in a browser and go through this list. Each line names the screen to look at.

| Check | Where | What you should see |
|---|---|---|
| Sign in | login page | Google sign-in lands on Home. |
| Annette can sign in too | login page, her phone | Same. If she sees "just for the two of them", her address in `ALLOWED_EMAILS` is misspelled. |
| Assistant | Settings → AI | The primary model shows a real id with "resolved from 'astra'" next to it. No red banner. |
| Quick add | ＋ → Type | Typing a sentence produces chips. |
| Receipt scan | ＋ → Photo | A photo of any receipt fills in the form. |
| Ask | Ask tab | "What's due this month?" answers with real numbers. |
| The Brief | Brief page (avatar menu → Brief) | A long document with fifteen numbered sections. **Copy link** gives you the address you can paste into any AI chat. |
| Notifications | Settings → Notifications | "Enable on this device" asks for permission and then says enabled. (On iPhone only after step 8.) |
| Bank | Money → Inbox | "Connect bank" opens Plaid, or says Plaid is not configured if you skipped step 5. |

Then do the real setup, in the app itself, under **Settings → Wedding**: set the exact date when you have one, and adjust the total budget if it changes. Under **Money → Budget** set each event's envelope; **Draft with AI** will propose a split you can edit.

---

## Step 7. Install it on Simi's Android phone

1. Open Chrome and go to your Railway address. Sign in with Google.
2. Tap the **⋮** menu (top right) and choose **Install app** or **Add to Home screen**. Confirm.
3. Open Harusi from the new icon on your home screen. Go to **Settings → Notifications → Enable on this device** and allow notifications.

---

## Step 8. Install it on Annette's iPhone

Notifications on iPhone only work from an app that has been added to the Home Screen, so this order matters.

1. Open **Safari** (not Chrome) and go to your Railway address. Sign in with her Google account.
2. Tap the **Share** button (the square with an arrow, bottom of the screen). Scroll the list and tap **Add to Home Screen**, then **Add**.
3. Close Safari. Open **Harusi** from the new icon on the Home Screen. Sign in again if asked.
4. Go to **Settings → Notifications → Enable on this device** and allow. Under **Profile**, she can pick her colour and set her timezone.

---

## Step 9. Optional: keep a copy of the Brief in Google Drive

The Brief is the document you paste into other AI chats. The app can also keep it as a file in your Google Drive, updated nightly.

1. In Google Cloud Console (step 2) search **Google Drive API** and click **Enable**.
2. In Railway → Variables, change `FEATURE_DRIVE_BRIEF` to `true`.
3. In the app, open the **Brief** page and turn on **Sync to Google Drive**. Google asks you once for permission to create a file. Afterwards a file called `Harusi Brief.md` appears in your Drive and updates every night.

---

## When something goes wrong

- **The site does not load at all.** Railway → service → **Deployments**: is the top one green? If red, open its logs and read the last lines. If green, check `AUTH_URL` matches the address exactly.
- **"Configuration" or "Server error" on the login page.** `AUTH_SECRET` is missing or `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are wrong.
- **Google says redirect_uri_mismatch.** Step 2, item 5. The URI must match your address exactly.
- **"The assistant is off."** Settings → AI shows why: a missing key, a rejected key, or no model matched. Paste the exact model id into the override box if the match fails.
- **Notifications will not enable.** Step 4 was skipped (no VAPID keys), or on iPhone the app was opened in Safari instead of from the Home Screen icon.
- **Data disappeared after a redeploy.** The volume from step 1 item 7 is not attached, or `DATABASE_URL` is not `file:/data/app.db`.
- **You want a fresh start.** Railway → service → Variables → make sure everything is right; then in the app, **Settings → Data → Export JSON** first. There is no "wipe" button in production on purpose.

## All the settings in one place

| Variable | Where it comes from | Looks like |
|---|---|---|
| `APP_NAME` | you | `Harusi` |
| `DATABASE_URL` | fixed | `file:/data/app.db` |
| `UPLOAD_DIR` | fixed | `/data/uploads` |
| `AUTH_URL` | Railway domain (step 1) | `https://….up.railway.app` |
| `AUTH_SECRET` | generated (step 4) | 44 random characters |
| `GOOGLE_CLIENT_ID` | Google Cloud (step 2) | `…apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud (step 2) | `GOCSPX-…` |
| `ALLOWED_EMAILS` | you | the two Gmail addresses, comma-separated |
| `OPENAI_API_KEY` | OpenAI (step 3) | `sk-…` |
| `ANTHROPIC_API_KEY` | Anthropic (step 3) | `sk-ant-…` |
| `AI_MODEL` | optional | leave blank; set only to force an exact id |
| `AI_MODEL_MATCH` | you | `astra` |
| `AI_BACKUP_MODEL` | you | `claude-opus-5` |
| `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV` | Plaid (step 5) | `sandbox` until approved |
| `PLAID_PRODUCTS`, `PLAID_COUNTRY_CODES` | fixed | `transactions`, `US` |
| `APP_ENCRYPTION_KEY` | generated (step 4) | 44 random characters |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | generated (step 4) | long strings starting with `B…` |
| `VAPID_SUBJECT` | you | `mailto:stmutasa@gmail.com` |
| `FEATURE_DRIVE_BRIEF` | you | `false` or `true` (step 9) |
| `FEATURE_GMAIL_TRIAGE` | fixed for now | `false` |
