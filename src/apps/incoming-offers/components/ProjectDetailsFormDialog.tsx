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
import type { UpdateProjectPayload } from "@/lib/api/projects";
import { GIG_SIZES, PROJECT_TYPES } from "../../active-projects/data";
import { isValidDecimalAmount } from "../data";

export interface ProjectDetailsFormValues {
  name: string;
  description: string;
  project_type: string;
  budget: string;
  event_date: string;
  start_date: string;
  end_date: string;
  venue_name: string;
  city: string;
  country: string;
  promoter_name: string;
  gig_size_id: number | null;
  curation_deadline: string;
}

export const EMPTY_PROJECT_DETAILS: ProjectDetailsFormValues = {
  name: "",
  description: "",
  project_type: "",
  budget: "",
  event_date: "",
  start_date: "",
  end_date: "",
  venue_name: "",
  city: "",
  country: "",
  promoter_name: "",
  gig_size_id: null,
  curation_deadline: "",
};

// Builds the PATCH payload from the form, skipping blank fields so we never
// overwrite existing backend values with empty strings.
export function toUpdatePayload(
  values: ProjectDetailsFormValues
): UpdateProjectPayload {
  const payload: UpdateProjectPayload = {};
  if (values.name.trim()) payload.name = values.name.trim();
  if (values.description.trim()) payload.description = values.description.trim();
  if (values.project_type.trim()) payload.project_type = values.project_type.trim();
  if (values.budget.trim()) payload.budget = values.budget.trim();
  if (values.event_date) payload.event_date = values.event_date;
  if (values.start_date) payload.start_date = values.start_date;
  if (values.end_date) payload.end_date = values.end_date;
  if (values.venue_name.trim()) payload.venue_name = values.venue_name.trim();
  if (values.city.trim()) payload.city = values.city.trim();
  if (values.country.trim()) payload.country = values.country.trim();
  if (values.promoter_name.trim())
    payload.promoter_name = values.promoter_name.trim();
  if (values.gig_size_id !== null) payload.gig_size_id = values.gig_size_id;
  if (values.curation_deadline)
    payload.curation_deadline = values.curation_deadline;
  return payload;
}

// Shown after approving an offer: the backend only carries title/description
// into the new project, so the user is asked to complete the remaining
// project fields here. Every field maps 1:1 to a live backend column.
export function ProjectDetailsFormDialog({
  isOpen,
  title,
  description,
  initialValues,
  isSaving,
  onSave,
  onSkip,
}: {
  isOpen: boolean;
  title: string;
  description: string;
  initialValues: ProjectDetailsFormValues;
  isSaving: boolean;
  onSave: (values: ProjectDetailsFormValues) => void;
  onSkip: () => void;
}) {
  const [values, setValues] = useState<ProjectDetailsFormValues>(initialValues);
  const { isMacTheme } = useOsTheme();

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues);
    }
  }, [isOpen, initialValues]);

  const set = <K extends keyof ProjectDetailsFormValues>(
    key: K,
    value: ProjectDetailsFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const budgetError = isValidDecimalAmount(values.budget)
    ? null
    : "Enter a plain number (e.g. 5000 or 5000.50), or leave it blank";

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSaving) onSkip();
      }}
      title={title}
      description={description}
      footer={
        <>
          <Button
            variant="retro"
            onClick={onSkip}
            disabled={isSaving}
            className="w-full sm:w-auto min-h-[36px]"
          >
            <span>Skip for Now</span>
          </Button>
          <Button
            variant={isMacTheme ? "default" : "retro"}
            onClick={() => onSave(values)}
            disabled={isSaving || !!budgetError}
            className="w-full sm:w-auto min-h-[36px]"
          >
            <span>{isSaving ? "Saving..." : "Save Details"}</span>
          </Button>
        </>
      }
    >
      <div className="space-y-3 py-1">
            <Field label="Project Name">
              <Input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
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
              <Field label="Project Type">
                <Select
                  value={values.project_type || "unset"}
                  onValueChange={(v) =>
                    set("project_type", v === "unset" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    {PROJECT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Budget">
                <Input
                  value={values.budget}
                  onChange={(e) => set("budget", e.target.value)}
                  placeholder="e.g. 5000"
                  inputMode="decimal"
                  aria-invalid={!!budgetError}
                />
                {budgetError && (
                  <p className="text-xs text-destructive">{budgetError}</p>
                )}
              </Field>
              <Field label="Event Date">
                <Input
                  type="date"
                  value={values.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </Field>
              <Field label="Gig Size">
                <Select
                  value={
                    values.gig_size_id !== null
                      ? String(values.gig_size_id)
                      : "unset"
                  }
                  onValueChange={(v) =>
                    set("gig_size_id", v === "unset" ? null : Number(v))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select size" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unset">Not set</SelectItem>
                    {GIG_SIZES.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>
                        {g.code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Start Date">
                <Input
                  type="date"
                  value={values.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </Field>
              <Field label="End Date">
                <Input
                  type="date"
                  value={values.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                />
              </Field>
              <Field label="Venue" className="sm:col-span-2">
                <Input
                  value={values.venue_name}
                  onChange={(e) => set("venue_name", e.target.value)}
                  placeholder="e.g. Electric Brixton"
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
              <Field label="Promoter" className="sm:col-span-2">
                <Input
                  value={values.promoter_name}
                  onChange={(e) => set("promoter_name", e.target.value)}
                />
              </Field>
              <Field label="Curation Deadline" className="sm:col-span-2">
                <Input
                  type="date"
                  value={values.curation_deadline}
                  onChange={(e) => set("curation_deadline", e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Curation vote reminders run until this date. Leave empty for
                  no reminders.
                </p>
              </Field>
            </div>
          </div>
    </FormDialog>
  );
}
