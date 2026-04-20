import { GoogleGenAI } from "@google/genai";

async function runTest() {
  console.log("Starting test with gemini-3.1-pro-preview...");
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
      console.log("API KEY MISSING");
  }
  const ai = new GoogleGenAI({ apiKey: apiKey || '' });
  try {
      const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: "Return a tiny JSON array like: [].",
      });
      console.log("SUCCESS. Response:", response.text);
  } catch (e: any) {
      console.error("FAIL:", e.status, e.message);
  }
}
runTest();
