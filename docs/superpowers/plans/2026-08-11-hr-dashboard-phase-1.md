# HR Attendance Dashboard Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a secure Indonesian HR/Admin dashboard with employee master data, device PIN mapping, two-file import preview/commit, dashboard metrics, transaction browsing, and reference-format CSV export.

**Architecture:** Keep NestJS as the authenticated API and ADMS receiver. Add normalized Employee, DeviceEnrollment, ImportRun, AuditEvent, and application-user records to PostgreSQL. Serve a React/Vite dashboard from a separate `web/` workspace; it calls only `/api` and never the device endpoints. Preserve raw AttendancePunches and derive employee display values by device+PIN joins.

**Tech Stack:** NestJS 11, Prisma 6/PostgreSQL 16, Passport JWT, bcrypt, class-validator, multer, ExcelJS, csv-parse, React 18, Vite, TypeScript, React Router, TanStack Query, Playwright, Vitest, Image Gen for approved dashboard visual concepts.

## Global Constraints

- Application timezone is `Asia/Jakarta`; device-local timestamp text is immutable and interpreted as WIB.
- Preserve every `/iclock` behavior and test it through HTTP E2E tests.
- Store PIN and EmployeeID as text; never lose leading zeros.
- Never store fingerprint templates, credentials, remote-shell data, or production employee records in fixtures.
- Dashboard APIs are authenticated under `/api`; device APIs remain isolated under `/iclock`.
- Use test-driven development with public HTTP/browser seams; database setup is allowed only to establish isolated state.
- Hard-delete only employees with no enrollment, punch, import dependency, or audit history.
- Do not add destructive device commands.

---

## Planned file structure

- `prisma/schema.prisma` — application-user, role, Employee, DeviceEnrollment, ImportRun, AuditEvent, and Device metadata relations.
- `prisma/migrations/*_hr_admin_foundation/migration.sql` — schema migration.
- `src/auth/*` — password hashing, JWT guard, bootstrap-admin configuration, login/profile endpoints.
- `src/employees/*` — employee DTOs, service, controller, enrollment operations, and audit writer use.
- `src/imports/*` — import parsers, preview/commit service, stored import metadata, and upload endpoints.
- `src/transactions/*` — filtered read model and UTF-8 CSV export.
- `src/dashboard/*` — selected-WIB-date metrics and recent punch read model.
- `src/audit/*` — append-only audit event writer and API reader.
- `src/devices/*` — device IP/display metadata only; no unsafe device control.
- `test/api-*.e2e-spec.ts` — authenticated API contract tests using isolated test records.
- `web/*` — React/Vite dashboard application, components, routes, browser tests, and visual assets.
- `docs/operations/admin-bootstrap.md` — first-admin, password rotation, import, and rollback instructions.

### Task 1: Backend foundation and data migration

**Files:**
- Modify: `package.json`, `prisma/schema.prisma`, `src/app.module.ts`
- Create: `prisma/migrations/<timestamp>_hr_admin_foundation/migration.sql`, `src/database/database.module.ts`, `test/api-foundation.e2e-spec.ts`

**Interfaces:**
- Produces `User { id, email, passwordHash, role }`, `Employee`, `DeviceEnrollment`, `ImportRun`, `AuditEvent`, and `Device.ipAddress` Prisma models.
- Employee identity is `employeeCode: string`; enrollment identity is `@@unique([deviceId, pin])`.

- [ ] **Step 1: Write the failing migration/API foundation test**

```ts
it('returns a health response after the HR schema is migrated', () =>
  request(app.getHttpServer()).get('/api/health').expect(200).expect({ status: 'ok' }));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/api-foundation.e2e-spec.ts`

Expected: FAIL with 404 for `/api/health`.

- [ ] **Step 3: Add the schema and health module**

```prisma
model Employee {
  id String @id @default(cuid())
  employeeCode String @unique @map("employee_code") @db.VarChar(100)
  displayName String @map("display_name") @db.VarChar(200)
  active Boolean @default(true)
  enrollments DeviceEnrollment[]
  @@map("employees")
}

model DeviceEnrollment {
  id String @id @default(cuid())
  employeeId String @map("employee_id")
  deviceId String @map("device_id")
  pin String @db.VarChar(50)
  employee Employee @relation(fields: [employeeId], references: [id], onDelete: Restrict)
  device Device @relation(fields: [deviceId], references: [id], onDelete: Restrict)
  @@unique([deviceId, pin])
  @@map("device_enrollments")
}
```

