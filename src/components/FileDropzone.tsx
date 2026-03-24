import { useRef, useState } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
  isLoading: boolean;
  error: string | null;
}

export function FileDropzone({ onFile, isLoading, error }: Props) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handle = (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) return;
    onFile(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handle(file);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handle(file);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload your donation spreadsheet"
      onClick={() => !isLoading && inputRef.current?.click()}
      onKeyDown={e => e.key === 'Enter' && !isLoading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      style={{
        border: `1.5px dashed ${dragging ? 'var(--green)' : error ? 'var(--red)' : 'var(--border2)'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '48px 32px',
        textAlign: 'center',
        background: dragging ? 'var(--green-bg)' : 'var(--surface)',
        cursor: isLoading ? 'wait' : 'pointer',
        transition: 'border-color 200ms, background 200ms',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
        userSelect: 'none',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={onChange}
        aria-hidden="true"
      />

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%',
            border: '2px solid var(--border2)',
            borderTopColor: 'var(--green)',
            animation: 'spin 0.75s linear infinite',
          }} />
          <p style={{ fontSize: 14, color: 'var(--text2)', fontWeight: 500 }}>Parsing spreadsheet…</p>
        </div>
      ) : (
        <>
          <div style={{
            width: 56, height: 56, borderRadius: 'var(--radius)',
            background: 'var(--green-bg)', border: '1px solid var(--green-ring)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {dragging
              ? <FileSpreadsheet size={26} color="var(--green)" />
              : <UploadCloud size={26} color="var(--green)" />
            }
          </div>

          <div>
            <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>
              {dragging ? 'Drop file to upload' : 'Upload your spreadsheet'}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>
              Drag & drop or click to browse · .xlsx, .xls, .csv
            </p>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 13, color: 'var(--red)', fontWeight: 500,
              padding: '8px 14px', borderRadius: 'var(--radius-sm)',
              background: 'var(--red-bg)', border: '1px solid rgba(220,38,38,0.2)',
              maxWidth: 380, textAlign: 'left',
            }}>
              <AlertCircle size={14} style={{ flexShrink: 0 }} /> {error}
            </div>
          )}
        </>
      )}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
