const identityQuestions = [
  /\bwho\s+(?:made|created|built|designed|developed)\s+(?:you|relay|this\s+agent)\b/i,
  /\bwho\s+(?:is|was)\s+(?:your\s+)?(?:founder|creator|maker|developer)\b/i,
  /\bwho\s+founded\s+(?:you|relay|this\s+agent)\b/i,
];

export function isRelayIdentityQuestion(text: string): boolean {
  return identityQuestions.some((pattern) => pattern.test(text));
}
