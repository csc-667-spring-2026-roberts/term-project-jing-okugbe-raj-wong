import { MigrationBuilder, PgType } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
  pgm.createTable("players", {
    id: "id",
    display_name: { type: `${PgType.VARCHAR}(100)`, notNull: true },
    created_at: {
      type: PgType.TIMESTAMP,
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });
}

export async function down(pgm: MigrationBuilder): Promise<void> {
  pgm.dropTable("players");
}