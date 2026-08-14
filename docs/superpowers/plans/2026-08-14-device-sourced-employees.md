# Device-Sourced Employee Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace employee imports and mutations with conflict-safe per-PIN USERINFO retrieval from registered attendance devices, and add previous-calendar-month report schedules.

**Architecture:** Add a temporary `EmployeeCandidate` aggregate keyed by device/PIN. Candidate discovery is driven by unmapped ATTLOG records, retrieval uses the existing persistent device command queue, and USERINFO ingestion stores only PIN/name before an explicit atomic save creates Employee plus DeviceEnrollment. Device registration remains separate from the environment allowlist, while monthly scheduling extends the existing report scheduler without changing daily or weekly behavior.

**Tech Stack:** NestJS 11, Prisma 6/PostgreSQL, Jest/Supertest, React 19, TypeScript, Vite/Vitest, node-cron.

## Global Constraints

- Preserve the public ADMS contract under `/iclock` and test it through HTTP E2E tests.
- Continue requiring `ALLOWED_DEVICE_SERIALS` for every ADMS request.
- Never store or log passwords, cards, fingerprint counts, fingerprint templates, face templates, or biometric payloads.
- Do not add remote shell, firmware update, door-control, user update/delete, or biometric-management commands.
- Employee creation is allowed only through explicit save of a READY machine candidate.
- Employee/import mutation conflicts must not partially write or overwrite existing records.
- Monthly schedules run on calendar day 1 in `Asia/Jakarta` and report the complete previous calendar month.
- Do not drop the existing `import_runs` table or delete historical employee records.

---

## File Structure

- `prisma/schema.prisma`: `EmployeeCandidate`, candidate status enum, and `MONTHLY` frequency.
- `prisma/migrations/20260814170000_device_employee_candidates_monthly_reports/migration.sql`: additive database migration.
- `src/employee-candidates/*`: candidate listing, USERINFO requests, ingestion, conflict-safe save, and authenticated routes.
- `src/devices/*`: authenticated serial registration and device list.
- `src/iclock/iclock.controller.ts`: route OPERLOG USERINFO to the candidate service while preserving ATTLOG behavior.
- `src/emails/emails.service.ts`: WIB schedule matching and previous-month period calculation.
- `src/report-schedules/*`: validate and persist monthly schedules.
- `src/app.module.ts`: remove ImportsModule and add EmployeeCandidatesModule.
- `src/employees/*`: retain read-only listing/audit routes; remove mutation routes.
- `web/src/app/types.ts`, `web/src/main.tsx`, `web/src/style.css`: remove import UI, add device/candidate workflows and monthly schedule UI.
- `test/device-employee-candidates.e2e-spec.ts`, `test/devices.e2e-spec.ts`, `test/employees.e2e-spec.ts`, `test/imports.e2e-spec.ts`, `test/report-schedules.e2e-spec.ts`: HTTP behavior.
- `web/src/components/AppShell.test.tsx`, `web/src/features/DeviceEmployeeWorkflow.test.tsx`: frontend behavior.

### Task 1: Add candidate persistence and monthly frequency

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260814170000_device_employee_candidates_monthly_reports/migration.sql`
- Test: `test/persistence.e2e-spec.ts`

**Interfaces:**
- Produces `EmployeeCandidateStatus = REQUESTED | READY | SAVED`.
- Produces `EmployeeCandidate { id, deviceId, pin, name, status, requestedAt, receivedAt, savedAt }` with unique `[deviceId, pin]`.
- Extends `ReportFrequency` with `MONTHLY`.

- [ ] **Step 1: Write the failing persistence test**

```ts
it('persists one candidate per device and PIN without sensitive fields', async () => {
  const model = database.employeeCandidate;
  expect(model).toBeDefined();
  const candidate = await model.create({
    data: { deviceId: device.id, pin: '0007', status: 'REQUESTED', requestedAt: new Date() },
  });
  expect(candidate).toEqual(expect.objectContaining({ pin: '0007', name: null, status: 'REQUESTED' }));
  expect(candidate).not.toHaveProperty('password');
  await expect(model.create({
    data: { deviceId: device.id, pin: '0007', status: 'REQUESTED', requestedAt: new Date() },
  })).rejects.toMatchObject({ code: 'P2002' });
});
```

- [ ] **Step 2: Run the test to verify RED**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/persistence.e2e-spec.ts`

