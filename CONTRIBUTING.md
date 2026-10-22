# 参与贡献 / Contributing

感谢你愿意改进本项目！

## 许可

- 本项目以 [PolyForm Noncommercial 1.0.0](LICENSE) 许可发布：允许个人学习、研究及非商业使用、修改与分发，**禁止商业用途**。
- 名称与图标不在许可范围内，见 [TRADEMARKS.md](TRADEMARKS.md)。
- 提交贡献前请阅读 [CLA.md](CLA.md)。**提交 Pull Request 即视为同意 CLA**。维护者需要这项授权，才能把社区贡献同样用于官方发行版（包括应用商店付费版）。

## 开发流程

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # 单元测试
npx tsc --noEmit
npm run lint
```

提交前请确保测试、类型检查和 lint 全部通过，并为新行为补充测试（`tests/*.test.mjs`）。

## 读音错误反馈

注音错误是最有价值的反馈。请在 Issue 中提供：

- 原句（尽量完整的上下文）
- 当前输出的读音与期望读音
- 使用的版本与平台

---

This project is licensed under [PolyForm Noncommercial 1.0.0](LICENSE). By opening a pull request you agree to the [CLA](CLA.md), which lets the maintainer ship your contribution in official builds, including paid app store releases. Please run `npm test`, `npx tsc --noEmit`, and `npm run lint` before submitting.
