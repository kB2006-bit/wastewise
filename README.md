# WasteWise — Collection Readiness & Dispatch Platform

> **A municipal waste collection platform built around upstream operational readiness and exception-to-resolution tracking.**

---

## 1. What WasteWise Solves

Municipal special waste collection (bulky furniture, hazardous e-waste, appliances, and recyclables) suffers from a chronic operational failure: **the curbside dry run**. 

Vehicles are dispatched to addresses only to discover that:
* The item contains undeclared hazards (e.g. un-taped lithium batteries, intact freon loops).
* The item is physically inaccessible (behind padlocked gates or blocked by vehicles).
* The item was not placed at the curb on the assigned day.
* The pickup request was placed in an arbitrary sector where no vehicle is operating.

Standard municipal web apps act as passive CRUD forms, unconditionally accepting requests and passing the burden to crews. **WasteWise solves this by enforcing collection readiness upstream before a request can be confirmed.**

---

## 2. Target Users

| User Persona | Context | Value Received |
| :--- | :--- | :--- |
| **Residents** | Occasional users seeking disposal for bulky or irregular waste. Zero desire to create an account or verify email. | Instant disposal guidelines, clear safety preparation requirements, guaranteed collection windows, and private status tracking without passwords. |
| **Dispatchers / Operators** | Municipal supervisors managing collection sectors, daily capacity limits, and crew manifests. | Real-time visibility into collection-ready requests, capacity enforcement by sector corridor, and structured exception logging when stops cannot be completed. |
| **Collection Crews** *(Downstream)* | Field drivers operating heavy haulers under tight route hours. | Precise curbside access notes, pre-verified safety compliance, and standard reason codes to report failed stops. |

---

## 3. Core Innovations

### 1. The Collection Readiness Engine
A request is not "ready" merely because a resident entered an address. Intake is governed by a deterministic readiness gate:
1. **Material & Hazard Classification:** Category-specific rules are loaded dynamically.
2. **Mandatory Safety Preparation:** If a category requires prep (e.g., taping battery terminals, wrapping upholstered mattresses, draining appliance fluids), the resident must explicitly acknowledge compliance.
3. **Curbside Access Declaration:** Explicit placement details (curb, driveway apron, alley) and driver access notes.
4. **Zonal Corridor Scheduling:** Requests can only be booked into active sector corridors (e.g. North on Mon/Thu, South on Tue/Fri) with real-time capacity throttling (e.g. max 8 bulky stops/day).

### 2. Exception-to-Resolution Tracking
When a collection stop cannot be retrieved at the curb, the operator does not simply mark it "Failed". The operator selects a **structured exception code** (`INACCESSIBLE`, `NOT_PRESENT`, `PREP_INCOMPLETE`, `INCORRECT_CATEGORY`, `CAPACITY_UNAVAILABLE`). The system automatically pairs the exception with an **actionable resolution instruction** visible to the resident on their private tracking link, telling them exactly how to rectify the issue for re-dispatch.

---

## 4. Architecture & Technology Stack

* **Runtime:** Node.js 22 LTS (Native ES Modules)
* **API Framework:** Express 5 (`^5.2.1`)
* **Persistence:** SQLite via Node 22 native `node:sqlite` (`DatabaseSync` with Write-Ahead Logging & Foreign Keys enabled)
* **Architecture Pattern:** Repository Pattern isolating persistence from business rules and routing
* **Authentication:** Zero-friction high-entropy reference tracking codes (`TRK-XXXX-XXXX`) for residents; environment-backed `x-admin-key` header verification for dispatchers
* **Containerization:** Production multi-stage `Dockerfile` adhering to Google Cloud Run specifications (`0.0.0.0:$PORT`)

```text
┌────────────────────────────────────────────────────────┐
│               Google Cloud Run Container               │
│                                                        │
│  Host: 0.0.0.0                                         │
│  Port: process.env.PORT || 8080                        │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │             Express 5 Server (Node 22)           │  │
│  │                                                  │  │
│  │  ┌──────────────────────┐ ┌───────────────────┐  │  │
│  │  │  REST API Layer      │ │ Static File Server│  │  │
│  │  │  - /api/categories   │ │ - /index.html     │  │  │
│  │  │  - /api/zones        │ │ - /track.html     │  │  │
│  │  │  - /api/windows      │ │ - /admin.html     │  │  │
│  │  │  - /api/requests     │ │ - /css/style.css  │  │  │
│  │  │  - /api/track/:code  │ │ - /js/*.js        │  │  │
│  │  │  - /api/admin/*      │ │                   │  │  │
│  │  │  - /health           │ │                   │  │  │
│  │  └──────────┬───────────┘ └───────────────────┘  │  │
│  └─────────────┼────────────────────────────────────┘  │
│                ▼                                       │
│  ┌─────────────────────────┐                           │
│  │ WasteWiseRepository     │                           │
│  │ (SQLite WAL + Schema)   │                           │
│  └─────────────────────────┘                           │
└────────────────────────────────────────────────────────┘
```

