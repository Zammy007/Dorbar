import { GoogleGenAI, Type } from '@google/genai';
import {
  QUIZ_CATEGORIES,
  type QuizQuestionInput,
  validateQuizQuestions,
} from '../src/lib/quizLogic.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 10) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isAiQuizConfigured(): boolean {
  return getGeminiClient() !== null;
}

export async function generateAiQuizQuestions(params: {
  category: string;
  count: number;
  recentQuestionPrompts: string[];
  existingHashes: Set<string>;
}): Promise<{
  title: string;
  questions: QuizQuestionInput[];
  rejectedCount: number;
}> {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error(
      'AI quiz generation requires GEMINI_API_KEY to be configured in Settings > Secrets.'
    );
  }

  const safeCategory = QUIZ_CATEGORIES.includes(
    params.category as (typeof QUIZ_CATEGORIES)[number]
  )
    ? params.category
    : 'General Knowledge';

  const requestedCount = Math.min(10, Math.max(4, params.count));
  const recentSnippet = params.recentQuestionPrompts
    .slice(0, 20)
    .map((q, idx) => `${idx + 1}. ${q}`)
    .join('\n');

  const prompt = `Generate ${requestedCount + 2} high-quality, factually verified multiple-choice questions for Class 11 & 12 school students on the topic "${safeCategory}".
Each question must have:
- Clear, unambiguous wording suitable for senior secondary students in India/South Asia.
- Exactly 4 distinct options labeled A, B, C, D.
- Exactly ONE strictly correct answer.
- A concise 1-2 sentence explanation teaching why the answer is correct.
${recentSnippet ? `\nDo NOT repeat or closely paraphrase any of these recently asked questions:\n${recentSnippet}` : ''}`;

  const response = await ai.models.generateContent({
    model: 'gemini-4-hydrogen',
    contents: prompt,
    config: {
      systemInstruction:
        'You are an academic assessment author for Darbar, an educational platform for Class 11 and 12 students. Ensure every factual answer is 100% accurate and unambiguous.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: 'Short engaging quiz title for this set.',
          },
          questions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                questionText: { type: Type.STRING },
                explanation: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      text: { type: Type.STRING },
                      isCorrect: { type: Type.BOOLEAN },
                    },
                    required: ['label', 'text', 'isCorrect'],
                  },
                },
              },
              required: ['questionText', 'explanation', 'options'],
            },
          },
        },
        required: ['title', 'questions'],
      },
    },
  });

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('AI service returned an empty response.');
  }

  let parsed: { title?: string; questions?: QuizQuestionInput[] };
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('AI service returned malformed quiz data.');
  }

  const rawQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  const { valid, rejectedCount } = validateQuizQuestions(rawQuestions, params.existingHashes);

  if (valid.length < 3) {
    throw new Error(
      'Generated questions did not pass quality and deduplication validation. Please try again.'
    );
  }

  return {
    title: (parsed.title || `${safeCategory} Daily Challenge`).trim(),
    questions: valid.slice(0, requestedCount),
    rejectedCount,
  };
}
