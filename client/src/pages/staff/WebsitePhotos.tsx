import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Check, ImagePlus, Images, Loader2, Plus, RotateCcw, Save, Trash2, Upload, X } from 'lucide-react';
import { api, errorMessage } from '../../lib/api';
import { RUNTIME, uploadDirect } from '../../lib/uploads';
import { BUILT_IN_PHOTOS, DEFAULT_SLIDES, PHOTO_SPOTS, setSite, type PhotoSpot, type SiteContent, type Slide } from '../../lib/site';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Field';
import { Alert, Card, Spinner } from '../../components/ui/misc';

type LibraryPhoto = { id: string; src: string; originalName: string; size: number; createdAt: string };
type SiteResponse = { content: SiteContent; library: LibraryPhoto[] };

/** Where a picked photo goes: a slide (by index), a new slide, or a page photo spot. */
type Target = { kind: 'slide'; index: number } | { kind: 'new-slide' } | { kind: 'spot'; key: PhotoSpot };

const MAX_EDGE = 2400;

/** Phone photos can be 10MB+: shrink to website size before uploading (keeps the site fast). */
async function shrink(file: File): Promise<File> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.webp', { type: 'image/webp' });
  } catch {
    return file;
  }
}

async function uploadPhotos(files: File[]): Promise<LibraryPhoto[]> {
  const ready = await Promise.all(files.map(shrink));
  if (RUNTIME.uploadMode === 'direct-to-storage') {
    const uploads = await uploadDirect(ready, 'staff');
    return api.post<LibraryPhoto[]>('/admin/site-images', { uploads }).then((r) => r.data);
  }
  const body = new FormData();
  ready.forEach((f) => body.append('files', f));
  return api.post<LibraryPhoto[]>('/admin/site-images', body).then((r) => r.data);
}

