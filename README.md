# 🥗 AI Health Coach

Track your meals and calories effortlessly through a conversational chat interface. Powered by OpenAI + Nutritionix, this app estimates and logs your daily food intake, automatically calculates calories, and keeps a daily food history — all with no login required.

---

## 💡 Project Summary

This is a take-home challenge for the AI Developer position. The goal was to build a robust calorie-tracking app powered by an LLM that:

- Accepts user meal input in free text via chat
- Parses and understands vague or complex inputs
- Estimates and logs calorie intake
- Tracks and displays daily summaries and history

---

## 🧠 Tech Stack

| Area             | Stack                       |
|------------------|-----------------------------|
| Framework        | Next.js (with App Router)   |
| UI Library       | React + Tailwind CSS         |
| Language         | JavaScript (No TypeScript)  |
| LLM              | OpenAI GPT-4o (via API)     |
| Nutrition Data   | Nutritionix API             |
| State Persistence| localStorage                |

---

## 🚀 Running the Project

1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/ai-health-coach.git
cd ai-health-coach

2. Install dependencies
npm install
npm install openai

3. Set environment variables
Create a .env.local file:

platform.openai.com
NEXT_PUBLIC_OPENAI_API_KEY=your_openai_key

https://developer.nutritionix.com/
NEXT_PUBLIC_NUTRITIONIX_APP_ID=your_app_id
NEXT_PUBLIC_NUTRITIONIX_APP_KEY=your_app_key

4. Run the app locally
npm run dev

Then open http://localhost:3000 in your browser.
