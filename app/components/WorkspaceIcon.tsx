export default function WorkspaceIcon({ symbol }: { symbol: string }) {
  const paths: Record<string,string> = {
    overview:'M3 11 12 3l9 8M5 10v11h14V10M9 21v-7h6v7',
    clients:'M10 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0M2 21v-3a5 5 0 0 1 10 0v3M16 4a3 3 0 0 1 0 6M16 14a5 5 0 0 1 6 5v2',
    licenses:'M6 3h12v13l-3-2-3 2-3-2-3 2zM9 7h6M9 10h4M10 16v6l3-2 3 2v-6',
    builder:'M3 4h7v7H3zM14 4h7v7h-7zM3 15h7v7H3zM17 15v7M14 18.5h7',
    modules:'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
    services:'M3 7h18v14H3zM8 7V3h8v4M3 12h18M10 12v3h4v-3',
    portfolio:'M3 4h18v16H3zM3 9h18M8 9v11M11 13h7M11 16h5',
    notifications:'M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4',
    content:'M5 3h14v18H5zM9 7h6M9 11h6M9 15h6M9 18h3',
    concepts:'M9 18h6M10 21h4M8 14a6 6 0 1 1 8 0l-1 2H9z',
    settings:'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
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
