"use strict";

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

module.exports = {
  PORT: parseInt(process.env.PORT, 10) || 3001,
  NODE_ENV: process.env.NODE_ENV || "development",
  ALLOWED_ORIGINS,
  // Admin API key — if set, /api/simulate requires X-Admin-Key header
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || null,
  // SQLite path — :memory: by default, set to a file path for persistence
  DB_PATH: process.env.DB_PATH || "./data/stadium.db",

  RATE: {
    GENERAL: { windowMs: 60_000, max: 120 },
    ORDER: { windowMs: 60_000, max: 10 },
    SIMULATE: { windowMs: 60_000, max: 20 },
  },

  SIM: {
    TICK_MS: 2000,
    MAX_ORDERS: 200,
    MAX_ALERTS: 20,
  },

  ZONES: {
    A: {
      id: "A",
      name: "North Gate",
      x: 200,
      y: 50,
      capacity: 500,
      connections: ["B", "E"],
    },
    B: {
      id: "B",
      name: "West Stand",
      x: 80,
      y: 200,
      capacity: 800,
      connections: ["A", "C", "F"],
    },
    C: {
      id: "C",
      name: "South Gate",
      x: 200,
      y: 350,
      capacity: 500,
      connections: ["B", "D", "G"],
    },
    D: {
      id: "D",
      name: "East Stand",
      x: 320,
      y: 200,
      capacity: 800,
      connections: ["A", "C", "H"],
    },
    E: {
      id: "E",
      name: "Food Court North",
      x: 200,
      y: 140,
      capacity: 300,
      connections: ["A", "F", "H"],
    },
    F: {
      id: "F",
      name: "Concourse West",
      x: 110,
      y: 270,
      capacity: 400,
      connections: ["B", "E", "G"],
    },
    G: {
      id: "G",
      name: "Food Court South",
      x: 200,
      y: 290,
      capacity: 300,
      connections: ["C", "F", "H"],
    },
    H: {
      id: "H",
      name: "Concourse East",
      x: 290,
      y: 270,
      capacity: 400,
      connections: ["D", "E", "G"],
    },
  },

  STALLS: [
    {
      id: "s1",
      name: "Burger Hub",
      zone: "E",
      baseWait: 4,
      menu: ["Classic Burger", "Fries", "Soda"],
    },
    {
      id: "s2",
      name: "Pizza Corner",
      zone: "G",
      baseWait: 6,
      menu: ["Margherita", "Pepperoni", "BBQ Chicken"],
    },
    {
      id: "s3",
      name: "Snack Bar",
      zone: "F",
      baseWait: 2,
      menu: ["Nachos", "Hot Dog", "Popcorn"],
    },
    {
      id: "s4",
      name: "Drinks Zone",
      zone: "H",
      baseWait: 3,
      menu: ["Cola", "Water", "Energy Drink"],
    },
  ],

  SIM_PROFILES: {
    normal: { base: 0.25, variance: 0.15 },
    pre_match: { base: 0.65, variance: 0.2 },
    halftime: { base: 0.85, variance: 0.15 },
    exit_rush: { base: 0.9, variance: 0.1 },
  },
};
