function normalizeGrade(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((token) => token && token !== "de" && token !== "o" && token !== "a");
}

function gradeNumber(token: string | undefined) {
  if (!token) return null;
  const numeric = token.match(/^([1-6])(?:ro|do|to|er|o|a)?$/);
  if (numeric) return Number(numeric[1]);
  const words: Record<string, number> = {
    primero: 1,
    segundo: 2,
    tercero: 3,
    cuarto: 4,
    quinto: 5,
    sexto: 6,
  };
  return words[token] ?? (Number.isInteger(Number(token)) ? Number(token) : null);
}

export function isEnglishTimeApplicable(gradeName: string | null | undefined, schoolYear: number | null | undefined) {
  if (schoolYear !== 2027) return false;
  const tokens = normalizeGrade(gradeName);
  if (tokens.length < 2) return false;
  const level = tokens[tokens.length - 1];
  const grade = gradeNumber(tokens[tokens.length - 2]);
  return (level === "primaria" && grade === 6)
    || (level === "basico" && grade === 3)
    || (level === "bachillerato" && grade === 5);
}
