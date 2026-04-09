import { MigrationBuilder } from 'node-pg-migrate';

export async function up(pgm: MigrationBuilder): Promise<void> {
    pgm.renameColumn("session", "id", "sid");
}

export async function down(pgm: MigrationBuilder): Promise<void> {
    pgm.renameColumn("session", "sid", "id");
}
