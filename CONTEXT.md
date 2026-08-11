# Attendance Automation

This context receives attendance transactions from physical devices and turns them into auditable HR reports.

## Language

**Attendance Device**:
A physical device that records identity and time and sends transactions to the server.
_Avoid_: Fingerprint machine, terminal

**Attendance Punch**:
An immutable raw record received from an Attendance Device for one device identity at one time.
_Avoid_: Attendance day, working time

**Device Identity**:
The employee identifier stored on a particular Attendance Device.
_Avoid_: Employee ID

**Attendance Day**:
A derived daily result calculated from Attendance Punches, a Work Schedule, and audited HR corrections.
_Avoid_: Log, transaction

**Work Schedule**:
The effective-dated start, end, tolerance, and overtime rules used to calculate an Attendance Day.
_Avoid_: Cron, report schedule

**Report Run**:
One auditable execution that creates and optionally delivers a report for a fixed date range.
_Avoid_: Job, email
