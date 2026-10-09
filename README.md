# MediBook

A full-stack doctor appointment booking app. Patients browse approved doctors, book a time slot and pay the consultation fee online. Doctors manage their appointments, and an admin approves doctors before they can log in.

## Features

- **Role-based access** for patients, doctors and admins, using JWT authentication and bcrypt-hashed passwords
- **Doctor approval workflow**: new doctors stay `pending` until an admin approves them
- **Double-booking prevention**: the server rejects a slot that is already taken for that doctor
- **Online payments** with Razorpay (order creation and HMAC-SHA256 signature verification), plus a **demo mode** that needs no Razorpay account
- **Appointment management**: patients can cancel, doctors can mark appointments completed or cancelled

## Tech Stack

| Layer     | Technology                                  |
| --------- | ------------------------------------------- |
| Frontend  | HTML, CSS, vanilla JavaScript               |
| Backend   | Node.js, Express                            |
| Database  | MySQL                                       |
| Auth      | JSON Web Tokens, bcryptjs                   |
| Payments  | Razorpay (optional)                         |

## Project Structure

```
medibook/
├── schema.sql          # Database and tables
├── backend/
│   ├── server.js       # Express API + serves the frontend
│   ├── package.json
│   └── .env.example    # Copy to .env and fill in
└── frontend/
    ├── index.html      # Login / register
    ├── dashboard.html  # Role-based dashboard
    ├── app.js
    └── style.css
```

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org) (LTS)
- MySQL 8+ and MySQL Workbench (or any MySQL client)

### 1. Set up the database

Run `schema.sql` in MySQL Workbench. It creates the `medibook` database with the `users`, `doctors` and `appointments` tables.

### 2. Configure environment variables

```bash
cd backend
cp .env.example .env
```

Open `.env` and set your values:

```
PORT=5000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=medibook
JWT_SECRET=a_long_random_string
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
```

Leave the two Razorpay values empty to use **demo payment mode**. To use real checkout in test mode, add your `rzp_test_...` keys from the Razorpay dashboard.

> On macOS, port 5000 can be taken by AirPlay Receiver. If you see `EADDRINUSE`, change `PORT` to something else, such as `3000`.

### 3. Install and run

```bash
cd backend
npm install
npm start
```

Open **http://localhost:5000** (or whichever port you set). The backend serves the frontend, so there is only one server to run.

## Usage

An admin account is created automatically on first run:

| Email            | Password   |
| ---------------- | ---------- |
| `admin@care.com` | `admin123` |

Change this password before using the app for anything beyond a local demo.

**Try the full flow:**

1. Register a user with the **Doctor** role.
2. Log in as admin and approve the doctor.
3. Register a **Patient**, log in, pick the doctor, choose a date and time, and book.
4. Pay through Razorpay (test card `4111 1111 1111 1111`, any future expiry, any CVV) or use demo mode.

## API Overview

| Method | Endpoint                       | Access        | Description                    |
| ------ | ------------------------------ | ------------- | ------------------------------ |
| POST   | `/api/register`                | Public        | Register a patient or doctor   |
| POST   | `/api/login`                   | Public        | Log in and receive a JWT       |
| GET    | `/api/doctors`                 | Public        | List approved doctors          |
| POST   | `/api/appointments`            | Patient       | Book a slot                    |
| POST   | `/api/appointments/:id/pay`    | Patient       | Confirm payment                |
| GET    | `/api/appointments`            | Any role      | List your appointments         |
| PATCH  | `/api/appointments/:id`        | Patient/Doctor| Cancel or complete             |
| GET    | `/api/admin/doctors`           | Admin         | List all doctors               |
| PATCH  | `/api/admin/doctors/:id`       | Admin         | Approve or reject a doctor     |

## Security Notes

- Never commit your real `.env` file. It is listed in `.gitignore`.
- Use a long random `JWT_SECRET` and a strong database password.
- Use Razorpay **test** keys while developing.

## Author

**Harshita Meena**: [GitHub](https://github.com/harshitameena29)
