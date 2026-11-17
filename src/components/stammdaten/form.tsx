"use client";

import Link from "next/link";
import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MasterAction } from "@/modules/stammdaten/form-state";

export type Choice = { value: string; label: string };
export type Field = {
  name: string;
  label: string;
  value?: string;
  required?: boolean;
  maxLength?: number;
  type?: "text" | "date" | "email" | "tel" | "decimal" | "integer" | "textarea" | "select" | "checkboxes";
  options?: Choice[];
  checkedValues?: string[];
  hint?: string;
};

const inputClass = "min-h-11 w-full rounded-md border border-border bg-background px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-primary aria-invalid:border-red-400";

export function MasterForm({ action, fields = [], hidden, cancel, submit = "Speichern", confirmation }: {
  action: MasterAction;
  fields?: Field[];
  hidden?: Record<string, string>;
  cancel?: string;
  submit?: string;
  confirmation?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [dirty, setDirty] = useState(false);
  const busy = useRef(false);
  const error = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (state.message) {
      busy.current = false;
      error.current?.focus();
    }
  }, [state]);

  useEffect(() => {
    if (!dirty || pending) return;
    const warning = "Ungespeicherte Änderungen verwerfen?";
    const unload = (event: BeforeUnloadEvent) => event.preventDefault();
    const linkClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || event.defaultPrevented || event.button !== 0 ||
          event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest("a[href]");
      if (link && !link.getAttribute("target") && !window.confirm(warning)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", linkClick, true);
    };
  }, [dirty, pending]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || (confirmation && !window.confirm(confirmation))) return;
    busy.current = true;
    const values = new FormData(event.currentTarget);
    startTransition(() => dispatch(values));
  }

  return <form method="post" onSubmit={send} onChange={() => setDirty(true)} aria-busy={pending} className="grid gap-4">
    {Object.entries(hidden ?? {}).map(([name, value]) => <input type="hidden" key={name} name={name} value={value} />)}
    <fieldset disabled={pending} className={fields.length ? "grid min-w-0 gap-4 sm:grid-cols-2" : "hidden"}>
      {fields.map((field) => <FormField key={field.name} field={field} errors={state.errors?.[field.name]} />)}
    </fieldset>
    {state.message && <p ref={error} tabIndex={-1} role="alert" className="text-sm text-red-300">{state.message}</p>}
    <div className="flex flex-wrap items-center gap-4">
      <Button type="submit" disabled={pending} className={confirmation ? "border border-border bg-transparent text-foreground hover:bg-background" : undefined}>
        {pending ? "Wird gespeichert …" : submit}
      </Button>
      {cancel && <Link href={cancel} className="flex min-h-11 items-center text-sm text-primary underline">Abbrechen</Link>}
    </div>
  </form>;
}

function FormField({ field, errors }: { field: Field; errors?: string[] }) {
  const id = useId();
  const label = field.label + (field.required ? " *" : "");
  const description = [field.hint ? id + "-hint" : null, errors?.length ? id + "-error" : null].filter(Boolean).join(" ") || undefined;
  const common = {
    id, name: field.name, defaultValue: field.value ?? "", required: field.required,
    "aria-invalid": Boolean(errors?.length), "aria-describedby": description,
  };

  if (field.type === "checkboxes") {
    return <fieldset aria-describedby={description} className="grid min-w-0 gap-2 sm:col-span-2">
      <legend className="text-sm font-medium">{label}</legend>
      <div className="max-h-52 overflow-y-auto rounded-md border border-border">
        {field.options?.map((option) => <label key={option.value} className="flex min-h-11 items-center gap-3 border-b border-border px-3 py-2 last:border-b-0">
          <input type="checkbox" name={field.name} value={option.value} defaultChecked={field.checkedValues?.includes(option.value)} />
          <span className="break-words">{option.label}</span>
        </label>)}
      </div>
      <FieldFeedback id={id} hint={field.hint} errors={errors} />
    </fieldset>;
  }

  return <div className={field.type === "textarea" ? "grid gap-2 sm:col-span-2" : "grid min-w-0 content-start gap-2"}>
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    {field.type === "select" ? <select {...common} className={inputClass}>
      {field.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : field.type === "textarea" ? <textarea {...common} className={inputClass} rows={3} maxLength={field.maxLength} /> :
      <Input {...common} type={field.type === "decimal" || field.type === "integer" ? "text" : field.type ?? "text"}
        inputMode={field.type === "decimal" ? "decimal" : field.type === "integer" ? "numeric" : undefined}
        maxLength={field.maxLength} />}
    <FieldFeedback id={id} hint={field.hint} errors={errors} />
  </div>;
}

function FieldFeedback({ id, hint, errors }: { id: string; hint?: string; errors?: string[] }) {
  return <>
    {hint && <p id={id + "-hint"} className="text-xs text-muted-foreground">{hint}</p>}
    {errors?.length ? <p id={id + "-error"} className="text-sm text-red-300">{errors[0]}</p> : null}
  </>;
}
