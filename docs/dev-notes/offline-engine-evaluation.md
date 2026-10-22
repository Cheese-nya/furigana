# 离线假名引擎评估

评估日期：2026-10-11。

评估目录：`/run/media/cheese/BA2209BD22097F9D/台本`。工具读取 15 份 DOCX，共约 119,813 个正文字符、7,491 行。文件中有 8,806 个原生 Word Ruby 片段；其中两份是本工具早期自动导出的文件，不能作为独立准确率样本，因此报告把它们的注音排除在参考匹配之外。

旧版 `mammoth.extractRawText()` 会忽略 `w:ruby`。在检测到 Ruby 的文件中，这会漏掉约 11,785 个带注音汉字正文。当前导入器读取 `w:rubyBase` 作为正文，把 `w:rt` 保存成行级校对覆盖，并兼容标准的 `w:r` 包裹和旧的段落级 Ruby。

在可作为参考的原文件注音中，当前规则版与旧规则版的对照如下：

| 版本 | 可比较片段 | 匹配片段 |
| --- | ---: | ---: |
| 旧规则版 | 550 | 368 |
| 当前规则版 | 554 | 374 |
| Sudachi Core（只作对照） | 544 | 366 |
| MeCab + UniDic Lite（只作对照） | 546 | 366 |

这些数字是“与文件已有 Ruby 的一致性”，不是全台本总体准确率。大多数台本没有人工注音；《外郎売》中的古语、历史用字、人名和专名对所有通用引擎都很难。当前规则版的优势来自词组整体注音、送假名对齐、`行っ` 上下文规则和保留源文件注音，而不是声称通用语境已经完全消歧。

词典体积也影响 Windows 单文件部署：项目已有 Kuromoji 词典约 17 MB；测试用 Sudachi Core 约 193 MB，UniDic Lite 约 249 MB。基于离线和 Windows 打包优先级，暂时保留 Kuromoji，并把人工校对保存为台本级覆盖。切换到 Sudachi 或完整 UniDic 前，应准备更多人工确认的普通现代台本作为独立测试集。

## 复现

```bash
npm test
python -m unittest discover -s tests -p "test_*.py"
node tools/audit-scripts.mjs "/path/to/台本" audit.json
```

可选安装 Python 对照引擎：

```bash
node tools/audit-scripts.mjs "/path/to/台本" audit.json - - corpus.json
pip install sudachipy sudachidict_core fugashi unidic-lite
python tools/compare-native.py corpus.json native-results.json
node tools/audit-scripts.mjs "/path/to/台本" compared-audit.json - native-results.json
```

对照引擎不会进入网页或 Windows 桌面版运行路径，也不会进行网络请求。
