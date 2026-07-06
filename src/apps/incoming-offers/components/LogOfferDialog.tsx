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
import type { ArtistListItem } from "@/lib/api/artists";

export interface LogOfferFormValues {
  name: string;
  description: string;
  artist_id: number | null;
  event_date: string;
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
  artist_id: null,
  event_date: "",
  venue_name: "",
  city: "",
  country: "",
  promoter_name: "",
  source: "Promoter",
  agreed_fee: "",
  notes: "",
};

// Records an external (non-pitch) offer as real backend data: a project
// (created on_hold until the offer is approved) plus a pending booking for
// the offered artist. Name and artist are the backend's required fields.
export function LogOfferDialog({
  isOpen,
  artists,
  isSaving,
  onClose,
  onSubmit,
}: {
  isOpen: boolean;
  artists: ArtistListItem[];
  isSaving: boolean;
  onClose: () => void;
  onSubmit: (values: LogOfferFormValues) => void;
}) {
  const [values, setValues] = useState<LogOfferFormValues>(EMPTY);

  useEffect(() => {
    if (isOpen) setValues(EMPTY);
  }, [isOpen]);

  const set = <K extends keyof LogOfferFormValues>(
    key: K,
    value: LogOfferFormValues[K]
  ) => setValues((prev) => ({ ...prev, [key]: value }));

  const canSubmit = values.name.trim() !== "" && values.artist_id !== null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open && !isSaving) onClose();
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Incoming Offer</DialogTitle>
          <DialogDescription>
            Record an offer received by email or elsewhere. This creates a
            pending booking (and an on-hold project) in the backend; the offer
            can then be approved or declined from the Inbox.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh] pr-3">
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-sm">Offer / Event Name *</Label>
              <Input
                value={values.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Warehouse Project Opening"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Artist *</Label>
              <Select
                value={
                  values.artist_id !== null ? String(values.artist_id) : ""
                }
                onValueChange={(v) => set("artist_id", Number(v))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Who is the offer for?" />
                </SelectTrigger>
                <SelectContent>
                  {artists.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.artist_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                <Label className="text-sm">Event Date</Label>
                <Input
                  type="date"
                  value={values.event_date}
                  onChange={(e) => set("event_date", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Fee Offered</Label>
                <Input
                  value={values.agreed_fee}
                  onChange={(e) => set("agreed_fee", e.target.value)}
                  placeholder="e.g. 1500"
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-sm">Venue</Label>
                <Input
                  value={values.venue_name}
                  onChange={(e) => set("venue_name", e.target.value)}
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
              <div className="space-y-1">
                <Label className="text-sm">Promoter</Label>
                <Input
                  value={values.promoter_name}
                  onChange={(e) => set("promoter_name", e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Source</Label>
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
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-sm">Notes</Label>
                <Textarea
                  value={values.notes}
                  onChange={(e) => set("notes", e.target.value)}
                  className="min-h-[50px]"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={() => onSubmit(values)}
            disabled={!canSubmit || isSaving}
          >
            {isSaving ? "Saving..." : "Log Offer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
