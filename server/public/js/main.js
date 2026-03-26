/**
 * CareConnect – main.js
 * Handles: tab switching, patient form, contact form, volunteer form,
 *          Gemini AI chat with conversation history.
 */
(function () {
  "use strict";

  /* ══════════════════════════════════════════════════════
     TABS
  ══════════════════════════════════════════════════════ */
  window.switchTab = function (name, btn) {
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    const panel = document.getElementById("panel-" + name);
    if (panel) panel.classList.add("active");
    if (btn)   btn.classList.add("active");
  };

  /* ══════════════════════════════════════════════════════
     TOAST
  ══════════════════════════════════════════════════════ */
  function showToast(msg, isError) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = (isError ? "⚠️ " : "✅ ") + msg;
    toast.style.background = isError ? "#dc2626" : "";
    toast.classList.add("show");
    setTimeout(() => { toast.classList.remove("show"); toast.style.background = ""; }, 4000);
  }

  /* ══════════════════════════════════════════════════════
     PATIENT FORM
  ══════════════════════════════════════════════════════ */
  window.submitPatient = async function () {
    const name      = document.getElementById("p-name")?.value.trim();
    const phone     = document.getElementById("p-phone")?.value.trim();
    const email     = document.getElementById("p-email")?.value.trim();
    const age       = document.getElementById("p-age")?.value.trim();
    const city      = document.getElementById("p-city")?.value.trim();
    const support   = document.getElementById("p-support")?.value;
    const history   = document.getElementById("p-history")?.value.trim();
    const income    = document.getElementById("p-income")?.value;

    if (!name || !phone || !support) {
      showToast("Please fill in Name, Phone, and Support Type.", true);
      return;
    }

    const btn = document.getElementById("patient-submit-btn");
    setLoading(btn, true, "Submitting…");

    try {
      const res = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, age, city, supportType: support, history, income }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed.");
      showToast("Patient registered! Our team will reach out within 24 hours.");
      document.querySelectorAll("#panel-patient input, #panel-patient select, #panel-patient textarea")
        .forEach(el => { el.value = el.tagName === "SELECT" ? el.options[0]?.value || "" : ""; });
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setLoading(btn, false, "Submit Registration →");
    }
  };

  /* ══════════════════════════════════════════════════════
     VOLUNTEER FORM (EJS form → POST to /api/register)
  ══════════════════════════════════════════════════════ */
  const volForm = document.getElementById("volunteer-form");
  if (volForm) {
    volForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const name       = document.getElementById("v-name")?.value.trim();
      const email      = document.getElementById("v-email")?.value.trim();
      const role       = document.getElementById("v-role")?.value;
      const experience = document.getElementById("v-exp")?.value.trim();

      if (!name || !email || !experience) {
        showToast("Please fill in Name, Email, and Experience.", true);
        return;
      }

      const btn = document.getElementById("volunteer-submit-btn");
      setLoading(btn, true, "Analyzing with AI…");

      try {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify({ name, email, role, experience }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Registration failed.");

        // Re-submit as form POST so EJS success page renders
        submitFormNatively({ name, email, role, experience });
      } catch (err) {
        setLoading(btn, false, "Apply as Volunteer →");
        showToast(err.message, true);
      }
    });
  }

  function submitFormNatively(fields) {
    const f = document.createElement("form");
    f.method = "POST"; f.action = "/api/register";
    Object.entries(fields).forEach(([k, v]) => {
      const inp = document.createElement("input");
      inp.type = "hidden"; inp.name = k; inp.value = v;
      f.appendChild(inp);
    });
    document.body.appendChild(f);
    f.submit();
  }

  /* ══════════════════════════════════════════════════════
     CONTACT FORM
  ══════════════════════════════════════════════════════ */
  window.submitContact = async function () {
    const name    = document.getElementById("c-name")?.value.trim();
    const email   = document.getElementById("c-email")?.value.trim();
    const subject = document.getElementById("c-subject")?.value;
    const message = document.getElementById("c-msg")?.value.trim();

    if (!name || !email || !message) {
      showToast("Please fill in Name, Email, and Message.", true);
      return;
    }

    const btn = document.getElementById("contact-submit-btn");
    setLoading(btn, true, "Sending…");

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, subject, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Send failed.");
      showToast("Message sent! We'll respond within 1–2 business days.");
      ["c-name","c-email","c-msg"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
      });
    } catch (err) {
      showToast(err.message, true);
    } finally {
      setLoading(btn, false, "Send Message →");
    }
  };

  /* ══════════════════════════════════════════════════════
     BUTTON LOADING STATE
  ══════════════════════════════════════════════════════ */
  function setLoading(btn, isLoading, labelText) {
    if (!btn) return;
    const label  = btn.querySelector(".btn-label");
    const spinner = btn.querySelector(".btn-spin");
    btn.disabled = isLoading;
    if (label)   label.textContent = labelText;
    if (spinner) spinner.classList.toggle("hidden", !isLoading);
  }

  /* ══════════════════════════════════════════════════════
     CHAT
  ══════════════════════════════════════════════════════ */
  // Conversation history for Gemini multi-turn context
  const chatHistory = [];

  window.sendFAQ = function (question) {
    const input = document.getElementById("chatInput");
    if (input) input.value = question;
    sendChat();
    const section = document.getElementById("assistant");
    if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  window.sendChat = async function () {
    const input   = document.getElementById("chatInput");
    const sendBtn = document.getElementById("sendBtn");
    const text    = input?.value.trim();
    if (!text || sendBtn?.disabled) return;

    input.value = "";
    appendMessage("user", text);
    chatHistory.push({ role: "user", text });

    sendBtn.disabled = true;
    showTyping();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history: chatHistory.slice(0, -1) }),
      });
      const data = await res.json();
      hideTyping();

      if (!res.ok) throw new Error(data.error || "AI is temporarily unavailable.");

      const reply = data.reply || "I'm not sure about that. Please contact our team via the form above.";
      chatHistory.push({ role: "model", text: reply });
      appendMessage("bot", reply);
    } catch (err) {
      hideTyping();
      const fallback = err.message || "I'm temporarily offline. Please fill the registration form and our team will reach out!";
      appendMessage("bot", fallback);
    } finally {
      sendBtn.disabled = false;
      input?.focus();
    }
  };

  function appendMessage(role, text) {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "msg " + role;
    div.innerHTML = `
      <div class="msg-av">${role === "bot" ? "🤖" : "👤"}</div>
      <div class="msg-bubble">${escapeHTML(text).replace(/\n/g, "<br>")}</div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function showTyping() {
    const container = document.getElementById("chatMessages");
    if (!container) return;
    const div = document.createElement("div");
    div.className = "msg bot"; div.id = "typing-indicator";
    div.innerHTML = `<div class="msg-av">🤖</div><div class="msg-bubble"><div class="typing-dots"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div></div>`;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function hideTyping() {
    document.getElementById("typing-indicator")?.remove();
  }

  function escapeHTML(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

})();
