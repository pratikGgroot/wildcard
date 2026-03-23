"use client";

import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import { Bold, Italic, List, ListOrdered, Heading2, Undo, Redo } from "lucide-react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  label?: string;
  required?: boolean;
}

export function RichTextEditor({ value, onChange, placeholder = "Enter description...", error, label, required }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [StarterKit, Link.configure({ openOnClick: false })],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        style: "min-height:200px;padding:12px 14px;outline:none;font-size:13px;line-height:1.6;color:#111827",
      },
    },
  });

  // Sync external value changes (e.g. when a template is applied via reset())
  const prevValueRef = React.useRef(value);
  React.useEffect(() => {
    if (!editor) return;
    if (value !== prevValueRef.current) {
      prevValueRef.current = value;
      // Only update if editor content actually differs to avoid cursor jumps
      const current = editor.getHTML();
      if (current !== value) {
        editor.commands.setContent(value || "", false);
      }
    }
  }, [editor, value]);

  const isEmpty = !editor?.getText().trim();
  const charCount = editor?.getText().length ?? 0;
  const pct = Math.min((charCount / 10000) * 100, 100);

  const tbBtn = (active: boolean, disabled = false) => ({
    padding: "5px 6px", borderRadius: 6, border: "none", cursor: disabled ? "not-allowed" : "pointer",
    background: active ? "#e0e7ff" : "transparent",
    color: active ? "#4f46e5" : disabled ? "#d1d5db" : "#6b7280",
    display: "flex", alignItems: "center", justifyContent: "center",
    opacity: disabled ? 0.5 : 1,
  } as React.CSSProperties);

  return (
    <div>
      {label && (
        <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6 }}>
          {label}{required && <span style={{ color: "#ef4444", marginLeft: 3 }}>*</span>}
        </label>
      )}
      <div style={{
        border: `1px solid ${error ? "#ef4444" : "#d1d5db"}`,
        borderRadius: 10, overflow: "hidden", background: "#fff",
        boxShadow: error ? "0 0 0 3px rgba(239,68,68,0.1)" : "none",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}>
        {/* Toolbar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 2,
          padding: "6px 10px", borderBottom: "1px solid #f3f4f6", background: "#fafafa",
        }}>
          <button type="button" style={tbBtn(editor?.isActive("heading", { level: 2 }) ?? false)}
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading">
            <Heading2 size={14} />
          </button>
          <button type="button" style={tbBtn(editor?.isActive("bold") ?? false)}
            onClick={() => editor?.chain().focus().toggleBold().run()} title="Bold">
            <Bold size={14} />
          </button>
          <button type="button" style={tbBtn(editor?.isActive("italic") ?? false)}
            onClick={() => editor?.chain().focus().toggleItalic().run()} title="Italic">
            <Italic size={14} />
          </button>
          <div style={{ width: 1, height: 16, background: "#e5e7eb", margin: "0 4px" }} />
          <button type="button" style={tbBtn(editor?.isActive("bulletList") ?? false)}
            onClick={() => editor?.chain().focus().toggleBulletList().run()} title="Bullet list">
            <List size={14} />
          </button>
          <button type="button" style={tbBtn(editor?.isActive("orderedList") ?? false)}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()} title="Numbered list">
            <ListOrdered size={14} />
          </button>
          <div style={{ width: 1, height: 16, background: "#e5e7eb", margin: "0 4px" }} />
          <button type="button" style={tbBtn(false, !editor?.can().undo())}
            onClick={() => editor?.chain().focus().undo().run()} title="Undo">
            <Undo size={14} />
          </button>
          <button type="button" style={tbBtn(false, !editor?.can().redo())}
            onClick={() => editor?.chain().focus().redo().run()} title="Redo">
            <Redo size={14} />
          </button>
        </div>

        {/* Editor */}
        <div style={{ position: "relative" }}>
          {isEmpty && (
            <p style={{
              position: "absolute", top: 12, left: 14, fontSize: 13,
              color: "#9ca3af", pointerEvents: "none", userSelect: "none", margin: 0,
            }}>
              {placeholder}
            </p>
          )}
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
        {error
          ? <p style={{ fontSize: 11, color: "#dc2626", margin: 0 }}>{error}</p>
          : <span />
        }
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 64, height: 3, background: "#e5e7eb", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 99, transition: "width 0.3s",
              width: `${pct}%`,
              background: pct > 90 ? "#ef4444" : charCount < 50 ? "#f59e0b" : "#4f46e5",
            }} />
          </div>
          <span style={{ fontSize: 11, color: charCount < 50 ? "#f59e0b" : "#9ca3af" }}>
            {charCount.toLocaleString()} / 10,000
          </span>
        </div>
      </div>
    </div>
  );
}