Expected: TypeScript/Prisma failure because `employeeCandidate` and `MONTHLY` do not exist.

- [ ] **Step 3: Add schema and additive SQL migration**

```prisma
enum EmployeeCandidateStatus {
  REQUESTED
  READY
  SAVED
}

enum ReportFrequency {
  DAILY
  WEEKLY
  MONTHLY
}

model EmployeeCandidate {
  id          String                  @id @default(cuid())
  deviceId    String                  @map("device_id")
  pin         String                  @db.VarChar(50)
  name        String?                 @db.VarChar(200)
  status      EmployeeCandidateStatus @default(REQUESTED)
  requestedAt DateTime                @default(now()) @map("requested_at")
  receivedAt  DateTime?               @map("received_at")
  savedAt     DateTime?               @map("saved_at")
  device      Device                  @relation(fields: [deviceId], references: [id], onDelete: Restrict)

  @@unique([deviceId, pin])
  @@index([status, requestedAt])
  @@map("employee_candidates")
}
```

Add `employeeCandidates EmployeeCandidate[]` to `Device`. Migration creates the enum/table/indexes and adds `MONTHLY` to `ReportFrequency`; it does not remove any table or record.

- [ ] **Step 4: Generate Prisma client, migrate test DB, and verify GREEN**

Run: `npx prisma generate; npx prisma migrate dev; npx jest --config ./test/jest-e2e.json --runInBand test/persistence.e2e-spec.ts`

Expected: PASS and no destructive migration prompt.

- [ ] **Step 5: Commit**

```bash
git add prisma test/persistence.e2e-spec.ts
git commit -m "feat: add device employee candidates"
```

### Task 2: Register synchronization devices by serial number

**Files:**
- Modify: `src/devices/devices.controller.ts`
- Modify: `src/devices/devices.service.ts`
- Modify: `test/devices.e2e-spec.ts`

**Interfaces:**
- Produces `DevicesService.register(serialNumber: string): Promise<Device>`.
- Produces authenticated `POST /api/devices` with `{ serialNumber: string }`.
- Existing `GET /api/devices` response remains compatible and adds `configuredAllowed: boolean`.

- [ ] **Step 1: Write failing HTTP tests**

```ts
it('registers a trimmed serial and rejects a duplicate', async () => {
  await request(app.getHttpServer()).post('/api/devices')
    .set('Authorization', authorization)
    .send({ serialNumber: '  TEST-SYNC-001  ' })
    .expect(201)
    .expect(expect.objectContaining({ serialNumber: 'TEST-SYNC-001' }));

  await request(app.getHttpServer()).post('/api/devices')
    .set('Authorization', authorization)
    .send({ serialNumber: 'TEST-SYNC-001' })
    .expect(409)
    .expect(({ body }) => expect(body.message).toContain('sudah terdaftar'));
});
```

Also assert empty serial returns 400 and anonymous registration returns 401.

- [ ] **Step 2: Run the focused test to verify RED**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/devices.e2e-spec.ts`

Expected: POST returns 404 because the endpoint is absent.

- [ ] **Step 3: Implement validation and conflict mapping**

```ts
@Post()
register(@Body() body: { serialNumber?: string }) {
  if (!body.serialNumber?.trim()) throw new BadRequestException('Serial number wajib diisi');
  return this.devices.register(body.serialNumber);
}
```

```ts
async register(value: string) {
  const serialNumber = value.trim();
  const existing = await this.prisma.device.findUnique({ where: { serialNumber } });
  if (existing) throw new ConflictException(`Serial number \${serialNumber} sudah terdaftar`);
  return this.prisma.device.create({ data: { serialNumber } });
}
```

Compute `configuredAllowed` from the same comma-separated environment semantics as `DeviceAccessPolicy` without changing that policy.

- [ ] **Step 4: Run device tests and ADMS contract tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/devices.e2e-spec.ts test/app.e2e-spec.ts`

