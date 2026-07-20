import { assertTestDatabaseReachable } from "../src/test/global-setup.ts";

await assertTestDatabaseReachable();
console.log("Postgres IT database is reachable.");
