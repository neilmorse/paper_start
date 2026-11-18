import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { cn } from "@/lib/utils";
import AboutPage from "@/src/pages/AboutPage";
import LibraryPage from "@/src/pages/LibraryPage";
import SearchPage from "@/src/pages/SearchPage";

const navClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-md px-3 py-1.5 text-sm transition-colors",
    isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );

export default function App() {
  return (
    <BrowserRouter>
      <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-4 sm:p-6">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">PaperStart</h1>
            <p className="text-xs text-muted-foreground">CCF 目录原生文献调研工作台</p>
          </div>
          <nav className="flex gap-1">
            <NavLink to="/" end className={navClass}>
              检索
            </NavLink>
            <NavLink to="/library" className={navClass}>
              收藏
            </NavLink>
            <NavLink to="/about" className={navClass}>
              关于
            </NavLink>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<SearchPage />} />
            <Route path="/library" element={<LibraryPage />} />
            <Route path="/about" element={<AboutPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}