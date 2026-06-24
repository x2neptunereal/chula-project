import mongoose, { Schema, Document, Model, Types } from "mongoose";
import { EXPENSE_CATEGORIES, type ExpenseCategory } from "@/lib/expense-categories";

export { EXPENSE_CATEGORIES };
export type { ExpenseCategory };

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  type: "income" | "expense";
  amount: number;
  date: Date;
  description?: string;
  category: ExpenseCategory;
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: ["income", "expense"],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    category: {
      type: String,
      enum: EXPENSE_CATEGORIES,
      required: false,
    },
  },
  { timestamps: true }
);

TransactionSchema.index({ userId: 1, date: -1 });

const Transaction: Model<ITransaction> =
  mongoose.models.Transaction ??
  mongoose.model<ITransaction>("Transaction", TransactionSchema);

export default Transaction;
