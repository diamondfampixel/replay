export default function StorefrontLoading() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-10">
      <div className="skeleton h-64 w-full rounded-lg" />
      <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index}>
            <div className="skeleton aspect-square rounded-md" />
            <div className="skeleton mt-2.5 h-3.5 w-3/4 rounded" />
            <div className="skeleton mt-1.5 h-3 w-1/3 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
