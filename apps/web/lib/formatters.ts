export function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not available yet";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "Not available yet";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium"
  }).format(new Date(value));
}

export function difficultyLabel(value: number) {
  return ["Very easy", "Easy", "Medium", "Hard", "Very hard"][value - 1] ?? `Level ${value}`;
}

export function problemStatusLabel(value: string) {
  switch (value) {
    case "draft":
      return "Draft";
    case "validation":
      return "Checking";
    case "ready_for_duel":
      return "Ready for duels";
    case "disabled":
      return "Needs fixes";
    default:
      return value.replaceAll("_", " ");
  }
}

export function testKindLabel(value: string) {
  switch (value) {
    case "sample":
      return "Visible example";
    case "hidden":
      return "Hidden checker";
    case "edge":
      return "Edge case";
    default:
      return value;
  }
}

export function duelStatusLabel(value: string) {
  return value.replaceAll("_", " ");
}

export function duelRoomTypeLabel(value: string) {
  switch (value) {
    case "rated":
      return "Rated room";
    case "practice":
      return "Practice room";
    default:
      return value.replaceAll("_", " ");
  }
}
