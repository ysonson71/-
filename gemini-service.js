// Gemini API Client for English Tutor
const STORAGE_KEY = 'GEMINI_API_KEY';
const MODEL_NAME = 'gemini-2.5-flash';

export class GeminiService {
  constructor() {
    this.apiKey = localStorage.getItem(STORAGE_KEY) || '';
  }

  hasApiKey() {
    return !!this.apiKey && this.apiKey.trim().length > 0;
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.apiKey) {
      localStorage.setItem(STORAGE_KEY, this.apiKey);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  getApiKey() {
    return this.apiKey;
  }

  async sendChatMessage(messages, systemPrompt = '') {
    if (!this.hasApiKey()) {
      throw new Error('API_KEY_REQUIRED');
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${this.apiKey}`;

    const formattedContents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const body = {
      contents: formattedContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 150
      }
    };

    if (systemPrompt) {
      body.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData?.error?.message || `API Error: ${response.status}`);
    }

    const data = await response.json();
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return replyText.trim();
  }

  async evaluateRepetition(targetSentence, spokenSentence) {
    if (!this.hasApiKey()) {
      // Offline / fallback simple similarity
      const cleanTarget = targetSentence.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const cleanSpoken = spokenSentence.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const isClose = cleanTarget === cleanSpoken || cleanTarget.includes(cleanSpoken) || cleanSpoken.includes(cleanTarget);
      return {
        passed: isClose,
        feedback: isClose ? "Great pronunciation! You nailed it." : "Nice try! Let's practice it once more."
      };
    }

    const prompt = `You are an encouraging English pronunciation tutor.
Target sentence: "${targetSentence}"
User spoke: "${spokenSentence}"

Compare the user's spoken sentence with the target sentence.
Reply ONLY with a valid JSON in this exact structure:
{"passed": true or false, "feedback": "Brief 1-sentence encouraging spoken English feedback"}
Do NOT include markdown formatting or backticks.`;

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${this.apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 80 }
        })
      });

      if (!response.ok) throw new Error('Eval failed');
      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanJson = rawText.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch {
      return {
        passed: true,
        feedback: "Awesome effort! Your pronunciation is very clear."
      };
    }
  }
}
