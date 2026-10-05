import { useEffect, useState } from 'react';
import { useStore } from '../store';
import { cn } from '../utils';
import { LayoutGrid, Plus, Trash2, Edit2, Palette } from 'lucide-react';

const COLORS = ['#ef4444', '#f97316', '#f59e0b', '#22c55e', '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#f43f5e'];

export function CategoriesView() {
  const { categories, loadCategories, setView, setSelectedCategoryId, showToast } = useStore();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');

  useEffect(() => { loadCategories(); }, []);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (editingId) {
      await window.electronAPI.updateCategory(editingId, { name, color });
      showToast('دسته‌بندی ویرایش شد');
    } else {
      await window.electronAPI.createCategory({ name, color });
      showToast('دسته‌بندی ایجاد شد');
    }
    setName('');
    setColor('#6366f1');
    setShowForm(false);
    setEditingId(null);
    loadCategories();
  };

  const handleDelete = async (id: string) => {
    await window.electronAPI.deleteCategory(id);
    showToast('دسته‌بندی حذف شد', 'error');
    loadCategories();
  };

  const handleEdit = (cat: any) => {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color);
    setShowForm(true);
  };

  return (
    <div className="h-full overflow-y-auto p-6 animate-fade-in">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-foreground">دسته‌بندی‌ها</h1>
          <button onClick={() => { setShowForm(true); setEditingId(null); setName(''); setColor('#6366f1'); }} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
            <Plus className="w-4 h-4" />
            جدید
          </button>
        </div>

        {showForm && (
          <div className="mb-6 p-4 rounded-xl border border-border bg-card animate-slide-up">
            <h3 className="text-sm font-medium mb-3">{editingId ? 'ویرایش دسته‌بندی' : 'دسته‌بندی جدید'}</h3>
            <input
              type="text"
              placeholder="نام دسته‌بندی"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            <div className="flex items-center gap-2 mb-3">
              <Palette className="w-4 h-4 text-muted-foreground" />
              <div className="flex gap-1.5 flex-wrap">
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)}                     className={cn('w-6 h-6 rounded-full transition-all', color === c && 'ring-2 ring-offset-2 ring-offset-background')} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleSubmit} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">{editingId ? 'ذخیره' : 'ایجاد'}</button>
              <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 rounded-lg bg-muted text-muted-foreground text-sm hover:bg-muted/80">لغو</button>
            </div>
          </div>
        )}

        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} onClick={() => { setView('category-detail'); setSelectedCategoryId(cat.id); }} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 bg-card hover:bg-accent/5 transition-all cursor-pointer">
              <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{cat.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{cat.taskCount || 0} تسک</div>
              </div>
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <button onClick={() => handleEdit(cat)} className="p-1.5 rounded-md hover:bg-muted transition-colors"><Edit2 className="w-3.5 h-3.5 text-muted-foreground" /></button>
                <button onClick={() => handleDelete(cat.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors"><Trash2 className="w-3.5 h-3.5 text-destructive" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
