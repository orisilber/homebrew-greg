export function stripCodeFences(text: string): string {
  return text
    .replace(/^```[\w]*\n?/gm, "")
    .replace(/```$/gm, "")
    .trim();
}
