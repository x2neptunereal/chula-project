import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface ISlip extends Document {
  userId: Types.ObjectId;
  transactionNumber: string;
  bank: "krungthai" | "truemoney" | "kbank" | "unknown";
  amount: number;
  date: Date;
  transactionId: Types.ObjectId;
  createdAt: Date;
}

const SlipSchema = new Schema<ISlip>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    transactionNumber: {
      type: String,
      required: true,
      trim: true,
    },
    bank: {
      type: String,
      enum: ["krungthai", "truemoney", "kbank", "unknown"],
      default: "unknown",
    },
    amount: {
      type: Number,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    transactionId: {
      type: Schema.Types.ObjectId,
      ref: "Transaction",
      required: true,
    },
  },
  { timestamps: true }
);

// Unique per user + transaction number
SlipSchema.index({ userId: 1, transactionNumber: 1 }, { unique: true });

const Slip: Model<ISlip> =
  mongoose.models.Slip ?? mongoose.model<ISlip>("Slip", SlipSchema);

export default Slip;
