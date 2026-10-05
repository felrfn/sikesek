# SIKESEK Product Requirements Document

## 1. Product Overview

SIKESEK (Sistem Informasi Kawasan dan Pengelolaan Wisata Arenan Kalikesek) is an integrated tourism management and Kawasan Tanpa Rokok (KTR) monitoring system for Wisata Arenan Kalikesek.

The system combines digital tourism management with AI-assisted KTR monitoring to improve operational efficiency, reservation management, ticket validation, and field response.

## 2. Problem Statement

The existing tourism operation relies heavily on manual processes for:

- Facility reservations
- Administrative management
- Ticket validation
- Operational monitoring
- KTR enforcement

These processes can cause:

- Double-booking
- Visitor queues
- Difficult transaction tracking
- Inefficient coordination
- Limited visibility into facility usage
- Difficult KTR monitoring
- Lack of consistent visual evidence during enforcement

## 3. Product Goals

SIKESEK aims to:

1. Digitize tourism facility management.
2. Provide online facility reservations.
3. Provide digital e-tickets.
4. Simplify ticket validation using QR Codes.
5. Centralize operational information.
6. Support KTR monitoring using YOLOv8.
7. Provide visual evidence for detected violations.
8. Notify field officers about detected violations.
9. Provide violation history for monitoring and evaluation.

## 4. Target Users

### 4.1 Visitors

Visitors use the public website.

Primary needs:

- View facilities
- Check availability
- Make reservations
- Complete payment
- Receive e-tickets

### 4.2 Admin

Admins manage the tourism operation.

Primary needs:

- Manage facilities
- Manage reservations
- Monitor payments
- Manage field officers
- Monitor KTR violations
- Review operational history

### 4.3 Field Officer

Field officers operate on-site.

Primary needs:

- Validate visitor tickets
- Receive KTR notifications
- View violation evidence
- Locate violations
- Perform field actions
- Update violation status

## 5. Product Scope

### In Scope

#### Tourism Management

- Facility management
- Facility information
- Facility availability
- Online reservation
- Payment integration
- E-ticket generation
- QR ticket validation
- Operational monitoring

#### KTR Monitoring

- CCTV-based monitoring
- RTSP video processing
- YOLOv8 smoking detection
- Evidence image generation
- Evidence storage
- Violation records
- Push notifications
- Violation status updates
- Violation history

#### User Management

- Admin authentication
- Field officer authentication
- Role-based access
- Profile management

## 6. Out of Scope

The initial system does not include:

- Full-area KTR monitoring
- Monitoring all tourism locations
- Detection of fire or other disasters
- Detection of violations unrelated to smoking
- General-purpose surveillance
- Automatic enforcement without human field officers

The initial AI monitoring implementation is limited to one gazebo.

## 7. Functional Requirements

### FR-01 Authentication

The system shall allow authorized admins and field officers to authenticate.

### FR-02 Facility Management

Admins shall be able to:

- Create facilities
- Update facilities
- Remove or deactivate facilities
- Update facility information
- Manage pricing
- Manage capacity
- Manage descriptions
- Manage facility images
- Manage facility status

### FR-03 Facility Browsing

Visitors shall be able to view:

- Facility information
- Availability
- Pricing
- Capacity
- Images
- Descriptions

### FR-04 Reservation

Visitors shall be able to:

- Select a facility
- Select an available schedule
- Create a reservation
- Proceed to payment
- Receive reservation status

### FR-05 Payment

The system shall integrate with Midtrans.

Payment status shall be updated through backend processing and Midtrans webhook events.

### FR-06 E-Ticket

After successful payment, the system shall provide an e-ticket containing a QR Code.

### FR-07 QR Ticket Validation

Field officers shall be able to scan the QR Code and validate the ticket.

The backend shall verify:

- Ticket/invoice
- Payment status
- Reservation date
- Ticket usage status

### FR-08 KTR Detection

The AI system shall process CCTV video and detect smoking activity using YOLOv8.

### FR-09 Evidence

When a violation is detected, the system shall store evidence and associate it with:

- Location
- Timestamp
- Confidence score
- Evidence image
- Violation status

### FR-10 Notification

The backend shall notify active field officers through Firebase Cloud Messaging when a KTR violation is detected.

### FR-11 Violation Handling

Field officers shall be able to:

- Open violation details
- View evidence
- View location
- Review detection information
- Perform field action
- Mark the violation as resolved

### FR-12 Violation History

Admins and authorized field officers shall be able to view relevant violation history.

### FR-13 Dashboard

