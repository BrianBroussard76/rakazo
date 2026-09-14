# AI data sharing: release and review

## Release gates

- Confirm the review account's actual model, voice, memory, and cloud-agent configuration.
- Verify the selected providers' contracts, retention, deletion, and security safeguards support
  the updated privacy policy's equal-or-greater-protection commitment. Provider privacy links
  alone are not evidence of equivalent protection. Disable a service that cannot meet it.
- For OpenRouter, review the named model hosts and provider data policies as well as the gateway.
  The adapter restricts requests to disclosed endpoint tags and requests `data_collection: deny`.
  This is not a zero-retention guarantee. If hosts change, new permission is required.
- Apply the consent database migration, then deploy the API and worker together. Restart old
  workers so an older process cannot continue sending data without the new boundary checks.
- Deploy the website policy with the app update. Confirm the App Store privacy-policy URL.
- Review App Store Connect's App Privacy responses against the actual deployed data flows,
  including user content, audio, identifiers, diagnostics, purposes, and account linkage.
- Specifically assess Photos or Videos for retained image attachments and Audio Data for voice
  processing. Apple's collection definition includes access beyond the real-time request by
  the app or its partners; verify provider retention before selecting the audio answer.
  See [Apple's App Privacy definitions](https://developer.apple.com/app-store/app-privacy-details/).
- Run Expo's dependency compatibility check before creating a fresh iOS store build.

## Verification

Use synthetic content and a fresh review account. Test on iPhone and iPad, including an
11-inch iPad layout. Native consent uses the platform alert; web/Electron use the shared dialog.

1. Send the first message. Confirm the disclosure names the configured recipient and any
   gateway model hosts, lists data and purposes, and links the policy.
2. Choose Not now. Confirm no model request is sent and the draft is preserved.
3. Send again and choose Allow. Confirm the permission is persisted and a response succeeds.
4. Relaunch and verify the approved configuration does not ask again.
5. Open Account → AI data sharing. Withdraw permission and confirm subsequent model turns,
   scheduled runs, voice requests, and memory requests cannot send covered data.
6. Change provider/model/endpoint. Confirm the old permission is not reused.
7. Test voice independently: microphone permission alone must not authorize AI sharing.
8. Verify permissions do not carry to another account, Space, or server.
9. Open the policy from the app and verify it matches the deployed behavior.

The web E2E consent test captures the shared dialog. A screenshot from the native iPad build
must be captured separately; a web screenshot does not prove native layout.

## App Review notes template

Replace bracketed fields only after verification. Do not include account credentials here;
enter the review credentials in App Store Connect's dedicated private fields.

The app requests explicit permission before sending personal content to AI services. The
permission screen identifies recipients and the information shared, explains its purpose,
and lets users decline. Users can withdraw permission in Account → AI data sharing.

To review: sign in with the supplied review account, open [bot], enter a message, and tap Send.
The review account has not already granted permission. Choose Not now to verify processing
is blocked; send again and choose Allow to test AI responses. Voice has a separate permission.

The privacy policy is available at https://rakazo.com/privacy/ and from the permission screen.
Tested build: [version and build]. Attached: [native iPad consent screenshot].

## Reply template

We added explicit permission before personal content is shared with third-party AI services.
The disclosure identifies recipients, data, and purposes and allows users to decline.
The backend enforces the decision for model, voice, memory, and background processing.
We updated the privacy policy and reviewed the configured providers' protections.

Please review build [version and build] using the steps in App Review Information.