---

## 5. Local Setup & Running

### Prerequisites
* Node.js 22+ installed
* npm 10+ installed

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Populate your environment variables:
```ini
PORT=8080
NODE_ENV=development
ADMIN_KEY=your-secure-admin-key
```

### 3. Run the Automated Test Suite
```bash
npm test
```
The test suite exercises all 9 core business rules:
1. Category preparation validation
2. Window capacity calculations
3. Atomic request creation & slot decrements
4. Preparation confirmation rejection
5. Status state machine transition validation
6. Admin authorization enforcement
7. Tracking code lookup & address privacy masking
8. Unsuccessful pickup exception logging & resolution mapping
9. Real-time database KPI calculations

### 4. Start the Application
```bash
npm start
```
Open your browser to:
* **Resident Booking:** `http://localhost:8080/`
* **Public Tracking:** `http://localhost:8080/track`
* **Operator Console:** `http://localhost:8080/admin`

---

## 6. API Specification

### Public Endpoints
* `GET /health` — Liveness & readiness probe for Cloud Run.
* `GET /api/categories` — Lists all active waste categories with preparation rules.
* `GET /api/categories/:id/prep-rules` — Lists preparation rules for a specific category.
* `GET /api/zones` — Lists active collection sectors.
* `GET /api/windows?zoneId=:id` — Lists upcoming collection dates with remaining vehicle capacity.
* `POST /api/requests` — Validates readiness, confirms prep, locks capacity slot, and issues tracking code.
* `GET /api/track/:trackingCode` — Returns safe, masked tracking status and remediation instructions.

### Admin Endpoints (Require `x-admin-key` Header)
* `GET /api/admin/requests` — Filterable queue by `status`, `zone_id`, `category_id`.
* `GET /api/admin/stats` — Real-time database metrics (total active, submitted, ready, scheduled, collected, unsuccessful).
* `PATCH /api/admin/requests/:id/status` — Enforces legal state machine status transitions (`READY`, `SCHEDULED`, `COLLECTED`, `UNSUCCESSFUL`).
* `POST /api/admin/requests/:id/exception` — Records curbside exception reason and updates status to `UNSUCCESSFUL`.

---

## 7. Google Cloud Run Deployment

### Cloud Run Container Architecture
The included `Dockerfile` builds a production container running `node:22-alpine` that:
1. Binds dynamically to `0.0.0.0` and `process.env.PORT || 8080`.
2. Serves static client files and API endpoints from a single unified process.
3. Exposes the `/health` endpoint for Google Cloud Run health checks.

### Deployment Method (GitHub + Cloud Run Console)
Because local environments may lack Docker or the `gcloud` CLI:
1. Push this repository to GitHub.
2. In the Google Cloud Console, open **Cloud Run** and select **"Create Service"**.
3. Choose **"Continuously deploy from a repository"** and select your repository.
4. Set the Build Type to **Dockerfile**.
5. Under **Variables & Secrets**, add the environment variable:
   * `ADMIN_KEY`: your chosen admin secret key.
6. Click **Deploy**. Cloud Build will build the container and deploy the service.

---

## 8. Important Architectural Limitation: Storage Durability

> **CRITICAL ARCHITECTURAL NOTE:**  
> Google Cloud Run containers operate on an **ephemeral, in-memory local filesystem**. Any modifications written to the local SQLite database file (`data/wastewise.db`) will **not persist** when Cloud Run recycles container instances or scales to zero.
> 
> * **For this Hackathon MVP:** The database features an **idempotent auto-seed routine** on startup. Every time a new container instance boots, it verifies if tables exist and seeds deterministic operational records (categories, rules, zones, windows, and sample requests). This ensures the live demo is 100% functional and never crashes on cold start.
> * **For Future Production:** The `WasteWiseRepository` interface is strictly isolated so that the persistence layer can be switched from SQLite to Google Cloud SQL (PostgreSQL) or Google Cloud Firestore simply by swapping the database connection adapter, without altering any business logic or route handlers.
