# Privacy Policy — DancePatternMapper (DPM)

**Last updated: October 6, 2026**

---

## 1. Who we are

**App name:** DancePatternMapper (DPM)  
**Developer / Data Controller:** Oliver Henrichs  
**Contact email:** dance-pattern-mapper@pm.me  
**Website / Support page:** https://oliverhenrichs.github.io/dpm/

If you have any questions about this Privacy Policy or wish to exercise your rights, please contact us at the email address above.

---

## 2. What this app does

DancePatternMapper is a tool for mapping and visualising partner-dance prerequisite graphs. It runs primarily **on your device** with all data stored locally. There are no user accounts, no advertising and no analytics or tracking.

The app connects to the internet only for the following optional features, each started by you:

- **Cloud Sharing**: publishing a pattern list so others can subscribe to it with an 8-character share code, or subscribing to someone else's list (section 3.3)
- **Online videos**: playing a video you attached by URL, such as a YouTube link (section 3.4)
- **On-device model downloads**: a one-time download of the speech and suggestion models the video tools need (section 3.5)

---

## 3. What data we collect and why

### 3.1 Data stored on your device only

| Data | Purpose | Where stored |
|---|---|---|
| Pattern lists, patterns, descriptions, tags, modifiers | Core app functionality | On-device (AsyncStorage) |
| Video files you attach to patterns, including videos you record or edit in the app | Viewing, editing and exporting patterns | On-device local filesystem |
| Transcripts of what is said in your videos | Reading and reusing what a teacher said | On-device (AsyncStorage) |
| Words you corrected in transcripts | Getting the same words right in the list's later transcripts | On-device (AsyncStorage) |
| Downloaded speech and suggestion models | Running the video tools offline | On-device local filesystem |
| Your graph layout, active list, theme, app style and language | Restoring your settings | On-device (AsyncStorage) |
| Your app icon colour | Showing the launcher icon you chose | On-device, by the operating system |

None of this data leaves your device unless you explicitly use the Export or Cloud Sharing feature. Exports are files you send yourself; they include local videos only if you choose to, and transcripts only if you tick "Include transcripts". An editable export of a list you have published also carries that list's share key, so whoever imports it can update or stop sharing the published list (that is how you move it to a new phone); a read-only export never does.

### 3.2 On-device video tools

Shortening a video, anonymizing it (turning the dancers into silhouettes), transcribing its speech and suggesting a pattern name and description are all processed **entirely on your device**. The video, its audio, the transcript and the suggestion are never sent to us or to anyone else.

An anonymized video shows the dancers as silhouettes and contains no sound. People may still be recognisable from their body shape, movement or surroundings, so treat it with the same care as the original.

If your videos show other people, such as teachers or other dancers, you are responsible for having their permission to record, keep and share those videos.

### 3.3 Data uploaded to our cloud service (Cloud Sharing only)

When you choose to **publish a pattern list**, the following is sent to and stored in Google Firebase Firestore:

