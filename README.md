# Claude HUD GLM
给claude-hud加上glm用量显示和重置时间
## 显示效果
compact
```
  [glm-5.1[1m]] ░░░░░░░░░░ 3% | Ethan | GLM 5h: 19% 20:10 | MCP: 41% 04-28 17:42
```
expand
```
  [glm-5.1[1m]] │ Ethan                        ◐ medium · /effort
  Context ░░░░░░░░░░ 0%
  GLM │ 5h: ██░░░░░░░░ 22% 20:10 │ MCP: ████░░░░░░ 41% 04-28 17:42
```
## 安装
```
# 添加市场
claude plugin marketplace add sandxin/claude-hud
# 安装插件
claude plugin install claude-hud
```
## 配置
方式一
```
/claude-hud:configure
```
方式二

编辑~/.claude/plugins/claude-hud/config.json
```
"display": {
  ...,
  "showGlmTokenUsage": true,
  "showGlmMcpUsage": true,
  "glmBarEnable": true
}
```

## 贡献
基于claud-hud 0.0.12
## License

MIT — see [LICENSE](LICENSE)


