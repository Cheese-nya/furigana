import os
import threading
import customtkinter as ctk
from tkinter import filedialog, messagebox

from furigana_engine import annotate_line
from exporter import generate_txt, generate_srt, generate_docx

# Application Settings
ctk.set_appearance_mode("System")
ctk.set_default_color_theme("blue")

class FuriganaApp(ctk.CTk):
    def __init__(self):
        super().__init__()
        
        self.title("Furigana Dubbing Studio - Native Python Edition")
        self.geometry("1000x700")
        self.minsize(800, 600)
        
        self.ruby_type = ctk.StringVar(value="hiragana")
        self.font_size = ctk.IntVar(value=16)
        
        self.setup_ui()
        self.update_preview()
        
    def setup_ui(self):
        # Top Bar
        top_frame = ctk.CTkFrame(self, fg_color="transparent")
        top_frame.pack(fill="x", padx=20, pady=10)
        
        title_label = ctk.CTkLabel(top_frame, text="日语假名配音台本工作室", font=ctk.CTkFont(size=24, weight="bold"))
        title_label.pack(side="left")
        
        # Options Frame
        options_frame = ctk.CTkFrame(self)
        options_frame.pack(fill="x", padx=20, pady=10)
        
        # Ruby Type selection
        ruby_label = ctk.CTkLabel(options_frame, text="注音模式:")
        ruby_label.pack(side="left", padx=10, pady=10)
        
        ruby_seg = ctk.CTkSegmentedButton(options_frame, values=["平假名 (Hiragana)", "片假名 (Katakana)", "罗马音 (Romaji)"],
                                          command=self.on_ruby_change)
        ruby_seg.set("平假名 (Hiragana)")
        ruby_seg.pack(side="left", padx=10, pady=10)
        
        # Font Size selection
        font_label = ctk.CTkLabel(options_frame, text="字号:")
        font_label.pack(side="left", padx=10, pady=10)
        
        def decrease_font():
            self.font_size.set(max(12, self.font_size.get() - 2))
            self.update_preview()
            
        def increase_font():
            self.font_size.set(min(36, self.font_size.get() + 2))
            self.update_preview()
            
        ctk.CTkButton(options_frame, text="-", width=30, command=decrease_font).pack(side="left", padx=5)
        font_val_label = ctk.CTkLabel(options_frame, textvariable=self.font_size)
        font_val_label.pack(side="left", padx=5)
        ctk.CTkButton(options_frame, text="+", width=30, command=increase_font).pack(side="left", padx=5)
        
        # Main Work Area
        work_frame = ctk.CTkFrame(self, fg_color="transparent")
        work_frame.pack(fill="both", expand=True, padx=20, pady=10)
        
        work_frame.columnconfigure(0, weight=1)
        work_frame.columnconfigure(1, weight=1)
        work_frame.rowconfigure(1, weight=1)
        
        ctk.CTkLabel(work_frame, text="📝 原始台本输入", font=ctk.CTkFont(weight="bold")).grid(row=0, column=0, sticky="w", pady=(0, 5))
        ctk.CTkLabel(work_frame, text="🎙️ 配音台本预览 (文本版)", font=ctk.CTkFont(weight="bold")).grid(row=0, column=1, sticky="w", pady=(0, 5), padx=(10, 0))
        
        self.input_text = ctk.CTkTextbox(work_frame, wrap="word", font=ctk.CTkFont(size=14))
        self.input_text.grid(row=1, column=0, sticky="nsew", pady=5)
        self.input_text.insert("0.0", "山田先生：みなさん、こんにちは！今日の日本語アフレコ台本へようこそ。\n佐藤：先生、この漢字の読み方は何ですか？\n山田先生：これは「未来」と「希望」です。\n鈴木：声優の吹替練習を始めましょう！")
        self.input_text.bind("<KeyRelease>", lambda e: self.update_preview())
        
        self.preview_text = ctk.CTkTextbox(work_frame, wrap="word", state="disabled", font=ctk.CTkFont(size=16))
        self.preview_text.grid(row=1, column=1, sticky="nsew", pady=5, padx=(10, 0))
        
        # Export Bar
        export_frame = ctk.CTkFrame(self)
        export_frame.pack(fill="x", padx=20, pady=10, side="bottom")
        
        ctk.CTkLabel(export_frame, text="单文件导出:").pack(side="left", padx=10, pady=10)
        ctk.CTkButton(export_frame, text="导出 TXT", command=lambda: self.export_file("txt")).pack(side="left", padx=5)
        ctk.CTkButton(export_frame, text="导出 SRT", command=lambda: self.export_file("srt")).pack(side="left", padx=5)
        ctk.CTkButton(export_frame, text="导出 Word (真 Ruby)", fg_color="#2b579a", hover_color="#1a3b6c", 
                      command=lambda: self.export_file("docx")).pack(side="left", padx=5)
        
        ctk.CTkButton(export_frame, text="📁 批量处理 (TXT/SRT/DOCX)", fg_color="#107c41", hover_color="#0b582e",
                      command=self.open_batch_window).pack(side="right", padx=10, pady=10)

    def on_ruby_change(self, value):
        if "Hiragana" in value:
            self.ruby_type.set("hiragana")
        elif "Katakana" in value:
            self.ruby_type.set("katakana")
        else:
            self.ruby_type.set("romaji")
        self.update_preview()
        
    def get_annotated_lines(self):
        raw = self.input_text.get("0.0", "end").strip().split('\n')
        lines = []
        for line in raw:
            if line.strip():
                lines.append(annotate_line(line, self.ruby_type.get()))
        return lines

    def update_preview(self):
        lines = self.get_annotated_lines()
        
        preview = ""
        for line in lines:
            ruby_text = ""
            for t in line['tokens']:
                if t.get('ruby'):
                    ruby_text += f"{t['surface']}({t['ruby']})"
                else:
                    ruby_text += t['surface']
            preview += ruby_text + "\n\n"
            
        self.preview_text.configure(state="normal")
        self.preview_text.delete("0.0", "end")
        self.preview_text.insert("0.0", preview)
        # Update font size dynamically
        self.preview_text.configure(font=ctk.CTkFont(size=self.font_size.get()))
        self.preview_text.configure(state="disabled")

    def export_file(self, ext):
        lines = self.get_annotated_lines()
        if not lines:
            messagebox.showwarning("警告", "没有内容可导出")
            return
            
        filetypes = []
        if ext == "txt":
            filetypes = [("Text files", "*.txt")]
        elif ext == "srt":
            filetypes = [("SRT Subtitles", "*.srt")]
        elif ext == "docx":
            filetypes = [("Word Document", "*.docx")]
            
        path = filedialog.asksaveasfilename(defaultextension=f".{ext}", filetypes=filetypes, initialfile=f"dubbing_script.{ext}")
        if not path:
            return
            
        try:
            if ext == "txt":
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(generate_txt(lines))
            elif ext == "srt":
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(generate_srt(lines))
            elif ext == "docx":
                doc_title = os.path.splitext(os.path.basename(path))[0] or "日语假名配音台本"
                generate_docx(lines, path, font_size_pt=12, title=doc_title)
                
            messagebox.showinfo("成功", f"文件成功导出到:\n{path}")
        except Exception as e:
            messagebox.showerror("错误", f"导出失败:\n{str(e)}")
            
    def open_batch_window(self):
        # A simple top level window for batch processing
        batch_win = ctk.CTkToplevel(self)
        batch_win.title("批量文件处理")
        batch_win.geometry("500x400")
        batch_win.grab_set() # Modal
        
        ctk.CTkLabel(batch_win, text="批量文件处理 (注音并导出)", font=ctk.CTkFont(size=18, weight="bold")).pack(pady=20)
        
        files_var = ctk.StringVar(value="未选择文件")
        files_list = []
        
        def select_files():
            paths = filedialog.askopenfilenames(filetypes=[("Text & Scripts", "*.txt *.srt *.docx")])
            if paths:
                files_list.clear()
                files_list.extend(paths)
                files_var.set(f"已选择 {len(files_list)} 个文件")
                
        ctk.CTkButton(batch_win, text="选择文件...", command=select_files).pack(pady=10)
        ctk.CTkLabel(batch_win, textvariable=files_var).pack(pady=5)
        
        target_format = ctk.StringVar(value="docx")
        
        fmt_frame = ctk.CTkFrame(batch_win, fg_color="transparent")
        fmt_frame.pack(pady=10)
        ctk.CTkLabel(fmt_frame, text="导出格式:").pack(side="left", padx=5)
        ctk.CTkRadioButton(fmt_frame, text="DOCX", variable=target_format, value="docx").pack(side="left", padx=5)
        ctk.CTkRadioButton(fmt_frame, text="TXT", variable=target_format, value="txt").pack(side="left", padx=5)
        ctk.CTkRadioButton(fmt_frame, text="SRT", variable=target_format, value="srt").pack(side="left", padx=5)
        
        def start_batch():
            if not files_list:
                return
            
            output_dir = filedialog.askdirectory(title="选择导出保存目录")
            if not output_dir:
                return
                
            fmt = target_format.get()
            success_count = 0
            
            # Simple synchronous batch processing
            for file_path in files_list:
                filename = os.path.basename(file_path)
                base, _ = os.path.splitext(filename)
                out_path = os.path.join(output_dir, f"{base}_dubbing.{fmt}")
                
                try:
                    # Very basic file reading. If it's docx input, python-docx is needed to read text (not implemented here fully for simplicity, we assume txt input for batch in this demo if not handled).
                    # For a robust implementation, DOCX parsing should be added.
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        
                    raw_lines = content.split('\n')
                    lines = [annotate_line(l, self.ruby_type.get()) for l in raw_lines if l.strip()]
                    
                    if fmt == "txt":
                        with open(out_path, 'w', encoding='utf-8') as f: f.write(generate_txt(lines))
                    elif fmt == "srt":
                        with open(out_path, 'w', encoding='utf-8') as f: f.write(generate_srt(lines))
                    elif fmt == "docx":
                        generate_docx(lines, out_path, title=base)
                    
                    success_count += 1
                except Exception as e:
                    print(f"Failed to process {filename}: {e}")
            
            messagebox.showinfo("完成", f"批量处理完成！\n成功: {success_count}/{len(files_list)}")
            batch_win.destroy()

        ctk.CTkButton(batch_win, text="开始批量处理", fg_color="#107c41", hover_color="#0b582e", command=start_batch).pack(pady=20)


if __name__ == "__main__":
    app = FuriganaApp()
    app.mainloop()
