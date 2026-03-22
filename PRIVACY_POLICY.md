# Privacy Policy — DancePatternMapper

**Last updated: March 22, 2026**

---

## 1. Who we are

**App name:** DancePatternMapper  
**Developer / Data Controller:** Oliver Henrichs  
**Contact email:** ohenrichs@gmail.com  
**Website / Support page:** N/A

If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at the email address above.

---

## 2. What this app does

DancePatternMapper is a tool for mapping and visualising partner-dance prerequisite graphs. It runs primarily **on your device** with all data stored locally. An optional cloud-sharing feature lets you publish a pattern list so others can subscribe to it using an 8-character share code.

---

## 3. What data we collect and why

### 3.1 Data stored on your device only

| Data | Purpose | Where stored |
|---|---|---|
| Pattern lists, patterns, descriptions, tags | Core app functionality | On-device (AsyncStorage) |
| Video files you attach to patterns | Viewing and exporting patterns | On-device local filesystem |
| Your active list selection | Restore your last session | On-device (AsyncStorage) |

None of this data ever leaves your device unless you explicitly use the Export or Cloud Sharing feature.

### 3.2 Data uploaded to our cloud service (Cloud Sharing only)

When you choose to **publish a pattern list**, the following is sent to and stored in Google Firebase Firestore:

| Data | Purpose |
|---|---|
| Pattern list content (name, pattern names, descriptions, tags, prerequisites) | Sharing the list with subscribers |
| Video URLs you have attached (the link text only, not the video file itself) | Enabling subscribers to view linked videos |
| A randomly generated 8-character share code (your "list ID") | Identifying your list in the cloud |
| Timestamps (`publishedAt`, `publisherVersion`) | Detecting updates on subscriber devices |

**We do not collect:** your name, email address, phone number, location, or any account credentials. The app has no user accounts.

**Local video files are never uploaded.** Only URL-based video references are included in the cloud document.

### 3.3 Data collected automatically by our infrastructure

When you use the Cloud Sharing feature (publishing or subscribing), Google Firebase automatically records:

- Your **IP address** (a form of personal data under GDPR)
- Connection timestamps and basic usage metadata

This happens even if the feature is available but you only read a shared list. It does **not** happen when you use the app in local-only mode (no publishing or subscribing).

---

## 4. Legal basis for processing (GDPR Art. 6)

| Processing activity | Legal basis |
|---|---|
| Storing pattern data on your device | Necessary for the performance of the service you requested (Art. 6(1)(b)) |
| Publishing your list to Firebase | Your explicit action (consent — Art. 6(1)(a)); you can delete the published list at any time |
| IP address collection by Firebase | Legitimate interest in operating a secure service (Art. 6(1)(f)) |

---

## 5. Who we share your data with

We use the following third-party data processor:

**Google LLC** (Firebase / Firestore)  
Role: Data Processor  
Purpose: Cloud storage of published pattern lists  
Privacy policy: https://policies.google.com/privacy  
Data Processing Terms: https://firebase.google.com/terms/data-processing-terms  
Data location: **Europe (europe-west, Belgium).** All Firestore data is stored exclusively on Google servers within the European Union. No cross-border transfer outside the EU/EEA takes place for stored data.

We do **not** sell your data to third parties and do not use your data for advertising.

---

## 6. Data retention

| Data | Retention |
|---|---|
| Local device data | Until you uninstall the app or delete the list manually |
| Published Firestore document | Until you unpublish the list from within the app (Settings → [your list] → Unpublish). There is no automatic expiry. |
| Firebase infrastructure logs (IP, timestamps) | Governed by Google's own retention policy (typically 30–180 days) |

---

## 7. Your rights (GDPR, if you are in the EU/EEA)

You have the right to:

- **Access** — request a copy of your personal data we hold
- **Erasure** ("right to be forgotten") — request deletion of your personal data
- **Portability** — export your data (use the in-app Export feature for local data; request Firestore data deletion by contacting us)
- **Objection** — object to processing based on legitimate interest
- **Lodge a complaint** — with your national data protection authority (e.g. the [BfDI](https://www.bfdi.bund.de/) in Germany, the [ICO](https://ico.org.uk/) in the UK)

**How to delete your published data:** Open the app → Dances → your list → Manage Cloud Sharing → Stop Sharing. This immediately removes the Firestore document. For anything else, contact us at ohenrichs@gmail.com.

Because the app has no user accounts, we cannot identify which Firestore documents belong to you without you providing the share code. Please include it in any erasure request.

---

## 8. Children

The app is not directed at children under 13 (or under 16 in the EU). We do not knowingly collect personal data from children. If you believe a child has submitted personal data through the cloud sharing feature, please contact us and we will delete it.

---

## 9. Security

We use cryptographically secure random number generation (CSPRNG) to create share codes. Published lists are protected by Firestore Security Rules that require a valid app token to write. However, any person who obtains a share code can read the corresponding list — do not publish lists containing sensitive personal information.

---

## 10. Changes to this policy

We may update this policy. When we do, we will update the "Last updated" date at the top of this document. We encourage you to review this policy periodically.

---

## 11. Contact

Oliver Henrichs  
ohenrichs@gmail.com

