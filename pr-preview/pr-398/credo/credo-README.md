# Safari (iOS 26 beta) – Minimal Digital Credentials Test

This is a single-file demo to exercise Safari’s Digital Credentials API on iOS 26 betas.
It requests only a boolean **over-18** attribute via either **ISO mDoc** or **OID4VP**.
If a Wallet app on the device can satisfy the request, iOS will show the system chooser sheet.

## How to use

1. **Serve over HTTPS** (required). For quick local testing:
   ```bash
   # macOS: install mkcert once, then
   mkcert -install
   mkcert localhost 127.0.0.1 ::1
   python3 -m http.server 8443 --bind 127.0.0.1
   # use a simple HTTPS static host if you prefer
   ```

2. On your **iPhone (iOS 26 beta)**, open Safari to `https://<your-host>:8443/index.html`.

3. Tap **“Prove you’re over 18.”**
   - If a Wallet provider (Apple Wallet with a compatible ID, or a third‑party Identity Document Provider app) is available, a **system sheet** appears.
   - If none is available, Safari will return **NotFoundError** – that still proves the API wiring works.

4. The page prints the **raw response object**. In a real service you would `POST` that JSON to your backend to verify the signature, issuer and status.

## Notes

- Some beta builds require turning on **Settings → Safari → Advanced → Feature Flags → Digital Credentials API**.
- If you are a developer, you can build Apple’s sample Identity Document Provider with Xcode 16 beta to act as a test wallet.
- This demo does **not** verify signatures; it’s intentionally minimal to show interop. Pair it later with a verifier (e.g., walt.id) for full checks.

## Privacy

The request asks only for a boolean `age_over_18` / `ageOver18`. No date of birth, name or document number is requested.
