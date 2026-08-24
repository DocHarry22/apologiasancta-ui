# Apologia Sancta — Play Console declaration worksheet

Last reviewed: 24 August 2026

This worksheet is the source-of-truth handoff for the Play Console forms. It is based on the current repository and must be rechecked against the deployed production services before submission. Do not guess or copy old declarations after data handling changes.

## App identity

- App name: **Apologia Sancta**
- Package/application ID: `com.apologiasancta.live`
- Category: **Education**
- Privacy policy path: `/privacy`
- Account deletion path: `/account/delete`
- Target SDK: **36**
- Minimum SDK: **23**
- Store artifact: signed Android App Bundle (`.aab`)

## App access

The app has public content and optional authenticated learner features. In Play Console, declare that some functionality can require account access and provide a dedicated review learner account if the reviewer needs to exercise sign-in, learner progress, saved research journeys, security controls, or account deletion.

Do not commit reviewer passwords to Git. Store reviewer credentials only in Play Console's App access instructions.

Recommended reviewer path:

1. Launch app.
2. Verify public Home, Learn, Library, Research and Quiz surfaces.
3. Sign in with the dedicated review learner account.
4. Open Learn and Research; save a research journey if this feature is enabled in the deployed build.
5. Open Account.
6. Exercise privacy/security controls.
7. Open **Delete account** and verify the deletion flow is directly reachable.

## Ads

Repository review found no AdMob/Google Mobile Ads integration, advertising-ID dependency, or obvious web ad tag in the application source. The Android manifest requests only `android.permission.INTERNET`.

**Play Console draft answer:** `Contains ads: No`

Before submission, recheck the production-hosted web application and any server-injected scripts. If hosting or a future analytics/monetisation layer injects advertising, update this declaration before release.

## Data safety — top-level answers

**Does the app collect or share required user data types?** Yes.

The app transmits account and learner information to its servers for authentication, learning progress, assessment, saved research journeys and quiz functionality.

**Is data encrypted in transit?** Yes for the production Android shell: the release configuration requires an HTTPS application URL and cleartext traffic is disabled in the release manifest.

**Can users request deletion of their data?** Yes.

- In-app: Account → Delete account.
- External web resource: `/account/delete`.
- The authenticated deletion API permanently removes the public account and account-linked learner data, including saved research journeys. Historical live-quiz participant rows are anonymised before the learner profile is removed.

## Data safety — data types

The following are the conservative declaration candidates for the current implementation.

### Personal info — Name

- Collected: **Yes**
- Shared: **No**, unless production infrastructure or a future third-party integration changes this.
- Required/optional: required for account display name; live quiz can also use a display name.
- Purposes: **App functionality**, **Account management**.

### Personal info — Email address

- Collected: **Yes**
- Shared: **No**, subject to production infrastructure verification.
- Required/optional: required for account creation/sign-in.
- Purposes: **App functionality**, **Account management**, **Fraud prevention, security and compliance** where used for authentication/security records.

### Personal info — User IDs

- Collected: **Yes**
- Shared: **No**, subject to production infrastructure verification.
- Purposes: **App functionality**, **Account management**, **Fraud prevention, security and compliance**.

### Personal info — Phone number

- Collected: **Optional**
- Shared: **No**, subject to production infrastructure verification.
- Purposes: **Account management**.

### App activity — App interactions

Covers account-linked lesson progress, bookmarks, mastery/assessment participation, unlock/progress state, deliberately saved research journeys, and comparable interaction records.

- Collected: **Yes**
- Shared: **No**, subject to production infrastructure verification. An unlisted research journey becomes visible to a person only when the learner intentionally gives that person its opaque share link; verify the final Play form treatment of user-initiated sharing against the deployed flow.
- Purposes: **App functionality**, **Personalization** where progress/recommendations are derived from prior learning activity.

### App activity — Other actions

Covers live-quiz/gameplay actions such as joining rooms, answer submissions, score/streak state and competition results.

- Collected: **Yes**
- Shared: **No** as a transfer to third parties. Some quiz display names/scores may be visible to other participants as part of the user-facing multiplayer feature; verify the final Play form wording for user-initiated/public display handling.
- Purposes: **App functionality**.

### Other user-generated content

The production-capable schema/UI can store learner-authored bookmark notes and saved-research-journey titles/navigation metadata. A learner can also intentionally expose an unlisted saved journey to another person by sharing its opaque URL.

- Collected: **Yes** when these authenticated save/note features are enabled in the deployed release.
- Shared: **No** as a developer-to-third-party transfer; user-initiated unlisted link sharing must be answered according to the current Play definition at submission time.
- Purposes: **App functionality**.

