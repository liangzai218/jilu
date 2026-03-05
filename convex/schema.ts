import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    username: v.string(),
    passwordHash: v.string(),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  todos: defineTable({
    username: v.string(),
    content: v.string(),
    completed: v.boolean(),
    localId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_username", ["username"]),

  bills: defineTable({
    username: v.string(),
    amount: v.number(),
    category: v.string(),
    note: v.optional(v.string()),
    date: v.string(),
    localId: v.string(),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  periods: defineTable({
    username: v.string(),
    startDate: v.string(),
    endDate: v.optional(v.string()),
    cycleDays: v.optional(v.number()),
    note: v.optional(v.string()),
    localId: v.string(),
    createdAt: v.number(),
  }).index("by_username", ["username"]),

  notes: defineTable({
    username: v.string(),
    title: v.string(),
    content: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    localId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_username", ["username"]),
});

