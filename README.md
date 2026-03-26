# CareConnect — Healthcare Support Portal

A Mini Healthcare Support Web App built for the Jarurat Care NGO internship assignment.

## 🌐 Live Demo
> [Deployed on Render] — **https://careconnect-7xnt.onrender.com**

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Node.js, Express.js |
| **Templating** | EJS (Embedded JavaScript) |
| **Styling** | Vanilla CSS (warm earth-tone design) |
| **Client Logic** | Vanilla JavaScript |
| **Database** | MongoDB Atlas |
| **AI** | Groq API — `llama-3.3-70b-versatile` |

## 🤖 AI Idea — Two AI Features

### 1. Volunteer Role Matcher (on registration)
When a volunteer submits their form, Groq AI reads their name, selected role, and experience description and **generates a personalised 2-sentence deployment suggestion** — telling them exactly how they can best contribute to the NGO.

### 2. Live Healthcare FAQ Chatbot
A real-time chat assistant on the homepage powered by Groq's Llama 3.3 model. Users can ask about:
- Free services and eligibility
- How to register as a patient or volunteer
- Clinic locations, home visits, donations
- General health and NGO support queries

The bot maintains **multi-turn conversation history** so follow-up questions work naturally.

## 🏥 NGO Use Case
Jarurat Care serves rural and underserved communities by:
- Connecting patients with free medical consultations, mental health support, and medicines
- Matching skilled volunteers to the right roles via AI
- Operating 14 clinic centres with home visit programmes

## 🚀 Running Locally

```bash
cd server
npm install
# Add .env file with your keys (see below)
npm run dev
```

**`.env` file (in `/server`):**
```
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
GROQ_API_KEY=your_groq_api_key
```

Then open **http://localhost:5000**

## 📁 Project Structure

```
CareConnect/
└── server/
    ├── views/
    │   ├── index.ejs      ← Landing page + registration tabs + chatbot
    │   └── success.ejs    ← AI suggestion result page
    ├── public/
    │   ├── css/style.css  ← Premium earth-tone design system
    │   └── js/main.js     ← Form handlers + chat logic
    ├── index.js           ← Express server + all API routes
    └── package.json
```

## 📡 API Routes

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Render homepage |
| `POST` | `/api/register` | Volunteer registration + Groq AI suggestion |
| `POST` | `/api/patient` | Patient support registration |
| `POST` | `/api/contact` | Contact form submission |
| `POST` | `/api/chat` | Live Groq AI chatbot |

---
Built with ❤️ · Submission for Jarurat Care NGO Internship · March 2026