### Location / IP-derived information

The server processes request IP information for rate limiting/security and may include it in security/audit events. The app does not request Android coarse or precise location permissions.

Google Play's Data safety guidance says IP-address disclosure depends on how the IP is used, including whether it is used to infer location. The current application should **not** infer user location from IP without updating both this worksheet and the privacy policy.

Before submission, verify whether production hosting/proxy/security tooling derives approximate or precise location from IP. If it does, declare the applicable Location type.

### Device or other IDs

The native manifest does not request advertising ID or hardware identifier permissions. Recheck all production SDKs and hosting scripts before declaring this data type as not collected.

## Data sharing

No advertising or analytics SDK was found in the current repository search. Do not mark user data as shared merely because it is transmitted to the developer's own service provider for processing on the developer's behalf when the Play definition treats that transfer as a service-provider exception; verify each production processor against the current Play definition before submission.

User-initiated sharing features require separate care: an unlisted saved research journey is disclosed only to recipients who receive its opaque URL from the learner. Confirm how the current Play Data safety form classifies that user-directed disclosure before final submission.

If any production provider uses the data for its own purposes, or any third-party analytics/AI/advertising SDK is added, reassess every affected data type and the privacy policy.

## Data deletion behaviour

The current deletion design:

- requires an authenticated public learner session;
- requires CSRF validation and explicit typed confirmation;
- uses a transaction-scoped `account_deletion` database context for governed unlock deletion;
- removes Phase 2 question-exposure/corrective/retention rows before deleting restrictive mastery-attempt references;
- removes learner node mastery/evidence, answers, unlocks, group progress, review schedule, bookmarks, lesson progress, attempt questions and attempts;
- removes learner-owned saved research journeys through the `learner_profiles` `ON DELETE CASCADE` relationship;
- removes the learner profile;
- anonymises retained live-quiz participant history by removing account linkage, replacing the display name and external participant key, and clearing participant metadata;
- deletes the public authentication account after learning-data deletion succeeds.

If any data must legally be retained later, the privacy policy and Data safety deletion answers must state that retained category and retention reason accurately.

## Content rating

Complete the IARC questionnaire in Play Console using the actual released content. Apologia Sancta is religious/educational content and may include comparative apologetics, historical violence/persecution references, and debate material depending on what is published. Do not preselect a rating in source control; the IARC rating is calculated from the questionnaire and can vary by territory.

Re-run the questionnaire whenever published content/features change in a way that changes an answer.

## Target audience

Do not select an age range merely to maximize distribution. Choose the audience the released product is actually designed for. If any child age group is selected, a separate Families-policy review is required and all SDK/data practices must be reassessed for children.

## Permissions declaration

Current Android manifest permission:

- `android.permission.INTERNET`

No contacts, SMS, call log, microphone, camera, location, storage/media, notification, accessibility, VPN, package-install or broad device-management permission is declared in the app manifest at this release boundary.

## Account deletion URL

Enter the deployed canonical HTTPS URL corresponding to:

`/account/delete`

The page must remain publicly reachable on the web. Sign-in can be required to complete deletion, but users must be able to reach the deletion resource outside the installed app.

## Privacy policy URL

Enter the deployed canonical HTTPS URL corresponding to:

`/privacy`

Before submission, ensure the page identifies the developer/accountable entity and provides the support/privacy contact that matches the verified Play developer profile. Do not invent or hard-code private contact details in source control solely to satisfy the form.

## Store listing

Use `docs/PLAY_STORE_LISTING.md` for:

- app name;
- short description;
- full description;
- category;
- initial release notes;
- screenshot/feature-graphic checklist;
- reviewer notes.

## Developer/account fields that must come from the verified Play account

These cannot safely be inferred from source code:

- legal developer name;
- developer address;
- organization/D-U-N-S information if applicable;
- public support email/phone;
- payments profile information;
- developer-account verification state;
- whether the account is subject to the personal-account production-testing gate.

Use the verified values already held by the Play developer account rather than duplicating unverified personal details in Git.

## Final submission gate

Do not promote an AAB to production until all of these are true:

- PR/main CI is green;
- signed release workflow passes;
- Play App Signing/upload certificate is registered;
- canonical production URL is used by Capacitor;
- privacy and account-deletion URLs are live over HTTPS;
- Data safety is completed from deployed behaviour;
- Ads declaration is accurate;
- App access instructions work;
- IARC content rating is complete;
- Target audience is complete;
- store graphics/screenshots reflect the actual app;
- pre-launch report has no unresolved blocker;
- testing/production-access requirements applicable to the developer account are satisfied.
