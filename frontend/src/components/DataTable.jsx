export default function DataTable({ columns, rows, actions }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-white/10">
      <table className="w-full text-sm">
        <thead className="bg-ink-800 text-white/60">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="text-right px-4 py-3 font-medium">
                {c.label}
              </th>
            ))}
            {actions && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-8 text-center text-white/40">
                لا توجد بيانات
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={row.id} className="hover:bg-white/[0.03]">
                {columns.map((c) => (
                  <td key={c.key} className="px-4 py-3 text-white/80">
                    {c.render ? c.render(row) : row[c.key]}
                  </td>
                ))}
                {actions && <td className="px-4 py-3">{actions(row)}</td>}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
