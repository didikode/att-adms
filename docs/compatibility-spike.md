# X105-ID ADMS compatibility spike

## Objective

Prove that a Solution X105-ID can communicate with this server before attendance calculations, reporting, scheduling, or email delivery are built.

The device currently points to `adms.ptreka.co.id:8191`. Do not replace that production endpoint without a maintenance window and a tested rollback procedure.

## Implemented contract

- `GET /iclock/cdata?SN=<serial>` returns the ADMS handshake configuration as plain text.
- `POST /iclock/cdata?SN=<serial>&table=ATTLOG&Stamp=<stamp>` acknowledges plain-text tab-separated attendance records.
- `GET /iclock/getrequest?SN=<serial>` returns `OK` while no command is pending.
- A repeated device/user/timestamp record is acknowledged but not stored twice. PostgreSQL enforces this with a unique constraint; the diagnostic `X-Records-Accepted` response header exposes the outcome during the spike.
- A handshake without `SN` is rejected with HTTP 400 and `Invalid parameter`.

## PostgreSQL development database

`compose.yaml` runs the local PostgreSQL database on host port `5433`, because port `5432` is already in use on this workstation. The `.env` file is intentionally ignored by Git and uses the same development connection string as `.env.example`.

The database stores the immutable raw Attendance Punch, including the device serial number, device identity, local device timestamp, status, verify value, work code, and raw line. The unique key is device, user, and local timestamp, so duplicate uploads remain safe even after an application restart.

## Remaining limitations

- Device serial numbers are not yet allowlisted or registered through an admin workflow.
- Command polling returns `OK`; a persistent command queue and range backfill are not implemented.
- Attendance Day calculation, PDF, schedules, and email are not implemented.

## Local verification

```powershell
npm install
npm run db:up
npx prisma migrate dev
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
8. Do not attempt backfill until the persistent command queue is implemented.

## Exit criteria

- A real X105-ID completes the handshake.
- A sanitized real `ATTLOG` payload is captured as a test fixture.
- A live punch is acknowledged and visible in PostgreSQL persistent storage.
- A duplicate upload does not create a duplicate punch.
- Command polling is observed.
- A range backfill is requested and reconciled after the persistent command queue is implemented.
