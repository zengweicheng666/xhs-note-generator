import { useEffect } from "react";
import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import MemeGeneratorPage from "@/pages/MemeGeneratorPage/MemeGeneratorPage";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
  // 本地运行时平台不会替换 {{appName}} 占位符，在此兜底设置真实标签页标题
  useEffect(() => {
    document.title = "自嘲熊表情包生成器";
  }, []);

  return (
    <>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MemeGeneratorPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
      <Toaster />
    </>
  );
}
