import {
  findContactById,
  getNextId,
  hasDuplicateContact,
  loadContacts,
  saveContacts,
} from "./contacts.js";
import type { Command, Contact, NewContact } from "./types.js";
import { newContactSchema } from "./validation.js";

function printUsage(): void {
  console.log(`
Contacts CLI

Commands:

  list
      List all contacts.

  search <query>
      Search contacts by name, email, phone, or tag.

  add --name <name> --email <email> --phone <phone> --tags <tag1,tag2>
      Add a new contact.

  remove <id>
      Remove a contact by ID.

Examples:

  pnpm dev list

  pnpm dev search alice

  pnpm dev add --name "John Doe" --email "john@example.com" --phone "+919876543210" --tags work,friend

  pnpm dev remove 3
`);
}

function parseCommand(args: string[]): Command {
  const command = args[0];
  const rest = args.slice(1);

  if (command === undefined) {
    throw new Error(
      "No command provided. Use: list, search, add, or remove.",
    );
  }

  switch (command) {
    case "list":
      if (rest.length > 0) {
        throw new Error("The list command does not accept arguments.");
      }

      return { type: "list" };

    case "search": {
      const query = rest[0];

      if (rest.length !== 1 || query === undefined || query.trim() === "") {
        throw new Error("Usage: search <query>");
      }

      return {
        type: "search",
        query,
      };
    }

    case "remove": {
      const idArgument = rest[0];

      if (rest.length !== 1 || idArgument === undefined) {
        throw new Error("Usage: remove <id>");
      }

      return {
        type: "remove",
        id: parseId(idArgument),
      };
    }

    case "add":
      return {
        type: "add",
        contact: parseAddArguments(rest),
      };

    case "--help":
    case "-h":
      printUsage();
      process.exit(0);

    default:
      throw new Error(
        `Unknown command "${command}". Use: list, search, add, or remove.`,
      );
  }
}

function parseAddArguments(args: string[]): NewContact {
  const values: Record<string, string> = {};

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === undefined) {
      throw new Error("Unexpected missing argument.");
    }

    if (!argument.startsWith("--")) {
      throw new Error(`Unexpected argument "${argument}".`);
    }

    const key = argument.slice(2);

    if (!["name", "email", "phone", "tags"].includes(key)) {
      throw new Error(`Unknown add option "--${key}".`);
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for "--${key}".`);
    }

    values[key] = value;
    index += 1;
  }

  const tags = values.tags
    ?.split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  const validationResult = newContactSchema.safeParse({
    name: values.name,
    email: values.email,
    phone: values.phone,
    tags,
  });

  if (!validationResult.success) {
    const messages = validationResult.error.issues
      .map((issue) => issue.message)
      .join("; ");

    throw new Error(`Invalid contact: ${messages}`);
  }

  return validationResult.data;
}

function parseId(value: string): number {
  const id = Number(value);

  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Invalid ID "${value}". ID must be a positive integer.`);
  }

  return id;
}

function printContacts(contacts: Contact[]): void {
  if (contacts.length === 0) {
    console.log("No contacts found.");
    return;
  }

  for (const contact of contacts) {
    console.log(
      `${contact.id}. ${contact.name} | ${contact.email} | ${contact.phone} | tags: ${contact.tags.join(", ")}`,
    );
  }
}

async function run(): Promise<void> {
  let command: Command;

  try {
    command = parseCommand(process.argv.slice(2));
  } catch (error: unknown) {
    console.error(`Error: ${getErrorMessage(error)}`);
    console.error("Run with --help to see usage.");
    process.exitCode = 1;
    return;
  }

  const contactsResult = await loadContacts();

  if (!contactsResult.success) {
    console.error(`Error: ${contactsResult.error}`);
    process.exitCode = 1;
    return;
  }

  const contacts = contactsResult.data;

  switch (command.type) {
    case "list":
      printContacts(contacts);
      return;

    case "search":
      handleSearch(contacts, command.query);
      return;

    case "add":
      await handleAdd(contacts, command.contact);
      return;

    case "remove":
      await handleRemove(contacts, command.id);
      return;
  }
}

function handleSearch(contacts: Contact[], query: string): void {
  const normalizedQuery = query.toLowerCase();

  const matches = contacts.filter((contact) => {
    return (
      contact.name.toLowerCase().includes(normalizedQuery) ||
      contact.email.toLowerCase().includes(normalizedQuery) ||
      contact.phone.toLowerCase().includes(normalizedQuery) ||
      contact.tags.some((tag) =>
        tag.toLowerCase().includes(normalizedQuery),
      )
    );
  });

  if (matches.length === 0) {
    console.log(`No contacts found for "${query}".`);
    return;
  }

  printContacts(matches);
}

async function handleAdd(
  contacts: Contact[],
  newContact: NewContact,
): Promise<void> {
  const duplicateMessage = hasDuplicateContact(contacts, newContact);

  if (duplicateMessage) {
    console.error(`Error: ${duplicateMessage}`);
    process.exitCode = 1;
    return;
  }

  const contact: Contact = {
    id: getNextId(contacts),
    ...newContact,
  };

  contacts.push(contact);

  const saveResult = await saveContacts(contacts);

  if (!saveResult.success) {
    console.error(`Error: ${saveResult.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Contact added successfully with ID ${contact.id}.`);
}

async function handleRemove(
  contacts: Contact[],
  id: number,
): Promise<void> {
  const contact = findContactById(contacts, id);

  if (!contact) {
    console.error(`Error: Contact with ID ${id} was not found.`);
    process.exitCode = 1;
    return;
  }

  const remainingContacts = contacts.filter(
    (existingContact) => existingContact.id !== id,
  );

  const saveResult = await saveContacts(remainingContacts);

  if (!saveResult.success) {
    console.error(`Error: ${saveResult.error}`);
    process.exitCode = 1;
    return;
  }

  console.log(`Contact "${contact.name}" removed successfully.`);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

run().catch((error: unknown) => {
  console.error(`Unexpected error: ${getErrorMessage(error)}`);
  process.exitCode = 1;
});