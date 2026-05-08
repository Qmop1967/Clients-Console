"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  consignmentId: number;
  onSuccess: () => void;
  onCancel: () => void;
}

export function AddNoteForm({ consignmentId, onSuccess, onCancel }: Props) {
  const t = useTranslations("consignments");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isValid = notes.trim().length > 0;

  const handleSubmit = async () => {
    if (!isValid || loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/consignments/${consignmentId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: notes.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || t("errorGeneric"));
        return;
      }
      setSuccess(true);
      setTimeout(onSuccess, 1500);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <Card className="border-emerald-200 dark:border-emerald-800">
        <CardContent className="p-4 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700 dark:text-emerald-400">{t("addNoteSuccess")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">{t("addNoteTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("notePlaceholder")}
          rows={3}
          maxLength={500}
          autoFocus
        />

        {error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> {error}
          </p>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={onCancel} disabled={loading}>
            {t("cancel")}
          </Button>
          <Button
            size="sm"
            className="flex-1"
            onClick={handleSubmit}
            disabled={!isValid || loading}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 me-1 animate-spin" /> {t("submitting")}</>
            ) : (
              t("submit")
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