Expected: registration tests pass; unlisted serial still receives 403 under `/iclock`.

- [ ] **Step 5: Commit**

```bash
git add src/devices test/devices.e2e-spec.ts
git commit -m "feat: register attendance devices by serial"
```

### Task 3: Retrieve USERINFO and save one employee atomically

**Files:**
- Create: `src/employee-candidates/employee-candidates.module.ts`
- Create: `src/employee-candidates/employee-candidates.controller.ts`
- Create: `src/employee-candidates/employee-candidates.service.ts`
- Modify: `src/iclock/iclock.module.ts`
- Modify: `src/iclock/iclock.controller.ts`
- Modify: `src/app.module.ts`
- Create: `test/device-employee-candidates.e2e-spec.ts`

**Interfaces:**
- Produces `EmployeeCandidatesService.list()`, `request(deviceId, pin, actorId)`, `acceptUserInfo(serialNumber, body)`, and `save(candidateId, actorId)`.
- Produces authenticated candidate endpoints from the approved spec.
- `acceptUserInfo` returns the count accepted and stores only PIN/name/status/timestamps.

- [ ] **Step 1: Write failing E2E tests for discovery and command creation**

```ts
it('lists an unmapped ATTLOG PIN and queues one USERINFO command', async () => {
  await postAttlog(serial, '0042\\t2026-08-14 08:00:00\\t0\\t1\\t0\\t0');
  const listed = await request(server).get('/api/employee-candidates')
    .set('Authorization', authorization).expect(200);
  const candidate = listed.body.data.find((item: { pin: string }) => item.pin === '0042');
  expect(candidate).toEqual(expect.objectContaining({ serialNumber: serial, state: 'DISCOVERED' }));

  await request(server)
    .post(`/api/employee-candidates/\${encodeURIComponent(candidate.deviceId)}/0042/request`)
    .set('Authorization', authorization).expect(201);
  await request(server)
    .post(`/api/employee-candidates/\${encodeURIComponent(candidate.deviceId)}/0042/request`)
    .set('Authorization', authorization).expect(201);

  expect(await database.deviceCommand.count({
    where: { deviceId: candidate.deviceId, command: 'DATA QUERY USERINFO PIN=0042', status: 'pending' },
  })).toBe(1);
});
```

