# Share card: save image + QR (session_01GGURqPpVwxSv9M2de9odTn), remove before merge

Done: qrcode-generator dep, jsqr devDep, share-link.ts (SHARE_SITE constant),
share-qr.ts, share-preview.ts/.css (preview dialog: Share files-only on iOS,
Save image off iOS/app, long-press hint), touch-hold exemption, new card
layout with QR (profile-card.ts CARD_QR, share-card.ts RESULT_QR).
Next: Info.plist NSPhotoLibraryAddUsageDescription; unit tests (qr decode with
jsqr); visual spec (decode real canvas, preview at 667/844/852/desktop);
update profile.spec.ts download test; screenshots → Artifact; PR (FULL lane).
