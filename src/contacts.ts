import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Contact, NewContact, Result } from "./types.js";
import { contactSchema } from "./validation.js";

const contactsFile = path.resolve(
  process.env.CONTACTS_FILE ?? path.join(process.cwd(), "contacts.json"),
);

export async function loadContacts(): Promise<Result<Contact[]>> {
  try {
    const fileContent = await readFile(contactsFile, "utf8");
    const parsedJson: unknown = JSON.parse(fileContent);

    if (!Array.isArray(parsedJson)) {
      return {
        success: false,
        error: "contacts.json must contain an array of contacts.",
      };
    }

    const contacts: Contact[] = [];

    for (const item of parsedJson) {
      const result = contactSchema.safeParse(item);

      if (!result.success) {
        return {
          success: false,
          error: `Invalid contact data in contacts.json: ${result.error.message}`,
        };
      }

      contacts.push(result.data);
    }

    return {
      success: true,
      data: contacts,
    };
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {
        success: false,
        error: `Contacts file not found: ${contactsFile}`,
      };
    }

    if (error instanceof SyntaxError) {
      return {
        success: false,
        error: "contacts.json contains invalid JSON.",
      };
    }

    return {
      success: false,
      error: `Failed to read contacts: ${getErrorMessage(error)}`,
    };
  }
}

export async function saveContacts(
  contacts: Contact[],
): Promise<Result<void>> {
  try {
    await writeFile(
      contactsFile,
      `${JSON.stringify(contacts, null, 2)}\n`,
      "utf8",
    );

    return {
      success: true,
      data: undefined,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error: `Failed to save contacts: ${getErrorMessage(error)}`,
    };
  }
}

export function findContactById(
  contacts: Contact[],
  id: number,
): Contact | undefined {
  return contacts.find((contact) => contact.id === id);
}

export function hasDuplicateContact(
  contacts: Contact[],
  newContact: NewContact,
): string | undefined {
  const emailExists = contacts.some(
    (contact) => contact.email.toLowerCase() === newContact.email.toLowerCase(),
  );

  if (emailExists) {
    return `A contact with email "${newContact.email}" already exists.`;
  }

  const phoneExists = contacts.some(
    (contact) => contact.phone === newContact.phone,
  );

  if (phoneExists) {
    return `A contact with phone "${newContact.phone}" already exists.`;
  }

  return undefined;
}

export function getNextId(contacts: Contact[]): number {
  if (contacts.length === 0) {
    return 1;
  }

  return Math.max(...contacts.map((contact) => contact.id)) + 1;
}

function isNodeError(
  error: unknown,
): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}