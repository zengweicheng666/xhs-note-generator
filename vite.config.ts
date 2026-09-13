import path from 'path'
import type { Connect, PluginOption } from 'vite'
import { loadEnv } from 'vite'
import { defineConfig } from '@lark-apaas/coding-preset-vite-react'

// 读取 .env.local（VITE_ 前缀变量）
const env = loadEnv('development', process.cwd(), '')

// 自定义代理中间件：/ark-api/* -> 火山方舟 api/v3/*
// key 优先取请求头 x-ark-key（界面设置），回退 .env.local；前端不暴露 key，也无跨域问题
function arkProxyPlugin(): PluginOption {
  return {
    name: 'ark-local-proxy',
    configureServer(server) {
      // 图片代理：把方舟返回的 tos 图片 URL 走同源转发，避免 <img>/canvas 跨域污染
      server.middlewares.use('/ark-img', (async (req: Connect.IncomingMessage, res: any) => {
        try {
          const u = new URL(req.url || '', 'http://localhost')
          const target = u.searchParams.get('u') || ''
          const hostOk = /(^|\.)volces\.com$|(^|\.)volcengine\.com$/.test(
            (() => { try { return new URL(target).host } catch { return '' } })(),
          )
          if (!target || !hostOk) {
            res.statusCode = 400
            res.end('bad image url')
            return
          }
          const upstream = await fetch(target)
          res.statusCode = upstream.status
          const ct = upstream.headers.get('content-type')
          if (ct) res.setHeader('Content-Type', ct)
          res.setHeader('Cache-Control', 'public, max-age=86400')
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.end(buf)
        } catch (e) {
          res.statusCode = 502
          res.end(String(e))
        }
      }) as any)

      // API 代理：/ark-api/* -> 火山方舟 api/v3/*
      server.middlewares.use('/ark-api', (async (req: Connect.IncomingMessage, res: any) => {
        try {
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          const body = Buffer.concat(chunks)

          const headerKey = req.headers['x-ark-key']
          const uiKey = Array.isArray(headerKey) ? headerKey[0] : headerKey
          const key = uiKey || env.VITE_ARK_API_KEY || ''

          // connect mount 后 req.url 已去掉 /ark-api 前缀
          const target = `https://ark.cn-beijing.volces.com/api/v3${req.url || ''}`
          const upstream = await fetch(target, {
            method: req.method || 'GET',
            headers: {
              'Content-Type': (req.headers['content-type'] as string) || 'application/json',
              ...(key ? { Authorization: `Bearer ${key}` } : {}),
            },
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : body,
          })

          res.statusCode = upstream.status
          const ct = upstream.headers.get('content-type')
          if (ct) res.setHeader('Content-Type', ct)
          const buf = Buffer.from(await upstream.arrayBuffer())
          res.end(buf)
        } catch (e) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: { message: `local proxy error: ${String(e)}` } }))
        }
      }) as any)
    },
  }
}

export default defineConfig({
  plugins: [arkProxyPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
    },
  },
})
