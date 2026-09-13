import { Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import MemeGeneratorPage from "@/pages/MemeGeneratorPage/MemeGeneratorPage";
import NotFoundPage from "@/pages/NotFoundPage/NotFoundPage";
import { Toaster } from "@/components/ui/sonner";

export default function App() {
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
