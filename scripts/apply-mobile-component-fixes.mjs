import { readFileSync, writeFileSync } from "node:fs";

function edit(path, changes) {
  let source = readFileSync(path, "utf8");
  for (const [from, to] of changes) {
    if (!source.includes(from)) {
      throw new Error(`Pattern not found in ${path}: ${from.slice(0, 140)}`);
    }
    source = source.replace(from, to);
  }
  writeFileSync(path, source);
  console.log(`[updated] ${path}`);
}

edit("src/components/kt/section.tsx", [
  [
    '    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">',
    '    <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">',
  ],
  [
    '<h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{displayTitle}</h2>',
    '<h2 className="break-words text-base font-bold leading-tight text-foreground [overflow-wrap:anywhere] sm:text-lg">{displayTitle}</h2>',
  ],
  [
    '<p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{displayIntro}</p>',
    '<p className="mt-1 max-w-3xl break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{displayIntro}</p>',
  ],
  [
    '<div className="flex shrink-0 flex-wrap items-center gap-2">',
    '<div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:shrink-0">',
  ],
  [
    '<section id={id} className="surface scroll-mt-24 overflow-hidden">',
    '<section id={id} className="surface w-full min-w-0 scroll-mt-24 overflow-hidden">',
  ],
  [
    '<header className="border-b border-border bg-card px-4 py-4 sm:px-5 lg:px-6">{header}</header>',
    '<header className="min-w-0 border-b border-border bg-card px-4 py-4 sm:px-5 lg:px-6">{header}</header>',
  ],
  [
    '<div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">{displayChildren}</div>',
    '<div className="min-w-0 px-4 py-4 sm:px-5 sm:py-5 lg:px-6">{displayChildren}</div>',
  ],
  [
    '<AccordionPrimitive.Header className="border-b border-border bg-card px-4 py-4 sm:px-5 lg:px-6">',
    '<AccordionPrimitive.Header className="min-w-0 border-b border-border bg-card px-4 py-4 sm:px-5 lg:px-6">',
  ],
  [
    '<div className="flex items-start gap-3">',
    '<div className="flex min-w-0 items-start gap-3">',
  ],
  [
    '<AccordionPrimitive.Trigger className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left [&[data-state=open]>svg]:rotate-180">',
    '<AccordionPrimitive.Trigger className="flex w-full min-w-0 flex-1 cursor-pointer items-start gap-3 text-left [&[data-state=open]>svg]:rotate-180">',
  ],
]);

edit("src/components/kt/checkin.tsx", [
  [
    '<div className="relative grid grid-cols-5 gap-1.5 sm:gap-2">',
    '<div className="relative grid min-w-0 grid-cols-5 gap-1 sm:gap-2">',
  ],
  [
    'className={`relative flex min-h-[78px] flex-col items-center justify-start gap-1 rounded-lg border px-1.5 py-2.5 text-center transition-all sm:min-h-[88px] sm:px-2 ${',
    'className={`relative flex min-h-[74px] min-w-0 flex-col items-center justify-start gap-1 overflow-hidden rounded-lg border px-0.5 py-2 text-center transition-all sm:min-h-[88px] sm:overflow-visible sm:px-2 sm:py-2.5 ${',
  ],
  [
    '<span className={`grid h-9 w-9 place-items-center rounded-full bg-card text-2xl shadow-sm ring-1 ${active ? iconRing : "ring-border"}`}>',
    '<span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card text-xl shadow-sm ring-1 sm:h-9 sm:w-9 sm:text-2xl ${active ? iconRing : "ring-border"}`}>',
  ],
  [
    '<span className="text-[10px] font-semibold leading-tight sm:text-xs">{item.label}</span>',
    '<span className="w-full min-w-0 break-words text-[9px] font-semibold leading-[1.05] [overflow-wrap:anywhere] sm:text-xs sm:leading-tight">{item.label}</span>',
  ],
]);

