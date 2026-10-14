
export default function PageHeader({ title, subtitle, actions }) {
  return (
    // flex-wrap + min-w-0: a long subtitle can never push the action buttons
    // past the page edge. If they don't fit beside the title they drop below it.
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-6">
      <div className="min-w-0 flex-1 basis-80">
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
          {actions}
        </div>
      )}
    </div>
  );
}
