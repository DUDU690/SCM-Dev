import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import PageHeader from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Plus, X, ImageIcon, Trash2, Upload, ChevronLeft, Pencil } from 'lucide-react';

interface Photo { id: string; url: string; caption?: string; createdAt: string }
interface Album {
  id: string; title: string; description?: string; isPublic: boolean; status: string;
  _count?: { photos: number };
  photos?: { url: string }[];
}

export default function GalleryPage() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);

  // Album create/edit
  const [albumDialog, setAlbumDialog] = useState<'create' | 'edit' | null>(null);
  const [albumForm, setAlbumForm] = useState({ title: '', description: '', isPublic: false });
  const [editAlbum, setEditAlbum] = useState<Album | null>(null);
  const [albumSaving, setAlbumSaving] = useState(false);
  const [albumError, setAlbumError] = useState('');

  // Album detail view
  const [openAlbum, setOpenAlbum] = useState<Album | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);

  // Photo upload
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadCaption, setUploadCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // Photo edit caption
  const [editPhoto, setEditPhoto] = useState<Photo | null>(null);
  const [editCaption, setEditCaption] = useState('');
  const [captionSaving, setCaptionSaving] = useState(false);

  // Delete
  const [deleteAlbumTarget, setDeleteAlbumTarget] = useState<Album | null>(null);
  const [deletePhotoTarget, setDeletePhotoTarget] = useState<Photo | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAlbums = useCallback(() => {
    setLoading(true);
    api.get('/gallery/albums').then(r => setAlbums(r.data.data ?? [])).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadAlbums(); }, [loadAlbums]);

  const loadPhotos = useCallback((albumId: string) => {
    setPhotosLoading(true);
    api.get(`/gallery/albums/${albumId}`)
      .then(r => setPhotos(r.data.data?.photos ?? []))
      .catch(console.error)
      .finally(() => setPhotosLoading(false));
  }, []);

  useEffect(() => { if (openAlbum) loadPhotos(openAlbum.id); }, [openAlbum, loadPhotos]);

  // ── Album CRUD ──

  function openCreateAlbum() {
    setAlbumForm({ title: '', description: '', isPublic: false });
    setAlbumError('');
    setAlbumDialog('create');
  }

  function openEditAlbum(a: Album, e: React.MouseEvent) {
    e.stopPropagation();
    setEditAlbum(a);
    setAlbumForm({ title: a.title, description: a.description || '', isPublic: a.isPublic });
    setAlbumError('');
    setAlbumDialog('edit');
  }

  async function handleAlbumSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setAlbumSaving(true); setAlbumError('');
    try {
      if (albumDialog === 'create') {
        await api.post('/gallery/albums', albumForm);
      } else if (editAlbum) {
        await api.patch(`/gallery/albums/${editAlbum.id}`, albumForm);
        if (openAlbum?.id === editAlbum.id) {
          setOpenAlbum(a => a ? { ...a, ...albumForm } : a);
        }
      }
      setAlbumDialog(null); loadAlbums();
    } catch (err: unknown) {
      setAlbumError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Error saving album');
    } finally { setAlbumSaving(false); }
  }

  async function handleDeleteAlbum() {
    if (!deleteAlbumTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/gallery/albums/${deleteAlbumTarget.id}`);
      setDeleteAlbumTarget(null);
      if (openAlbum?.id === deleteAlbumTarget.id) setOpenAlbum(null);
      loadAlbums();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to delete album');
    } finally { setDeleting(false); }
  }

  // ── Photo Upload ──

  function addFiles(files: FileList | null) {
    if (!files) return;
    const imgs = Array.from(files).filter(f => f.type.startsWith('image/'));
    setUploadFiles(prev => [...prev, ...imgs]);
  }

  async function handleUpload(ev: React.FormEvent) {
    ev.preventDefault();
    if (!openAlbum || uploadFiles.length === 0) return;
    setUploading(true); setUploadError(''); setUploadProgress(0);
    let done = 0;
    try {
      for (const file of uploadFiles) {
        const fd = new FormData();
        fd.append('photo', file);
        fd.append('albumId', openAlbum.id);
        if (uploadCaption) fd.append('caption', uploadCaption);
        await api.post('/gallery/photos/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        done++;
        setUploadProgress(Math.round((done / uploadFiles.length) * 100));
      }
      setUploadDialog(false);
      setUploadFiles([]);
      setUploadCaption('');
      setUploadProgress(0);
      loadPhotos(openAlbum.id);
      loadAlbums();
    } catch (err: unknown) {
      setUploadError((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Upload failed');
    } finally { setUploading(false); }
  }

  async function handleDeletePhoto() {
    if (!deletePhotoTarget || !openAlbum) return;
    setDeleting(true);
    try {
      await api.delete(`/gallery/photos/${deletePhotoTarget.id}`);
      setDeletePhotoTarget(null);
      loadPhotos(openAlbum.id);
      loadAlbums();
    } catch (err: unknown) {
      alert((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Failed to delete photo');
    } finally { setDeleting(false); }
  }

  async function handleSaveCaption(ev: React.FormEvent) {
    ev.preventDefault();
    if (!editPhoto || !openAlbum) return;
    setCaptionSaving(true);
    try {
      await api.patch(`/gallery/photos/${editPhoto.id}`, { caption: editCaption });
      setEditPhoto(null);
      loadPhotos(openAlbum.id);
    } catch { /* silent */ } finally { setCaptionSaving(false); }
  }

  // ── Album detail view ──
  if (openAlbum) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setOpenAlbum(null)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="h-4 w-4" />Albums
          </button>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{openAlbum.title}</span>
          <Badge variant={openAlbum.isPublic ? 'success' : 'secondary'} className="ml-1">{openAlbum.isPublic ? 'Public' : 'Private'}</Badge>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={e => openEditAlbum(openAlbum, e)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit Album</Button>
            <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDeleteAlbumTarget(openAlbum)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete Album</Button>
            <Button size="sm" onClick={() => { setUploadDialog(true); setUploadFiles([]); setUploadCaption(''); setUploadError(''); }}>
              <Upload className="h-3.5 w-3.5 mr-1" />Upload Photos
            </Button>
          </div>
        </div>

        {openAlbum.description && (
          <p className="text-sm text-muted-foreground mb-5">{openAlbum.description}</p>
        )}

        {photosLoading ? <LoadingSpinner className="mx-auto mt-16" /> : photos.length === 0 ? (
          <div className="text-center py-20 border-2 border-dashed rounded-lg border-muted">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground mb-4">No photos in this album yet</p>
            <Button onClick={() => { setUploadDialog(true); setUploadFiles([]); setUploadCaption(''); setUploadError(''); }}>
              <Upload className="h-4 w-4 mr-1" />Upload First Photo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {photos.map(p => (
              <div key={p.id} className="group relative aspect-square rounded-lg overflow-hidden bg-muted">
                <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                {/* caption overlay */}
                {p.caption && (
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
                    <p className="text-xs text-white line-clamp-2">{p.caption}</p>
                  </div>
                )}
                {/* action overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-start justify-end p-1.5 gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    title="Edit caption"
                    onClick={() => { setEditPhoto(p); setEditCaption(p.caption || ''); }}
                    className="p-1 rounded bg-white/90 hover:bg-white text-gray-700 shadow"
                  ><Pencil className="h-3 w-3" /></button>
                  <button
                    title="Delete photo"
                    onClick={() => setDeletePhotoTarget(p)}
                    className="p-1 rounded bg-white/90 hover:bg-white text-red-600 shadow"
                  ><Trash2 className="h-3 w-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Upload Photos Modal ── */}
        {uploadDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-lg p-6 w-full max-w-lg shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Upload Photos</h2>
                <button onClick={() => setUploadDialog(false)}><X className="h-5 w-5" /></button>
              </div>
              {uploadError && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{uploadError}</p>}
              <form onSubmit={handleUpload} className="space-y-4">
                {/* drop zone */}
                <div
                  className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/30 hover:border-primary/50'}`}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm font-medium">Click to select or drag & drop images</p>
                  <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, GIF · max 2 MB each</p>
                  <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => addFiles(e.target.files)} />
                </div>

                {/* selected file list */}
                {uploadFiles.length > 0 && (
                  <ul className="text-sm space-y-1 max-h-32 overflow-y-auto border rounded p-2">
                    {uploadFiles.map((f, i) => (
                      <li key={i} className="flex items-center justify-between gap-2">
                        <span className="truncate text-muted-foreground">{f.name}</span>
                        <button type="button" onClick={() => setUploadFiles(prev => prev.filter((_, j) => j !== i))} className="shrink-0 text-destructive hover:text-destructive/80"><X className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}

                <div>
                  <Label>Caption (applies to all selected photos)</Label>
                  <textarea
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                    placeholder="Optional description for these photos…"
                    value={uploadCaption}
                    onChange={e => setUploadCaption(e.target.value)}
                  />
                </div>

                {uploading && (
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" loading={uploading} disabled={uploadFiles.length === 0} className="flex-1">
                    {uploading ? `Uploading… ${uploadProgress}%` : `Upload ${uploadFiles.length > 0 ? `${uploadFiles.length} Photo${uploadFiles.length > 1 ? 's' : ''}` : 'Photos'}`}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setUploadDialog(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Edit Caption Modal ── */}
        {editPhoto && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Edit Caption</h2>
                <button onClick={() => setEditPhoto(null)}><X className="h-5 w-5" /></button>
              </div>
              <div className="mb-3">
                <img src={editPhoto.url} alt="" className="w-full h-40 object-cover rounded-md" />
              </div>
              <form onSubmit={handleSaveCaption} className="space-y-3">
                <div>
                  <Label>Caption</Label>
                  <textarea
                    className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
                    value={editCaption}
                    onChange={e => setEditCaption(e.target.value)}
                    placeholder="Describe this photo…"
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" loading={captionSaving} className="flex-1">Save Caption</Button>
                  <Button type="button" variant="outline" onClick={() => setEditPhoto(null)}>Cancel</Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Delete Photo Confirm ── */}
        {deletePhotoTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
              <h2 className="text-lg font-semibold mb-2">Delete Photo</h2>
              <img src={deletePhotoTarget.url} alt="" className="w-full h-36 object-cover rounded-md mb-3" />
              <p className="text-sm text-muted-foreground mb-4">This will permanently delete the photo and cannot be undone.</p>
              <div className="flex gap-2">
                <Button variant="destructive" loading={deleting} onClick={handleDeletePhoto} className="flex-1">Delete</Button>
                <Button variant="outline" onClick={() => setDeletePhotoTarget(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Delete Album Confirm (from detail view) ── */}
        {deleteAlbumTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
              <h2 className="text-lg font-semibold mb-1">Delete Album</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Permanently delete <strong>{deleteAlbumTarget.title}</strong> and all its photos? This cannot be undone.
              </p>
              <div className="flex gap-2">
                <Button variant="destructive" loading={deleting} onClick={handleDeleteAlbum} className="flex-1">Delete Album</Button>
                <Button variant="outline" onClick={() => setDeleteAlbumTarget(null)}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Edit Album Modal ── */}
        {albumDialog && (
          <AlbumFormModal
            mode={albumDialog}
            form={albumForm}
            setForm={setAlbumForm}
            error={albumError}
            saving={albumSaving}
            onSubmit={handleAlbumSubmit}
            onClose={() => setAlbumDialog(null)}
          />
        )}
      </div>
    );
  }

  // ── Album list view ──
  return (
    <div>
      <PageHeader
        title="Photo Gallery"
        breadcrumbs={[{ label: 'Dashboard', href: '/dashboard' }, { label: 'Gallery' }]}
        actions={<Button onClick={openCreateAlbum}><Plus className="h-4 w-4 mr-1" />New Album</Button>}
      />

      {loading ? <LoadingSpinner className="mx-auto mt-16" /> : albums.length === 0 ? (
        <div className="text-center py-20">
          <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground mb-4">No albums yet. Create one to start uploading photos.</p>
          <Button onClick={openCreateAlbum}><Plus className="h-4 w-4 mr-1" />Create First Album</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {albums.map(a => {
            const coverUrl = a.photos?.[0]?.url;
            const count = a._count?.photos ?? a.photos?.length ?? 0;
            return (
              <Card
                key={a.id}
                className="cursor-pointer hover:shadow-md transition-shadow group overflow-hidden"
                onClick={() => setOpenAlbum(a)}
              >
                <div className="h-40 bg-muted relative overflow-hidden">
                  {coverUrl ? (
                    <img src={coverUrl} alt={a.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <ImageIcon className="h-10 w-10 text-muted-foreground" />
                    </div>
                  )}
                  {/* edit/delete icons */}
                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      title="Edit album"
                      onClick={e => openEditAlbum(a, e)}
                      className="p-1.5 rounded bg-white/90 hover:bg-white text-gray-700 shadow"
                    ><Pencil className="h-3.5 w-3.5" /></button>
                    <button
                      title="Delete album"
                      onClick={e => { e.stopPropagation(); setDeleteAlbumTarget(a); }}
                      className="p-1.5 rounded bg-white/90 hover:bg-white text-red-600 shadow"
                    ><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium truncate">{a.title}</p>
                    <Badge variant={a.isPublic ? 'success' : 'secondary'} className="shrink-0">{a.isPublic ? 'Public' : 'Private'}</Badge>
                  </div>
                  {a.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.description}</p>}
                  <p className="text-xs text-muted-foreground mt-2">{count} photo{count !== 1 ? 's' : ''}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Album Modal ── */}
      {albumDialog && (
        <AlbumFormModal
          mode={albumDialog}
          form={albumForm}
          setForm={setAlbumForm}
          error={albumError}
          saving={albumSaving}
          onSubmit={handleAlbumSubmit}
          onClose={() => setAlbumDialog(null)}
        />
      )}

      {/* ── Delete Album Confirm (from list view) ── */}
      {deleteAlbumTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h2 className="text-lg font-semibold mb-1">Delete Album</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Permanently delete <strong>{deleteAlbumTarget.title}</strong> and all its photos? This cannot be undone.
            </p>
            <div className="flex gap-2">
              <Button variant="destructive" loading={deleting} onClick={handleDeleteAlbum} className="flex-1">Delete Album</Button>
              <Button variant="outline" onClick={() => setDeleteAlbumTarget(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Album Form Modal ──
interface AlbumFormProps {
  mode: 'create' | 'edit';
  form: { title: string; description: string; isPublic: boolean };
  setForm: React.Dispatch<React.SetStateAction<{ title: string; description: string; isPublic: boolean }>>;
  error: string;
  saving: boolean;
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
}

function AlbumFormModal({ mode, form, setForm, error, saving, onSubmit, onClose }: AlbumFormProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-lg p-6 w-full max-w-md shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{mode === 'create' ? 'New Album' : 'Edit Album'}</h2>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        {error && <p className="text-sm text-destructive mb-3 p-2 bg-destructive/10 rounded">{error}</p>}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <Label>Album Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
          </div>
          <div>
            <Label>Description</Label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1 resize-none"
              placeholder="Describe this album…"
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="isPublic" checked={form.isPublic} onChange={e => setForm(f => ({ ...f, isPublic: e.target.checked }))} className="h-4 w-4" />
            <Label htmlFor="isPublic" className="cursor-pointer font-normal">Make this album visible to students</Label>
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" loading={saving} className="flex-1">{mode === 'create' ? 'Create Album' : 'Save Changes'}</Button>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
