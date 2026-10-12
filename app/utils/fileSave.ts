export interface SaveResult {
  success: boolean;
  path?: string;
  downloadStarted?: boolean;
}

interface SaveWindow extends Window {
  pywebview?: { api?: { save_file(filename: string, data: string): Promise<{ success: boolean; path?: string; error?: string }> } };
  showSaveFilePicker?: (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<{
    name: string;
    createWritable(): Promise<{ write(blob: Blob): Promise<void>; close(): Promise<void> }>;
  }>;
}

/** Only fall back when a save API is unavailable, never after a failed write. */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  const target = window as SaveWindow;
  const api = target.pywebview?.api;
  if (api?.save_file) {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
      reader.readAsDataURL(blob);
    });
    const result = await api.save_file(filename, base64);
    if (result?.success) return { success: true, path: result.path };
    if (result?.error === 'Cancelled') return { success: false };
    throw new Error(result?.error || '文件保存失败');
  }

  if (target.showSaveFilePicker) {
    const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
    const types: Record<string, { description: string; accept: Record<string, string[]> }> = {
      txt: { description: 'TXT 文本文件', accept: { 'text/plain': ['.txt'] } },
      json: { description: 'JSON 专名词典', accept: { 'application/json': ['.json'] } },
      srt: { description: 'SRT 字幕文件', accept: { 'application/x-subrip': ['.srt'] } },
      docx: { description: 'Word 文档', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } },
    };
    let handle;
    try {
      handle = await target.showSaveFilePicker({ suggestedName: filename, types: [types[ext] || types.txt] });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return { success: false };
      throw error;
    }
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { success: true, path: handle.name };
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  try {
    anchor.click();
    return { success: true, path: filename, downloadStarted: true };
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
