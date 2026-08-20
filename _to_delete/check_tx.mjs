import mongoose from "mongoose";
import fs from "fs";

const envContent = fs.readFileSync(".env.local", "utf8");
const uriMatch = envContent.match(/MONGODB_URI=(.+)/);
const uri = uriMatch[1].trim();

await mongoose.connect(uri);
const Transaction = mongoose.connection.collection("transactions");

// Find transactions whose category is not one of the new 8 valid values
const validCategories = ["food_drinks", "travel", "education", "shopping", "entertainment", "recurring_expenses", "health", "social_gifts"];
const stale = await Transaction.find({
  category: { $exists: true, $ne: null, $nin: [...validCategories, ""] }
}).project({ category: 1, description: 1, amount: 1, date: 1 }).limit(20).toArray();

console.log("Stale category transactions found:", stale.length);
console.log(JSON.stringify(stale, null, 2));

await mongoose.disconnect();
