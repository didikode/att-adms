# New Attendance

ADMS-compatible attendance ingestion and automated HR reporting for Solution X105-ID devices.

The repository is currently in the compatibility-spike phase. See [docs/compatibility-spike.md](docs/compatibility-spike.md) for the implemented protocol contract, limitations, verification commands, and safe device-test procedure.

## Development

```powershell
npm install
npm run db:up
npx prisma migrate dev
npx jest --config ./test/jest-e2e.json --runInBand
npx tsc --noEmit --incremental false
npm run start:dev
```

Set `PORT=8192` and add every authorized device serial number to
`ALLOWED_DEVICE_SERIALS` in `.env`. The included local configuration allows
only the designated staging device.
