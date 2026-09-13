'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export interface EmployeeData {
  nik: string;
  nama: string;
  gender?: string;
  department?: string;
  division?: string;
  job_position?: string;
  site_name?: string;
  national_id?: string;
  phone_number?: string;
  [key: string]: string | undefined;
}

export type SearchBy = 'nik' | 'national_id' | 'nama';

interface EmployeeLookupInputProps {
  value: string;
  onChange: (value: string) => void;
  onEmployeeFound: (data: EmployeeData) => void;
  placeholder?: string;
  label?: React.ReactNode;
  required?: boolean;
  className?: string;
  autoFill?: Record<string, string>;
  onAutoFill?: (formFieldId: string, value: string) => void;
  minLength?: number;
  debounceMs?: number;
  inputStyle?: React.CSSProperties;
  /** Show the "search by" dropdown selector. Default: true */
  showSearchBySelector?: boolean;
  /** Default search field. Default: 'nik' */
  defaultSearchBy?: SearchBy;
}

type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found';

const SPINNER_COLOR = '#ff4d00';
const FOUND_COLOR = '#00B894';
const NOT_FOUND_COLOR = '#FF4444';

const SEARCH_BY_OPTIONS: { value: SearchBy; label: string; placeholder: string; minLength: number }[] = [
  { value: 'nik', label: 'NIK', placeholder: 'Masukkan NIK karyawan (mis. 230802778)', minLength: 4 },
  { value: 'national_id', label: 'National ID', placeholder: 'Masukkan National ID / NIK KTP', minLength: 6 },
  { value: 'nama', label: 'Nama', placeholder: 'Ketik nama karyawan (mis. Budi)', minLength: 3 },
];

export default function EmployeeLookupInput({
  value,
  onChange,
  onEmployeeFound,
  placeholder: placeholderProp,
  label,
  required,
  className = 'admin-input',
  autoFill,
  onAutoFill,
  minLength: minLengthProp,
  debounceMs = 500,
  inputStyle,
  showSearchBySelector = true,
  defaultSearchBy = 'nik',
}: EmployeeLookupInputProps) {
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [searchBy, setSearchBy] = useState<SearchBy>(defaultSearchBy);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedValue = useRef<string>('');

  // Dynamic placeholder based on searchBy
  const currentOption = SEARCH_BY_OPTIONS.find(o => o.value === searchBy) || SEARCH_BY_OPTIONS[0];
  const placeholder = placeholderProp || currentOption.placeholder;
  const minLength = minLengthProp || currentOption.minLength;

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  const doLookup = useCallback(
    async (searchValue: string) => {
      if (searchValue.length < minLength || searchValue === lastSearchedValue.current) return;
      lastSearchedValue.current = searchValue;

      setStatus('searching');
      try {
        const res = await fetch('/api/employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchValue, searchBy }),
        });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const emp = json.data[0] as EmployeeData;
          setStatus('found');
          onEmployeeFound(emp);
          if (autoFill && onAutoFill) {
            const entries = Object.entries(autoFill) as [string, string][];
            for (const [empField, formFieldId] of entries) {
              const val = emp[empField];
              if (val) onAutoFill(formFieldId, val);
            }
          }
        } else {
          setStatus('not_found');
        }
      } catch (_err) {
        setStatus('not_found');
      }
    },
    [autoFill, onAutoFill, onEmployeeFound, minLength, searchBy]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (v !== lastSearchedValue.current) {
      setStatus('idle');
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (v.length >= minLength) {
      debounceTimer.current = setTimeout(() => doLookup(v), debounceMs);
    }
  };

  const handleBlur = () => {
    if (value.length >= minLength && value !== lastSearchedValue.current) {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      doLookup(value);
    }
  };

  const handleSearchByChange = (newSearchBy: SearchBy) => {
    setSearchBy(newSearchBy);
    setStatus('idle');
    lastSearchedValue.current = '';
    // Clear current value when switching search type (different fields have different formats)
    onChange('');
  };

  const borderOverride: React.CSSProperties = {
    ...(inputStyle || {}),
    ...(status === 'found'
      ? { borderColor: FOUND_COLOR, boxShadow: '0 0 0 2px rgba(0,184,148,0.15)' }
      : status === 'not_found'
        ? { borderColor: NOT_FOUND_COLOR }
        : {}),
    paddingRight: 36,
  };

  const indicatorIcon = (() => {
    if (status === 'searching') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={SPINNER_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'emp-lookup-spin 0.8s linear infinite' }}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      );
    }
    if (status === 'found') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={FOUND_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    }
    if (status === 'not_found') {
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={NOT_FOUND_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      );
    }
    return null;
  })();

  return (
    <div>
      {label && (
        <label className="admin-label">
          {label}
          {required && <span style={{ color: '#ff4d00', marginLeft: 2 }}>*</span>}
        </label>
      )}
      {showSearchBySelector && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {SEARCH_BY_OPTIONS.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleSearchByChange(opt.value)}
              style={{
                padding: '3px 10px',
                fontSize: 10,
                fontWeight: 600,
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: searchBy === opt.value ? 'var(--brand-primary, #ff4d00)' : 'transparent',
                color: searchBy === opt.value ? '#fff' : 'var(--muted-foreground)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={className}
          style={borderOverride}
        />
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', width: 18, height: 18 }}>
          {indicatorIcon}
        </span>
      </div>
    </div>
  );
}
