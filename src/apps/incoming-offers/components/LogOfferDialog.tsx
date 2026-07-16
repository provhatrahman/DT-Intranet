import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormDialog, useOsTheme } from "@/components/greenroom";

export interface LogOfferFormValues {
  name: string;
  description: string;
  event_date: string;
  timings: string;
  venue_name: string;
  city: string;
  country: string;
  promoter_name: string;
  source: string;
  agreed_fee: string;
  notes: string;
}

const EMPTY: LogOfferFormValues = {
  name: "",
  description: "",
  event_date: "",
  timings: "",
  venue_name: "",
  city: "",
  country: "",
  promoter_name: "",
  source: "Promoter",
  agreed_fee: "",
  notes: "",
};

// Records an external (non-pitch) offer as real backend data: a project
// (created on_hold until the offer is approved) plus a pending booking.
// Incoming offers are for the collective as a whole rather than a specific
// artist, so no artist is chosen here — the booking is attached to a stand-in
// collective artist by the caller. Only the offer name is required.
export function LogOfferDialog({
  isOpen,
  isSaving,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: LogOfferFormValues) => void;
}) {
  const [values, setValues] = useState<LogOfferFormValues>(EMPTY);
  const { isMacTheme } = useOsTheme();

  useEffect(() => {
    if (isOpen) setValues(EMPTY);
  }, [isOpen]);

  const set = <K extends keyof LogOfferFormValues>(
    key: K,
    value: LogOfferFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const canSubmit = values.name.trim() !== "";

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
      title="Log Incoming Offer"
      description="Record an offer received by email or elsewhere. This creates a pending booking (and an on-hold project) in the backend; the offer can then be approved or declined from the Inbox."
      footer={
        <>
          <Button
            variant="retro"
            onClick={onClose}
            disabled={isSaving}
            className="w-full sm:w-auto min-h-[36px]"
          >
            <span>Cancel</span>
          </Button>
          <Button
            variant={isMacTheme ? "default" : "retro"}
            onClick={() => onSubmit(values)}
            disabled={!canSubmit || isSaving}
            className="w-full sm:w-auto min-h-[36px]"
          >
            <span>{isSaving ? "Saving..." : "Log Offer"}</span>
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
            <Field label="Offer / Event Name" required>
              <Input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Warehouse Project Opening"
              />
            </Field>
            <Field label="Description">
              <Textarea
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                className="min-h-[60px]"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Event Date">
                <Input
                  type="date"
                  value={values.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </Field>
              <Field label="Fee Offered">
                <Input
                  value={values.agreed_fee}
                  onChange={(e) => set("agreed_fee", e.target.value)}
                  placeholder="e.g. 1500"
                  inputMode="decimal"
                />
              </Field>
              <Field label="Time" className="sm:col-span-2">
                <Input
                  value={values.timings}
                  onChange={(e) => set("timings", e.target.value)}
                  placeholder="e.g. Doors 7pm, on stage 9pm"
                />
              </Field>
              <Field label="Venue" className="sm:col-span-2">
                <Input
                  value={values.venue_name}
                  onChange={(e) => set("venue_name", e.target.value)}
                />
              </Field>
              <Field label="City">
                <Input
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </Field>
              <Field label="Country">
                <Input
                  value={values.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </Field>
              <Field label="Promoter">
                <Input
                  value={values.promoter_name}
                  onChange={(e) => set("promoter_name", e.target.value)}
                />
              </Field>
              <Field label="Source">
                <Select
                  value={values.source}
                  onValueChange={(v) => set("source", v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Promoter">Promoter</SelectItem>
                    <SelectItem value="Direct">Direct</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Notes" className="sm:col-span-2">
                <Textarea
                  value={values.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  className="min-h-[50px]"
                />
              </Field>
            </div>
          </div>
    </FormDialog>
  );
}
