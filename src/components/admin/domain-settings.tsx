"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/admin/confirm";
import { checkDomainAction, connectDomainAction, disconnectDomainAction } from "@/app/actions/domains";
import { DOMAIN_STATUS_LABEL, type DnsRecord, type DomainStatus } from "@/lib/domains/validate";

type Props = {
  storeSlug: string;
  canWrite: boolean;
  initial: {
    host: string | null;
    kind: "apex" | "www" | "subdomain" | null;
    status: DomainStatus;
    error: string | null;
    verifiedAt: string | null;
    checkedAt: string | null;
    records: DnsRecord[];
    hostingReady: boolean;
  };
};

const TONE: Record<DomainStatus, "neutral" | "warning" | "success" | "danger" | "outline"> = {
  NOT_CONNECTED: "outline",
  DNS_REQUIRED: "warning",
  VERIFYING: "warning",
  CONNECTED: "success",
  ERROR: "danger",
};

export function DomainSettings({ storeSlug, canWrite, initial }: Props) {
  const [state, setState] = useState(initial);
  const [input, setInput] = useState("");
  const [pending, start] = useTransition();
  const [removing, setRemoving] = useState(false);

  function connect(event: React.FormEvent) {
    event.preventDefault();
    start(async () => {
      const result = await connectDomainAction(input);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState({ ...state, ...result.data, verifiedAt: result.data.status === "CONNECTED" ? new Date().toISOString() : null, checkedAt: new Date().toISOString() });
      setInput("");
      toast.success(result.message ?? "Saved");
    });
  }

  function check() {
    start(async () => {
      const result = await checkDomainAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState({ ...state, ...result.data, checkedAt: new Date().toISOString(), verifiedAt: result.data.status === "CONNECTED" ? state.verifiedAt ?? new Date().toISOString() : null });
      toast[result.data.status === "CONNECTED" ? "success" : "message"](result.message ?? "Checked");
    });
  }

  function remove() {
    start(async () => {
      const result = await disconnectDomainAction();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState({ host: null, kind: null, status: "NOT_CONNECTED", error: null, verifiedAt: null, checkedAt: null, records: [], hostingReady: state.hostingReady });
      setRemoving(false);
      toast.success("Domain removed");
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle>Your store&apos;s addresses</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-[13px]">
          <Row label="Halyard address">
            <a href={`/s/${storeSlug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-pine-700 hover:underline">
              /s/{storeSlug} <ExternalLink className="size-3" />
            </a>
          </Row>
          <Row label="Custom domain">
            {state.host ? (
              <span className="inline-flex items-center gap-2">
                <span className="font-medium text-ink-900">{state.host}</span>
                <Badge tone={TONE[state.status]}>{DOMAIN_STATUS_LABEL[state.status]}</Badge>
              </span>
            ) : (
              <Badge tone="outline">Not connected</Badge>
            )}
          </Row>
          <p className="text-ink-500">
            Your Halyard address always keeps working, so connecting a domain never takes your store offline.
          </p>
        </CardContent>
      </Card>

      {!state.host ? (
        <Card>
          <CardHeader><CardTitle>Connect a domain you own</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-[13px]">
            <p className="text-ink-600">
              Enter a domain you have already bought from a registrar (GoDaddy, Namecheap, Cloudflare, Google Domains…).
              Halyard does not sell domains. You can use the root domain, <span className="font-mono">www</span>, or a subdomain like <span className="font-mono">shop</span>.
            </p>
            <form onSubmit={connect} className="flex flex-col gap-2 sm:flex-row">
              <Input
                aria-label="Domain"
                placeholder="courtline.com"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                disabled={!canWrite || pending}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                inputMode="url"
              />
              <Button type="submit" disabled={!canWrite || pending || !input.trim()} loading={pending}>Connect domain</Button>
            </form>
            {!state.hostingReady && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                You can reserve your domain and see the DNS records now. Halyard&apos;s hosting connection for custom domains is being
                enabled; verification will run automatically once it is, and your store keeps working at its Halyard address meanwhile.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {state.status === "CONNECTED" ? "Connected" : state.status === "ERROR" ? "Needs attention" : "Add these DNS records"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-[13px]">
            {state.status === "CONNECTED" ? (
              <p className="text-ink-600">
                <span className="font-medium text-ink-900">https://{state.host}</span> now serves your store with HTTPS.
                {state.verifiedAt && <> Verified {new Date(state.verifiedAt).toLocaleString()}.</>}
              </p>
            ) : (
              <p className="text-ink-600">
                Sign in at your domain registrar, open the DNS settings for <span className="font-medium text-ink-900">{state.kind === "apex" ? state.host : state.host.split(".").slice(-2).join(".")}</span>, and add each record below exactly as shown.
                Changes usually take a few minutes; some registrars take up to 24 hours.
              </p>
            )}

            {state.error && (
              <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-800">{state.error}</p>
            )}

            {state.records.length > 0 && (
              <div className="overflow-x-auto rounded-md border border-ink-200">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-ink-50 text-left font-mono text-[10.5px] uppercase tracking-wider text-ink-500">
                    <tr><th className="px-3 py-2">Type</th><th className="px-3 py-2">Name / host</th><th className="px-3 py-2">Value / points to</th><th className="px-3 py-2">Why</th><th className="px-3 py-2"></th></tr>
                  </thead>
                  <tbody>
                    {state.records.map((record) => (
                      <tr key={`${record.type}-${record.name}-${record.value}`} className="border-t border-ink-100 align-top">
                        <td className="px-3 py-2 font-mono">{record.type}</td>
                        <td className="px-3 py-2 font-mono"><CopyValue value={record.name} /></td>
                        <td className="px-3 py-2 font-mono break-all"><CopyValue value={record.value} /></td>
                        <td className="px-3 py-2 text-ink-500">{record.purpose}</td>
                        <td className="px-3 py-2"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!state.hostingReady && state.status !== "CONNECTED" && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                Your domain is reserved. Halyard&apos;s hosting connection for custom domains is still being enabled, so &ldquo;Check again&rdquo;
                cannot verify it yet. Nothing is lost: add the records now and it will verify automatically once the connection is live.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" onClick={check} disabled={!canWrite || pending} loading={pending}>
                <RefreshCw className="size-3.5" /> Check again
              </Button>
              {state.checkedAt && <span className="text-[12px] text-ink-400">Last checked {new Date(state.checkedAt).toLocaleString()}</span>}
              <span className="flex-1" />
              <Button variant="ghost" size="sm" onClick={() => setRemoving(true)} disabled={!canWrite || pending}>Remove domain</Button>
            </div>

            <details className="text-[12.5px] text-ink-600">
              <summary className="cursor-pointer font-medium text-ink-800">Common problems</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li><span className="font-medium">Still &ldquo;DNS required&rdquo; after adding records:</span> DNS can take up to 24 hours to spread. Check for a typo in the value, and make sure there is no second A or CNAME record for the same name.</li>
                <li><span className="font-medium">Registrar won&apos;t accept a CNAME on the root domain:</span> use the A record for the root, and a CNAME for www.</li>
                <li><span className="font-medium">Domain is behind Cloudflare:</span> set the record to &ldquo;DNS only&rdquo; (grey cloud) until it shows Connected.</li>
                <li><span className="font-medium">&ldquo;Attached to another site&rdquo;:</span> the domain is in use on another hosting project. Remove it there first.</li>
                <li><span className="font-medium">Both root and www:</span> connect the one you want as the main address; we&apos;ll add automatic redirects for the other in a later update.</li>
              </ul>
            </details>
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={removing}
        onOpenChange={setRemoving}
        title="Remove this domain?"
        description={`${state.host ?? "The domain"} will stop serving your store. Your Halyard address keeps working.`}
        confirmLabel="Remove domain"
        destructive
        onConfirm={remove}
      />
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink-500">{label}</span>
      <span className="text-ink-800">{children}</span>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-ink-100"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Copy failed — select the text instead");
        }
      }}
      aria-label={`Copy ${value}`}
    >
      <span>{value}</span>
      {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3 text-ink-400" />}
    </button>
  );
}
