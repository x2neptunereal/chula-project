export const EXPENSE_CATEGORIES = [
  "food_drinks",
  "travel",
  "education",
  "shopping",
  "entertainment",
  "recurring_expenses",
  "health",
  "social_gifts",
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const CATEGORY_LABEL_KEYS: Record<
  ExpenseCategory,
  | "category_food_drinks"
  | "category_travel"
  | "category_education"
  | "category_shopping"
  | "category_entertainment"
  | "category_recurring_expenses"
  | "category_health"
  | "category_social_gifts"
> = {
  food_drinks: "category_food_drinks",
  travel: "category_travel",
  education: "category_education",
  shopping: "category_shopping",
  entertainment: "category_entertainment",
  recurring_expenses: "category_recurring_expenses",
  health: "category_health",
  social_gifts: "category_social_gifts",
};
