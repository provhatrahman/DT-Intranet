import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { UpdateProjectPayload } from "@/lib/api/projects";
import { GIG_SIZES, PROJECT_TYPES } from "../../active-projects/data";

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

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues);
    }
  }, [isOpen, initialValues]);

  const set = <K extends keyof ProjectDetailsFormValues>(
    key: K,
    value: ProjectDetailsFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSaving) onSkip();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-sm">Project Name</Label>
              <Input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Description</Label>
              <Textarea
                value={values.description}
                onChange={(e) => set("description", e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm">Project Type</Label>
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
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Budget</Label>
                <Input
                  value={values.budget}
                  onChange={(e) => set("budget", e.target.value)}
                  placeholder="e.g. 5000"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Event Date</Label>
                <Input
                  type="date"
                  value={values.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Gig Size</Label>
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
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Start Date</Label>
                <Input
                  type="date"
                  value={values.start_date}
                  onChange={(e) => set("start_date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">End Date</Label>
                <Input
                  type="date"
                  value={values.end_date}
                  onChange={(e) => set("end_date", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-sm">Venue</Label>
                <Input
                  value={values.venue_name}
                  onChange={(e) => set("venue_name", e.target.value)}
                  placeholder="e.g. Electric Brixton"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">City</Label>
                <Input
                  value={values.city}
                  onChange={(e) => set("city", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Country</Label>
                <Input
                  value={values.country}
                  onChange={(e) => set("country", e.target.value)}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-sm">Promoter</Label>
                <Input
                  value={values.promoter_name}
                  onChange={(e) => set("promoter_name", e.target.value)}
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onSkip} disabled={isSaving}>
            Skip for Now
          </Button>
          <Button onClick={() => onSave(values)} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
