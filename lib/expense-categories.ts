// Shared constant — safe to import from both client components and server-only
// model files (lib/models/Transaction.ts imports mongoose, which must never
// end up in the browser bundle, so the category list lives here instead).
export const EXPENSE_CATEGORIES = [
  "entertainment",
  "shopping",
  "investment_transport_recurring",
  "basic_utilities",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

// Maps each category to its i18n dictionary key (see lib/i18n.tsx).
export const CATEGORY_LABEL_KEYS: Record<
  ExpenseCategory,
  "category_entertainment" | "category_shopping" | "category_investment_transport_recurring" | "category_basic_utilities"
> = {
  entertainment: "category_entertainment",
  shopping: "category_shopping",
  investment_transport_recurring: "category_investment_transport_recurring",
  basic_utilities: "category_basic_utilities",
};
