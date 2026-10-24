# Uku Furigana 中转服务部署指南（Debian 12）

本服务（`server/relay/relay.py`）仅依赖 Python 3.11 标准库，监听在 `127.0.0.1:8787`，由 `uku.saiaino.xyz` 的 nginx 反代暴露：

- `POST /api/feedback`：脱敏、限流并在 `Cheese-nya/uku-furigana` 创建 GitHub Issue
- `GET /api/update/latest`：缓存并返回最新 Release 信息与 `SHA256SUMS.txt` 哈希
- `GET /api/update/dl/{tag}/{name}`：流式镜像下载安装包（支持 `Range` 断点续传，磁盘最多缓存最近 2 个版本）
- `GET /api/health`：健康检查

---

## 1. 创建 GitHub 细粒度 Personal Access Token (PAT)

1. 登录 GitHub，进入 **Settings → Developer settings → Personal access tokens → Fine-grained tokens**，点击 **Generate new token**。
2. **Token name**：填写例如 `uku-furigana-relay`。
3. **Expiration**：按需选择有效期。
4. **Repository access**：选择 **Only select repositories**，仅勾选 `Cheese-nya/uku-furigana`。
5. **Permissions → Repository permissions**：
   - **Issues**：设为 **Read and write**
   - **Metadata**：保持默认的 **Read-only**
   - 其余所有权限保持 **No access**
6. 点击 **Generate token**，复制生成的 token（仅在此时显示一次）。

---

## 2. 上传文件与配置环境变量

在服务器（Debian 12）上以 `root` 执行：

```bash
# 1. 创建程序目录并放置 relay.py
install -d -m 0755 /opt/uku-relay
install -m 0755 relay.py /opt/uku-relay/relay.py

# 2. 创建环境变量文件（请将 <YOUR_GITHUB_PAT> 替换为你自己生成的细粒度 PAT）
cat >/etc/uku-relay.env <<'EOF'
UKU_GITHUB_TOKEN=<YOUR_GITHUB_PAT>   # 可选：不设置时更新接口照常工作，/api/feedback 返回 503
UKU_REPO=Cheese-nya/uku-furigana
UKU_BIND=127.0.0.1
UKU_PORT=8787
UKU_CACHE_DIR=/var/cache/uku-relay
UKU_ALLOWED_ORIGINS=https://localhost,https://uku.saiaino.xyz,http://localhost:3000
EOF

# 3. 严格限制权限，仅 root 可读写
chmod 600 /etc/uku-relay.env
```

> **提示**：仓库仓库需提前存在 `from-app`、`bug`、`feedback` 三个 Issue 标签（若不存在，GitHub API 拥有 Issues 写权限时也会自动创建或可在仓库 Labels 页面预先创建）。

---

## 3. 启用 systemd 服务

```bash
install -m 0644 uku-relay.service /etc/systemd/system/uku-relay.service
systemctl daemon-reload
systemctl enable --now uku-relay.service

# 检查运行状态与日志
systemctl status uku-relay.service
journalctl -u uku-relay.service -n 50 --no-pager
```

---

## 4. 配置 nginx 并重载

编辑 `uku.saiaino.xyz` 所在的 nginx 站点配置，在 `server { ... }` 块中加入 `nginx-uku-snippet.conf` 的内容（**保留原有的 `/api/hit` 配置不变**）：

```nginx
    location = /api/feedback {
        client_max_body_size 64k;
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ^~ /api/update/ {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
        proxy_read_timeout 300s;
    }

    location = /api/health {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
```

测试配置并重载 nginx：

```bash
nginx -t && systemctl reload nginx
```

---

## 5. `curl` 自测命令

```bash
# 1. 本机健康检查
curl -fsS http://127.0.0.1:8787/api/health

# 2. 公网健康检查与 CORS 头验证（模拟 Android WebView Origin）
curl -i -H "Origin: https://localhost" https://uku.saiaino.xyz/api/health

# 3. 检查 Windows 桌面端随机端口 Origin 放行
curl -i -X OPTIONS \
  -H "Origin: http://127.0.0.1:54321" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  https://uku.saiaino.xyz/api/feedback

# 4. 查询最新版本信息
curl -fsS https://uku.saiaino.xyz/api/update/latest | python3 -m json.tool

# 5. 校验非法反馈负载应返回 400 {"ok":false,"error":"invalid"}
curl -i -X POST https://uku.saiaino.xyz/api/feedback \
  -H "Content-Type: application/json" \
  -d '{"kind":"text","includeLog":false}'

# 6. 测试镜像下载 Range 支持（需将 v1.2.1 替换为实际已发布的 tag）
curl -i -H "Range: bytes=0-63" \
  https://uku.saiaino.xyz/api/update/dl/v1.2.1/Uku-Furigana-v1.2.1.apk \
  -o /dev/null
```