edit("src/components/kt/politicas.tsx", [
  [
    '<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">',
    '<div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">',
  ],
  [
    'className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"',
    'className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-2xl border border-border bg-card"',
  ],
  [
    '<div className="flex flex-1 flex-col p-4">',
    '<div className="flex min-w-0 flex-1 flex-col p-4">',
  ],
  [
    '<h3 className="text-sm font-bold">{doc.titulo}</h3>',
    '<h3 className="break-words text-sm font-bold [overflow-wrap:anywhere]">{doc.titulo}</h3>',
  ],
  [
    '<p className="mt-1 text-[10px] font-mono text-muted-foreground/60">',
    '<p className="mt-1 break-all text-[10px] font-mono text-muted-foreground/60">',
  ],
  [
    'className="w-full rounded-full"\n                      onClick={() => abrirDoc(doc)}',
    'className="h-auto min-h-9 w-full whitespace-normal rounded-full py-2 text-center leading-tight"\n                      onClick={() => abrirDoc(doc)}',
  ],
  [
    'className="w-full rounded-full disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"',
    'className="h-auto min-h-9 w-full whitespace-normal rounded-full py-2 text-center leading-tight disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"',
  ],
  [
    '<div className="flex gap-2">',
    '<div className="grid gap-2 sm:flex">',
  ],
  [
    'className="flex-1 rounded-full"',
    'className="w-full rounded-full sm:flex-1"',
  ],
  [
    'className="rounded-full"\n                onClick={() => {',
    'className="w-full rounded-full sm:w-auto"\n                onClick={() => {',
  ],
]);

