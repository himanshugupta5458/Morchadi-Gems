-- Admin credentials moved from a Postgres row to ADMIN_USERNAME/ADMIN_PASSWORD in the
-- environment (ADR-061). The `admins` table no longer has a reader or a writer, and
-- `admin_sessions.admin_id` stops being a foreign key -- it now just names the single,
-- well-known identity every session belongs to ("env-admin", lib/admin-auth.ts).

-- DropForeignKey
ALTER TABLE "admin_sessions" DROP CONSTRAINT "admin_sessions_admin_id_fkey";

-- DropTable
DROP TABLE "admins";
