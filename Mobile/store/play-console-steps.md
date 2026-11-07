# Publish Vrodux ERP on Google Play — step by step

Do the steps in order. Wording in Play Console changes slightly over time; if a button has a different name, pick the closest one.
Pasteable texts (descriptions, data safety) are in `play-listing.md` in this same folder.
Things in `<angle brackets>` are for you to fill in.

---

## STEP 0 — Things to have ready (15 minutes)

1. **The upload file**: `rFEm2rMQD2QlI_epUP9s5e8FBoZUJACjJx8BBc79rdQ.aab`
   Link: https://expo.dev/artifacts/eas/rFEm2rMQD2QlI_epUP9s5e8FBoZUJACjJx8BBc79rdQ.aab (right-click → save, keep the .aab ending).
2. **A reviewer login** (Step 4 explains how to make one).
3. **A support email** you are happy to show publicly, e.g. `vrodux@softaxis.ae`.
4. **Pages that must open in a browser**: https://vrodux.com/privacy, https://vrodux.com/terms, https://vrodux.com/delete-account (this last one must be live before Step 7).
5. **12 or more friends/colleagues with Gmail addresses** who will test for 14 days.
6. **Pictures** (Step 9): app icon 512×512, a 1024×500 banner, 2+ phone screenshots.

---

## STEP 1 — Create the app

Play Console → **Create app**.
- App name: `Vrodux ERP`
- Default language: `English (United States)`
- App or game: **App**
- Free or paid: **Free**
- Tick the declarations (developer program policies, US export laws) → **Create app**.

You land on the **Dashboard** with a list "Set up your app". The next steps are those tasks.

---

## STEP 2 — Privacy policy
Dashboard task, or Policy and programs → App content → **Privacy policy**.
- Paste: `https://vrodux.com/privacy` → Save.

## STEP 3 — Ads
App content → **Ads** → "Does your app contain ads?" → **No** → Save.

---

## STEP 4 — App access (the form you asked about)

App content → **App access** → choose **"All or some functionality is restricted"** → **Add new instructions** (this opens the "Add sign in details" form).

