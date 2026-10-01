// Tests never call real providers and never touch the dev database.
delete process.env.GEMINI_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
process.env.ORIEL_SYNC_PIPELINE = "1";
process.env.DATABASE_PATH = ":memory:";
