"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./ResearchUI.module.css";

export type KnowledgeOption = { id: string; title: string; kind?: string; summary?: string };

export default function KnowledgeSelector({ label, name, kind = "claim", initialId = "", initialTitle = "", excludeId = "", onSelect, required = true }: {
  label: string; name: string; kind?: "claim" | "argument"; initialId?: string; initialTitle?: string;
  excludeId?: string; onSelect?: (id: string) => void; required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const edited = useRef(false);
  const [selected, setSelected] = useState(initialId);
  const [query, setQuery] = useState(initialTitle || initialId);
  const [options, setOptions] = useState<KnowledgeOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [status, setStatus] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    input.current?.setCustomValidity(selected || (!required && !query.trim()) ? "" : `Choose a published ${kind} from the search results.`);
  }, [selected, kind, required, query]);

  useEffect(() => {
    if (!initialId || initialTitle) return;
    const controller = new AbortController();
    fetch(`/api/knowledge/${kind === "argument" ? "arguments" : "nodes"}/${encodeURIComponent(initialId)}`, { signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : null)
      .then((node) => { if (node?.title && !controller.signal.aborted && !edited.current) setQuery(node.title); })
      .catch(() => {});
    return () => controller.abort();
  }, [initialId, initialTitle, kind]);

  useEffect(() => {
    if (!open || selected || (kind === "claim" && query.trim().length < 2)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setStatus("Searching published records…");
      try {
        const params = new URLSearchParams({ q: query.trim(), limit: "12" });
        const response = await fetch(`/api/knowledge/${kind === "argument" ? "arguments" : "search"}?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        const records = (kind === "argument" ? data.arguments : data.results) || [];
        const next = records.filter((item: KnowledgeOption) => item.id && item.title && item.id !== excludeId);
        setOptions(next);
        setActive(-1);
        setStatus(next.length ? `${next.length} published results. Use arrow keys to choose.` : "No published matches. Try another title or phrase.");
      } catch {
        if (!controller.signal.aborted) setStatus("Search unavailable. Please retry.");
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, selected, kind, excludeId, retry]);

  useEffect(() => { if (active >= 0) document.getElementById(`${id}-option-${active}`)?.scrollIntoView?.({ block: "nearest" }); }, [active, id]);

  function choose(option: KnowledgeOption) {
    setQuery(option.title); setSelected(option.id); setOpen(false); setOptions([]); setActive(-1);
    setStatus(`${option.title} selected.`); onSelect?.(option.id);
  }

  return <div className={styles.selector} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor={id}>{label}</label>
    <input ref={input} id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open ? `${id}-results` : undefined}
      aria-activedescendant={open && active >= 0 ? `${id}-option-${active}` : undefined} aria-describedby={`${id}-status`}
      value={query} maxLength={500} autoComplete="off" required={required} placeholder={`Search ${kind === "argument" ? "arguments" : "claims"} by title or phrase…`}
      onFocus={() => setOpen(true)}
      onChange={(event) => { edited.current = true; setQuery(event.target.value); setSelected(""); setOptions([]); setActive(-1); setStatus(""); setOpen(true); onSelect?.(""); }}
      onKeyDown={(event) => {
        if (event.key === "Escape") { setOpen(false); setActive(-1); }
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault(); setOpen(true);
          setActive((current) => options.length ? current < 0 ? event.key === "ArrowDown" ? 0 : options.length - 1 : (current + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length : -1);
        }
        if (event.key === "Enter" && open && active >= 0 && options[active]) { event.preventDefault(); choose(options[active]); }
      }} />
    <input type="hidden" name={name} value={selected} />
    <p id={`${id}-status`} role="status">{status || (selected ? "Published record selected." : kind === "argument" ? "Search by title or browse published arguments." : "Type at least two characters, then choose a result.")}</p>
    {open && <div className={styles.results}>
      <ul id={`${id}-results`} role="listbox" aria-label={`${label} results`}>
        {options.map((option, index) => <li key={option.id} id={`${id}-option-${index}`} role="option" aria-selected={active === index}>
          <button type="button" tabIndex={-1} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}
            className={styles.option} data-active={active === index}>
            <strong>{option.title}</strong><span>{option.kind || kind}{option.summary ? ` · ${option.summary.slice(0, 120)}` : ""}</span>
          </button>
        </li>)}
      </ul>
      {!options.length && <p>{status || "Search the published catalogue above."}</p>}
      {status.includes("unavailable") && <button type="button" onClick={() => setRetry((value) => value + 1)}>Retry search</button>}
    </div>}
  </div>;
}
