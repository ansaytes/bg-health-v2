'use client';

import { useState } from 'react';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const SEPARATOR = ' | ';

/** true untuk pilihan yang berarti "tidak ada temuan" (mis. "Normal"). */
function isNormalOption(option: string): boolean {
  return /^(normal|dbn|tidak ada)$/i.test(option.trim());
}

/**
 * Dropdown multi-pilih untuk field seperti Gigi & Mulut dan Fisik Mata.
 *
 * Kenapa bukan <details> lagi: daftar pilihan lama memakai posisi absolut di
 * dalam AccordionContent yang ber-`overflow-hidden`, sehingga daftar yang
 * panjang terpotong di tepi bawah kartu dan pilihan terbawah tidak bisa
 * dijangkau. Radix Popover merender daftar lewat Portal ke <body>, jadi tidak
 * bisa terpotong induknya, dan otomatis membalik ke atas / mengecilkan
 * tingginya bila ruang di bawah layar tidak cukup.
 */
export default function MultiSelectField({
  options,
  value,
  onChange,
  allowCustom,
  invalid,
  placeholder = 'Pilih satu atau lebih...',
}: {
  options: string[];
  /** Nilai tersimpan, dipisah " | ". */
  value: string;
  onChange: (value: string) => void;
  allowCustom?: boolean;
  invalid?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');

  const selected = value ? value.split(SEPARATOR).map((v) => v.trim()).filter(Boolean) : [];
  // Nilai tersimpan yang tidak ada di daftar (data lama / isian "Lainnya")
  // tetap ditampilkan sebagai pilihan yang tercentang, supaya tidak hilang
  // diam-diam dan bisa dihapus operator.
  const legacy = selected.filter((s) => !options.includes(s));
  const allOptions = [...options, ...legacy];

  const emit = (next: string[]) => onChange(next.join(SEPARATOR));

  const toggle = (option: string, checked: boolean) => {
    if (!checked) {
      emit(selected.filter((s) => s !== option));
      return;
    }
    if (isNormalOption(option)) {
      // "Normal" tidak boleh bersama temuan abnormal.
      emit([option]);
      return;
    }
    emit([...selected.filter((s) => !isNormalOption(s)), option]);
  };

  const addCustom = () => {
    const text = custom.trim().replace(/\s*\|\s*/g, ' ');
    if (!text) return;
    if (!selected.includes(text)) emit([...selected.filter((s) => !isNormalOption(s)), text]);
    setCustom('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex min-h-9 w-full cursor-pointer items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-left text-xs text-foreground ${
            invalid ? 'border-red-500/60 dark:border-red-500/50' : 'border-input'
          }`}
        >
          <span className="flex flex-1 flex-wrap items-center gap-1.5">
            {selected.length
              ? selected.map((s) => (
                  <span key={s} className="rounded-md bg-primary/10 px-2 py-1 text-primary">{s}</span>
                ))
              : <span className="text-muted-foreground">{placeholder}</span>}
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={12}
        avoidCollisions
        className="flex w-(--radix-popover-trigger-width) min-w-60 max-h-(--radix-popover-content-available-height) flex-col gap-2 p-2"
      >
        <div role="listbox" aria-multiselectable className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain">
          {allOptions.map((option) => {
            const checked = selected.includes(option);
            const isLegacy = legacy.includes(option);
            return (
              <label
                key={option}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => toggle(option, event.target.checked)}
                  className="mt-0.5 accent-primary"
                />
                <span className="flex-1">
                  {option}
                  {isLegacy && <span className="ml-1 text-[10px] text-muted-foreground">(nilai lama / manual)</span>}
                </span>
                {checked && <Check className="mt-0.5 size-3.5 text-primary" />}
              </label>
            );
          })}
        </div>

        {allowCustom && (
          <div className="flex items-center gap-1.5 border-t border-border/60 pt-2">
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Lainnya: ketik temuan lalu Enter"
              className="h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-xs"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={!custom.trim()}
              aria-label="Tambah temuan"
              className="inline-flex size-8 items-center justify-center rounded-md border border-input hover:bg-accent disabled:opacity-40"
            >
              <Plus className="size-4" />
            </button>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => emit([])}
            disabled={selected.length === 0}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            <X className="size-3" /> Kosongkan
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
          >
            Selesai
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
