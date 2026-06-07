import mongoose, { type Document } from "mongoose";
import bcrypt from "bcrypt";

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  createdAt: Date;
  tokenUsage: {
    daily: number;
    lastReset: Date;
  };
  preferences: {
    defaultProvider: "groq" | "gemini";
    quizDifficulty: "easy" | "medium" | "hard" | "mixed";
  };
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new mongoose.Schema<IUser>({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  tokenUsage: {
    daily: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now },
  },
  preferences: {
    defaultProvider: {
      type: String,
      enum: ["groq", "gemini"],
      default: "groq",
    },
    quizDifficulty: {
      type: String,
      enum: ["easy", "medium", "hard", "mixed"],
      default: "medium",
    },
  },
});

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Remove password from JSON output
userSchema.set("toJSON", {
  transform(_doc, ret) {
    const obj = ret as unknown as Record<string, unknown>;
    delete obj.password;
    return obj;
  },
});

export const User = mongoose.model<IUser>("User", userSchema);