export default function WebsitePhotos() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['site'], queryFn: () => api.get<SiteResponse>('/admin/site').then((r) => r.data) });
  const [slides, setSlides] = useState<Slide[]>([]);
  const [photos, setPhotos] = useState<SiteContent['photos']>({});
  const [dirty, setDirty] = useState(false);
  const [target, setTarget] = useState<Target | null>(null);

  // Load the saved choices once; later cache updates (new uploads) must not wipe unsaved edits.
  const loaded = useRef(false);
  useEffect(() => {
    if (!data || loaded.current) return;
    loaded.current = true;
    setSlides(data.content.slides ?? DEFAULT_SLIDES);
    setPhotos(data.content.photos ?? {});
  }, [data]);

  const save = useMutation({
    // Unchanged built-in slides are saved as "use the original", so future built-in updates still show.
    mutationFn: () =>
      api.put<SiteContent>('/admin/site', { slides: JSON.stringify(slides) === JSON.stringify(DEFAULT_SLIDES) ? null : slides, photos }).then((r) => r.data),
    onSuccess: (saved) => {
      setSite(saved);
      qc.setQueryData<SiteResponse>(['site'], (d) => (d ? { ...d, content: saved } : d));
      setDirty(false);
    },
  });

  if (isLoading || !data) return <Spinner />;

  const change = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
    save.reset();
  };
  const updateSlides = change(setSlides);
  const updatePhotos = change(setPhotos);

  const pick = (src: string) => {
    if (!target) return;
    if (target.kind === 'spot') updatePhotos({ ...photos, [target.key]: src });
    else if (target.kind === 'new-slide') updateSlides([...slides, { src, caption: '', alt: '', position: '50% 50%' }]);
    else updateSlides(slides.map((s, i) => (i === target.index ? { ...s, src, position: '50% 50%' } : s)));
    setTarget(null);
  };
  const move = (i: number, dir: -1 | 1) => {
    const next = [...slides];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    updateSlides(next);
  };

  return (
    <div className="max-w-5xl space-y-6 pb-24">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Website Photos</h1>
        <p className="text-navy-500">Change the slideshow and photos on the website. Tap a photo to change it, then press Save.</p>
      </div>

      {/* ---------- Slideshow ---------- */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-bold">Home page slideshow</h2>
            <p className="text-sm text-navy-500">Shown full screen at the top of the home page, in this order. Landscape photos work best.</p>
          </div>
          <Button variant="ghost" size="sm" icon={<RotateCcw className="size-4" />} onClick={() => updateSlides(DEFAULT_SLIDES)}>
            Use original slides
          </Button>
        </div>
        <ul className="mt-5 grid gap-4 sm:grid-cols-2">
          {slides.map((s, i) => (
            <li key={i} className="overflow-hidden rounded-xl border border-navy-100 bg-white">
              <FocusPicker src={s.src} position={s.position} onChange={(position) => updateSlides(slides.map((x, j) => (j === i ? { ...x, position } : x)))} />
              <div className="space-y-3 p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-navy-800">Slide {i + 1}</span>
                  <div className="flex items-center gap-1">
                    <IconBtn label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)}><ArrowUp className="size-4" /></IconBtn>
                    <IconBtn label="Move later" disabled={i === slides.length - 1} onClick={() => move(i, 1)}><ArrowDown className="size-4" /></IconBtn>
                    <IconBtn label="Remove slide" disabled={slides.length <= 1} onClick={() => updateSlides(slides.filter((_, j) => j !== i))} danger><Trash2 className="size-4" /></IconBtn>
                  </div>
                </div>
                <Input
                  className="h-10 text-sm"
                  placeholder="Describe the photo (helps Google and blind visitors)"
                  value={s.alt}
                  maxLength={200}
                  onChange={(e) => updateSlides(slides.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))}
                />
                <Button variant="outline" size="sm" className="w-full" icon={<ImagePlus className="size-4" />} onClick={() => setTarget({ kind: 'slide', index: i })}>
                  Change photo
                </Button>
              </div>
            </li>
          ))}
          {slides.length < 8 && (
            <li>
              <button
                onClick={() => setTarget({ kind: 'new-slide' })}
                className="flex h-full min-h-48 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-navy-200 text-navy-500 transition hover:border-brand-400 hover:text-brand-600"
              >
                <Plus className="size-7" />
                <span className="font-semibold">Add a slide</span>
                <span className="text-xs">Up to 8</span>
              </button>
            </li>
          )}
        </ul>
        <p className="mt-3 text-xs text-navy-400">Tip: tap on a slide photo to choose which part stays in view on phones (the blue dot).</p>
      </Card>

      {/* ---------- Page photos ---------- */}
      <Card className="p-5 sm:p-6">
        <h2 className="font-bold">Photos on the pages</h2>
        <p className="text-sm text-navy-500">Each photo appears in one place on the website.</p>
        <ul className="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-3">
          {PHOTO_SPOTS.map((spot) => {
            const current = photos[spot.key] ?? spot.src;
            const changed = !!photos[spot.key] && photos[spot.key] !== spot.src;
            return (
              <li key={spot.key} className="overflow-hidden rounded-xl border border-navy-100 bg-white">
                <button onClick={() => setTarget({ kind: 'spot', key: spot.key })} className="group relative block aspect-[4/3] w-full overflow-hidden bg-navy-100" aria-label={`Change photo: ${spot.label}`}>
                  <img src={current} alt="" loading="lazy" className="size-full object-cover transition group-hover:scale-[1.03]" />
                  <span className="absolute inset-0 flex items-center justify-center bg-navy-950/0 text-sm font-semibold text-white opacity-0 transition group-hover:bg-navy-950/45 group-hover:opacity-100">
                    <ImagePlus className="mr-1.5 size-4" /> Change
                  </span>
                </button>
                <div className="p-3">
                  <p className="text-[11px] font-bold tracking-wide text-brand-600 uppercase">{spot.page} page</p>
                  <p className="text-sm leading-snug font-semibold text-navy-800">{spot.label}</p>
                  {changed && (
                    <button
                      onClick={() => {
                        const next = { ...photos };
                        delete next[spot.key];
                        updatePhotos(next);
                      }}
                      className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-navy-500 hover:text-navy-900"
                    >
                      <RotateCcw className="size-3" /> Use original
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {/* ---------- Save bar ---------- */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-navy-100 bg-white/95 px-4 py-3 backdrop-blur lg:left-64">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-navy-600">
            {save.isError ? (
              <span className="text-red-600">{errorMessage(save.error)}</span>
            ) : save.isSuccess && !dirty ? (
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700"><Check className="size-4" /> Saved. Visitors see the new photos within a minute.</span>
            ) : dirty ? (
              'You have unsaved changes.'
            ) : (
              'No changes yet.'
            )}
          </p>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty} icon={<Save className="size-4" />}>
            Save photos
          </Button>
        </div>
      </div>

      {target && <PhotoPicker library={data.library} onPick={pick} onClose={() => setTarget(null)} inUse={new Set([...slides.map((s) => s.src), ...Object.values(photos)])} />}
    </div>
  );
}

function IconBtn({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={clsx('rounded-md p-1.5 transition disabled:opacity-30', danger ? 'text-red-600 hover:bg-red-50' : 'text-navy-500 hover:bg-navy-50 hover:text-navy-900')}
    >
      {children}
    </button>
  );
}

/** Slide preview: tap to set the point that stays in view when the photo is cropped to a phone screen. */
function FocusPicker({ src, position, onChange }: { src: string; position: string; onChange: (p: string) => void }) {
  const [x, y] = position.split(' ').map((v) => parseInt(v, 10));
  return (
    <button
      type="button"
      className="relative block aspect-video w-full cursor-crosshair overflow-hidden bg-navy-900"
      aria-label="Choose the part of the photo that stays in view"
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const px = Math.round(((e.clientX - r.left) / r.width) * 100);
        const py = Math.round(((e.clientY - r.top) / r.height) * 100);
        onChange(`${Math.min(100, Math.max(0, px))}% ${Math.min(100, Math.max(0, py))}%`);
      }}
    >
      <img src={src} alt="" className="size-full object-cover" style={{ objectPosition: position }} />
      <span className="pointer-events-none absolute size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-brand-500 shadow-lg" style={{ left: `${x}%`, top: `${y}%` }} />
    </button>
  );
}

function PhotoPicker({ library, onPick, onClose, inUse }: { library: LibraryPhoto[]; onPick: (src: string) => void; onClose: () => void; inUse: Set<string> }) {
  const qc = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = useMutation({
    mutationFn: uploadPhotos,
    onSuccess: (added) => {
      qc.setQueryData<SiteResponse>(['site'], (d) => (d ? { ...d, library: [...added, ...d.library] } : d));
      if (added.length === 1) onPick(added[0].src);
    },
    onError: (e) => setError(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/site-images/${id}`),
    onSuccess: (_r, id) => qc.setQueryData<SiteResponse>(['site'], (d) => (d ? { ...d, library: d.library.filter((p) => p.id !== id) } : d)),
    onError: (e) => setError(errorMessage(e)),
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy-950/60 sm:items-center sm:p-6" onClick={onClose}>
      <div className="flex max-h-[92dvh] w-full max-w-3xl flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Choose a photo">
        <div className="flex items-center justify-between border-b border-navy-100 px-5 py-4">
          <h2 className="flex items-center gap-2 font-bold"><Images className="size-5 text-brand-500" /> Choose a photo</h2>
          <button onClick={onClose} className="rounded-md p-1 text-navy-400 hover:bg-navy-50 hover:text-navy-900" aria-label="Close"><X className="size-5" /></button>
        </div>
        <div className="overflow-y-auto p-5">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = '';
              if (!files.length) return;
              setError(null);
              upload.mutate(files);
            }}
          />
          <button
            onClick={() => input.current?.click()}
            disabled={upload.isPending}
            className="flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-brand-300 bg-brand-50/50 px-4 py-7 text-center transition hover:border-brand-500 hover:bg-brand-50 disabled:opacity-60"
          >
            {upload.isPending ? <Loader2 className="size-7 animate-spin text-brand-500" /> : <Upload className="size-7 text-brand-500" />}
            <span className="font-semibold text-navy-900">{upload.isPending ? 'Uploading…' : 'Upload a new photo'}</span>
            <span className="text-xs text-navy-500">JPG, PNG or WEBP. Large phone photos are resized automatically.</span>
          </button>
          {error && <Alert kind="error" className="mt-4">{error}</Alert>}

          {library.length > 0 && (
            <>
              <h3 className="mt-6 mb-2 text-sm font-semibold text-navy-800">Your uploads</h3>
              <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {library.map((p) => (
                  <li key={p.id} className="group relative">
                    <Thumb src={p.src} onPick={onPick} used={inUse.has(p.src)} />
                    {!inUse.has(p.src) && (
                      <button
                        onClick={() => confirm('Delete this photo for good?') && remove.mutate(p.id)}
                        className="absolute top-1.5 right-1.5 rounded-md bg-white/90 p-1 text-red-600 opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100 max-sm:opacity-100"
                        aria-label="Delete photo"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          <h3 className="mt-6 mb-2 text-sm font-semibold text-navy-800">Built-in photos</h3>
          <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
            {[...new Set(BUILT_IN_PHOTOS)].map((src) => (
              <li key={src}>
                <Thumb src={src} onPick={onPick} used={inUse.has(src)} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Thumb({ src, onPick, used }: { src: string; onPick: (src: string) => void; used: boolean }) {
  return (
    <button onClick={() => onPick(src)} className="relative block aspect-[4/3] w-full overflow-hidden rounded-lg bg-navy-100 ring-brand-500 transition hover:ring-2 focus-visible:ring-2">
      <img src={src.replace('-1920.webp', '-960.webp')} alt="" loading="lazy" className="size-full object-cover" />
      {used && <span className="absolute bottom-1.5 left-1.5 rounded bg-navy-950/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">On website</span>}
    </button>
  );
}
