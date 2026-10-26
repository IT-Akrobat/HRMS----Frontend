export default function PageHeader({
  title,
  subtitle,
  actions,
  // actionsInline: keep the action buttons on the SAME first line as the
  // title, pushed to the right end (the subtitle goes underneath). Without
  // it, the buttons wrap onto their own row below the subtitle on phones.
  actionsInline = false,
  // hideSubtitleOnMobile: hide the subtitle on phones (shown from md up).
  hideSubtitleOnMobile = false,
}) {
  const subtitleClass = `text-sm text-slate-500 mt-1${
    hideSubtitleOnMobile ? " hidden md:block" : ""
  }`;
  if (actionsInline) {
    return (
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <h1 className="min-w-0 text-2xl font-bold text-slate-800">{title}</h1>
          {actions && (
            <div className="flex items-center gap-2 shrink-0">{actions}</div>
          )}
        </div>
        {subtitle && <p className={subtitleClass}>{subtitle}</p>}
      </div>
    );
  }
  return (
    // flex-wrap + min-w-0: a long subtitle can never push the action buttons
    // past the page edge. If they don't fit beside the title they drop below it.
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-6">
      <div className="min-w-0 flex-1 basis-80">
        <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
        {subtitle && <p className={subtitleClass}>{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 shrink-0 max-w-full">
          {actions}
        </div>
      )}
    </div>
  );
}
