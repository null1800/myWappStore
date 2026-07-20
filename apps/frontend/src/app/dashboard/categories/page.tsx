'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, FolderOpen, Save, X } from 'lucide-react';
import { api } from '@/lib/api';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from 'sonner';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Edit / Create Form States
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/categories');
      setCategories(data.data || data); // handle standard REST wrapper or direct array
    } catch {
      toast.error('Failed to load categories');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleNameChange = (val: string) => {
    setFormName(val);
    // Auto-slugify
    setFormSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''));
  };

  const handleOpenCreate = () => {
    setIsCreating(true);
    setEditingCategory(null);
    setFormName('');
    setFormSlug('');
    setFormDesc('');
    setFormIsActive(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setIsCreating(false);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormDesc(cat.description ?? '');
    setFormIsActive(cat.isActive);
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingCategory(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formSlug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName,
        slug: formSlug,
        description: formDesc || null,
        isActive: formIsActive,
      };

      if (isCreating) {
        await api.post('/categories', payload);
        toast.success('Category created');
      } else if (editingCategory) {
        await api.patch(`/categories/${editingCategory.id}`, payload);
        toast.success('Category updated');
      }

      setIsCreating(false);
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category? Products in this category will be set to "No Category".')) return;
    setDeletingId(id);
    try {
      await api.delete(`/categories/${id}`);
      toast.success('Category deleted');
      fetchCategories();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message ?? 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Categories</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-0.5">Manage your storefront product classification</p>
        </div>
        {!isCreating && !editingCategory && (
          <button onClick={handleOpenCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Category
          </button>
        )}
      </div>

      {(isCreating || editingCategory) && (
        <form onSubmit={handleSave} className="card p-5 space-y-4 max-w-xl">
          <div className="flex justify-between items-center pb-2 border-b border-[var(--border)]">
            <h3 className="font-semibold text-[var(--text-primary)]">
              {isCreating ? 'Create Category' : 'Edit Category'}
            </h3>
            <button type="button" onClick={handleCancel} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="label">Category Name</label>
            <input
              required
              className="input"
              placeholder="e.g. Shirts & Blouses"
              value={formName}
              onChange={(e) => handleNameChange(e.target.value)}
            />
          </div>

          <div>
            <label className="label">Slug URL</label>
            <input
              required
              className="input"
              placeholder="e.g. shirts-blouses"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))}
            />
          </div>

          <div>
            <label className="label">Description (Optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Description of the category…"
              value={formDesc}
              onChange={(e) => setFormDesc(e.target.value)}
            />
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                className="w-4 h-4 accent-[var(--brand)]"
                checked={formIsActive}
                onChange={(e) => setFormIsActive(e.target.checked)}
              />
              <div>
                <span className="text-sm font-medium text-[var(--text-primary)]">Active status</span>
                <p className="text-xs text-[var(--text-muted)]">Show this category on your storefront filter list</p>
              </div>
            </label>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={handleCancel} className="btn-secondary">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
              {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
              Save Category
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20"><Spinner size="lg" className="text-[var(--brand)]" /></div>
      ) : categories.length === 0 ? (
        <div className="card p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 rounded-xl bg-[var(--surface-3)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
            <FolderOpen className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-semibold text-[var(--text-primary)]">No categories yet</h3>
            <p className="text-sm text-[var(--text-secondary)] mt-1">Create categories to structure your catalog.</p>
          </div>
          <button onClick={handleOpenCreate} className="btn-primary inline-flex items-center gap-2 mx-auto">
            <Plus className="w-4 h-4" /> Add Category
          </button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 max-w-4xl">
          {categories.map((cat) => (
            <div key={cat.id} className="card p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold text-[var(--text-primary)] flex items-center gap-2">
                      {cat.name}
                      {!cat.isActive && <span className="badge badge-gray text-[10px] py-0.5">Inactive</span>}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">/{cat.slug}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEdit(cat)}
                      className="p-2 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-3)] rounded-lg transition-colors"
                      title="Edit Category"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      disabled={deletingId === cat.id}
                      onClick={() => handleDelete(cat.id)}
                      className="p-2 text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete Category"
                    >
                      {deletingId === cat.id ? <Spinner size="sm" /> : <Trash2 className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {cat.description && (
                  <p className="text-sm text-[var(--text-secondary)] line-clamp-2">{cat.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
