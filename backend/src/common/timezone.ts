import * as pg from 'pg';

/**
 * Server-side dates such as "today" follow India time. Imported first by main.ts.
 */
process.env.TZ = 'Asia/Kolkata';

/**
 * The database runs in UTC, and createdAt/updatedAt columns have no timezone, so
 * their values are UTC. By default pg treats them as server-local time, which put
 * every time 5:30 behind on an India server. Read and write them as UTC.
 */
const TIMESTAMP_WITHOUT_TIME_ZONE = 1114;
pg.types.setTypeParser(TIMESTAMP_WITHOUT_TIME_ZONE, (value: string) => new Date(`${value.replace(' ', 'T')}Z`));
(pg.defaults as any).parseInputDatesAsUTC = true;
