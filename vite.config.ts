import path from 'path'
import fs from 'fs/promises'
import type { Connect, PluginOption } from 'vite'
import { loadEnv } from 'vite'
import { defineConfig } from '@lark-apaas/coding-preset-vite-react'

// 读取 .env.local（VITE_ 前缀变量）
const env = loadEnv('development', process.cwd(), '')

// 生成图落盘目录：方舟返回的图片 URL 只有 24 小时有效期，
// 这里把图片保存到工程内的 public/notes/<日期>/，前端改用稳定的本地 URL。
const NOTES_DIR = path.resolve(__dirname, 'public/notes')

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

      // 读取已保存的配图：直接从磁盘读，避免依赖 public 静态处理
      // （Vite 在启动时会缓存 public 的目录结构，运行时新建的目录它看不到，
      //   会退回 index.html，导致刚保存的图第一次加载失败）
      server.middlewares.use('/notes', (async (req: Connect.IncomingMessage, res: any) => {
        try {
          const rel = decodeURIComponent((req.url || '/').split('?')[0]).replace(/^\/+/, '')
          const file = path.resolve(NOTES_DIR, rel)
          // 防路径穿越
          if (!file.startsWith(NOTES_DIR + path.sep)) {
            res.statusCode = 403
            res.end('forbidden')
            return
          }
          const st = await fs.stat(file)
          if (!st.isFile()) {
            res.statusCode = 404
            res.end('not found')
            return
          }
          const buf = await fs.readFile(file)
          const lower = file.toLowerCase()
          const ct = lower.endsWith('.png')
            ? 'image/png'
            : lower.endsWith('.webp')
              ? 'image/webp'
              : lower.endsWith('.gif')
                ? 'image/gif'
                : 'image/jpeg'
          res.statusCode = 200
          res.setHeader('Content-Type', ct)
          res.setHeader('Cache-Control', 'public, max-age=31536000')
          res.end(buf)
        } catch {
          res.statusCode = 404
          res.end('not found')
        }
      }) as any)

      // 保存配图：把方舟临时链接下载后写入工程目录，返回稳定的本地 URL
      // body: { url: 方舟临时图片地址, name: 文件名（不含扩展名） }
      server.middlewares.use('/api/save-image', (async (req: Connect.IncomingMessage, res: any) => {
        try {
          if ((req.method || 'GET') !== 'POST') {
            res.statusCode = 405
            res.end('method not allowed')
            return
          }
          const chunks: Buffer[] = []
          for await (const chunk of req) chunks.push(chunk as Buffer)
          let payload: { url?: string; name?: string } = {}
          try {
            payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
          } catch {
            payload = {}
          }

          const target = String(payload.url || '')
          let buf: Buffer
          let ext = 'jpg'

          if (target.startsWith('data:')) {
            // 占位图 / 已内联的图：直接解码 base64 落盘
            const m = /^data:([^;,]+)?(;base64)?,([\s\S]*)$/.exec(target)
            const mime = m?.[1] || ''
            if (!m || m[2] !== ';base64' || !mime.startsWith('image/')) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'bad data url' }))
              return
            }
            buf = Buffer.from(m[3], 'base64')
            ext = mime.includes('png')
              ? 'png'
              : mime.includes('webp')
                ? 'webp'
                : mime.includes('gif')
                  ? 'gif'
                  : 'jpg'
          } else {
            // 远程图：只允许方舟域名，避免被用来下载任意地址
            const hostOk = /(^|\.)volces\.com$|(^|\.)volcengine\.com$/.test(
              (() => { try { return new URL(target).host } catch { return '' } })(),
            )
            if (!target || !hostOk) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'bad image url' }))
              return
            }
            const upstream = await fetch(target)
            if (!upstream.ok) {
              res.statusCode = 502
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: `upstream ${upstream.status}` }))
              return
            }
            buf = Buffer.from(await upstream.arrayBuffer())
            const ct = upstream.headers.get('content-type') || ''
            ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg'
          }

          // 只保留安全字符，避免路径穿越
          const safeName = String(payload.name || 'note').replace(/[^\w\u4e00-\u9fa5-]/g, '_')
          const now = new Date()
          const pad = (n: number) => String(n).padStart(2, '0')
          const day = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
          const dir = path.join(NOTES_DIR, day)
          await fs.mkdir(dir, { recursive: true })

          const relPath = `${day}/${safeName}.${ext}`
          await fs.writeFile(path.join(NOTES_DIR, relPath), buf)
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ url: `/notes/${relPath}` }))
        } catch (e) {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: `save image failed: ${String(e)}` }))
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
