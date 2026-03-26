const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("Connected to MongoDB successfully!"))
  .catch((err) => console.error("MongoDB connection error:", err));

// Mongoose Schema & Model
const volunteerSchema = new mongoose.Schema({
  name: String,
  email: String,
  role: String,
  experience: String,
  aiSuggestion: String,
  createdAt: { type: Date, default: Date.now },
});

const Volunteer = mongoose.model("Volunteer", volunteerSchema);

// --- ROUTES ---

// Test Route
app.get("/", (req, res) => {
  res.send("Healthcare API is running...");
});

// Registration & AI Route
app.post("/api/register", async (req, res) => {
  try {
    const { name, email, role, experience } = req.body;

    // 1. Construct the prompt for Gemini
    const prompt = `You are an AI assistant for a healthcare NGO. A volunteer named ${name} wants to join as a ${role}. Their experience is: "${experience}". In exactly two sentences, suggest a specific, helpful way they can contribute to the NGO based on their skills.`;

    // 2. Call the Gemini API
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const aiSuggestion = result.response.text();

    // 3. Save to MongoDB
    const newVolunteer = new Volunteer({
      name,
      email,
      role,
      experience,
      aiSuggestion,
    });

    await newVolunteer.save();

    // 4. Send response back to frontend
    res.status(201).json({
      message: "Registration successful!",
      volunteer: newVolunteer,
    });
  } catch (error) {
    console.error("Error in /api/register:", error);
    res.status(500).json({ error: "Something went wrong on the server." });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
