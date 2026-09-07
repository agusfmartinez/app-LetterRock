/** Generic shimmer block — sizing comes from the className passed in. */
export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton ${className}`} />
}

/**
 * Loading state for a detail page (artist/album/track/collection/profile):
 * a cover block plus title and a couple of text lines, roughly matching the
 * shape of what's about to render instead of a bare "Cargando..." line.
 */
export function PageSkeleton() {
  return (
    <div className="flex flex-col md:flex-row gap-8">
      <SkeletonBlock className="w-full md:w-56 aspect-square rounded-lg flex-shrink-0" />
      <div className="flex-1 space-y-3 pt-1">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-9 w-3/4" />
        <SkeletonBlock className="h-4 w-1/3" />
        <div className="space-y-2 pt-3">
          <SkeletonBlock className="h-3.5 w-full" />
          <SkeletonBlock className="h-3.5 w-11/12" />
          <SkeletonBlock className="h-3.5 w-2/3" />
        </div>
      </div>
    </div>
  )
}

/** Compact inline skeleton for admin lists/forms where a full layout guess isn't worth it. */
export function InlineSkeleton() {
  return (
    <div className="space-y-2 py-2">
      <SkeletonBlock className="h-3.5 w-2/5" />
      <SkeletonBlock className="h-3.5 w-1/3" />
      <SkeletonBlock className="h-3.5 w-1/2" />
    </div>
  )
}
