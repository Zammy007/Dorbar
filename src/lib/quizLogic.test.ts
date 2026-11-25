import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatCountdown,
  gradeQuizSubmission,
  normalizeQuestionHash,
  validateQuizQuestions,
} from './quizLogic';

test('validateQuizQuestions keeps valid unique 4-option single-answer questions and rejects invalid or duplicates', () => {
  const existing = new Set([normalizeQuestionHash('What is the SI unit of force?')]);
  const result = validateQuizQuestions(
    [
      {
        questionText: 'What is the SI unit of force?',
        explanation: 'Newton is the SI unit.',
        options: [
          { label: 'A', text: 'Newton', isCorrect: true },
          { label: 'B', text: 'Joule', isCorrect: false },
          { label: 'C', text: 'Watt', isCorrect: false },
          { label: 'D', text: 'Pascal', isCorrect: false },
        ],
      },
      {
        questionText: 'Which organelle is known as the powerhouse of the cell?',
        explanation: 'Mitochondria synthesize ATP during cellular respiration.',
        options: [
          { label: 'A', text: 'Ribosome', isCorrect: false },
          { label: 'B', text: 'Mitochondria', isCorrect: true },
          { label: 'C', text: 'Golgi apparatus', isCorrect: false },
          { label: 'D', text: 'Lysosome', isCorrect: false },
        ],
      },
      {
        questionText: 'Invalid multiple correct answers question here?',
        explanation: 'Has two correct options.',
        options: [
          { label: 'A', text: 'One', isCorrect: true },
          { label: 'B', text: 'Two', isCorrect: true },
          { label: 'C', text: 'Three', isCorrect: false },
          { label: 'D', text: 'Four', isCorrect: false },
        ],
      },
    ],
    existing
  );

  assert.equal(result.valid.length, 1);
  assert.equal(result.rejectedCount, 2);
  assert.equal(result.valid[0].questionText, 'Which organelle is known as the powerhouse of the cell?');
});

test('gradeQuizSubmission computes accurate scores and percentages', () => {
  const result = gradeQuizSubmission(
    [
      { id: 1, correctOptionId: 10 },
      { id: 2, correctOptionId: 21 },
      { id: 3, correctOptionId: 33 },
      { id: 4, correctOptionId: 40 },
    ],
    [
      { questionId: 1, selectedOptionId: 10 },
      { questionId: 2, selectedOptionId: 22 },
      { questionId: 3, selectedOptionId: 33 },
    ]
  );

  assert.equal(result.score, 2);
  assert.equal(result.totalQuestions, 4);
  assert.equal(result.percentage, 50);
  assert.equal(result.graded[3].selectedOptionId, null);
  assert.equal(result.graded[3].isCorrect, false);
});

test('formatCountdown formats mm:ss and clamps negatives', () => {
  assert.equal(formatCountdown(305), '05:05');
  assert.equal(formatCountdown(9), '00:09');
  assert.equal(formatCountdown(-12), '00:00');
});
