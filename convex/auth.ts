import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const register = mutation({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { username, password }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    
    if (existing) throw new Error("用户名已存在");
    
    // 注意：实际项目中应使用bcrypt进行密码哈希
    const passwordHash = password; // 简化处理，实际应哈希
    
    await ctx.db.insert("users", {
      username,
      passwordHash,
      createdAt: Date.now(),
    });
    
    return { success: true, username };
  },
});

export const login = query({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, { username, password }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_username", (q) => q.eq("username", username))
      .first();
    
    if (!user) throw new Error("用户不存在");
    
    // 注意：实际项目中应使用bcrypt比较密码
    if (user.passwordHash !== password) throw new Error("密码错误");
    
    return { success: true, username };
  },
});