- [ ] **Step 2: Run discovery test to verify RED**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/device-employee-candidates.e2e-spec.ts`

Expected: GET candidate endpoint returns 404.

- [ ] **Step 3: Implement candidate union and idempotent request**

List distinct device/PIN pairs from AttendancePunch that have no active enrollment. Left join `EmployeeCandidate` and return `DISCOVERED`, `REQUESTED`, `READY`, or `SAVED`. In one Prisma transaction, upsert REQUESTED and create a command only when no pending identical command exists.

- [ ] **Step 4: Write failing USERINFO sanitization test**

```ts
it('accepts USERINFO but stores only PIN and name', async () => {
  await request(server).post(`/iclock/cdata?SN=\${serial}&table=OPERLOG`)
    .set('Content-Type', 'text/plain')
    .send('USER PIN=0042\\tName=Nama Mesin\\tPasswd=secret\\tCard=999\\tFP=biometric')
    .expect(200).expect('OK: 1');

  const candidate = await database.employeeCandidate.findUniqueOrThrow({
    where: { deviceId_pin: { deviceId: device.id, pin: '0042' } },
  });
  expect(candidate).toEqual(expect.objectContaining({ name: 'Nama Mesin', status: 'READY' }));
  expect(JSON.stringify(candidate)).not.toContain('secret');
  expect(JSON.stringify(candidate)).not.toContain('999');
  expect(JSON.stringify(candidate)).not.toContain('biometric');
});
```

- [ ] **Step 5: Run sanitization test to verify RED**

Run the same focused Jest command.

Expected: current controller returns `OK: 0` and no candidate becomes READY.

- [ ] **Step 6: Implement strict OPERLOG USER parser**

Route only `table.toUpperCase() === 'OPERLOG'` and lines beginning `USER PIN=`. Parse tab-separated `key=value` fields, read only `USER PIN` and `Name`, discard all other keys immediately, and call `acceptUserInfo`. Continue acknowledging unsupported OPERLOG with `OK: 0`.

- [ ] **Step 7: Write failing atomic save/conflict tests**

```ts
it('saves a READY candidate once and rejects cross-device conflict', async () => {
  const saved = await request(server)
    .post(`/api/employee-candidates/\${candidate.id}/save`)
    .set('Authorization', authorization).expect(201);
  expect(saved.body).toEqual(expect.objectContaining({ employeeCode: '0042', displayName: 'Nama Mesin' }));
  expect(await database.deviceEnrollment.findUnique({
    where: { deviceId_pin: { deviceId: device.id, pin: '0042' } },
  })).toEqual(expect.objectContaining({ employeeId: saved.body.id }));

  await seedReadyCandidate(otherDevice.id, '0042', 'Nama Lain');
  await request(server)
    .post(`/api/employee-candidates/\${otherCandidate.id}/save`)
    .set('Authorization', authorization).expect(409);
  expect(await database.employee.count({ where: { employeeCode: '0042' } })).toBe(1);
  expect(await database.deviceEnrollment.count({ where: { pin: '0042' } })).toBe(1);
});
```

- [ ] **Step 8: Implement transaction and audit**

Use `prisma.$transaction(async tx => ...)`; re-read candidate as READY, check Employee and all active enrollment conflicts, require trimmed name, create Employee and DeviceEnrollment, update candidate to SAVED, and create `AuditEvent(action='EMPLOYEE_SAVED_FROM_DEVICE')` inside the same transaction. Translate unique-constraint races to HTTP 409.

- [ ] **Step 9: Run candidate, ADMS, dashboard, and transaction tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/device-employee-candidates.e2e-spec.ts test/app.e2e-spec.ts test/dashboard.e2e-spec.ts test/transactions.e2e-spec.ts`

Expected: all pass with unchanged ATTLOG acknowledgments and deduplication.

- [ ] **Step 10: Commit**

```bash
git add prisma src/employee-candidates src/iclock src/app.module.ts test/device-employee-candidates.e2e-spec.ts
git commit -m "feat: save employees from device USERINFO"
```

### Task 4: Remove imports and employee mutation routes

**Files:**
- Delete: `src/imports/imports.controller.ts`
- Delete: `src/imports/imports.module.ts`
- Delete: `src/imports/imports.service.ts`
- Modify: `src/app.module.ts`
- Modify: `src/employees/employees.controller.ts`
- Modify: `src/employees/employees.service.ts`
- Modify: `test/imports.e2e-spec.ts`
- Modify: `test/employees.e2e-spec.ts`

**Interfaces:**
- Retains authenticated `GET /api/employees` and `GET /api/employees/:id/audit`.
- Removes all `/api/imports` routes and Employee POST/PATCH/deactivate/enrollment mutation routes.

- [ ] **Step 1: Replace old mutation tests with failing absence tests**

```ts
it.each([
  ['post', '/api/employees'],
  ['patch', '/api/employees/not-used'],
  ['post', '/api/employees/not-used/deactivate'],
  ['post', '/api/employees/not-used/enrollments'],
  ['post', '/api/imports/hr/preview'],
])('%s %s is unavailable', async (method, path) => {
  await request(app.getHttpServer())[method](path)
    .set('Authorization', authorization)
    .send({}).expect(404);
});
```

Keep a GET employee listing assertion seeded directly through Prisma.

