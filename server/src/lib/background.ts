import { waitUntil } from '@vercel/functions';

/**
 * Runs work after the response has been sent (emails, SMS, push alerts).
 * On Vercel the function is kept alive until it finishes; elsewhere it simply runs.
 */
export function background(task: Promise<unknown>, label = 'background task') {
  const p = task.catch((e) => console.error(`${label} failed`, e));
  try {
    waitUntil(p);
  } catch {
    /* not on Vercel */
  }
}
