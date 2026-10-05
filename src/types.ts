export interface Contact {
  id: number;
  name: string;
  email: string;
  phone: string;
  tags: string[];
}

export type NewContact = Omit<Contact, "id">;

export type Command =
  | { type: "list" }
  | { type: "search"; query: string }
  | { type: "add"; contact: NewContact }
  | { type: "remove"; id: number };

export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

export type ContactSummary = Pick<Contact, "id" | "name" | "email">;

export function isContact(value: unknown): value is Contact {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "number" &&
    typeof candidate.name === "string" &&
    typeof candidate.email === "string" &&
    typeof candidate.phone === "string" &&
    Array.isArray(candidate.tags) &&
    candidate.tags.every((tag): tag is string => typeof tag === "string")
  );
}