edit("src/components/kt/employee-dashboard-v3.tsx", [
  [
    '<section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">',
    '<section id={id} className="w-full min-w-0 scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">',
  ],
  [
    '<header className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">',
    '<header className="flex min-w-0 flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">',
  ],
  [
    '{action ? <div className="shrink-0">{action}</div> : null}',
    '{action ? <div className="w-full min-w-0 sm:w-auto sm:shrink-0">{action}</div> : null}',
  ],
  [
    '<div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>',
    '<div className="min-w-0 px-4 py-4 sm:px-6 sm:py-6">{children}</div>',
  ],
  [
    '<div className="flex flex-col gap-2 border-b border-border py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">',
    '<div className="flex w-full min-w-0 flex-col gap-2 border-b border-border py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">',
  ],
  [
    '{body ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p> : null}',
    '{body ? <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{body}</p> : null}',
  ],
  [
    '<div className="mx-auto grid w-full max-w-[1180px] gap-6">',
    '<div className="mx-auto grid w-full min-w-0 max-w-[1180px] gap-4 sm:gap-6">',
  ],
  [
    '<article key={survey.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">',
    '<article key={survey.id} className="flex w-full min-w-0 flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">',
  ],
  [
    '<div className="flex shrink-0 flex-wrap gap-2">',
    '<div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:flex-wrap">',
  ],
  [
    '<span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-success/10 px-4 text-sm font-bold text-success">',
    '<span className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-success/10 px-4 text-center text-sm font-bold text-success sm:w-auto">',
  ],
  [
    'className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#4b1736] px-4 text-sm font-bold text-white hover:bg-[#351526]"',
    'className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#4b1736] px-4 text-center text-sm font-bold text-white hover:bg-[#351526] sm:w-auto"',
  ],
  [
    '<Button variant="outline" onClick={() => void markExternalAnswered(survey)}>Já respondi</Button>',
    '<Button className="w-full sm:w-auto" variant="outline" onClick={() => void markExternalAnswered(survey)}>Já respondi</Button>',
  ],
  [
    '<Button className="bg-[#4b1736] text-white hover:bg-[#351526]" onClick={() => { setAnswers({}); setSurveyOpen(survey); }}>',
    '<Button className="w-full bg-[#4b1736] text-white hover:bg-[#351526] sm:w-auto" onClick={() => { setAnswers({}); setSurveyOpen(survey); }}>',
  ],
  [
    '<div className="grid gap-4 lg:grid-cols-3">',
    '<div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">',
  ],
  [
    '<article key={news.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background">',
    '<article key={news.id} className="flex w-full min-w-0 max-w-full flex-col overflow-hidden rounded-xl border border-border bg-background">',
  ],
  [
    '<h3 className="mt-1.5 font-extrabold leading-snug text-foreground">{news.titulo}</h3>',
    '<h3 className="mt-1.5 break-words font-extrabold leading-snug text-foreground [overflow-wrap:anywhere]">{news.titulo}</h3>',
  ],
  [
    '<p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{news.resumo}</p>',
    '<p className="mt-1.5 break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{news.resumo}</p>',
  ],
  [
    '<iframe className="h-full w-full" src={embed} title={news.titulo} allowFullScreen />',
    '<iframe className="block h-full w-full max-w-full" src={embed} title={news.titulo} allowFullScreen />',
  ],
  [
    '<div className="rounded-xl border border-border bg-background px-4 sm:px-5">',
    '<div className="w-full min-w-0 rounded-xl border border-border bg-background px-4 sm:px-5">',
  ],
  [
    '<div key={item.id} className="flex gap-3 border-b border-border py-4 last:border-b-0">',
    '<div key={item.id} className="flex w-full min-w-0 gap-3 border-b border-border py-4 last:border-b-0">',
  ],
  [
    '<p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.motivo}</p>',
    '<p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">{item.motivo}</p>',
  ],
  [
    '<div className="flex flex-wrap gap-2">\n            <Button size="sm" onClick={() => setFeedbackOpen(true)}><MessagesSquare className="h-4 w-4" /> Novo feedback</Button>',
    '<div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap">\n            <Button className="w-full justify-center sm:w-auto" size="sm" onClick={() => setFeedbackOpen(true)}><MessagesSquare className="h-4 w-4" /> Novo feedback</Button>',
  ],
  [
    '<Button size="sm" variant="outline" onClick={() => setRecognitionOpen(true)}><MessageSquareHeart className="h-4 w-4" /> Reconhecer alguém</Button>',
    '<Button className="w-full justify-center sm:w-auto" size="sm" variant="outline" onClick={() => setRecognitionOpen(true)}><MessageSquareHeart className="h-4 w-4" /> Reconhecer alguém</Button>',
  ],
  [
    '<Button size="sm" variant="outline" onClick={() => setSuggestionOpen(true)}><Lightbulb className="h-4 w-4" /> Sugestão</Button>',
    '<Button className="w-full justify-center sm:w-auto" size="sm" variant="outline" onClick={() => setSuggestionOpen(true)}><Lightbulb className="h-4 w-4" /> Sugestão</Button>',
  ],
  [
    '<Button size="sm" variant="outline" onClick={() => setSupportOpen(true)}><MessageCircle className="h-4 w-4" /> Apoio RH</Button>',
    '<Button className="w-full justify-center sm:w-auto" size="sm" variant="outline" onClick={() => setSupportOpen(true)}><MessageCircle className="h-4 w-4" /> Apoio RH</Button>',
  ],
  [
    '<div className="flex items-center justify-between gap-3"><h3 className="font-bold">Seus feedbacks e ocorrências</h3><StatusPill>{employeeFeedbacks.length} registro(s)</StatusPill></div>',
    '<div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="break-words font-bold [overflow-wrap:anywhere]">Seus feedbacks e ocorrências</h3><StatusPill>{employeeFeedbacks.length} registro(s)</StatusPill></div>',
  ],
  [
    '<div className="flex items-center justify-between gap-3"><h3 className="font-bold">Pedidos de apoio</h3><StatusPill>{employeeSupport.length} pedido(s)</StatusPill></div>',
    '<div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="break-words font-bold [overflow-wrap:anywhere]">Pedidos de apoio</h3><StatusPill>{employeeSupport.length} pedido(s)</StatusPill></div>',
  ],
  [
    '<div className="flex items-center justify-between gap-3"><h3 className="font-bold">Caixinha de sugestões</h3><StatusPill>{sugestoes.length} protocolo(s)</StatusPill></div>',
    '<div className="flex min-w-0 flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between"><h3 className="break-words font-bold [overflow-wrap:anywhere]">Caixinha de sugestões</h3><StatusPill>{sugestoes.length} protocolo(s)</StatusPill></div>',
  ],
  [
    '<p className="flex items-center justify-center gap-2 pb-1 text-xs text-muted-foreground">',
    '<p className="flex min-w-0 items-center justify-center gap-2 break-words pb-1 text-center text-xs text-muted-foreground [overflow-wrap:anywhere]">',
  ],
]);

edit("src/components/kt/employee-content-instrumentation.tsx", [
  [
    '<div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3">',
    '<div className="flex w-full min-w-0 flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3">',
  ],
  [
    '<span className="mr-auto text-[11px] font-semibold text-muted-foreground">',
    '<span className="w-full text-[11px] font-semibold text-muted-foreground sm:mr-auto sm:w-auto">',
  ],
  [
    'className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-kt hover:bg-kt-soft"',
    'className="inline-flex min-h-8 w-full items-center justify-center gap-1.5 rounded-md px-2 text-xs font-bold text-kt hover:bg-kt-soft sm:w-auto"',
  ],
]);

console.log("Mobile component fixes applied successfully.");
