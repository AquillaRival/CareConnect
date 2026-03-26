const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
const Groq = require("groq-sdk");
require("dotenv").config();

const app = express();

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── View Engine (EJS) ────────────────────────────────────────────────────────
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ─── Static Assets ────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ─── Groq AI ──────────────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = "llama-3.3-70b-versatile";

// ─── MongoDB ──────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Volunteer Schema
const volunteerSchema = new mongoose.Schema({
  name: String, email: String, role: String,
  experience: String, aiSuggestion: String,
  createdAt: { type: Date, default: Date.now },
});
const Volunteer = mongoose.model("Volunteer", volunteerSchema);

// Patient Schema
const patientSchema = new mongoose.Schema({
  name: String, phone: String, email: String, age: Number,
  city: String, supportType: String, history: String, income: String,
  createdAt: { type: Date, default: Date.now },
});
const Patient = mongoose.model("Patient", patientSchema);

// Contact Schema
const contactSchema = new mongoose.Schema({
  name: String, email: String, subject: String, message: String,
  createdAt: { type: Date, default: Date.now },
});
const Contact = mongoose.model("Contact", contactSchema);

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// Home
app.get("/", (req, res) => {
  res.render("index", { error: null, success: null });
});

// ── Volunteer Registration + AI Suggestion ────────────────────────────────────
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, role, experience } = req.body;

    // Groq: generate AI deployment suggestion
    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages: [
        {
          role: "system",
          content: "You are an AI assistant for Jarurat Care, a healthcare NGO in India. Be specific and helpful. Respond in exactly two sentences.",
        },
        {
          role: "user",
          content: `A volunteer named ${name} wants to join as a ${role}. Their experience: "${experience}". Suggest a specific, helpful way they can contribute to the NGO based on their skills.`,
        },
      ],
      max_tokens: 150,
      temperature: 0.7,
    });

    const aiSuggestion = completion.choices[0]?.message?.content?.trim() || "We look forward to having you on board!";

    await new Volunteer({ name, email, role, experience, aiSuggestion }).save();

    const isJSON = (req.headers["accept"] || "").includes("application/json");
    if (isJSON) return res.status(201).json({ message: "Registration successful!", aiSuggestion });

    res.render("success", { name, role, aiSuggestion });
  } catch (error) {
    console.error("Error in /api/register:", error.message);
    const isJSON = (req.headers["accept"] || "").includes("application/json");
    if (isJSON) return res.status(500).json({ error: "Something went wrong." });
    res.render("index", { error: "Registration failed. Please try again.", success: null });
  }
});

// ── Patient Registration ──────────────────────────────────────────────────────
app.post("/api/patient", async (req, res) => {
  try {
    const { name, phone, email, age, city, supportType, history, income } = req.body;
    await new Patient({ name, phone, email, age, city, supportType, history, income }).save();
    res.json({ message: "Patient registered successfully!" });
  } catch (error) {
    console.error("Error in /api/patient:", error.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// ── Contact Form ──────────────────────────────────────────────────────────────
app.post("/api/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    await new Contact({ name, email, subject, message }).save();
    res.json({ message: "Message received!" });
  } catch (error) {
    console.error("Error in /api/contact:", error.message);
    res.status(500).json({ error: "Something went wrong." });
  }
});

// ── AI Chat (Groq) ────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required." });

    // Build messages array with conversation history
    const messages = [
      {
        role: "system",
        content: `You are a warm, helpful AI assistant for Jarurat Care — a healthcare NGO in India.
Answer questions about our services: free/subsidised medical consultations, mental health support,
medicine distribution, home visits, diagnostic tests, and maternal & child health care.
We have 14 clinic centres. Eligibility: BPL cardholders, low-income families, anyone in medical need.
Volunteers can register online. Donations are accepted.
Keep responses concise (2–4 sentences), friendly, and in English.`,
      },
      // Inject conversation history for multi-turn context
      ...(history || []).map((h) => ({
        role: h.role === "bot" ? "assistant" : "user",
        content: h.text,
      })),
      { role: "user", content: message },
    ];

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      max_tokens: 200,
      temperature: 0.65,
    });

    const reply = completion.choices[0]?.message?.content?.trim() || "I'm not sure about that. Please contact our team via the form above.";
    res.json({ reply });
  } catch (error) {
    console.error("Error in /api/chat:", error.message);
    res.status(500).json({ error: "AI is temporarily unavailable. Please try again." });
  }
});

// ─── Start Server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
