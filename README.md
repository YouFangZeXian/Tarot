# Oracle Room

`Oracle Room` 是一个带有“数字神谕室”氛围的网页版塔罗项目，强调慢节奏仪式感、抽牌悬念与 AI 解读体验。

## Stack

- Next.js 16
- Tailwind CSS 4
- Framer Motion
- DeepSeek Chat Completions API

## Features

- 沉浸式 Landing Hero
- 自动扩展的问题输入区
- 五种牌阵选择
- 洗牌与抽牌动画
- 卡牌逐张翻面揭示
- DeepSeek 流式解读
- 预置 Tarot Reader + Jungian Guide 系统提示词
- 无 API Key 时自动进入本地演示解读模式

## Getting Started

```bash
npm install
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)

## Environment Variables

复制 `.env.example` 为 `.env.local`：

```bash
cp .env.example .env.local
```

然后填写：

```env
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-v4-flash
```

默认请求地址使用：

- `https://api.deepseek.com/chat/completions`

## Notes

- `src/app/api/reading/route.ts` 负责服务端代理 DeepSeek 流式响应。
- `src/lib/deepseek.ts` 保存 AI 身份、System Prompt 和 fallback 解读逻辑。
- `src/data/tarot.ts` 内含 78 张牌基础数据与抽牌逻辑。