Create `GET /api/health` returning `{ status: 'ok' }`, run `npx prisma migrate dev --name hr_admin_foundation`, and run `npx prisma generate` while the server is stopped.

- [ ] **Step 4: Run the focused test and Prisma validation**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/api-foundation.e2e-spec.ts; npx prisma validate`

Expected: test passes and Prisma schema is valid.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json prisma src test
git commit -m "feat: add HR administration data foundation"
```

### Task 2: Authentication, roles, and audit trail

**Files:**
- Create: `src/auth/auth.module.ts`, `src/auth/auth.service.ts`, `src/auth/auth.controller.ts`, `src/auth/jwt-auth.guard.ts`, `src/auth/roles.decorator.ts`, `src/auth/roles.guard.ts`, `src/audit/audit.module.ts`, `src/audit/audit.service.ts`, `test/auth.e2e-spec.ts`
- Modify: `src/app.module.ts`, `.env.example`, `README.md`

**Interfaces:**
- `POST /api/auth/login { email, password } -> { accessToken, user: { id, email, role } }` and sets an HttpOnly, Secure-in-production refresh cookie.
- `POST /api/auth/refresh -> { accessToken, user: { id, email, role } }`; `POST /api/auth/logout` clears the refresh cookie.
- `GET /api/auth/profile` requires Bearer JWT.
- `AuditService.record(input: { actorId: string; action: string; targetType: string; targetId: string; summary: Record<string, unknown> }): Promise<void>`.

- [ ] **Step 1: Write the failing public auth tests**

```ts
it('rejects an unauthenticated employee list', () => request(server).get('/api/employees').expect(401));
it('returns a JWT for a seeded admin with the correct password', async () => {
  const response = await request(server).post('/api/auth/login').send({ email: 'admin@example.test', password: 'CorrectHorse1!' }).expect(201);
  expect(response.body.user.role).toBe('ADMIN');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/auth.e2e-spec.ts`

Expected: FAIL because auth routes and guard are absent.

- [ ] **Step 3: Implement auth and authorization**

Use bcrypt with cost 12, a 15-minute access JWT from `JWT_SECRET`, a refresh token from `JWT_REFRESH_SECRET` held only in an HttpOnly cookie, and role checks. Require `ADMIN` for account/device administration; allow `ADMIN` and `HR` for employee/import/transaction routes. Add a documented bootstrap command requiring `BOOTSTRAP_ADMIN_EMAIL` and `BOOTSTRAP_ADMIN_PASSWORD`; it must refuse to run if an admin already exists.

- [ ] **Step 4: Run focused tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/auth.e2e-spec.ts`

Expected: unauthenticated calls return 401, invalid password returns 401, HR receives 403 for admin-only route, and login/profile pass.

- [ ] **Step 5: Commit**

```bash
git add src test .env.example README.md prisma
git commit -m "feat: add authenticated HR and admin access"
```

### Task 3: Employee CRUD, enrollment mapping, and audits

**Files:**
- Create: `src/employees/dto/create-employee.dto.ts`, `src/employees/dto/update-employee.dto.ts`, `src/employees/employees.controller.ts`, `src/employees/employees.service.ts`, `src/employees/employees.module.ts`, `test/employees.e2e-spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- `POST /api/employees`, `GET /api/employees?q=&active=`, `GET /api/employees/:id`, `PATCH /api/employees/:id`, `POST /api/employees/:id/deactivate`.
- `POST /api/employees/:id/enrollments { deviceSerialNumber, pin, fingerprintCount? }`.
- `GET /api/employees/:id/audit`.

- [ ] **Step 1: Write failing employee API tests**

```ts
it('preserves a leading-zero device PIN when creating an enrollment', async () => {
  const employee = await createEmployeeAsHr({ employeeCode: 'E.RMS001', firstName: 'Test', lastName: 'User' });
  await request(server).post(`/api/employees/${employee.id}/enrollments`).set(auth).send({ deviceSerialNumber: 'TEST-DEVICE-1', pin: '000000715' }).expect(201);
  await request(server).get(`/api/employees/${employee.id}`).set(auth).expect(200).expect(expect.objectContaining({ enrollments: [expect.objectContaining({ pin: '000000715' })] }));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/employees.e2e-spec.ts`

Expected: FAIL with 404.

