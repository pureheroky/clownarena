"use client";

import Editor from "@monaco-editor/react";

export function CodeEditor({
  value,
  onChange,
  height = 420
}: {
  value: string;
  onChange: (value: string) => void;
  height?: number;
}) {
  return (
    <div className="min-w-0 overflow-hidden">
      <Editor
        defaultLanguage="python"
        height={height}
        theme="vs-light"
        value={value}
        options={{
          automaticLayout: true,
          minimap: { enabled: false },
          fontSize: 14,
          padding: { top: 16 },
          scrollBeyondLastLine: false,
          wordWrap: "on"
        }}
        onChange={(next) => onChange(next ?? "")}
      />
    </div>
  );
}
