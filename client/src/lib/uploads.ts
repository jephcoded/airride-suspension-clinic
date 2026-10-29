import { upload } from '@vercel/blob/client';

/** Set at startup from /api/meta: how this deployment stores photos and videos. */
export const RUNTIME = { uploadMode: 'via-server' as 'via-server' | 'direct-to-storage', pushKey: null as string | null };

export type DirectUpload = { pathname: string; originalName: string };

/**
 * On Vercel, files go straight from the phone to private storage (Vercel limits requests to 4.5 MB,
 * smaller than a short video). Returns what the server needs to check and record each file.
 */
export async function uploadDirect(files: File[], who: 'booking' | 'staff', onProgress?: (percent: number) => void): Promise<DirectUpload[]> {
  const total = files.reduce((s, f) => s + f.size, 0) || 1;
  const done: number[] = files.map(() => 0);
  const out: DirectUpload[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const safe = f.name.replace(/[^\w.-]+/g, '-').slice(-80) || 'file';
    const blob = await upload(`uploads/${safe}`, f, {
      access: 'private',
      handleUploadUrl: '/api/uploads',
      clientPayload: who,
      multipart: f.size > 8 * 1024 * 1024,
      onUploadProgress: ({ loaded }) => {
        done[i] = loaded;
        onProgress?.(Math.round((done.reduce((s, n) => s + n, 0) / total) * 100));
      },
    });
    out.push({ pathname: blob.pathname, originalName: f.name });
  }
  return out;
}
