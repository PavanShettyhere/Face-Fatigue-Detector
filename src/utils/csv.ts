export function toCsv<T extends object>(rows: T[]): string {
  if (!rows.length) {
    return "";
  }

  const firstRow = rows[0] as Record<string, unknown>;
  const headers = Object.keys(firstRow);
  const escapeValue = (value: unknown) => {
    if (value === null || value === undefined) {
      return "";
    }
    const stringValue =
      typeof value === "object" ? JSON.stringify(value) : String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, "\"\"")}"`;
    }
    return stringValue;
  };

  const lines = [
    headers.join(","),
    ...rows.map((row) => {
      const record = row as Record<string, unknown>;
      return headers.map((header) => escapeValue(record[header])).join(",");
    }),
  ];

  return lines.join("\n");
}

export function triggerDownload(filename: string, contents: BlobPart, type: string): void {
  const blob = new Blob([contents], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
