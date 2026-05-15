# CareerProof Application System

Full-stack internship application flow with Razorpay payment, MongoDB storage, PDF generation, and email delivery.

## Flow

```text
User clicks "Submit Application"
        |
Frontend validates the form
        |
POST /api/create-order creates a Razorpay order for INR 5
        |
Razorpay Checkout opens
        |
Payment succeeds
        |
POST /api/verify-payment verifies the Razorpay signature on the server
        |
Application is saved to MongoDB
        |
Offer letter PDF and email are processed in the background
        |
After internship end date, certificate PDF and certificate email are sent automatically
```

The application is not stored unless the Razorpay payment verifies successfully.

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `env.example` and fill in your real credentials:

```bash
copy env.example .env
```

Required values:

| Variable | Description |
|---|---|
| `PORT` | API port, defaults to `5000` |
| `APP_ENV` | Use `development` locally; use `production` only for production safeguards outside Vercel |
| `RAZORPAY_KEY_ID` | Razorpay test/live key ID |
| `RAZORPAY_KEY_SECRET` | Razorpay test/live key secret |
| `MONGODB_URI` | MongoDB Atlas or local MongoDB connection string |
| `EMAIL_PROVIDER` | `gmail`, `resend`, or `smtp` |
| `EMAIL_FROM` | Sender address, for example `CareerProof <hr@careerproof.in>` |
| `EMAIL_USER` / `EMAIL_PASS` | Gmail or SMTP credentials |
| `RESEND_API_KEY` | Required only when `EMAIL_PROVIDER=resend` |

3. Start the server:

```bash
npm start
```

4. Open the form:

```text
http://localhost:5000/apply.html
```

## API

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/create-order` | Creates a Razorpay Standard Checkout order for INR 5 |
| `POST` | `/api/verify-payment` | Verifies Razorpay signature and saves the paid application to MongoDB |
| `POST` | `/api/payment/order` | Backward-compatible alias for the older payment order route |
| `POST` | `/api/payment/verify` | Backward-compatible alias for the older payment verification route |
| `GET` | `/api/applications` | Lists saved applicants |
| `GET` | `/api/applications/:candidateId` | Gets one applicant |
| `POST` | `/api/certificates/run` | Manually runs the due-certificate email job |
| `GET` | `/api/verify/:candidateId` | Public student verification lookup |
| `GET` | `/api/verify/:candidateId/offer-letter` | Download regenerated offer letter PDF for verified paid student |
| `GET` | `/api/verify/:candidateId/certificate` | Download regenerated certificate PDF after internship completion |
| `GET` | `/api/health` | Health check |

## Notes

- Use Razorpay test keys while developing.
- To accept real payments, replace production environment variables with Razorpay live keys:
  - `RAZORPAY_KEY_ID` must start with `rzp_live_`
  - `RAZORPAY_KEY_SECRET` must be the matching live secret from the same Razorpay account
  - On Vercel, set these under Project Settings -> Environment Variables for Production, then redeploy
- Production startup rejects test keys, so a deployed production app cannot accidentally charge through Razorpay test mode.
- The frontend API base URL is in `apply.html` as `API_BASE_URL`.
- Public PDF QR codes point to `PUBLIC_BASE_URL/verify.html?id=<studentId>`.
- Generated offer PDFs are stored temporarily in `generated_pdfs/` and cleaned after email processing.
- The server checks due certificates on startup and once every 24 hours while it is running.
