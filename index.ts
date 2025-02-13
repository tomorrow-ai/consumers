import cron from "node-cron";

cron.schedule("* * * * *", () => {
  console.log("Hello via Bun!");
});

