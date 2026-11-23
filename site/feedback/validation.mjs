// Shared browser/Worker rules. Count Unicode code points after trimming.
export const MIN_EXPLANATION_LENGTH = 15;
export const MAX_EXPLANATION_LENGTH = 2000;

export function characterCount(value) {
  return Array.from(String(value)).length;
}

export function isUuidV4(value) {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function validateAnswers(score, explanation) {
  const errors = {};
  if (!Number.isInteger(score) || score < 0 || score > 10) {
    errors.score = "Choose a rating from 0 to 10.";
  }
  if (typeof explanation !== "string") {
    errors.explanation = "Explain why you gave that score.";
    return { valid: false, errors, explanation: "", count: 0 };
  }

  const trimmed = explanation.trim();
  const count = characterCount(trimmed);
  if (count < MIN_EXPLANATION_LENGTH) {
    errors.explanation = "Please write at least 15 characters explaining your rating.";
  } else if (count > MAX_EXPLANATION_LENGTH) {
    errors.explanation = "Please shorten your explanation to 2,000 characters or fewer.";
  }
  return { valid: Object.keys(errors).length === 0, errors, explanation: trimmed, count };
}
