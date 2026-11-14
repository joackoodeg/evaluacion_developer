import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

// Aplica las migraciones de ./drizzle en producción.
// No usa drizzle-kit porque es una dependencia de desarrollo y no está en la imagen.
async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('Migraciones aplicadas');
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
