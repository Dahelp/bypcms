export default function WorkspaceIcon({ symbol }: { symbol: string }) {
  const paths: Record<string,string> = {
    '⌂':'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
    '▤':'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4',
    '▥':'M5 3h14v18H5zM9 8h6M9 12h6M9 16h4',
    '⬡':'m12 3 9 5v9l-9 5-9-5V8zM12 3v19M3 8l9 5 9-5',
    '◇':'m12 3 9 9-9 9-9-9z',
    '⚙':'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    '♙':'M15 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M5 21v-3a7 7 0 0 1 14 0v3',
    '₽':'M8 21V3h6a5 5 0 0 1 0 10H5M5 17h11',
    '●':'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
    '♢':'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    '→':'M4 12h16M14 6l6 6-6 6','←':'M20 12H4M10 6l-6 6 6 6',
    '↗':'M14 4h6v6M20 4l-9 9M18 13v7H4V6h7',
    '＋':'M12 4v16M4 12h16','×':'m6 6 12 12M18 6 6 18','✓':'m5 12 4 4L19 6',
  };
  return <svg className="workspaceIcon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[symbol] || 'M5 4h14v16H5zM9 9h6M9 14h6'}/></svg>;
}
