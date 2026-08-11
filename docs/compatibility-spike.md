# X105-ID ADMS compatibility spike

## Objective

Prove that a Solution X105-ID can communicate with this server before attendance calculations, reporting, scheduling, or email delivery are built.

The device currently points to `adms.ptreka.co.id:8191`. Do not replace that production endpoint without a maintenance window and a tested rollback procedure.

## Implemented contract

- `GET /iclock/cdata?SN=<serial>` returns the ADMS handshake configuration as plain text.
- `POST /iclock/cdata?SN=<serial>&table=ATTLOG&Stamp=<stamp>` acknowledges plain-text tab-separated attendance records.
- `GET /iclock/getrequest?SN=<serial>` returns `OK` while no command is pending.
- A repeated device/user/timestamp record is acknowledged but not accepted twice. The diagnostic `X-Records-Accepted` response header exposes this during the spike.
- A handshake without `SN` is rejected with HTTP 400 and `Invalid parameter`.

## Important limitation

The current `AttendancePunchStore` is intentionally in-memory. It proves parsing and idempotency within one running process only. It must be replaced by PostgreSQL with a unique constraint before staging receives production-like traffic or the service is restarted.

## Local verification

```powershell
npm install
npx jest --config ./test/jest-e2e.json --runInBand
npx tsc --noEmit --incremental false
npm run start:dev
```

Handshake example:

```powershell
Invoke-WebRequest `
  -Uri 'http://localhost:3000/iclock/cdata?SN=TEST-X105-ID-001' `
  -UseBasicParsing
```

ATTLOG example:

```powershell
$attendanceBody = "411`t2026-08-11 08:00:00`t0`t1`t0`t0`t0`t0`t0`t0"
Invoke-WebRequest `
  -Uri 'http://localhost:3000/iclock/cdata?SN=TEST-X105-ID-001&table=ATTLOG&Stamp=1' `
  -Method Post `
  -ContentType 'text/plain' `
  -Body $attendanceBody `
  -UseBasicParsing
```

## Safe device test checklist

1. Provision a staging hostname and listener without changing the active ADMS endpoint.
2. Restrict the listener to the test device and record the device configuration before changing it.
3. Start structured request logging without recording secrets or biometric data.
4. Change one device during a maintenance window.
5. Confirm handshake, one live punch, duplicate acknowledgment, and command polling.
6. Restore `adms.ptreka.co.id:8191` immediately if the device does not receive the expected acknowledgment.
7. Compare transaction counts with the existing attendance system.
8. Do not attempt backfill until a persistent command queue and PostgreSQL storage exist.

## Exit criteria

- A real X105-ID completes the handshake.
- A sanitized real `ATTLOG` payload is captured as a test fixture.
- A live punch is acknowledged and visible in persistent storage.
- A duplicate upload does not create a duplicate punch.
- Command polling is observed.
- A range backfill is requested and reconciled after the persistent command queue is implemented.
