"""
launch_desktop.py
Furigana Dubbing Studio 独立桌面窗口启动器 (PyWebView / App Mode)
"""

import sys
import os
import time
import subprocess
import threading
import webbrowser

def start_nextjs_server():
    server_dir = os.path.dirname(os.path.abspath(__file__))
    subprocess.Popen("npm run dev", shell=True, cwd=server_dir)

def launch_standalone_window():
    print("🚀 正在启动独立软件窗口...")
    time.sleep(2)

    try:
        import webview
        webview.create_window(
            title='Furigana Dubbing Studio — Apple Liquid Glass',
            url='http://localhost:3000',
            width=1280,
            height=830,
            resizable=True,
            background_color='#07070c'
        )
        webview.start()
    except ImportError:
        # 如果未安装 pywebview，回退使用系统浏览器 App 窗口模式
        edge_path = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
        chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

        if os.path.exists(edge_path):
            subprocess.Popen([edge_path, "--app=http://localhost:3000", "--window-size=1280,830"])
        elif os.path.exists(chrome_path):
            subprocess.Popen([chrome_path, "--app=http://localhost:3000", "--window-size=1280,830"])
        else:
            webbrowser.open("http://localhost:3000")

if __name__ == '__main__':
    threading.Thread(target=start_nextjs_server, daemon=True).start()
    launch_standalone_window()
