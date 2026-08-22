'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Trash2, Edit3, Check, X, Moon, Sun, Star, Table2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { useTheme } from 'next-themes';
import { useMCUStore, type SheetConfig } from '@/lib/store';

const STORAGE_KEY = 'mcu-sheet-configs';

function loadConfigs(): SheetConfig[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveConfigs(configs: SheetConfig[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(configs));
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: 'easeOut' },
  }),
};

export default function SettingsView() {
  const store = useMCUStore();
  const { theme, setTheme } = useTheme();
  const mountedRef = useRef(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSpreadsheetId, setFormSpreadsheetId] = useState('');
  const [formSheetName, setFormSheetName] = useState('RAW_DATA');
  const [formStartRow, setFormStartRow] = useState('4');
  const [formTotalCols, setFormTotalCols] = useState('142');

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const loaded = loadConfigs();
    store.setSheetConfigs(loaded);
    const def = loaded.find((c) => c.isDefault);
    if (def) store.setActiveSheetId(def.id);
    // Delayed setState to avoid synchronous set-state-in-effect
    const timer = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(timer);
  }, [store]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormSpreadsheetId('');
    setFormSheetName('RAW_DATA');
    setFormStartRow('4');
    setFormTotalCols('142');
    setEditingId(null);
    setIsNew(false);
  }, []);

  const handleNew = useCallback(() => {
    resetForm();
    setIsNew(true);
  }, [resetForm]);

  const handleEdit = useCallback((config: SheetConfig) => {
    setIsNew(false);
    setEditingId(config.id);
    setFormName(config.name);
    setFormSpreadsheetId(config.spreadsheetId);
    setFormSheetName(config.sheetName);
    setFormStartRow(String(config.dataStartRow));
    setFormTotalCols(String(config.totalCols));
  }, []);

  const handleSave = useCallback(() => {
    if (!formName.trim() || !formSpreadsheetId.trim()) {
      store.showToast('Nama dan Spreadsheet ID wajib diisi', 'error');
      return;
    }

    const configs = [...store.sheetConfigs];
    const configData: SheetConfig = {
      id: editingId || crypto.randomUUID(),
      name: formName.trim(),
      spreadsheetId: formSpreadsheetId.trim(),
      sheetName: formSheetName.trim() || 'RAW_DATA',
      dataStartRow: parseInt(formStartRow) || 4,
      totalCols: parseInt(formTotalCols) || 142,
      isDefault: editingId
        ? configs.find((c) => c.id === editingId)?.isDefault || false
        : configs.length === 0,
    };

    if (editingId) {
      const idx = configs.findIndex((c) => c.id === editingId);
      if (idx >= 0) configs[idx] = configData;
    } else {
      configs.push(configData);
    }

    saveConfigs(configs);
    store.setSheetConfigs(configs);
    if (configData.isDefault) store.setActiveSheetId(configData.id);
    store.showToast('Konfigurasi disimpan', 'success');
    resetForm();
  }, [editingId, formName, formSpreadsheetId, formSheetName, formStartRow, formTotalCols, store, resetForm]);

  const handleDelete = useCallback(
    (id: string) => {
      const configs = store.sheetConfigs.filter((c) => c.id !== id);
      saveConfigs(configs);
      store.setSheetConfigs(configs);
      if (store.activeSheetId === id) {
        const newDef = configs.find((c) => c.isDefault);
        store.setActiveSheetId(newDef?.id || null);
      }
      store.showToast('Konfigurasi dihapus', 'info');
    },
    [store]
  );

  const handleSetDefault = useCallback(
    (id: string) => {
      const configs = store.sheetConfigs.map((c) => ({
        ...c,
        isDefault: c.id === id,
      }));
      saveConfigs(configs);
      store.setSheetConfigs(configs);
      store.setActiveSheetId(id);
      store.showToast('Diatur sebagai default', 'success');
    },
    [store]
  );

  const isEditing = editingId !== null || isNew;

  return (
    <div className="space-y-6 pb-6">
      {/* Theme toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="bg-card rounded-2xl p-5"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              {mounted && theme === 'dark' ? (
                <Moon className="size-5 text-primary" />
              ) : (
                <Sun className="size-5 text-primary" />
              )}
            </div>
            <div>
              <h3 className="text-sm font-semibold">Tampilan Gelap</h3>
              <p className="text-xs text-muted-foreground">Ganti tema aplikasi</p>
            </div>
          </div>
          <Switch
            checked={mounted ? theme === 'dark' : false}
            onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
          />
        </div>
      </motion.div>

      {/* Spreadsheet configs header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Table2 className="size-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Target Spreadsheet</h3>
            <p className="text-xs text-muted-foreground">
              {store.sheetConfigs.length} konfigurasi
            </p>
          </div>
        </div>
        <motion.div whileTap={{ scale: 0.95 }}>
          <Button
            size="sm"
            onClick={handleNew}
            className="rounded-xl gap-1.5"
          >
            <Plus className="size-3.5" />
            Baru
          </Button>
        </motion.div>
      </motion.div>

      {/* New/Edit form */}
      <AnimatePresence>
        {isEditing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-2xl p-5 space-y-3">
              <h4 className="text-sm font-semibold">
                {isNew ? 'Konfigurasi Baru' : 'Edit Konfigurasi'}
              </h4>

              <div>
                <label className="text-xs text-muted-foreground">Nama</label>
                <Input
                  placeholder="Contoh: MCU 2026 Raw Data"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="h-10 rounded-xl bg-background mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Spreadsheet ID</label>
                <Input
                  placeholder="Google Spreadsheet ID"
                  value={formSpreadsheetId}
                  onChange={(e) => setFormSpreadsheetId(e.target.value)}
                  className="h-10 rounded-xl bg-background mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground">Sheet Name</label>
                  <Input
                    placeholder="RAW_DATA"
                    value={formSheetName}
                    onChange={(e) => setFormSheetName(e.target.value)}
                    className="h-10 rounded-xl bg-background mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Data Start Row</label>
                  <Input
                    type="number"
                    placeholder="4"
                    value={formStartRow}
                    onChange={(e) => setFormStartRow(e.target.value)}
                    className="h-10 rounded-xl bg-background mt-1"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground">Total Columns</label>
                <Input
                  type="number"
                  placeholder="142"
                  value={formTotalCols}
                  onChange={(e) => setFormTotalCols(e.target.value)}
                  className="h-10 rounded-xl bg-background mt-1"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  onClick={handleSave}
                  className="flex-1 h-10 rounded-xl"
                  size="sm"
                >
                  <Check className="size-3.5" />
                  Simpan
                </Button>
                <Button
                  variant="outline"
                  onClick={resetForm}
                  className="h-10 rounded-xl"
                  size="sm"
                >
                  <X className="size-3.5" />
                  Batal
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config list */}
      <div className="space-y-3">
        <AnimatePresence>
          {store.sheetConfigs.map((config, i) => (
            <motion.div
              key={config.id}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, x: -100 }}
              className={`bg-card rounded-2xl p-4 transition-all ${config.id === store.activeSheetId ? 'ring-2 ring-primary/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold truncate">{config.name}</h4>
                    {config.isDefault && (
                      <Star className="size-3.5 text-amber-500 fill-amber-500 shrink-0" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {config.sheetName} • Baris {config.dataStartRow} • {config.totalCols} kolom
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 font-mono truncate">
                    {config.spreadsheetId}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() => handleEdit(config)}
                    >
                      <Edit3 className="size-3.5" />
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg"
                      onClick={() => handleSetDefault(config.id)}
                    >
                      <Star className={`size-3.5 ${config.isDefault ? 'text-amber-500 fill-amber-500' : ''}`} />
                    </Button>
                  </motion.div>
                  <motion.div whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 rounded-lg text-destructive hover:text-destructive"
                      onClick={() => handleDelete(config.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </motion.div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {store.sheetConfigs.length === 0 && !isEditing && (
          <div className="text-center py-12 text-muted-foreground">
            <Table2 className="size-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Belum ada konfigurasi spreadsheet</p>
            <p className="text-xs mt-1">Tap &quot;Baru&quot; untuk menambahkan</p>
          </div>
        )}
      </div>
    </div>
  );
}
