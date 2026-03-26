# CareConnect — Full Project Walkthrough

A step-by-step record of everything done to build and deploy this project.

---

## 1. Project Structure (Starting Point)

The project already had a basic Express backend and a plain Vite + React frontend:

```
CareConnect/
├── client/   ← Vite + React (basic, unstyled)
└── server/   ← Express + MongoDB + Gemini AI
```

**Decision:** Scrap the React client entirely. Serve the UI directly from Express using **EJS templates**, keeping everything in one place with no build step.

---

## 2. Setting Up EJS in the Server

### Install EJS
```bash
cd server
npm install ejs
```

### Update `server/index.js`
Added EJS as the view engine and pointed Express to serve static files:

```js
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));
```

Also fixed the broken `package.json` start scripts (were pointing to `server.js` which didn't exist):

```json
"scripts": {
  "start": "node index.js",
  "dev":   "nodemon index.js"
}
```

### Delete the old React client
```bash
# From the CareConnect/ root
rmdir /s /q client
```

---

## 3. Building the UI (EJS + CSS + JS)

Created the following file structure inside `server/`:

```
server/
├── views/
│   ├── index.ejs      ← Full landing page + 3-tab forms + AI chatbot
│   └── success.ejs    ← Volunteer registration success + AI suggestion
└── public/
    ├── css/style.css  ← Complete design system
    └── js/main.js     ← Tab switching, form handlers, chat logic
```

**Design inspiration:** Warm editorial aesthetic (earth tones, DM Serif Display + DM Sans fonts, paper noise texture, card-based layout).

**Key UI sections in `index.ejs`:**
- Sticky frosted-glass navbar
- Hero section with radial gradient accent
- Stats card (2,400+ Patients, 380 Volunteers, 14 Centres)
- **3-tab registration section:** Patient Support / Volunteer / Contact Us
- **AI Chat section** with FAQ chip sidebar + live chat window
- Services grid (6 cards)
- Footer

---

## 4. Fixing the AI Model Error

The original code used `gemini-1.5-flash` which returned a **404** because the model name was wrong for the v1beta API endpoint.

**Attempted fixes:**
- `gemini-2.0-flash` → worked but hit **daily free-tier quota limit**
- `gemini-1.5-flash-latest` → **404** (wrong name)
- `gemini-2.0-flash-lite` → also hit **quota** (same API key, exhausted)

**Root cause:** The Gemini API key had exhausted all free-tier daily quotas from repeated test calls.

**Solution:** Switch to **Groq** (completely separate provider, generous free tier).

---

## 5. Integrating Groq AI

### Get a free API key
Sign up at **[console.groq.com](https://console.groq.com)** → Create API Key → copy it.

### Install the Groq SDK
```bash
cd server
npm install groq-sdk
```

### Add key to `.env`
```
GROQ_API_KEY=gsk_your_key_here
```

### Replace Gemini with Groq in `index.js`

```js
// Before (Gemini)
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// After (Groq)
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "llama-3.3-70b-versatile";
```

### Volunteer AI Suggestion (on registration)
```js
const completion = await groq.chat.completions.create({
  model: GROQ_MODEL,
  messages: [
    { role: "system", content: "You are an AI assistant for a healthcare NGO. Respond in exactly two sentences." },
    { role: "user",   content: `Volunteer ${name} wants to join as ${role}. Experience: "${experience}". Suggest how they can contribute.` }
  ],
  max_tokens: 150,
});
const aiSuggestion = completion.choices[0].message.content.trim();
```

### Live Chat Route (`POST /api/chat`)
Accepts `{ message, history }` — builds the full conversation array:

```js
const messages = [
  { role: "system", content: "You are a helpful assistant for CareConnect healthcare NGO..." },
  // inject prior turns for multi-turn context
  ...(history || []).map(h => ({ role: h.role === "bot" ? "assistant" : "user", content: h.text })),
  { role: "user", content: message },
];
const completion = await groq.chat.completions.create({ model: GROQ_MODEL, messages, max_tokens: 200 });
res.json({ reply: completion.choices[0].message.content.trim() });
```

### Test the chat endpoint
```bash
node test-chat.js   # quick HTTP request script
# STATUS: 200
# REPLY: { "reply": "At CareConnect, we offer free and subsidised medical consultations..." }
```

---

## 6. New API Routes Added

| Method | Route | What it does |
|--------|-------|--------------|
| `GET`  | `/` | Renders `index.ejs` |
| `POST` | `/api/register` | Volunteer form → Groq AI suggestion → MongoDB → renders `success.ejs` |
| `POST` | `/api/patient` | Patient form → MongoDB |
| `POST` | `/api/contact` | Contact form → MongoDB |
| `POST` | `/api/chat` | Groq AI chatbot with multi-turn history |

---

## 7. Running Locally

```bash
cd server
npm run dev
# → Server running at http://localhost:5000
# → Connected to MongoDB
```

Open **http://localhost:5000** in browser.

---

## 8. Pushing to GitHub

```bash
# From CareConnect/ root
git add .
git commit -m "feat: EJS+CSS+JS UI redesign with Groq AI chat and volunteer registration"
git push origin main
```

Files pushed:
- `README.md` (assignment requirement)
- `render.yaml` (deployment config)
- `server/views/index.ejs`
- `server/views/success.ejs`
- `server/public/css/style.css`
- `server/public/js/main.js`
- `server/index.js` (updated)
- `server/package.json` (updated, groq-sdk added)

---

## 9. Deploying to Render

1. Go to **[render.com](https://render.com)** → New → Web Service
2. Connect GitHub → select `CareConnect` repo
3. Settings:

| Field | Value |
|---|---|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | Free |

4. Environment Variables (set in Render dashboard):

| Key | Value |
|---|---|
| `MONGO_URI` | *(your MongoDB Atlas connection string)* |
| `GROQ_API_KEY` | *(your Groq API key)* |

5. Click **Deploy** → live in ~2 minutes.

---

## 10. Final Project Tree

```
CareConnect/
├── README.md
├── render.yaml
└── server/
    ├── .env               ← secrets (NOT committed)
    ├── .gitignore         ← node_modules, .env
    ├── index.js           ← Express app (all routes + AI)
    ├── package.json
    ├── views/
    │   ├── index.ejs      ← Main page
    │   └── success.ejs    ← Post-registration page
    └── public/
        ├── css/style.css  ← Design system
        └── js/main.js     ← Frontend logic
```

---

## Tech Stack Summary

| Layer | Technology |
|---|---|
| Server | Node.js + Express.js |
| Templating | EJS |
| Styling | Vanilla CSS |
| Frontend Logic | Vanilla JavaScript |
| Database | MongoDB Atlas (Mongoose) |
| AI | Groq API — `llama-3.3-70b-versatile` |
| Hosting | Render (free tier) |
| Version Control | Git + GitHub |