- [ ] **Step 3: Implement employee service and controller**

Validate unique employee code, email syntax, date-only inputs, and device serial existence. Return 409 on duplicate employee code or device/PIN. Deactivation changes `active` to false and writes `EMPLOYEE_DEACTIVATED`; create/edit/enrollment writes corresponding audit entries. Reject hard delete when a dependency exists; do not expose a hard-delete route in Phase 1.

- [ ] **Step 4: Run focused tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/employees.e2e-spec.ts`

Expected: CRUD, search, deactivation, role protection, PIN preservation, duplicate conflict, and audit listing all pass.

- [ ] **Step 5: Commit**

```bash
git add src/employees src/audit test/employees.e2e-spec.ts
git commit -m "feat: manage employees and device PIN mappings"
```

### Task 4: Import preview, validation, and atomic commit

**Files:**
- Create: `src/imports/imports.module.ts`, `src/imports/imports.controller.ts`, `src/imports/imports.service.ts`, `src/imports/parsers/hr-workbook.parser.ts`, `src/imports/parsers/device-enrollment.parser.ts`, `src/imports/dto/commit-import.dto.ts`, `test/imports.e2e-spec.ts`, `test/fixtures/hr-employees.xlsx`, `test/fixtures/device-enrollments.csv`
- Modify: `src/app.module.ts`

**Interfaces:**
- `POST /api/imports/hr/preview` accepts `.xlsx`; `POST /api/imports/device-enrollments/preview` accepts `.csv`.
- Both return `{ importId, rows: [{ rowNumber, status, messages, normalized }], summary }`.
- `POST /api/imports/:importId/commit` atomically applies previewed rows.

- [ ] **Step 1: Write failing import contract tests**

```ts
it('flags an HR row without Pin and DeviceSerial for manual mapping without dropping the employee', async () => {
  const preview = await uploadWorkbook('hr-employees.xlsx');
  expect(preview.body.summary.manualMapping).toBe(1);
  await request(server).post(`/api/imports/${preview.body.importId}/commit`).set(auth).expect(201);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/imports.e2e-spec.ts`

Expected: FAIL because upload endpoints do not exist.

- [ ] **Step 3: Implement parsers and commit transaction**

Use ExcelJS for workbook fields `EmployeeID, FirstName, LastName, Gender, DivisionID, Position, Active, HireDate, ActiveDate, Pin, DepartmentName, Email, DeviceSerial`. Use `csv-parse` for the supplied enrollment headers. Normalize whitespace only; preserve PIN/employee code as strings. Parse `Registration Device` into serial/IP if exact `SERIAL(IP)` syntax exists. Store only checksum and row-validation JSON in ImportRun, not raw workbook bytes. Commit with a Prisma transaction; create/update employees by EmployeeID and create enrollment only when both device and PIN resolve. Never auto-match names.

- [ ] **Step 4: Run focused tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/imports.e2e-spec.ts`

Expected: valid preview/commit works, invalid rows do not commit, ambiguous rows remain reviewable, duplicate checksum is reported, and leading-zero PIN remains unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/imports test/imports.e2e-spec.ts test/fixtures prisma
git commit -m "feat: import HR employees and device enrollments"
```

### Task 5: Transaction browser API, mapping, and reference CSV export

**Files:**
- Create: `src/transactions/transactions.module.ts`, `src/transactions/transactions.controller.ts`, `src/transactions/transactions.service.ts`, `src/transactions/csv-export.service.ts`, `test/transactions.e2e-spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- `GET /api/transactions?from=YYYY-MM-DD&to=YYYY-MM-DD&employeeId=&deviceSerialNumber=&state=&page=&pageSize=`.
- `GET /api/transactions/export` with the same filters returns `text/csv; charset=utf-8`.

- [ ] **Step 1: Write failing transaction/export tests**

```ts
it('exports the supplied CSV headers and mapped employee name in WIB', async () => {
  const response = await request(server).get('/api/transactions/export?from=2026-07-01&to=2026-07-01').set(auth).expect(200);
  expect(response.text.split('\n')[0]).toBe('Index,Pin,Ename,Time,State,Verification,Work Code,Reserved,Device');
  expect(response.text).toContain('000000715');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/transactions.e2e-spec.ts`

Expected: FAIL with 404.

- [ ] **Step 3: Implement immutable transaction read model**

Join AttendancePunch to DeviceEnrollment on `deviceId` and `userId=pin`, then Employee. Do not update punches. Render unknown employee as `Belum dipetakan`. Map known numeric state/verification values through explicit lookup tables while retaining original integers in the API. Prefix CSV with UTF-8 BOM, quote RFC-4180 fields, and set a date-range filename.

- [ ] **Step 4: Run focused tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/transactions.e2e-spec.ts`

Expected: filters paginate deterministically, mapped/unmapped rows render correctly, CSV header/order/escaping pass, and PIN is preserved.

- [ ] **Step 5: Commit**

```bash
git add src/transactions test/transactions.e2e-spec.ts
git commit -m "feat: browse and export attendance transactions"
```

### Task 6: Dashboard summary API

**Files:**
- Create: `src/dashboard/dashboard.module.ts`, `src/dashboard/dashboard.controller.ts`, `src/dashboard/dashboard.service.ts`, `test/dashboard.e2e-spec.ts`
- Modify: `src/app.module.ts`

**Interfaces:**
- `GET /api/dashboard?date=YYYY-MM-DD` returns `{ date, activeEmployees, punchedEmployees, unmappedPunches, activeDevices, recentTransactions }` in WIB.

- [ ] **Step 1: Write failing dashboard API test**

```ts
it('counts distinct mapped employees and unmapped punches for a selected WIB date', () =>
  request(server).get('/api/dashboard?date=2026-07-01').set(auth).expect(200).expect(expect.objectContaining({ date: '2026-07-01', punchedEmployees: 1, unmappedPunches: 1 })));
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/dashboard.e2e-spec.ts`

Expected: FAIL with 404.

- [ ] **Step 3: Implement date-bounded WIB metrics**

Use lexical bounds on the existing `occurredAtLocal` format only after validating the `YYYY-MM-DD HH:mm:ss` shape. Count active employees from Employee, distinct mapped employees from enrollments/punches, and unmapped punches separately. Active device means at least one punch or command delivery on the selected date; never infer device availability from ICMP.

- [ ] **Step 4: Run focused tests**

Run: `npx jest --config ./test/jest-e2e.json --runInBand test/dashboard.e2e-spec.ts`

Expected: zero-data, mapped, unmapped, and date-boundary cases pass.

- [ ] **Step 5: Commit**

```bash
git add src/dashboard test/dashboard.e2e-spec.ts
git commit -m "feat: add WIB attendance dashboard metrics"
```

### Task 7: Dashboard visual concept and React application shell

**Files:**
- Create: `web/`, `web/src/app/*`, `web/src/components/*`, `web/src/routes/*`, `web/src/styles/tokens.css`, `web/e2e/login.spec.ts`
- Modify: root `README.md`, `.gitignore`

**Interfaces:**
- `/login`, `/dashboard`, `/employees`, `/imports`, `/transactions` browser routes.
- `apiClient` attaches the access token and redirects to login on 401.

- [ ] **Step 1: Produce and accept the dashboard visual concept**

Use Image Gen to create a full 1366×768 Indonesian HR dashboard screen and readable detail states for employee table, import preview, and transaction table. The concept must show left navigation, compact header/date control, table-led content, selected states, and no invented device controls or fake attendance data. Inspect the concept with `view_image` and record tokens for color, typography, spacing, table, form, and status components.

- [ ] **Step 2: Create failing browser tests**

```ts
test('admin logs in and reaches the dashboard', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.test');
  await page.getByLabel('Password').fill('CorrectHorse1!');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
```

- [ ] **Step 3: Run browser test to verify it fails**

Run: `cd web; npx playwright test e2e/login.spec.ts`

Expected: FAIL because React application is absent.

- [ ] **Step 4: Scaffold and implement app shell**

Create React/Vite TypeScript app. Implement app shell, protected routes, in-memory access tokens, automatic refresh through the HttpOnly cookie, explicit logout, accessible labels, keyboard focus, Indonesian navigation labels, responsive left rail, and shared empty/error/loading states. Implement exact accepted concept tokens and compare a browser screenshot with the Image Gen concept using `view_image`.

- [ ] **Step 5: Run browser test and visual check**

Run: `cd web; npm run build; npx playwright test e2e/login.spec.ts`

Expected: production build and login route test pass; rendered screenshot matches the accepted concept in layout, color, type, and density.

- [ ] **Step 6: Commit**

```bash
git add web README.md .gitignore
git commit -m "feat: add HR dashboard application shell"
```

### Task 8: Employee, import, transaction, and dashboard UI workflows

**Files:**
- Create: `web/src/features/employees/*`, `web/src/features/imports/*`, `web/src/features/transactions/*`, `web/src/features/dashboard/*`, `web/e2e/employees.spec.ts`, `web/e2e/imports.spec.ts`, `web/e2e/transactions.spec.ts`
- Modify: `web/src/routes/*`, `web/src/app/api-client.ts`

**Interfaces:**
- Uses the Task 3–6 `/api` contracts without direct database access.

- [ ] **Step 1: Write failing browser workflow tests**

```ts
test('HR creates a mapped employee and exports filtered transactions', async ({ page }) => {
  await loginAsHr(page);
  await page.goto('/employees');
  await page.getByRole('button', { name: 'Tambah karyawan' }).click();
  await page.getByLabel('EmployeeID').fill('E.RMS001');
  await page.getByLabel('PIN mesin').fill('000000715');
  await page.getByRole('button', { name: 'Simpan' }).click();
  await page.goto('/transactions');
  await expect(page.getByRole('link', { name: 'Ekspor CSV' })).toBeVisible();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web; npx playwright test e2e/employees.spec.ts e2e/imports.spec.ts e2e/transactions.spec.ts`

Expected: FAIL because feature routes are absent.

- [ ] **Step 3: Implement feature screens**

Implement employee table/search/filter/form/deactivation/audit drawer; import source selector/upload/preview/row errors/commit/history; transaction filters/table/pagination/CSV link; and dashboard metrics/recent transactions. Use server responses for all state, block duplicate submit buttons during mutation, and show actionable Indonesian error text. Do not add report PDF, email scheduling, or device time controls in this phase.

- [ ] **Step 4: Run browser tests and compare visuals**

Run: `cd web; npm run build; npx playwright test`

Expected: critical CRUD/import/export workflows pass. Capture 1366×768 dashboard and employee table screenshots, inspect them with `view_image`, and fix clipping, visual drift, focus issues, and mobile overflow.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat: add HR employee import and transaction workflows"
```

### Task 9: Documentation, end-to-end verification, and operational restart

**Files:**
- Create: `docs/operations/admin-bootstrap.md`, `docs/operations/import-and-export.md`
- Modify: `README.md`, `docs/compatibility-spike.md`

**Interfaces:**
- Documents commands to migrate, bootstrap first admin, launch API/dashboard, import safely, and verify ADMS stays on port 8192.

- [ ] **Step 1: Write the failing smoke test checklist as automated assertions**

```ts
it('keeps ADMS handshake available while authenticated HR APIs are enabled', async () => {
  await request(server).get('/iclock/cdata').query({ SN: 'TEST-X105-ID-001' }).expect(200);
  await request(server).get('/api/employees').expect(401);
});
```

- [ ] **Step 2: Run it to establish the required regression boundary**

Run: `npm test -- --runInBand`

Expected: all ADMS, API, import, transaction, dashboard, and browser suites pass.

- [ ] **Step 3: Document startup and rollback**

Document backup before migration, `npm run db:up`, `npx prisma migrate deploy`, bootstrap admin, API/dashboard startup, port 8192 health check, browser URL, import preview/commit, and rollback by restoring database backup rather than deleting tables. Do not log user credentials.

- [ ] **Step 4: Run complete verification**

Run: `npm test -- --runInBand; npx eslint "{src,test}/**/*.ts"; npx tsc --noEmit --incremental false; npx prisma validate; npm run build; cd web; npm run build; npx playwright test`

Expected: all commands exit 0. Manually verify `GET /iclock/cdata?SN=NHZ4254800180` still returns 200 after restart, while avoiding display of employee data.

- [ ] **Step 5: Commit**

```bash
git add README.md docs test
git commit -m "docs: document HR dashboard operations"
```

## Plan self-review

- **Spec coverage:** Tasks 1–6 implement Phase 1 backend; Tasks 7–8 implement accepted UI and browser flows; Task 9 proves ADMS compatibility and documents operation. Attendance calculation, PDF/email, and device synchronization are intentionally separated into later phases as specified.
- **No unfinished stubs:** All interfaces, commands, failure expectations, and commit boundaries are specified.
- **Type consistency:** Employee uses `employeeCode`; mapping uses `deviceSerialNumber` plus text `pin`; frontend consumes only `/api`; `/iclock` remains independent.
