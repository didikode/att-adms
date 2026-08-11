# Development instructions

- Build the attendance automation described in `docs/compatibility-spike.md` one vertical slice at a time.
- Treat `C:\C\Mesin Absensi\adms-server` and `C:\C\Mesin Absensi\iclockSvr` as read-only references.
- Never copy biometric templates, credentials, public IP addresses, or production employee records into fixtures.
- Preserve the public ADMS contract under `/iclock`; test it through HTTP E2E tests.
- Use test-driven development for protocol parsing, deduplication, attendance calculation, scheduling, and retry behavior.
- Do not add remote shell, firmware update, door-control, or biometric-management capabilities.
