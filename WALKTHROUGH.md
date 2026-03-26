# CareConnect — Complete Project Walkthrough

> **What this document covers:**
> A detailed, step-by-step guide of how the entire CareConnect healthcare NGO web app was built from scratch — including project setup, every file created, every route built and why, how the AI was integrated, and how the app was deployed to the internet.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack Decisions](#2-tech-stack-decisions)
3. [Project Initialisation](#3-project-initialisation)
4. [Setting Up the Express Server](#4-setting-up-the-express-server)
5. [Connecting MongoDB Atlas](#5-connecting-mongodb-atlas)
6. [Installing EJS — The View Engine](#6-installing-ejs--the-view-engine)
7. [Building the UI](#7-building-the-ui)
   - [index.ejs — The Main Page](#indexejs--the-main-page)
   - [success.ejs — The AI Result Page](#successejs--the-ai-result-page)
   - [style.css — The Design System](#stylecss--the-design-system)
   - [main.js — The Frontend Logic](#mainjs--the-frontend-logic)
8. [API Routes — Full Explanation](#8-api-routes--full-explanation)
   - [GET /](#get-)
   - [POST /api/register](#post-apiregister)
   - [POST /api/patient](#post-apipatient)
   - [POST /api/contact](#post-apicontact)
   - [POST /api/chat](#post-apichat)
9. [AI Integration — Groq](#9-ai-integration--groq)
10. [Running the App Locally](#10-running-the-app-locally)
11. [Pushing to GitHub](#11-pushing-to-github)
12. [Deploying to Render](#12-deploying-to-render)
13. [Final Project Structure](#13-final-project-structure)

---

## 1. Project Overview

**CareConnect** is a Mini Healthcare Support Web App built for an NGO internship assignment. The goal was to create a web app that:

- Has **multiple registration forms** — for patients seeking support, volunteers, and general contact
- Uses **AI or automation** as one of the core features
- Is **live-hosted** on the internet (not just running locally)

The app we built solves real NGO problems:
- Patients in underserved rural areas can request medical support
- Volunteers can register, and an AI instantly tells them how they can best contribute based on their skills
- A Groq-powered AI chatbot answers healthcare FAQs 24/7 without needing human staff

---

## 2. Tech Stack Decisions

Before writing a single line of code, decisions were made about what technologies to use.

| Layer | Choice | Why |
|---|---|---|
| **Server** | Node.js + Express | Lightweight, fast, most popular for small web apps |
| **Templating** | EJS | Lets us write HTML with dynamic data injected from the server — no separate frontend build step |
| **Styling** | Vanilla CSS | Full control, no framework constraints, loads fast |
| **Frontend Logic** | Vanilla JavaScript | No dependencies, works in every browser, sufficient for our needs |
| **Database** | MongoDB Atlas | Free cloud database, flexible document model, works perfectly with Node.js via Mongoose |
| **AI** | Groq API (Llama 3.3 70B) | Completely free tier, 14,400 requests/day, extremely fast, OpenAI-compatible API |
| **Hosting** | Render | Free tier for web services, direct Node.js support, auto-deploys from GitHub |

**Why not React?** React requires a build step, a separate dev server, and adds complexity. Since the assignment asked for a simple web app, using EJS templates served directly by Express keeps the architecture simple and deployment straightforward.

**Why Groq instead of OpenAI or Gemini?** OpenAI requires a paid account. Gemini's free tier has a very low daily quota (we ran into quota errors during development). Groq offers 14,400 free requests per day with one of the fastest inference speeds available — ideal for a demo/internship project.

---

## 3. Project Initialisation

### Create the project folder and initialise Node.js

```bash
mkdir CareConnect
cd CareConnect
mkdir server
cd server
npm init -y
```

`npm init -y` creates a `package.json` file with default values. This file tracks all the packages (dependencies) our project uses.

### Install the core dependencies

```bash
npm install express mongoose cors dotenv ejs groq-sdk
npm install --save-dev nodemon
```

**What each package does:**

| Package | Purpose |
|---|---|
| `express` | The web server framework |
| `mongoose` | ODM (Object Data Mapper) for MongoDB — lets us define schemas and query the database with JavaScript |
| `cors` | Allows cross-origin requests (needed when the frontend and backend might be on different origins) |
| `dotenv` | Loads environment variables from a `.env` file so we don't hardcode secrets like API keys |
| `ejs` | The HTML templating engine |
| `groq-sdk` | Official Groq SDK to call the Groq AI API |
| `nodemon` | Dev tool — automatically restarts the server when you change a file |

### Create the `.env` file

```bash
# server/.env
PORT=5000
MONGO_URI=your_mongodb_atlas_connection_string
GROQ_API_KEY=your_groq_api_key
```

> ⚠️ **Important:** Never commit this file to GitHub. It contains secrets. Add it to `.gitignore`:

```bash
# server/.gitignore
/node_modules
/.env
```

### Update `package.json` scripts

```json
"scripts": {
  "start": "node index.js",
  "dev":   "nodemon index.js"
}
```

- `npm start` → used in production (Render will use this)
- `npm run dev` → used locally during development (nodemon auto-restarts on file changes)

---

## 4. Setting Up the Express Server

Create the main server file `server/index.js`:

```js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const Groq = require("groq-sdk");
require("dotenv").config(); // load .env variables FIRST

const app = express();
```

### Middleware setup

```js
app.use(cors());                          // allow cross-origin requests
app.use(express.json());                  // parse incoming JSON body (for fetch() calls)
app.use(express.urlencoded({ extended: true })); // parse traditional HTML form POST
```

Three middleware lines are needed because:
- `cors()` — the AI chat is called via `fetch()` from the browser, so CORS headers must be set
- `express.json()` — lets us read `req.body` when the request is sent as JSON (`fetch` with `Content-Type: application/json`)
- `express.urlencoded` — lets us read `req.body` when a traditional HTML `<form>` does a POST

---

## 5. Connecting MongoDB Atlas

### Why MongoDB Atlas?
Atlas is MongoDB's free cloud database service. Instead of running a database on your own machine, Atlas hosts it in the cloud. This means the database works both locally and on Render without any extra setup.

### Create a free cluster
1. Go to [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a free cluster
3. Add a database user (username + password)
4. Whitelist IP: `0.0.0.0/0` (allow all — needed for Render deployment)
5. Get your connection string and paste it into `.env` as `MONGO_URI`

### Connect in `index.js`

```js
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB error:", err));
```

Mongoose handles the connection pool automatically. We use `.then()` / `.catch()` to log whether the connection succeeded.

### Define Mongoose Schemas

A **schema** defines the shape of a document stored in MongoDB. We created three:

```js
// Volunteer Schema — stores volunteer registrations
const volunteerSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  experience: String,
  aiSuggestion: String,          // ← the AI-generated suggestion is stored here
  createdAt: { type: Date, default: Date.now },
});
const Volunteer = mongoose.model("Volunteer", volunteerSchema);

// Patient Schema — stores patient support requests
const patientSchema = new mongoose.Schema({
  name: String, phone: String, email: String, age: Number,
  city: String, supportType: String, history: String, income: String,
  createdAt: { type: Date, default: Date.now },
});
const Patient = mongoose.model("Patient", patientSchema);

// Contact Schema — stores general enquiries
const contactSchema = new mongoose.Schema({
  name: String, email: String, subject: String, message: String,
  createdAt: { type: Date, default: Date.now },
});
const Contact = mongoose.model("Contact", contactSchema);
```

Each `mongoose.model()` call creates a MongoDB **collection** automatically (e.g., `volunteers`, `patients`, `contacts`).

---

## 6. Installing EJS — The View Engine

### What is EJS?
EJS (Embedded JavaScript) is a templating engine. It lets you write HTML files with special `<%= variable %>` tags that get replaced with real data by the server before sending the page to the browser.

**Example:**
```html
<!-- views/success.ejs -->
<h1>Welcome, <%= name %>!</h1>
<p>Your AI suggestion: <%= aiSuggestion %></p>
```
When the server calls `res.render("success", { name: "Priya", aiSuggestion: "..." })`, EJS replaces `<%= name %>` with `Priya`.

### Configure EJS in Express

```js
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views")); // tell Express where to find .ejs files
```

### Serve static files (CSS, JS, images)

```js
app.use(express.static(path.join(__dirname, "public")));
```

This tells Express: "any file inside the `public/` folder can be accessed directly via URL." So `public/css/style.css` becomes accessible at `http://localhost:5000/css/style.css` — which is what the `<link>` tag in our HTML uses.

### Install EJS
```bash
npm install ejs
```

---

## 7. Building the UI

### Directory Structure

```
server/
├── views/
│   ├── index.ejs      ← the main page
│   └── success.ejs    ← shown after volunteer registers
└── public/
    ├── css/
    │   └── style.css  ← all styles
    └── js/
        └── main.js    ← all frontend JavaScript
```

---

### `index.ejs` — The Main Page

This is the biggest file and the heart of the UI. It contains four major sections:

**1. Navbar** — Sticky, frosted-glass effect. Links to the three main sections.

**2. Hero Section** — Large heading, tagline, two CTA buttons ("Register Now" and "Ask AI Assistant"), and a floating stats card showing: 2,400+ patients served, 380 volunteers, 14 clinic centres.

**3. Registration Section** — The most important part. Uses a **tab interface** with three tabs:

- 🏥 **Patient Support Tab** — Fields: Full Name, Age, Phone, Email, City, Support Type (dropdown with 7 options like General Consultation, Mental Health, Home Visit, etc.), Medical History (textarea), Income Category (for subsidy eligibility). JavaScript submits this via `fetch()` to `POST /api/patient`.

- 🤝 **Volunteer Tab** — Fields: Full Name, Profession, Email, Phone, City, Availability, Skills (checkboxes for 6 skill areas), Why do you want to volunteer (textarea). **This is the AI-powered tab** — on submit, the server calls Groq AI which generates a personalised role suggestion. Uses a traditional `<form>` POST to `/api/register` so EJS can render the success page.

- ✉️ **Contact Us Tab** — Fields: Name, Email, Subject (dropdown), Message. Submits via `fetch()` to `POST /api/contact`.

**4. AI Chat Section** — A chat interface with:
- Left sidebar: 7 pre-written FAQ chip buttons (e.g., "What free services do you offer?", "How do I register as a patient?")
- Right: a chat window with message bubbles, a typing indicator (three bouncing dots), and a text input with send button.

The chat maintains **full conversation history** — each new message includes all prior messages so the AI has context for follow-up questions.

**5. Services Section** — Six cards describing the NGO's core services:
Medical Consultations, Mental Health Support, Medicine Distribution, Home Visit Programme, Diagnostic Tests, Maternal & Child Health.

**6. Footer**

The EJS file also uses conditional rendering for error/success banners:
```html
<% if (error) { %>
  <div class="alert-error">⚠️ <%= error %></div>
<% } %>
```

---

### `success.ejs` — The AI Result Page

Rendered after a volunteer submits their form and the AI has generated their suggestion.

**Key elements:**
- Animated SVG checkmark (drawn via CSS `stroke-dashoffset` animation)
- Volunteer's name displayed dynamically: `Welcome, <%= name %>!`
- Their role: `You've joined as a <%= role %> volunteer.`
- The AI suggestion in a styled quote block: `<%= aiSuggestion %>`
- Two "next step" cards: Check email + Stay ready
- A link back to the homepage to register another volunteer

The EJS template receives these variables from the server:
```js
res.render("success", { name, role, aiSuggestion });
```

---

### `style.css` — The Design System

A full CSS file (~380 lines) defining the entire visual language of the app.

**Design philosophy:** Warm editorial aesthetic inspired by premium healthcare brands — earthy, trustworthy, human.

**CSS Variables (design tokens):**
```css
:root {
  --bg:      #f5f0e8;   /* warm off-white background */
  --bg2:     #ede7d9;   /* slightly darker background for cards */
  --card:    #fdfaf5;   /* card background */
  --ink:     #1a1410;   /* primary text — near black with warm tone */
  --ink2:    #4a3f35;   /* secondary text */
  --ink3:    #8a7a6e;   /* muted text, labels */
  --border:  #d9cfc3;   /* border color */
  --accent:  #c94f2c;   /* primary red-orange accent */
  --accent2: #e8734a;   /* hover state of accent */
  --green:   #3a7d5a;   /* success / online indicator */
}
```

**Notable CSS features used:**

- **Paper noise texture** — A subtle SVG noise pattern as a `body::before` pseudo-element gives the page a tactile, editorial feel
- **Frosted glass navbar** — `backdrop-filter: blur(14px)` with semi-transparent background
- **Tab system** — Pure CSS + JavaScript `.active` class toggling
- **Chat message bubbles** — Different border-radius for bot (top-left square) and user (top-right square) messages
- **SVG checkmark animation** — `stroke-dasharray` and `stroke-dashoffset` CSS animation on the success page
- **Smooth hover effects** — `transform: translateY(-4px)` on service cards, box-shadow transitions
- **Fully responsive** — CSS Grid columns collapse on mobile using `@media` queries at 900px and 640px

**Typography:**
```html
<!-- Loaded from Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
```
- **DM Serif Display** — Used for all headings. Elegant, editorial, trustworthy.
- **DM Sans** — Used for body text. Modern, clean, highly legible.

---

### `main.js` — The Frontend Logic

All vanilla JavaScript wrapped in an IIFE (`(function() { ... })()`) to avoid polluting the global scope.

**Tab switching:**
```js
window.switchTab = function (name, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("panel-" + name).classList.add("active");
  btn.classList.add("active");
};
```
Each tab button calls `switchTab('patient', this)` etc. The function removes `active` from everything, then adds it to the clicked tab and its matching panel.

**Loading state on buttons:**
```js
function setLoading(btn, isLoading, labelText) {
  btn.disabled = isLoading;
  btn.querySelector(".btn-label").textContent = labelText;
  btn.querySelector(".btn-spin").classList.toggle("hidden", !isLoading);
}
```
Every form button has a hidden CSS spinner (`.btn-spin`) and a text label (`.btn-label`). When a form is submitting, the button disables, the text changes to "Submitting…" and the spinner appears.

**Patient form submit (via fetch):**
```js
const res = await fetch("/api/patient", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, phone, email, age, city, supportType, history, income }),
});
const data = await res.json();
showToast("Patient registered! Our team will reach out within 24 hours.");
```

**Volunteer form submit (traditional POST for EJS rendering):**
The volunteer form needs the server to render `success.ejs` (which requires server-side template variables like `name`, `role`, `aiSuggestion`). A `fetch()` call alone can't trigger a page navigation to a server-rendered page, so after the fetch completes successfully, we programmatically submit a hidden HTML form:

```js
function submitFormNatively(fields) {
  const f = document.createElement("form");
  f.method = "POST"; f.action = "/api/register";
  Object.entries(fields).forEach(([k, v]) => {
    const inp = document.createElement("input");
    inp.type = "hidden"; inp.name = k; inp.value = v;
    f.appendChild(inp);
  });
  document.body.appendChild(f);
  f.submit(); // triggers a full page navigation → server renders success.ejs
}
```

**Chat logic:**
```js
const chatHistory = []; // stores conversation turns in memory

async function sendChat() {
  const text = input.value.trim();
  appendMessage("user", text);
  chatHistory.push({ role: "user", text });
  
  showTyping(); // show bouncing dots
  
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: text, history: chatHistory.slice(0, -1) }),
  });
  
  const { reply } = await res.json();
  hideTyping();
  chatHistory.push({ role: "bot", text: reply });
  appendMessage("bot", reply);
}
```

The `history` array sent to the server contains all previous turns so Groq can maintain context (e.g., if a user asks a follow-up question like "tell me more", the AI knows what "more" refers to).

---

## 8. API Routes — Full Explanation

All routes are defined in `server/index.js`.

---

### `GET /`

**Why:** Every web app needs a homepage. This is the entry point.

**How it works:**
```js
app.get("/", (req, res) => {
  res.render("index", { error: null, success: null });
});
```
When someone visits `http://localhost:5000`, Express calls `res.render("index", {...})`. EJS takes the `views/index.ejs` file, injects the variables (`error` and `success` are `null` by default so no banners show), and sends the resulting HTML to the browser.

---

### `POST /api/register`

**Why:** This is the volunteer registration route. It's the most feature-rich route because it also calls the AI.

**What it does (step by step):**

1. Extract form data from the request body:
```js
const { name, email, role, experience } = req.body;
```

2. Call Groq AI to generate a personalised deployment suggestion:
```js
const completion = await groq.chat.completions.create({
  model: "llama-3.3-70b-versatile",
  messages: [
    {
      role: "system",
      content: "You are an AI assistant for CareConnect healthcare NGO. Respond in exactly two sentences."
    },
    {
      role: "user",
      content: `Volunteer ${name} wants to join as ${role}. Experience: "${experience}". Suggest how they can best contribute.`
    }
  ],
  max_tokens: 150,
  temperature: 0.7,
});
const aiSuggestion = completion.choices[0].message.content.trim();
```

3. Save the volunteer + AI suggestion to MongoDB:
```js
await new Volunteer({ name, email, role, experience, aiSuggestion }).save();
```

4. Return the response — if the request came from `fetch()` (JSON Accept header), return JSON. Otherwise (traditional form POST), render the success EJS page:
```js
const isJSON = (req.headers["accept"] || "").includes("application/json");
if (isJSON) return res.status(201).json({ message: "Registration successful!", aiSuggestion });
res.render("success", { name, role, aiSuggestion });
```

**Why the dual response?** During the first `fetch()` call, we validate the data and get the AI suggestion. If successful, we then do a traditional form POST (which the browser treats as navigation), so the server renders the success page with the volunteer's name and AI suggestion embedded in the HTML.

---

### `POST /api/patient`

**Why:** Patients seeking medical support need to be registered in the system so the NGO team can follow up.

**What it does:**
```js
app.post("/api/patient", async (req, res) => {
  const { name, phone, email, age, city, supportType, history, income } = req.body;
  await new Patient({ name, phone, email, age, city, supportType, history, income }).save();
  res.json({ message: "Patient registered successfully!" });
});
```

Simple: extract all form fields, save to MongoDB, return a success message. The frontend then shows a toast notification ("✅ Patient registered!") without any page reload.

**Why no AI here?** The patient form collects sensitive medical information. An AI generating responses here could be misleading or inappropriate. The NGO staff should handle patient cases personally.

---

### `POST /api/contact`

**Why:** NGOs receive enquiries from journalists, donors, partners, and the general public. These need to be captured in the database.

**What it does:**
```js
app.post("/api/contact", async (req, res) => {
  const { name, email, subject, message } = req.body;
  await new Contact({ name, email, subject, message }).save();
  res.json({ message: "Message received!" });
});
```

Same pattern as patient — saves to MongoDB, returns success. The frontend shows a toast "✅ Message sent! We'll respond within 1–2 business days."

---

### `POST /api/chat`

**Why:** This is the AI chatbot route. Instead of NGO staff having to answer the same FAQ questions repeatedly ("What services do you offer?", "How do I register?", "Where are your centres?"), a Groq-powered AI handles these 24/7.

**How it works:**

```js
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body;

  // Build the full conversation for Groq
  const messages = [
    {
      role: "system",
      content: `You are a warm, helpful AI assistant for CareConnect — a healthcare NGO in India.
Answer questions about our services: free/subsidised medical consultations, mental health support,
medicine distribution, home visits, diagnostic tests, and maternal & child health care.
We have 14 clinic centres. Eligibility: BPL cardholders, low-income families, anyone in medical need.
Keep responses concise (2–4 sentences), friendly, and in English.`,
    },
    // Inject all prior conversation turns for context
    ...(history || []).map((h) => ({
      role: h.role === "bot" ? "assistant" : "user",
      content: h.text,
    })),
    // Add the new user message
    { role: "user", content: message },
  ];

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages,
    max_tokens: 200,
    temperature: 0.65,
  });

  const reply = completion.choices[0].message.content.trim();
  res.json({ reply });
});
```

**Key design decision — conversation history:** Groq's API (like all LLM APIs) is stateless — it doesn't remember previous messages. To make multi-turn conversation work (so the AI remembers what was said earlier in the chat), the frontend sends the full `history` array with every request. The server reconstructs the conversation from scratch for Groq each time.

**The `system` message** is a fixed instruction at the start of every conversation that tells Groq its persona, what it knows, and how to respond. This scopes the AI to only answer CareConnect-relevant questions.

---

## 9. AI Integration — Groq

### Why Groq?

Several AI providers were evaluated during development:

| Provider | Issue |
|---|---|
| Gemini (Google) | Free tier quota exhausted quickly; `gemini-1.5-flash` model name caused 404 errors |
| OpenAI | Requires paid account / credit card |
| Cohere | Very low free quota (1,000/month) |
| **Groq** ✅ | 14,400 requests/day free, no card needed, OpenAI-compatible API, fastest inference |

### Getting a Groq API Key

1. Go to [console.groq.com](https://console.groq.com)
2. Sign up with Google or email (free, no credit card)
3. Go to **API Keys** → **Create API Key**
4. Copy the key — it starts with `gsk_`
5. Add it to `server/.env`:
```
GROQ_API_KEY=gsk_your_key_here
```

### Installing the Groq SDK

```bash
cd server
npm install groq-sdk
```

### Initialising Groq in the Server

```js
const Groq = require("groq-sdk");
const groq = new Groq({ apiKey: process.env.GEMINI_API_KEY });
const GROQ_MODEL = "llama-3.3-70b-versatile";
```

We use `llama-3.3-70b-versatile` because:
- 70 billion parameters → high quality responses
- "versatile" variant → balanced between speed and quality
- Well within the free tier's TPM (tokens per minute) limits

### How the Groq API Call Works

```js
const completion = await groq.chat.completions.create({
  model: GROQ_MODEL,
  messages: [
    { role: "system",    content: "..." },  // context/instructions
    { role: "user",      content: "..." },  // user's question
    { role: "assistant", content: "..." },  // (optional) previous AI responses
  ],
  max_tokens: 200,     // cap the response length
  temperature: 0.65,   // 0 = deterministic, 1 = creative. 0.65 = balanced
});

const reply = completion.choices[0].message.content.trim();
```

The `choices[0]` is because Groq can return multiple response candidates (`n` parameter), but we only request one (default). `.message.content` is the actual text response. `.trim()` removes any leading/trailing whitespace.

---

## 10. Running the App Locally

### Prerequisites
- Node.js installed (v18+)
- A MongoDB Atlas account with a free cluster
- A Groq API key

### Setup

```bash
# 1. Clone or navigate to the project
cd CareConnect/server

# 2. Install all dependencies
npm install

# 3. Create the .env file
# (create server/.env with the following content)
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/careconnect
GROQ_API_KEY=gsk_your_key_here

# 4. Start the development server
npm run dev
```

You should see:
```
🚀 Server running at http://localhost:5000
✅ Connected to MongoDB
```

Open **[http://localhost:5000](http://localhost:5000)** in your browser.

### Testing Individual Routes

**Test the chat API:**
```js
// test-chat.js (run with: node test-chat.js)
const http = require("http");
const body = JSON.stringify({ message: "What free services do you offer?", history: [] });
const options = { hostname: "localhost", port: 5000, path: "/api/chat", method: "POST",
  headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } };
const req = http.request(options, (res) => {
  let data = ""; res.on("data", c => data += c);
  res.on("end", () => console.log("REPLY:", data));
});
req.write(body); req.end();
```

Expected output:
```
REPLY: {"reply":"At CareConnect, we offer free and subsidised medical consultations, mental health support..."}
```

---

## 11. Pushing to GitHub

### Why GitHub?
- Assignment requires a GitHub link
- Render (our hosting platform) deploys directly from GitHub — every `git push` can trigger a new deployment

### Create a new GitHub repository
1. Go to [github.com](https://github.com) → New Repository
2. Name it `CareConnect` → Public → Create
3. Copy the remote URL

### Initialise and push

```bash
# From CareConnect/ root directory

git init
git add .
git commit -m "feat: initial CareConnect healthcare NGO web app"
git branch -M main
git remote add origin https://github.com/yourusername/CareConnect.git
git push -u origin main
```

### What gets pushed (and what doesn't)

**Committed to GitHub ✅**
```
CareConnect/
├── README.md
├── render.yaml          ← deployment config for Render
├── WALKTHROUGH.md       ← this file
└── server/
    ├── index.js
    ├── package.json
    ├── package-lock.json
    ├── .gitignore
    ├── views/
    │   ├── index.ejs
    │   └── success.ejs
    └── public/
        ├── css/style.css
        └── js/main.js
```

**NOT committed (in `.gitignore`) ❌**
```
server/node_modules/    ← too large, regenerated with npm install
server/.env             ← contains API keys and DB credentials — NEVER commit this
```

### Future updates

For every change made after the initial push:
```bash
git add .
git commit -m "fix: describe what you changed"
git push origin main
```

---

## 12. Deploying to Render

### Why Render?
- Free tier supports Node.js web services (not just static sites)
- Connects directly to GitHub — auto-deploys on every `git push`
- Environment variables are set securely in the dashboard (so `.env` stays off GitHub)
- Provides a real HTTPS URL (required for the assignment's "live hosted link")

### The `render.yaml` file

We created a `render.yaml` in the project root to give Render the deployment configuration:

```yaml
services:
  - type: web
    name: careconnect
    runtime: node
    rootDir: server        # ← our server code is in the /server subdirectory
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: MONGO_URI
        sync: false        # sync: false = must be set manually in the dashboard
      - key: GROQ_API_KEY
        sync: false
```

`rootDir: server` is critical — it tells Render that our `package.json` and `index.js` are inside the `server/` folder, not the repo root.

### Deployment Steps

**Step 1:** Go to [render.com](https://render.com) → Sign up (free)

**Step 2:** New → Web Service → Connect GitHub → Select `CareConnect`

**Step 3:** Fill in settings:

| Setting | Value |
|---|---|
| Name | `careconnect` |
| Root Directory | `server` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Instance Type | `Free` |

**Step 4:** Add Environment Variables (in the "Environment" tab):

| Key | Value |
|---|---|
| `MONGO_URI` | Your MongoDB Atlas connection string |
| `GROQ_API_KEY` | `gsk_your_key_here` |

> Do NOT add `PORT` — Render injects this automatically.

**Step 5:** Click **Create Web Service** → Render runs `npm install` then `npm start`

Build logs will show:
```
==> Running build command: npm install
==> Starting service with: npm start
🚀 Server running at http://0.0.0.0:5000
✅ Connected to MongoDB
```

Your live URL: `https://careconnect.onrender.com` (or similar)

### Free Tier Limitation
On Render's free tier, the service **sleeps after 15 minutes of inactivity**. The first request after sleep takes ~30 seconds to wake up. This is normal — for a demo/internship submission it's perfectly fine. Paid plans keep the service always-on.

---

## 13. Final Project Structure

```
CareConnect/
│
├── README.md              ← Project overview, tech stack, how to run
├── WALKTHROUGH.md         ← This file
├── render.yaml            ← Render deployment configuration
│
└── server/
    ├── .env               ← Secret keys (NOT in GitHub)
    ├── .gitignore         ← node_modules, .env
    ├── index.js           ← Express server: middleware, DB, all routes, Groq AI
    ├── package.json       ← Dependencies + npm scripts
    ├── package-lock.json  ← Exact dependency versions (auto-generated)
    │
    ├── views/             ← EJS HTML templates (server renders these)
    │   ├── index.ejs      ← Main page: hero, tabs, chat, services
    │   └── success.ejs    ← Volunteer registration success + AI suggestion
    │
    └── public/            ← Static files (browser loads these directly)
        ├── css/
        │   └── style.css  ← All styles: design tokens, layout, components, responsive
        └── js/
            └── main.js    ← Tab switching, form handlers, fetch() calls, chat logic
```

### All API Routes Summary

| Method | Route | Description | AI? | DB? |
|---|---|---|---|---|
| `GET` | `/` | Render the homepage | No | No |
| `POST` | `/api/register` | Volunteer registration | ✅ Groq generates suggestion | ✅ Saves to MongoDB |
| `POST` | `/api/patient` | Patient support request | No | ✅ Saves to MongoDB |
| `POST` | `/api/contact` | General contact/enquiry | No | ✅ Saves to MongoDB |
| `POST` | `/api/chat` | Live AI chatbot | ✅ Groq chat completions | No |

### Dependencies

```json
{
  "dependencies": {
    "cors": "^2.8.6",
    "dotenv": "^17.3.1",
    "ejs": "^3.1.10",
    "express": "^5.2.1",
    "groq-sdk": "^0.x.x",
    "mongoose": "^9.3.3"
  },
  "devDependencies": {
    "nodemon": "^3.1.14"
  }
}
```

---

*Built for CareConnect Healthcare NGO · Internship Assignment Submission · March 2026*
