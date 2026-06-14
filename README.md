# Shared Expenses App

A premium Splitwise-style Shared Expenses App featuring a dark-theme glassmorphic UI, dynamic group membership intervals, an audited transaction ledger, debt simplification suggested transfers, and an interactive CSV import resolution wizard.

Developed with the assistance of Gemini 3.5 Flash.

---

## Tech Stack

* **Backend**: FastAPI (Python), SQLAlchemy, PostgreSQL (Relational Database)
* **Frontend**: React.js (Vite), Axios, Vanilla CSS (Premium Glassmorphism Design System)
* **Authentication**: JWT Bearer Tokens

---

## Local Setup Instructions

### 1. Database Configuration
Ensure a PostgreSQL database is running locally. By default, the app is configured to connect to:
`postgresql://postgres:postgres@localhost:5433/spiltwise_db`

You can change this connection string by editing:
* `backend/.env`
* `backend/app/db/database.py`

### 2. Backend Startup
1. Open a terminal in the `backend` folder:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment (optional but recommended):
   ```bash
   python -m venv venv
   # On Windows:
   .\venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the FastAPI development server:
   ```bash
   uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
   ```
   *The backend will be running at `http://127.0.0.1:8001`.*

### 3. Frontend Startup
1. Open a second terminal in the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   *The frontend will be running at `http://localhost:5173`.*

---

## Running with Docker (Recommended for Easy Deployment)

To build and spin up the complete stack (PostgreSQL, Backend, and Frontend) automatically, use Docker Compose:

1. Ensure Docker Desktop is running on your machine.
2. From the root directory, run:
   ```bash
   docker compose up --build
   ```
3. Once running, you can access the application at:
   - **Frontend**: `http://localhost:5173`
   - **Backend API**: `http://localhost:8001`
   - **PostgreSQL**: `localhost:5433` (accessible by host tools)

To shut down the containers and preserve volume data:
```bash
docker compose down
```

---

## How to Test the CSV Import
1. Navigate to `http://localhost:5173`.
2. Register/Login or select the pre-loaded group.
3. Choose the target group and select `Expenses Export.csv` from your system.
4. Click **Upload & Parse**.
5. You will be redirected to the **CSV Import Resolution Wizard**, showing a list of all staged rows with anomalies.
6. For each row, review the proposed resolution (date fix, typo correction, USD conversion rate, or ignoring duplicate) and click **Approve Resolution & Commit**.
7. Go back to the Group Details page to see the updated balances, simplified direct settlements, and the transaction ledgers!
