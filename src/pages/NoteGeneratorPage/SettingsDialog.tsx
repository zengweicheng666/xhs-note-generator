import { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, KeyRound, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { getSettings, saveSettings, type IArkSettings } from '@/lib/settings';

/** 火山方舟控制台入口（新窗口打开） */
const ARK_CONSOLE_URL = 'https://console.volcengine.com/ark';
/** 控制台 · API Key 管理页 */
const ARK_APIKEY_URL = 'https://console.volcengine.com/ark/region:ark+cn-beijing/apikey';

export default function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [form, setForm] = useState<IArkSettings>(getSettings());

  useEffect(() => {
    if (open) setForm(getSettings());
  }, [open]);

  const handleSave = () => {
    saveSettings({
      apiKey: form.apiKey.trim(),
      imageModel: form.imageModel.trim() || 'doubao-seedream-5-0-260128',
      textModel: form.textModel.trim() || 'doubao-seed-2-0-mini-260428',
    });
    toast.success('设置已保存');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Settings className="size-4" />
          API 设置
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="size-4" />
            火山方舟 API 设置
          </DialogTitle>
          <DialogDescription>
            填写后实时生效，只保存在当前浏览器本地，不会上传。留空 API Key 则使用项目 .env.local 里的配置。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ark-key">API Key</Label>
            <div className="relative">
              <Input
                id="ark-key"
                type={showKey ? 'text' : 'password'}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder="ark-xxxxxxxx"
                className="pr-10 font-mono text-sm"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                title={showKey ? '隐藏' : '显示'}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="img-model">文生图模型 ID</Label>
            <Input
              id="img-model"
              value={form.imageModel}
              onChange={(e) => setForm({ ...form, imageModel: e.target.value })}
              placeholder="doubao-seedream-5-0-260128"
              className="font-mono text-sm"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="txt-model">文案模型 ID</Label>
            <Input
              id="txt-model"
              value={form.textModel}
              onChange={(e) => setForm({ ...form, textModel: e.target.value })}
              placeholder="doubao-seed-2-0-mini-260428"
              className="font-mono text-sm"
              autoComplete="off"
            />
          </div>

          {/* 火山方舟控制台快捷入口 */}
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              还没有 API Key？去火山方舟控制台创建 Key，并在「模型广场 / 推理接入点」开通对应模型后才能调用。
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <a href={ARK_APIKEY_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  API Key 管理
                </a>
              </Button>
              <Button asChild variant="ghost" size="sm" className="gap-1.5">
                <a href={ARK_CONSOLE_URL} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  打开方舟控制台
                </a>
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            取消
          </Button>
          <Button onClick={handleSave}>保存</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
