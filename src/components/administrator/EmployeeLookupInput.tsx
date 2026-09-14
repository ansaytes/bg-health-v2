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
}

type LookupStatus = 'idle' | 'searching' | 'found' | 'not_found';

const SPINNER_COLOR = '#ff4d00';
const FOUND_COLOR = '#00B894';
const NOT_FOUND_COLOR = '#FF4444';

/**
 * Auto-detect search type based on input pattern:
 * - 16 digits (exactly) → national_id (NIK KTP)
 * - All digits but not 16 → nik (NIK Karyawan)
 * - Has letters → nama
 */
function autoDetectSearchBy(query: string): 'nik' | 'national_id' | 'nama' {
  const trimmed = query.trim();
  if (!trimmed) return 'nama';
  // If contains any letter → name search
  if (/[a-zA-Z]/.test(trimmed)) return 'nama';
  // If all digits
  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length === 16) return 'national_id';
    return 'nik';
  }
  // Default fallback
  return 'nama';
}

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
  debounceMs = 400,
  inputStyle,
}: EmployeeLookupInputProps) {
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [suggestions, setSuggestions] = useState<EmployeeData[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchedValue = useRef<string>('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-detect search type
  const searchBy = autoDetectSearchBy(value);
  const minLength = minLengthProp || (searchBy === 'nama' ? 3 : 4);

  // Single unified placeholder (auto-detect handles type)
  const dynamicPlaceholder = 'Masukkan NIK KTP, NIK Karyawan, atau Nama Karyawan';
  const placeholder = placeholderProp || dynamicPlaceholder;

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const doLookup = useCallback(
    async (searchValue: string) => {
      if (searchValue.length < minLength || searchValue === lastSearchedValue.current) return;
      lastSearchedValue.current = searchValue;
      const detectedType = autoDetectSearchBy(searchValue);

      setStatus('searching');
      setShowSuggestions(true);
      try {
        const res = await fetch('/api/employee', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: searchValue, searchBy: detectedType }),
        });
        const json = await res.json();
        if (json.success && json.data && json.data.length > 0) {
          const results = json.data as EmployeeData[];
          setSuggestions(results);
          setStatus('found');
          // If only 1 result, auto-fill directly
          if (results.length === 1) {
            const emp = results[0];
            onEmployeeFound(emp);
            if (autoFill && onAutoFill) {
              const entries = Object.entries(autoFill) as [string, string][];
              for (const [empField, formFieldId] of entries) {
                const val = emp[empField];
                if (val) onAutoFill(formFieldId, val);
              }
            }
            setShowSuggestions(false);
          }
        } else {
          setSuggestions([]);
          setStatus('not_found');
        }
      } catch (_err) {
        setStatus('not_found');
        setSuggestions([]);
      }
    },
    [autoFill, onAutoFill, onEmployeeFound, minLength]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    if (v !== lastSearchedValue.current) {
      setStatus('idle');
      setSuggestions([]);
      setShowSuggestions(false);
    }
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (v.length >= minLength) {
      debounceTimer.current = setTimeout(() => doLookup(v), debounceMs);
    }
  };

  const handleBlur = () => {
    // Delay blur so click on suggestion works
    setTimeout(() => {
      if (value.length >= minLength && value !== lastSearchedValue.current) {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        doLookup(value);
      }
    }, 150);
  };

  const handleSelectSuggestion = (emp: EmployeeData) => {
    onEmployeeFound(emp);
    if (autoFill && onAutoFill) {
      const entries = Object.entries(autoFill) as [string, string][];
      for (const [empField, formFieldId] of entries) {
        const val = emp[empField];
        if (val) onAutoFill(formFieldId, val);
      }
    }
    // Optionally fill input with NIK Karyawan for visibility
    if (emp.nik) onChange(emp.nik);
    setStatus('found');
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
        doLookup(value);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(prev => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(prev => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeSuggestion >= 0 && activeSuggestion < suggestions.length) {
        handleSelectSuggestion(suggestions[activeSuggestion]);
      } else if (suggestions.length > 0) {
        handleSelectSuggestion(suggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setActiveSuggestion(-1);
    }
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

  // Detect badge text
  const detectBadge = value && value.length >= 2
    ? (searchBy === 'nik' ? 'NIK Karyawan' : searchBy === 'national_id' ? 'NIK KTP' : 'Nama')
    : null;

  const displayLabel = label || <>Cari Data Karyawan {required !== false && <span style={{ color: '#ff4d00', marginLeft: 2 }}>*</span>}</>;

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <label className="admin-label">
        {displayLabel}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          type="text"
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
          placeholder={placeholder}
          className={className}
          style={borderOverride}
          autoComplete="off"
        />
        {detectBadge && (
          <span style={{
            position: 'absolute',
            right: 36,
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--brand-primary, #ff4d00)',
            background: 'rgba(255,77,0,0.1)',
            padding: '1px 6px',
            borderRadius: 4,
            pointerEvents: 'none',
          }}>
            {detectBadge}
          </span>
        )}
        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', width: 18, height: 18 }}>
          {indicatorIcon}
        </span>
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="emp-suggestions-dropdown" style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 10,
          boxShadow: '0 12px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000,
          maxHeight: 320,
          overflowY: 'auto',
        }}>
          {suggestions.map((emp, idx) => (
            <div
              key={`${emp.nik}-${idx}`}
              onClick={() => handleSelectSuggestion(emp)}
              onMouseEnter={() => setActiveSuggestion(idx)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: idx === activeSuggestion ? 'rgba(255,77,0,0.12)' : 'transparent',
                borderBottom: idx < suggestions.length - 1 ? '1px solid var(--border, rgba(255,255,255,0.04))' : 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                transition: 'background 0.12s',
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #ff4d00, #ff6b2b)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {(emp.nama || '?').charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--foreground, #fff)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {emp.nama || '(Tanpa nama)'}
                </div>
                <div style={{
                  fontSize: 10,
                  color: 'var(--muted-foreground, #888)',
                  display: 'flex',
                  gap: 8,
                  marginTop: 2,
                }}>
                  {emp.national_id && (
                    <span style={{ fontFamily: 'monospace' }}>
                      KTP: {emp.national_id.length > 16 ? '••••' + emp.national_id.slice(-4) : emp.national_id}
                    </span>
                  )}
                  {emp.site_name && (
                    <span>📍 {emp.site_name}</span>
                  )}
                </div>
              </div>
              {emp.nik && (
                <div style={{
                  fontSize: 10,
                  color: 'var(--brand-primary, #ff4d00)',
                  fontWeight: 600,
                  background: 'rgba(255,77,0,0.08)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}>
                  {emp.nik}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