### 4a. Make the reviewer account first
Google's reviewers log in on every update. Use a **dedicated account**, not your own admin login.
1. Sign in to the web app (https://erp.vrodux.com) as the admin of your **demo company** (the one with sample data and all modules on).
2. Settings → **Users** → **Create user**.
   - Name: `Google Reviewer`
   - Email: an inbox **you can open** (e.g. `reviewer@vrodux.com` or a Gmail you control)
   - Password: pick a strong one and write it down (follow the on-screen rules)
   - Role: **Administrator** (so every module shows)
3. **Open that inbox and click the verification link.** Accounts created by an admin cannot sign in until the email is verified.
4. Do **not** switch on two-factor for this account.
5. Test it: install the APK on your phone, sign in with it, and check Leads, HR, Inventory open. If it fails, Google will reject the app.

### 4b. Fill the form — field by field

| Field in the form | What to type |
|---|---|
| **Name** (max 60) | `Reviewer account - all modules` |
| **Username, email address, or phone number** | the reviewer email, e.g. `reviewer@vrodux.com` |
| **Password** | the password you set in 4a |
| **Any other information required to access your app** (max 500) | paste the text below |

Paste in "Any other information":
```
Sign in on the first screen with the email and password above. There is no 2-step verification on this account and no workspace code is needed. The account belongs to a demo company with sample data (leads, sales, stock, invoices, HR), so all modules are available. Please do not change the password. Camera access is only used to scan barcodes and can be skipped.
```
(about 380 characters)

- Tick the box at the bottom: **"Sign in details in this declaration provide full access to all the features and content within this app"** (true for an Administrator account).
- **Save**, then back on the App access page → **Save**.

Keep this account working. If you change its password or delete it, update this form before your next release.

---

## STEP 5 — Content rating
App content → **Content rating** → **Start questionnaire**.
- Email: your support email.
- Category: **"Utility, Productivity, Communication, or Other"**.
- Answer **No** to every question (violence, sex, language, drugs, gambling, user-generated content shared with the public, location sharing, purchases).
- Save → **Submit**. Result should be "Everyone".

## STEP 6 — Target audience and other declarations
App content, then each item:
- **Target audience and content** → age groups: only **18 and over** → "Does it appeal to children?" **No** → Save.
- **News apps** → No. **COVID-19 apps** → No. **Government apps** → No.
- **Financial features** → "My app doesn't provide any financial features".
- **Health** → "My app does not have any health features".
- **Advertising ID** → "No" (the app does not use it).

## STEP 7 — Data safety
App content → **Data safety** → Start. Follow section 4 of `play-listing.md` row by row (it lists each data type, Yes/No, and the purpose).
- When asked "Do you provide a way for users to request data deletion?" → **Yes**.
- "Delete account URL" → `https://vrodux.com/delete-account` (the page must already open).
- Save → Submit.

## STEP 8 — App category and contact details
Grow → Store presence → **Store settings**:
- App category: **App → Business**
- Tags: pick what is offered (Business / Productivity)
- Email address: your support email · Website: `https://vrodux.com` · Phone: optional
- Save.

## STEP 9 — Store listing (the page people see)
Grow → Store presence → **Main store listing**.
- **App name**: `Vrodux ERP`
- **Short description**: paste from `play-listing.md` section 1
- **Full description**: paste from `play-listing.md` section 1
- **App icon**: upload 512×512 PNG (resize `Mobile\assets\icon.png`; no transparency)
- **Feature graphic**: upload 1024×500 (banner: your logo on the brand blue `#1E3A8A`)
- **Phone screenshots**: at least 2 (take them on your phone from a demo company: Dashboard, Leads, Approvals, HR check-in, Inventory scan)
- Save. (Ask me if you want me to generate the 512 icon and a draft banner.)

---

## STEP 10 — Upload the app to closed testing
Left menu → Test and release → **Testing → Closed testing** → **Create track** (name it `Testers`) → **Create new release**.
1. **App signing**: accept "Use Play App Signing" if asked.
2. **Upload** the `.aab` file.
3. Release name: leave the suggested one.
4. Release notes: paste the "Release notes" block from `play-listing.md`.
5. **Next** → fix any errors shown (see Troubleshooting) → **Save** → **Go to publishing overview**.
6. Back in the track → **Testers** tab → **Create email list** → name `Testers` → add 12+ Gmail addresses → Save.
7. **Countries/regions** tab → add the countries your testers are in.
8. On the track page, copy the **opt-in link** ("How testers join your test") and send it to every tester.
9. Publishing overview → **Send changes for review**. First review can take a few days.

Each tester must: open the link on their phone **signed in to Google with the same Gmail you added**, tap **Become a tester**, then **Download it on Google Play**.

## STEP 11 — The 14 days
- At least **12 testers opted in, continuously for 14 days**. If someone leaves and you drop under 12, the count restarts.
- During the 14 days, ask testers to open the app; upload at least one update (version code must be higher; run the production build again and it increments automatically).
- Day 15+: Dashboard → **Apply for production** → answer the questions (how you tested, feedback received) → submit. Google reviews it (usually within a week), then you publish to **Production**.

---

## Troubleshooting
- **"Upload failed: version code already used"** → rebuild with `npx eas build --profile production --platform android` (it bumps the number).
- **"You need to upload a service account / FCM"** → not a Play error; push needs the Firebase key uploaded to Expo (done).
- **Review rejected for "can't access app"** → the reviewer login failed. Re-test it on a phone, fix password/verification, update Step 4, resubmit.
- **Rejected for missing delete-account page** → publish `/delete-account`.
- **Data safety mismatch** → compare answers with `play-listing.md` section 4.
- **Lost the signing key** → with Play App Signing Google holds the final key; EAS keeps the upload key. Back it up: `npx eas credentials` → Android → download keystore.