- [ ] **Step 2: Run tests to verify RED**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/employees.e2e-spec.ts test/imports.e2e-spec.ts`

Expected: mutation/import routes currently return validation or success responses instead of 404.

- [ ] **Step 3: Remove module wiring and mutation methods**

Delete ImportsModule files and import from AppModule. Reduce EmployeesController to GET list/audit and EmployeesService to list/audit only. Do not edit `ImportRun` schema or delete database rows.

- [ ] **Step 4: Run focused and full API tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/employees.e2e-spec.ts test/imports.e2e-spec.ts; npm test -- --runInBand`

Expected: removal assertions and full API suite pass.

- [ ] **Step 5: Commit**

```bash
git add src/app.module.ts src/employees test/employees.e2e-spec.ts test/imports.e2e-spec.ts
git add -u src/imports
git commit -m "refactor: remove employee import and mutation APIs"
```

### Task 5: Add previous-calendar-month report schedules

**Files:**
- Modify: `src/report-schedules/report-schedules.service.ts`
- Modify: `src/emails/emails.service.ts`
- Modify: `test/report-schedules.e2e-spec.ts`
- Modify: `test/reports.e2e-spec.ts`

**Interfaces:**
- Produces `reportPeriod(frequency: ReportFrequency, now: Date): { from: string; to: string }`.
- Extends `runDue(now = new Date())` so MONTHLY is queried only on WIB calendar day 1.

- [ ] **Step 1: Write failing monthly creation and period tests**

```ts
it('creates a monthly schedule without weekday', async () => {
  const response = await request(server).post('/api/report-schedules')
    .set('Authorization', authorization)
    .send({ name: 'Bulanan', frequency: 'MONTHLY', time: '08:30',
      recipients: ['hr@example.test'], scope: 'ALL' })
    .expect(201);
  expect(response.body).toEqual(expect.objectContaining({ frequency: 'MONTHLY', weekday: null }));
});

it('uses the previous December when a monthly run occurs on January 1', () => {
  expect(service.reportPeriod(ReportFrequency.MONTHLY, new Date('2027-01-01T01:30:00.000Z')))
    .toEqual({ from: '2026-12-01', to: '2026-12-31' });
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/report-schedules.e2e-spec.ts test/reports.e2e-spec.ts`

Expected: MONTHLY is rejected/not typed and period helper is absent.

- [ ] **Step 3: Implement monthly validation and pure WIB date helpers**

Use date parts in `Asia/Jakarta`. For MONTHLY, construct the first day of the current WIB month, subtract one day for the previous month end, and format its first and last dates. Do not derive month boundaries by subtracting a fixed number of days.

- [ ] **Step 4: Extend due selection and test-send**

On day 1, append `schedules.due(ReportFrequency.MONTHLY, null, time)`. On other days, do not query/send MONTHLY. Both scheduled and test delivery use `reportPeriod`.

- [ ] **Step 5: Run schedule/report/email tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/report-schedules.e2e-spec.ts test/reports.e2e-spec.ts; npm test -- --runInBand`

Expected: monthly, weekly, and daily cases all pass.

- [ ] **Step 6: Commit**

```bash
git add prisma src/report-schedules src/emails test/report-schedules.e2e-spec.ts test/reports.e2e-spec.ts
git commit -m "feat: add monthly attendance schedules"
```

### Task 6: Replace frontend import/employee/device flows

**Files:**
- Modify: `web/src/app/types.ts`
- Modify: `web/src/components/AppShell.test.tsx`
- Create: `web/src/features/DeviceEmployeeWorkflow.tsx`
- Create: `web/src/features/DeviceEmployeeWorkflow.test.tsx`
- Modify: `web/src/main.tsx`
- Modify: `web/src/style.css`

**Interfaces:**
- Removes `Impor Data` from `NAV_ITEMS`.
- Produces `EmployeeCandidateView` and `DeviceView` typed API models.
- Produces candidate and device pages using the authenticated endpoints from Tasks 2–3.

- [ ] **Step 1: Write failing navigation and read-only workflow tests**

```tsx
it('does not show Impor Data in desktop or mobile navigation', async () => {
  render(<AppShell activePage="Dashboard" onNavigate={vi.fn()} onLogout={vi.fn()} heading={<h1>Dashboard</h1>} />);
  expect(screen.queryByRole('button', { name: 'Impor Data' })).not.toBeInTheDocument();
});

