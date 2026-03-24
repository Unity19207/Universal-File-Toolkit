import { useMemo } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { toolRegistry } from "../../core/plugins/registry";
import { categoryMeta } from "../../core/plugins/categories";
import type { ToolCategory } from "../../core/plugins/types";

const CATEGORY_COLORS: Record<string, string> = {
  image: "var(--cat-image)",
  pdf: "var(--cat-pdf)",
  data: "var(--cat-data)",
  text: "var(--cat-text)",
  media: "var(--cat-media)",
  developer: "var(--cat-developer)",
  archive: "var(--cat-archive)",
};

export function CategoryPage() {
  const { categoryId } = useParams<{ categoryId: string }>();

  const category = useMemo(() => {
    if (!categoryId) return null;
    return categoryMeta[categoryId as ToolCategory];
  }, [categoryId]);

  const tools = useMemo(() => {
    if (!categoryId) return [];
    return toolRegistry.filter((tool) => tool.category === categoryId);
  }, [categoryId]);

  if (!category || tools.length === 0) {
    return <Navigate to="/" replace />;
  }

  const catColor = CATEGORY_COLORS[categoryId!] || "var(--accent-primary)";

  return (
    <main
      style={{ background: "var(--bg-base)", minHeight: "calc(100vh - 44px)" }}
    >
      <section className="category-page-header" style={{ padding: "40px 40px 10px" }}>
        <div className="tool-breadcrumb mb-6">
          <Link to="/">Dashboard</Link>
          <span className="bc-sep">/</span>
          <span className="bc-current">Tools</span>
        </div>
        <div className="flex items-end justify-between gap-6 border-b border-[var(--border-color)] pb-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display text-[var(--text-primary)] mb-2">
              {category.title} Tools
            </h1>
            <p className="text-[var(--text-secondary)] text-lg max-w-xl opacity-80 leading-relaxed">
              {category.description}
            </p>
          </div>
          <div className="shrink-0 offline-badge">{tools.length} SYSTEMS</div>
        </div>
      </section>

      {/* ── Tools grid ── */}
      <section className="tool-cards-grid">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            to={`/tools/${tool.id}`}
            className="tool-card"
            style={{ "--cat-color": catColor } as React.CSSProperties}
          >
            <span className="tool-card-library">{tool.badge}</span>
            <div className="tool-card-name">{tool.name}</div>
            <div className="tool-card-desc">{tool.description}</div>
            <span className="tool-card-action">Open tool →</span>
          </Link>
        ))}
      </section>
    </main>
  );
}
