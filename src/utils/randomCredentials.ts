export function generate8DigitLoginCode(): string {
  return String(Math.floor(10_000_000 + Math.random() * 90_000_000));
}

export function generateDefaultPassword(): string {
  return String(Math.floor(10_000_000 + Math.random() * 90_000_000));
}