it('shows machine actions without employee mutation controls', () => {
  render(<EmployeeCandidatesPage token="token" candidates={[readyCandidate]} onRefresh={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Simpan' })).toBeInTheDocument();
  expect(screen.queryByText('Tambah Karyawan')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /hapus|edit|nonaktifkan/i })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify RED**

Run: `cd web; npm run test -- src/components/AppShell.test.tsx src/features/DeviceEmployeeWorkflow.test.tsx`

Expected: import navigation remains and feature component is absent.

- [ ] **Step 3: Implement candidate UI states and requests**

Render read-only saved employees plus candidate table. DISCOVERED shows **Ambil dari Mesin**, REQUESTED shows disabled **Menunggu mesin**, READY shows **Simpan**, and SAVED shows status text. Encode device/PIN in request URLs and display Indonesian API conflict messages.

- [ ] **Step 4: Implement serial-only Perangkat page**

Render one required `Serial number` field and **Simpan Perangkat** action. List serial, ONLINE/OFFLINE, last activity, and configuration authorization. Do not render IP, firmware, fingerprint, user-management, or command controls.

- [ ] **Step 5: Implement monthly schedule UI and remove import state**

Extend the frequency union/selector with MONTHLY; omit weekday for DAILY/MONTHLY; label saved schedules `Bulanan · tanggal 1 · HH:mm`. Remove import state, file inputs, fetch calls, page branch, and unused import CSS.

- [ ] **Step 6: Run frontend tests and production build**

Run: `cd web; npm run test; npm run build`

Expected: all frontend tests pass and Vite builds without TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add web/src
git commit -m "feat: add device-sourced employee workflow UI"
```

### Task 7: Full contract and regression verification

**Files:**
- Modify only files implicated by a failing test.
- Test all backend and frontend suites.

**Interfaces:**
- Consumes all prior tasks.
- Produces a release-ready branch with verified ADMS compatibility and responsive UI.

- [ ] **Step 1: Run database/client checks**

Run: `npx prisma validate; npx prisma generate; npx tsc --noEmit --incremental false`

Expected: all commands exit 0.

- [ ] **Step 2: Run complete backend E2E suite**

Run: `npm test -- --runInBand`

Expected: all tests pass, including unchanged handshake, ATTLOG, deduplication, and command polling contracts.

- [ ] **Step 3: Run complete frontend verification**

Run: `cd web; npm run test; npm run build`

Expected: all tests pass and `web/dist` is generated.

- [ ] **Step 4: Inspect responsive UI**

Verify at desktop and 390px mobile sizes:

- no Impor Data navigation;
- Karyawan is read-only and uses candidate actions;
- Perangkat has only serial registration and status;
- Jadwal Laporan includes Bulanan;
- no horizontal clipping except intentional table scrolling.

- [ ] **Step 5: Security content scan**

Run: `rg -n -i "FINGERTMP|DATA (UPDATE|DELETE) USERINFO|remote shell|firmware|door.control" src web/src test`

Expected: no newly introduced prohibited capability; any legacy/reference match is inspected and excluded from the change.

- [ ] **Step 6: Commit final corrections if needed**

```bash
git add prisma src test web/src
git commit -m "fix: complete device employee workflow verification"
```

## Self-Review

- Spec coverage: Tasks 1–3 cover candidate persistence, ATTLOG discovery, per-PIN USERINFO, sensitive-field exclusion, atomic save, and conflict behavior. Task 2 preserves the environment allowlist while adding serial registration. Task 4 removes import and employee mutation surfaces without dropping historical data. Task 5 covers monthly scheduling and year boundaries. Task 6 covers every frontend change. Task 7 covers ADMS, security, build, and responsive regression checks.
- Placeholder scan: every file path, behavior, command, interface, and expected outcome is concrete.
- Type consistency: `EmployeeCandidateStatus`, `EmployeeCandidatesService`, `reportPeriod`, `PageName`, and frontend view models are introduced before their consumers.