The admin dashboard shall provide operational summaries such as:

- Reservation information
- Facility information
- Facility status
- KTR violation count
- Operational information

## 8. Non-Functional Requirements

### Performance

The system should provide responsive user interaction and avoid unnecessary network requests.

### Availability

Production services should be deployed with appropriate uptime and monitoring mechanisms.

### Security

The system must:

- Use HTTPS.
- Protect authentication credentials.
- Protect server-side secrets.
- Enforce backend authorization.
- Validate user input.
- Restrict CORS.
- Secure payment credentials.
- Secure object storage credentials.

### Maintainability

The implementation should:

- Use modular components.
- Use typed interfaces.
- Separate UI and business logic.
- Centralize API communication.
- Follow consistent naming conventions.

### Scalability

The architecture should allow future expansion from:

```text
One monitored gazebo
```

to:

```text
Multiple monitored gazebos
Multiple facilities
Multiple field officers
```

without requiring a complete architectural rewrite.

## 9. User Journeys

### Visitor Journey

```text
Visit Website
 ↓
Browse Facilities
 ↓
Select Facility
 ↓
Check Availability
 ↓
Create Reservation
 ↓
Payment
 ↓
Payment Confirmation
 ↓
Receive E-Ticket
 ↓
Arrive at Location
 ↓
Show QR Code
```

### Field Officer Journey

```text
Login
 ↓
Open Mobile Dashboard
 ↓
Scan Visitor QR
 ↓
Validate Ticket
 ↓
Monitor Facilities
 ↓
Receive KTR Notification
 ↓
Open Violation
 ↓
View Evidence
 ↓
Visit Location
 ↓
Take Action
 ↓
Resolve Violation
```

### Admin Journey

```text
Login
 ↓
Open Dashboard
 ↓
Monitor Operations
 ↓
Manage Facilities
 ↓
Manage Reservations
 ↓
Monitor Payments
 ↓
Review KTR Violations
 ↓
Review Operational History
```

## 10. System Integrations

| Integration              | Purpose                    |
| ------------------------ | -------------------------- |
| PostgreSQL               | Application data           |
| Cloudflare R2            | Evidence and media storage |
| Midtrans                 | Payment processing         |
| Firebase Cloud Messaging | Mobile notifications       |
| CCTV/RTSP                | Video acquisition          |
| YOLOv8                   | Smoking detection          |

## 11. Data Entities

Core entities include:

```text
User
Role
Facility
Reservation
Payment
Ticket
Violation
Notification
```

### User

Potential fields:

```text
id
name
email
password/auth reference
role
status
created_at
updated_at
```

### Facility

Potential fields:

```text
id
name
category
description
price
capacity
image_url
status
created_at
updated_at
```

### Reservation

Potential fields:

```text
id
user_id
facility_id
invoice_number
reservation_date
status
payment_status
created_at
updated_at
```

### Violation

Potential fields:

```text
id
location
detected_at
confidence
evidence_url
status
handled_by
resolved_at
created_at
updated_at
```

The exact database schema must follow the backend implementation.

## 12. System Flow

### Overall

```text
Visitor
  ↓
Public Website
  ↓
Backend API
  ↓
PostgreSQL
```

```text
CCTV
  ↓
YOLOv8
  ↓
Cloudflare R2
  ↓
Backend
  ↓
PostgreSQL
  ↓
FCM
  ↓
Field Officer
```

```text
Visitor
  ↓
Reservation
  ↓
Midtrans
  ↓
Webhook
  ↓
Backend
  ↓
PAID
  ↓
E-Ticket
```

## 13. Success Criteria

The product is considered functionally successful when:

- Visitors can browse available facilities.
- Visitors can create reservations.
- Payments can be processed through Midtrans.
- Paid reservations produce valid e-tickets.
- Field officers can validate tickets using QR Codes.
- YOLOv8 can produce KTR detection records.
- Detection evidence can be stored and displayed.
- Field officers receive violation notifications.
- Field officers can update violation status.
- Admins can manage facilities and reservations.
- Admins can review KTR violation history.
- Unauthorized users cannot access protected functionality.

## 14. Future Expansion

Potential future improvements include:

- Monitoring multiple gazebos.
- More advanced KTR detection.
- Real-time dashboard updates.
- Analytics and reporting.
- Automated operational reports.
- Improved notification prioritization.
- Multi-location tourism management.
- Additional payment methods.
- Offline support for selected field operations.
- More granular role and permission management.

Future features must not be added to the current scope without updating the product requirements and architecture documentation.