| Data | Purpose |
|---|---|
| Pattern list content (name, the list's dance, pattern types, pattern names, descriptions, counts, rhythms, levels, tags, prerequisites, modifiers) | Sharing the list with subscribers |
| Video URLs you have attached (the link text only, not the video file itself) | Enabling subscribers to view linked videos |
| A randomly generated 8-character share code (your "list ID") | Identifying your list in the cloud |
| Timestamps (`publishedAt`, `publisherVersion`) | Detecting updates on subscriber devices |
| An owner record: your anonymous user ID and the list's share key (a random secret created on your phone) | Making sure only you can update or stop sharing your list. Nobody can read this record, including subscribers |

**Anonymous sign-in.** The first time you publish, the app signs in to **Google Firebase Authentication** anonymously. This creates a random user ID for your installation of the app, with no name, email address, phone number or password attached, and Firebase records when it was created and last used. The ID is kept on your phone so you stay the owner of your lists. Subscribing to a list never signs in.

**We do not collect:** your name, email address, phone number, location, or any account credentials. The app has no user accounts you can see or sign in to; the anonymous ID above is the only identifier, and it is not linked to you as a person.

**Local video files and transcripts are never uploaded.** Only URL-based video references are included in the cloud document.

When you publish or subscribe, Google Firebase automatically records:

- Your **IP address** (a form of personal data under GDPR)
- Connection timestamps and basic usage metadata

This does **not** happen when you use the app without publishing or subscribing.

### 3.4 Online videos

When you play a video that you (or the publisher of a list you subscribed to) attached by URL, the app loads it from wherever it is hosted. YouTube links play in YouTube's embedded player. To show a preview image of a YouTube link, for example in the pattern editor or in the Reels overview, the app loads that video's thumbnail from YouTube (img.youtube.com) without you pressing play. The host, for example **YouTube (Google)**, receives your IP address and device information, and may set cookies or collect usage data under its own privacy policy. We receive none of this data.

### 3.5 Model downloads

The speech-to-text and suggestion features need models that are downloaded once, when you first use the feature or download them under Settings → On-device models, and always after the app has shown you the download size. The models are fetched from **Hugging Face** (huggingface.co and its content delivery network). Hugging Face receives your **IP address** and the usual request metadata (such as time and the file requested). Nothing about you, your videos or your patterns is sent. You can delete downloaded models at any time under Settings → On-device models.

### 3.6 Device permissions

| Permission | Used for |
|---|---|
| Camera | Scanning a share QR code, and recording a video for a pattern with the system camera. The camera image used for scanning is processed on the device and not stored. |
| Microphone (iOS only) | The sound of videos you record for a pattern. On Android the system camera app records the sound, and the app itself does not request microphone access. |
| Photos / videos | Choosing a video from your gallery to attach to a pattern. Only the videos you pick are read, and they are copied into the app's own storage. |
| Notifications | Telling you when video work you started (shortening, anonymizing, transcribing) has finished while the app was in the background. The app asks the first time you start such work. Notifications are created on the device; nothing is sent from a server. |

You can refuse or withdraw any of these permissions in your device settings; only the feature that needs it stops working.

---

## 4. Legal basis for processing (GDPR Art. 6)

| Processing activity | Legal basis |
|---|---|
| Storing and processing your data on your device, including the video tools | Necessary for the performance of the service you requested (Art. 6(1)(b)) |
| Publishing your list to Firebase | Your explicit action (consent — Art. 6(1)(a)); you can delete the published list at any time |
| Anonymous sign-in and the owner record when you publish | Necessary for the performance of the publishing feature you requested, so that only you can change or remove your list (Art. 6(1)(b)) |
| IP address collection by Firebase | Legitimate interest in operating a secure service (Art. 6(1)(f)) |
| Connecting to a video host or to Hugging Face at your request | Necessary for the performance of the service you requested (Art. 6(1)(b)) |

---

## 5. Who we share your data with

We use the following third-party data processor:

**Google LLC** (Firebase / Firestore, Firebase Authentication)  
Role: Data Processor  
Purpose: Cloud storage of published pattern lists, and the anonymous sign-in of publishers  
Privacy policy: https://policies.google.com/privacy  
Data Processing Terms: https://firebase.google.com/terms/data-processing-terms  
Data location: **Europe (europe-west, Belgium)** for Firestore. Published lists and owner records are stored on Google servers within the European Union. Firebase Authentication, which holds the anonymous user ID of publishers, is a global Google service and may process that ID and the related IP address outside the EU/EEA, including in the United States; such transfers are covered by Google's Data Processing Terms and the EU Standard Contractual Clauses.

When you use the features in sections 3.4 and 3.5, your device connects directly to these services. They process your IP address as **independent controllers** under their own policies, and may do so outside the EU/EEA, including in the United States:

- **YouTube / Google LLC** (online videos): https://policies.google.com/privacy
- **Hugging Face, Inc.** (model downloads): https://huggingface.co/privacy
- The host of any other online video you attach

We do **not** sell your data to third parties and do not use your data for advertising.

---

## 6. Data retention

| Data | Retention |
|---|---|
| Local device data | Until you uninstall the app or delete it in the app (a list, a pattern, a video) |
| Downloaded models | Until you delete them under Settings → On-device models, or uninstall the app |
| Published Firestore document | Until you stop sharing the list in the app (Lists → your list's "more" button → Manage Cloud Sharing → Stop Sharing). There is no automatic expiry. |
| Owner record of a published list | Removed together with the list when you stop sharing it |
| Anonymous user ID (Firebase Authentication) | Kept while you might still publish from this installation; it stays on Google's servers after you uninstall the app until we delete it, which you can ask us to do at any time |
| Firebase infrastructure logs (IP, timestamps) | Governed by Google's own retention policy (typically 30–180 days) |
| Logs kept by video hosts, Hugging Face and GitHub | Governed by each service's own policy |

---

## 7. Your rights (GDPR, if you are in the EU/EEA)

You have the right to:

- **Access** — request a copy of your personal data we hold
- **Erasure** ("right to be forgotten") — request deletion of your personal data
- **Portability** — export your data (use the in-app Export feature for local data; request Firestore data deletion by contacting us)
- **Objection** — object to processing based on legitimate interest
- **Lodge a complaint** — with your national data protection authority (e.g. the [BfDI](https://www.bfdi.bund.de/) in Germany, the [ICO](https://ico.org.uk/) in the UK)

**How to delete your published data:** Open the app → Lists → your list's "more" button → Manage Cloud Sharing → Stop Sharing. This immediately removes the Firestore document and its owner record. For anything else, contact us at dance-pattern-mapper@pm.me.

Because the app has no user accounts, we cannot identify which data belongs to you without you providing the share code. Please include it in any erasure request; from it we can also find and delete your anonymous user ID.

For data held by YouTube, Hugging Face or GitHub, please use their own privacy tools or contact them directly; we have no access to it.

---

## 8. Children

The app is not directed at children under 13 (or under 16 in the EU). We do not knowingly collect personal data from children. If you believe a child has submitted personal data through the cloud sharing feature, please contact us and we will delete it.

---

## 9. Security

We use cryptographically secure random number generation (CSPRNG) to create share codes and share keys. Published lists are protected by Firestore Security Rules: only the publisher's anonymous ID, or whoever holds the list's share key, can update or delete a list, and nobody can list or browse the published lists. However, any person who obtains a share code can read the corresponding list — do not publish lists containing sensitive personal information.

Downloaded models are checked against a fixed SHA-256 checksum before use, so a corrupted or altered file is rejected.

---

## 10. This website

The DPM website (https://oliverhenrichs.github.io/dpm/) is hosted on **GitHub Pages** by GitHub, Inc. It uses no cookies, no analytics and no third-party fonts or scripts; its fonts and its one small script are served from the site itself. If you switch the page between its two styles, your choice is kept in your browser's local storage so the next page you open looks the same; it never leaves your browser, and clearing your browsing data removes it. GitHub records the IP address of visitors in its server logs for security purposes; see the [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement). Links to the GitHub repository and to email take you to those services.

---

## 11. Changes to this policy

We may update this policy. When we do, we will update the "Last updated" date at the top of this document. We encourage you to review this policy periodically.

---

## 12. Contact

Oliver Henrichs  
dance-pattern-mapper@pm.me
