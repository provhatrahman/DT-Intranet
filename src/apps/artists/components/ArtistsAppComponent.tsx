import { useState, useEffect, useMemo, type ReactNode } from "react";
import { AppProps } from "../../base/types";
import { WindowFrame } from "@/components/layout/WindowFrame";
import { ArtistsMenuBar } from "./ArtistsMenuBar";
import HelpGuideDialog from "@/components/help/HelpGuideDialog";
import { useArtistsStore } from "@/stores/useArtistsStore";
import { useBookingsStore } from "@/stores/useBookingsStore";
import type {
  ArtistDetail,
  CreateArtistPayload,
  UpdateArtistPayload,
} from "@/lib/api/artists";
import {
  ALL,
  actTypeTokens,
  collectOptions,
  matchesBookingFilter,
  recentBookingCutoff,
  toComboboxOptions,
  type BookingFilter,
} from "../utils/filters";
import {
  AppToolbar,
  ArtistFacts,
  EmptyState,
  Field,
  FormDialog,
  InfoTile,
  SidebarRow,
  StatusBadge,
  useOsTheme,
} from "@/components/greenroom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Combobox } from "@/components/ui/combobox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CalendarCheck,
  Clock,
  ExternalLink,
  Globe,
  Instagram,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Mic,
  Music,
  Pencil,
  Phone,
  Plus,
  Search,
  Star,
  User,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type StatusFilter = "all" | "active" | "inactive";
type SortKey = "name" | "score" | "last_booked";

// "2026-03-14" → "14 Mar 2026"; null/invalid → null so callers can fall back.
function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Booking fees come back as decimal strings ("350.00"); render as GBP without
// noise decimals for whole amounts.
function formatFee(fee: string | null): string | null {
  if (!fee) return null;
  const amount = Number(fee);
  if (Number.isNaN(amount)) return fee;
  const whole = amount % 1 === 0;
  return amount.toLocaleString("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 0,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

// Clickable href for a social/link field: full URLs pass through, "@handle"
// values map onto the platform's profile URL when one is given, anything else
// renders as plain text.
function linkHref(value: string, handleBase?: string): string | undefined {
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return v;
  if (handleBase && v.startsWith("@")) return `${handleBase}${v.slice(1)}`;
  return undefined;
}

// Grouped fieldset for the artist form: an inset Aqua well on the macosx
// theme (bordered panel elsewhere) with a small icon + title header — same
// section language as the quick-add form in Active Projects.
function FormSection({
  icon: Icon,
  title,
  children,
}: {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  const { isMacTheme } = useOsTheme();
  return (
    <div
      className={cn(
        "p-3 rounded-md space-y-3",
        isMacTheme ? "aqua-well" : "border"
      )}
    >
      <div className="flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: LucideIcon;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <h3 className="text-sm font-semibold">{title}</h3>
    </div>
  );
}

// One row in the Contact & Links section; renders an external link when the
// value resolves to a URL.
function ContactRow({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
}) {
  return (
    <div className="flex items-center gap-2 text-sm min-w-0">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <span className="text-xs text-muted-foreground w-24 shrink-0">
        {label}
      </span>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 inline-flex items-center gap-1 underline underline-offset-2 hover:opacity-80"
        >
          <span className="truncate">{value}</span>
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      ) : (
        <span className="truncate">{value}</span>
      )}
    </div>
  );
}

// Everything the create/edit form captures. Genres and location are
// create-only: the backend's update endpoint has no genre/location handling.
interface ArtistFormValues {
  artist_name: string;
  preferred_name: string;
  type_of_act: string;
  pronouns: string;
  genres: string;
  city: string;
  country: string;
  bio: string;
  primary_email: string;
  primary_phone: string;
  instagram: string;
  soundcloud: string;
  tiktok: string;
  website: string;
  is_active: boolean;
  is_collective_member: boolean;
}

const EMPTY_FORM: ArtistFormValues = {
  artist_name: "",
  preferred_name: "",
  type_of_act: "",
  pronouns: "",
  genres: "",
  city: "",
  country: "UK",
  bio: "",
  primary_email: "",
  primary_phone: "",
  instagram: "",
  soundcloud: "",
  tiktok: "",
  website: "",
  is_active: true,
  is_collective_member: true,
};

// Shared create/edit form. Only the artist name is required; everything else
// can be completed later. In edit mode the genre/location fields are hidden
// (create-only in the backend) and the current profile is prefilled.
function ArtistFormDialog({
  isOpen,
  onOpenChange,
  mode,
  initial,
  initialName,
  onSubmit,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: ArtistDetail | null;
  initialName?: string;
  onSubmit: (values: ArtistFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<ArtistFormValues>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Re-seed the form each time the dialog opens: from the existing profile in
  // edit mode, from the search box (no-match → Create) in create mode.
  useEffect(() => {
    if (!isOpen) return;
    if (mode === "edit" && initial) {
      setForm({
        ...EMPTY_FORM,
        artist_name: initial.artist_name,
        preferred_name: initial.preferred_name ?? "",
        type_of_act: initial.type_of_act ?? "",
        pronouns: initial.pronouns ?? "",
        bio: initial.bio ?? "",
        primary_email: initial.primary_email ?? "",
        primary_phone: initial.primary_phone ?? "",
        instagram: initial.instagram ?? "",
        soundcloud: initial.soundcloud ?? "",
        tiktok: initial.tiktok ?? "",
        website: initial.website ?? "",
        is_active: initial.is_active,
        is_collective_member: initial.is_collective_member,
      });
    } else {
      setForm({ ...EMPTY_FORM, artist_name: initialName ?? "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const canSubmit = form.artist_name.trim().length > 0 && !isSubmitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setIsSubmitting(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch {
      // error surfaced via store toast; keep the dialog open to retry
    } finally {
      setIsSubmitting(false);
    }
  };

  const setField = <K extends keyof ArtistFormValues>(
    key: K,
    value: ArtistFormValues[K]
  ) => setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <FormDialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "New Artist" : "Edit Artist"}
      description={
        mode === "create"
          ? "Add an artist to the database. Only the name is required — the full profile can be completed later."
          : "Update this artist's profile. Genres and locations can only be set when an artist is created for now."
      }
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            variant="default"
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            <span className="inline-flex items-center">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {isSubmitting
                ? "Saving…"
                : mode === "create"
                  ? "Add to Database"
                  : "Save Changes"}
            </span>
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <FormSection icon={Mic} title="Artist">
          <Field label="Artist name" required>
            <Input
              value={form.artist_name}
              onChange={(e) => setField("artist_name", e.target.value)}
              placeholder="Stage name"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Preferred name">
              <Input
                value={form.preferred_name}
                onChange={(e) => setField("preferred_name", e.target.value)}
                placeholder="Real / preferred name"
              />
            </Field>
            <Field label="Pronouns">
              <Input
                value={form.pronouns}
                onChange={(e) => setField("pronouns", e.target.value)}
                placeholder="they/them"
              />
            </Field>
          </div>
          <Field label="Type of act">
            <Input
              value={form.type_of_act}
              onChange={(e) => setField("type_of_act", e.target.value)}
              placeholder="DJ, Live Act…"
            />
          </Field>
          {mode === "create" && (
            <Field label="Genres">
              <Input
                value={form.genres}
                onChange={(e) => setField("genres", e.target.value)}
                placeholder="Techno, House — comma-separated"
              />
            </Field>
          )}
          <Field label="Bio">
            <Textarea
              value={form.bio}
              onChange={(e) => setField("bio", e.target.value)}
              placeholder="Short bio"
              className="min-h-16"
            />
          </Field>
        </FormSection>

        {mode === "create" && (
          <FormSection icon={MapPin} title="Location">
            <div className="grid grid-cols-2 gap-3">
              <Field label="City">
                <Input
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                  placeholder="London"
                />
              </Field>
              <Field label="Country">
                <Input
                  value={form.country}
                  onChange={(e) => setField("country", e.target.value)}
                />
              </Field>
            </div>
          </FormSection>
        )}

        <FormSection icon={Mail} title="Contact & Links">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Email">
              <Input
                type="email"
                value={form.primary_email}
                onChange={(e) => setField("primary_email", e.target.value)}
                placeholder="artist@example.com"
              />
            </Field>
            <Field label="Phone">
              <Input
                value={form.primary_phone}
                onChange={(e) => setField("primary_phone", e.target.value)}
                placeholder="+44…"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Instagram">
              <Input
                value={form.instagram}
                onChange={(e) => setField("instagram", e.target.value)}
                placeholder="@handle or URL"
              />
            </Field>
            <Field label="SoundCloud">
              <Input
                value={form.soundcloud}
                onChange={(e) => setField("soundcloud", e.target.value)}
                placeholder="URL"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="TikTok">
              <Input
                value={form.tiktok}
                onChange={(e) => setField("tiktok", e.target.value)}
                placeholder="@handle or URL"
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(e) => setField("website", e.target.value)}
                placeholder="URL"
              />
            </Field>
          </div>
        </FormSection>

        <FormSection icon={Users} title="Status">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm">Active</div>
              <div className="text-xs text-muted-foreground">
                Available for bookings and lineups
              </div>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setField("is_active", checked)}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-sm">Collective member</div>
              <div className="text-xs text-muted-foreground">
                Part of the core roster
              </div>
            </div>
            <Switch
              checked={form.is_collective_member}
              onCheckedChange={(checked) =>
                setField("is_collective_member", checked)
              }
            />
          </div>
        </FormSection>
      </div>
    </FormDialog>
  );
}

export function ArtistsAppComponent({
  isWindowOpen,
  onClose,
  isForeground,
  skipInitialSound,
  instanceId,
  onNavigateNext,
  onNavigatePrevious,
}: AppProps) {
  const [isHelpDialogOpen, setIsHelpDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [genreFilter, setGenreFilter] = useState(ALL);
  const [cityFilter, setCityFilter] = useState(ALL);
  const [actTypeFilter, setActTypeFilter] = useState(ALL);
  const [bookingFilter, setBookingFilter] = useState<BookingFilter>(ALL);
  const [sortKey, setSortKey] = useState<SortKey>("name");
  // Viewport-width based (not touch): a touch-enabled desktop keeps the
  // two-pane master-detail layout instead of collapsing to a single pane.
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [selectedArtistId, setSelectedArtistId] = useState<number | null>(null);

  const { isMacTheme, isXpTheme } = useOsTheme();

  const {
    artists,
    artistDetails,
    stats,
    isLoading,
    error,
    fetchArtists,
    fetchStats,
    getArtistDetail,
    createArtist,
    updateArtist,
    clearError,
  } = useArtistsStore();
  // Bookings back the per-artist booking history (and the stats' source data).
  const { bookings, fetchBookings } = useBookingsStore();

  useEffect(() => {
    if (isWindowOpen) {
      fetchArtists().catch((err) => {
        console.error("Failed to fetch artists:", err);
      });
      fetchStats().catch((err) => {
        console.error("Failed to fetch artist stats:", err);
      });
      fetchBookings().catch((err) => {
        console.error("Failed to fetch bookings:", err);
      });
    }
  }, [isWindowOpen, fetchArtists, fetchStats, fetchBookings]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  // Filter dropdown options, derived from the roster itself so they only ever
  // offer values that actually match something.
  const genreOptions = useMemo(
    () => toComboboxOptions("Genre: All", collectOptions(artists, (a) => a.genres)),
    [artists]
  );
  const cityOptions = useMemo(
    () =>
      toComboboxOptions(
        "City: All",
        collectOptions(artists, (a) => a.locations.map((l) => l.city))
      ),
    [artists]
  );
  const actTypeOptions = useMemo(
    () =>
      toComboboxOptions(
        "Act: All",
        collectOptions(artists, (a) => actTypeTokens(a.type_of_act))
      ),
    [artists]
  );

  const selectedGenreLabel = genreOptions.find((o) => o.value === genreFilter)?.label;
  const selectedCityLabel = cityOptions.find((o) => o.value === cityFilter)?.label;
  const selectedActTypeLabel = actTypeOptions.find(
    (o) => o.value === actTypeFilter
  )?.label;

  const hasNonSearchFilters =
    statusFilter !== "active" ||
    genreFilter !== ALL ||
    cityFilter !== ALL ||
    actTypeFilter !== ALL ||
    bookingFilter !== ALL;

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "active" ||
    genreFilter !== ALL ||
    cityFilter !== ALL ||
    actTypeFilter !== ALL ||
    bookingFilter !== ALL;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("active");
    setGenreFilter(ALL);
    setCityFilter(ALL);
    setActTypeFilter(ALL);
    setBookingFilter(ALL);
  };

  // Live client-side filter over the whole roster (a few hundred rows, so no
  // debounce/server round-trip needed). Matches names, genres, and cities; an
  // empty query shows the entire database so it's browsable without searching.
  const visibleArtists = useMemo(() => {
    const query = search.trim().toLowerCase();
    let list = artists;
    if (statusFilter !== "all") {
      list = list.filter((a) => a.is_active === (statusFilter === "active"));
    }
    if (genreFilter !== ALL) {
      list = list.filter((a) =>
        a.genres.some((g) => g.trim().toLowerCase() === genreFilter)
      );
    }
    if (cityFilter !== ALL) {
      list = list.filter((a) =>
        a.locations.some((l) => l.city.trim().toLowerCase() === cityFilter)
      );
    }
    if (actTypeFilter !== ALL) {
      list = list.filter((a) =>
        actTypeTokens(a.type_of_act).some(
          (t) => t.toLowerCase() === actTypeFilter
        )
      );
    }
    if (bookingFilter !== ALL) {
      const cutoff = recentBookingCutoff();
      list = list.filter((a) =>
        matchesBookingFilter(stats[a.id], bookingFilter, cutoff)
      );
    }
    if (query) {
      list = list.filter(
        (a) =>
          a.artist_name.toLowerCase().includes(query) ||
          (a.preferred_name ?? "").toLowerCase().includes(query) ||
          a.genres.some((g) => g.toLowerCase().includes(query)) ||
          a.locations.some((l) => l.city.toLowerCase().includes(query))
      );
    }
    const sorted = [...list];
    if (sortKey === "score") {
      sorted.sort(
        (a, b) =>
          (stats[b.id]?.total_gig_score ?? 0) -
            (stats[a.id]?.total_gig_score ?? 0) ||
          a.artist_name.localeCompare(b.artist_name)
      );
    } else if (sortKey === "last_booked") {
      sorted.sort(
        (a, b) =>
          (stats[b.id]?.last_booked_date ?? "").localeCompare(
            stats[a.id]?.last_booked_date ?? ""
          ) || a.artist_name.localeCompare(b.artist_name)
      );
    } else {
      sorted.sort((a, b) => a.artist_name.localeCompare(b.artist_name));
    }
    return sorted;
  }, [
    artists,
    search,
    statusFilter,
    genreFilter,
    cityFilter,
    actTypeFilter,
    bookingFilter,
    sortKey,
    stats,
  ]);

  // Default selection on desktop.
  useEffect(() => {
    if (!isMobile && visibleArtists.length > 0 && selectedArtistId === null) {
      setSelectedArtistId(visibleArtists[0].id);
    }
  }, [visibleArtists, selectedArtistId, isMobile]);

  // Load the full profile whenever an artist is selected.
  useEffect(() => {
    if (selectedArtistId !== null && !artistDetails[selectedArtistId]) {
      getArtistDetail(selectedArtistId).catch((err) => {
        console.error("Failed to load artist detail:", err);
      });
    }
  }, [selectedArtistId, artistDetails, getArtistDetail]);

  const selectedDetail =
    selectedArtistId !== null ? artistDetails[selectedArtistId] : undefined;
  const selectedStat =
    selectedArtistId !== null ? stats[selectedArtistId] : undefined;

  const artistBookings = useMemo(() => {
    if (selectedArtistId === null) return [];
    return bookings
      .filter((b) => b.artist_id === selectedArtistId)
      .sort((a, b) => (b.event_date ?? "").localeCompare(a.event_date ?? ""));
  }, [bookings, selectedArtistId]);

  const handleRefresh = () => {
    Promise.all([fetchArtists(), fetchStats(), fetchBookings()])
      .then(() => toast.success("Artist database refreshed"))
      .catch(() => {
        // errors surfaced via the store error toast
      });
  };

  const handleCreate = async (values: ArtistFormValues) => {
    const genres = values.genres
      .split(",")
      .map((g) => g.trim())
      .filter(Boolean);
    const city = values.city.trim();
    const payload: CreateArtistPayload = {
      artist_name: values.artist_name.trim(),
      preferred_name: values.preferred_name.trim() || undefined,
      pronouns: values.pronouns.trim() || undefined,
      type_of_act: values.type_of_act.trim() || undefined,
      bio: values.bio.trim() || undefined,
      primary_email: values.primary_email.trim() || undefined,
      primary_phone: values.primary_phone.trim() || undefined,
      instagram: values.instagram.trim() || undefined,
      soundcloud: values.soundcloud.trim() || undefined,
      tiktok: values.tiktok.trim() || undefined,
      website: values.website.trim() || undefined,
      is_active: values.is_active,
      is_collective_member: values.is_collective_member,
      genres: genres.length > 0 ? genres : undefined,
      locations: city
        ? [{ city, country: values.country.trim() || "UK" }]
        : undefined,
    };
    const newId = await createArtist(payload);
    setSelectedArtistId(newId);
    toast.success(`${payload.artist_name} added to the database`);
  };

  const handleEdit = async (values: ArtistFormValues) => {
    if (selectedArtistId === null) return;
    // Empty inputs clear the field (null), so a profile can be corrected —
    // unlike create, where empties are simply omitted.
    const payload: UpdateArtistPayload = {
      artist_name: values.artist_name.trim(),
      preferred_name: values.preferred_name.trim() || null,
      pronouns: values.pronouns.trim() || null,
      type_of_act: values.type_of_act.trim() || null,
      bio: values.bio.trim() || null,
      primary_email: values.primary_email.trim() || null,
      primary_phone: values.primary_phone.trim() || null,
      instagram: values.instagram.trim() || null,
      soundcloud: values.soundcloud.trim() || null,
      tiktok: values.tiktok.trim() || null,
      website: values.website.trim() || null,
      is_active: values.is_active,
      is_collective_member: values.is_collective_member,
    };
    await updateArtist(selectedArtistId, payload);
    toast.success(`${payload.artist_name} updated`);
  };

  const menuBar = (
    <ArtistsMenuBar
      onClose={onClose}
      onShowHelp={() => setIsHelpDialogOpen(true)}
      onNewArtist={() => setIsCreateDialogOpen(true)}
      onRefresh={handleRefresh}
    />
  );

  const rowClasses = cn(
    "flex items-center gap-2 p-2 rounded-md",
    isMacTheme ? "aqua-well" : "border"
  );
  const chipClasses = cn(
    "px-2 py-0.5 rounded-full text-xs",
    isMacTheme ? "aqua-well" : "border bg-muted/30"
  );

  if (!isWindowOpen) return null;

  const showList = !isMobile || selectedArtistId === null;
  const showDetail = !isMobile || selectedArtistId !== null;

  return (
    <>
      {!isXpTheme && isForeground && menuBar}
      <WindowFrame
        title="Artists"
        onClose={onClose}
        isForeground={isForeground}
        appId="artists"
        skipInitialSound={skipInitialSound}
        instanceId={instanceId}
        onNavigateNext={onNavigateNext}
        onNavigatePrevious={onNavigatePrevious}
        menuBar={isXpTheme ? menuBar : undefined}
      >
        <div className="flex flex-col h-full w-full min-h-0">
          {showList && (
            <AppToolbar>
              <div className="relative flex-1 min-w-40">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search name, genre, or city…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as StatusFilter)}
              >
                <SelectTrigger className="w-28 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="all">All</SelectItem>
                </SelectContent>
              </Select>
              <Combobox
                value={genreFilter}
                onChange={setGenreFilter}
                options={genreOptions}
                displayValue={
                  genreFilter === ALL
                    ? "Genre: All"
                    : `Genre: ${selectedGenreLabel ?? genreFilter}`
                }
                searchPlaceholder="Search genres…"
                searchAriaLabel="Search genres"
                emptyMessage="No genres"
                className="w-36 shrink-0"
              />
              <Combobox
                value={cityFilter}
                onChange={setCityFilter}
                options={cityOptions}
                displayValue={
                  cityFilter === ALL
                    ? "City: All"
                    : `City: ${selectedCityLabel ?? cityFilter}`
                }
                searchPlaceholder="Search cities…"
                searchAriaLabel="Search cities"
                emptyMessage="No cities"
                className="w-36 shrink-0"
              />
              <Combobox
                value={actTypeFilter}
                onChange={setActTypeFilter}
                options={actTypeOptions}
                displayValue={
                  actTypeFilter === ALL
                    ? "Act: All"
                    : `Act: ${selectedActTypeLabel ?? actTypeFilter}`
                }
                searchPlaceholder="Search act types…"
                searchAriaLabel="Search act types"
                emptyMessage="No act types"
                className="w-36 shrink-0"
              />
              <Select
                value={bookingFilter}
                onValueChange={(v) => setBookingFilter(v as BookingFilter)}
              >
                <SelectTrigger className="w-44 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Booked: Any</SelectItem>
                  <SelectItem value="recent">Booked: Last 12 months</SelectItem>
                  <SelectItem value="stale">Booked: Over a year ago</SelectItem>
                  <SelectItem value="booked">Booked: Ever</SelectItem>
                  <SelectItem value="never">Booked: Never</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortKey}
                onValueChange={(v) => setSortKey(v as SortKey)}
              >
                <SelectTrigger className="w-36 shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">Sort: Name</SelectItem>
                  <SelectItem value="score">Sort: Gig score</SelectItem>
                  <SelectItem value="last_booked">Sort: Last booked</SelectItem>
                </SelectContent>
              </Select>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  onClick={clearFilters}
                  className="shrink-0 min-h-8 touch-manipulation"
                  title="Reset search and filters"
                >
                  <span className="inline-flex items-center">
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </span>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setIsCreateDialogOpen(true)}
                className="shrink-0 min-h-8 touch-manipulation"
              >
                <span className="inline-flex items-center">
                  <Plus className="h-4 w-4 mr-1" />
                  New Artist
                </span>
              </Button>
            </AppToolbar>
          )}

          <div
            className={cn(
              "flex flex-1 w-full min-h-0 p-4",
              isMacTheme ? "pt-2" : "bg-background"
            )}
          >
            {/* Roster sidebar */}
            {showList && (
              <div
                className={cn(
                  "flex flex-col min-h-0",
                  isMobile ? "w-full" : "w-72 pr-4 mr-4",
                  isMacTheme && !isMobile && "border-r border-r-black/10"
                )}
              >
                <h2 className="text-lg font-semibold mb-3">
                  Artists
                  {visibleArtists.length > 0 ? ` (${visibleArtists.length})` : ""}
                </h2>
                {/* Radix wraps content in a display:table div that grows to the
                    content's intrinsic width; force block so rows can't exceed
                    the fixed sidebar width. */}
                <ScrollArea className="flex-1 min-h-0 [&_[data-radix-scroll-area-viewport]>div]:block!">
                  <div className="space-y-2">
                    {isLoading && artists.length === 0 ? (
                      <EmptyState title="Loading artists..." className="py-6" />
                    ) : visibleArtists.length === 0 ? (
                      search.trim() ? (
                        <EmptyState
                          title={`No artists match "${search.trim()}"`}
                          hint={
                            hasNonSearchFilters
                              ? "Other filters are also narrowing the list."
                              : undefined
                          }
                          className="py-6"
                        >
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="mt-3 touch-manipulation"
                          >
                            <span className="inline-flex items-center">
                              <Plus className="h-4 w-4 mr-1" />
                              Create "{search.trim()}"
                            </span>
                          </Button>
                        </EmptyState>
                      ) : hasActiveFilters ? (
                        <EmptyState
                          title="No artists match these filters"
                          hint="Widen or reset them to see more of the roster."
                          className="py-6"
                        >
                          <Button
                            variant="default"
                            size="sm"
                            onClick={clearFilters}
                            className="mt-3 touch-manipulation"
                          >
                            <span className="inline-flex items-center">
                              <X className="h-4 w-4 mr-1" />
                              Clear filters
                            </span>
                          </Button>
                        </EmptyState>
                      ) : (
                        <EmptyState
                          title="No artists in the database yet"
                          hint="Add the first one with New Artist."
                          className="py-6"
                        />
                      )
                    ) : (
                      visibleArtists.map((artist) => {
                        const stat = stats[artist.id];
                        return (
                          <SidebarRow
                            key={artist.id}
                            selected={selectedArtistId === artist.id}
                            onClick={() => setSelectedArtistId(artist.id)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="font-medium text-sm truncate">
                                  {artist.artist_name}
                                  {artist.preferred_name && (
                                    <span className="font-normal text-muted-foreground">
                                      {" "}
                                      ({artist.preferred_name})
                                    </span>
                                  )}
                                </div>
                                <ArtistFacts artist={artist} />
                              </div>
                              {stat && (
                                <span
                                  className="shrink-0 inline-flex items-center gap-1 text-xs text-muted-foreground tabular-nums"
                                  title={`Gig score ${stat.total_gig_score} · ${stat.gig_count} completed gig${stat.gig_count === 1 ? "" : "s"} · last booked ${formatDate(stat.last_booked_date) ?? "—"}`}
                                >
                                  <Star className="h-3 w-3" />
                                  {stat.total_gig_score}
                                </span>
                              )}
                            </div>
                          </SidebarRow>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Profile pane */}
            {showDetail && (
              <div className="flex-1 flex flex-col min-w-0 min-h-0">
                {selectedArtistId === null ? (
                  <EmptyState
                    icon={Users}
                    title="Select an artist"
                    hint="Pick an artist from the list to see their profile and gig stats."
                    className="flex-1"
                  />
                ) : !selectedDetail ? (
                  <EmptyState title="Loading artist..." className="flex-1" />
                ) : (
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-4 pr-3">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          {isMobile && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedArtistId(null)}
                              className="-ml-2 mb-1 h-7 px-2"
                            >
                              <span className="inline-flex items-center text-xs">
                                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                                All Artists
                              </span>
                            </Button>
                          )}
                          <h2 className="text-lg font-semibold leading-tight break-words">
                            {selectedDetail.artist_name}
                            {selectedDetail.preferred_name && (
                              <span className="font-normal text-muted-foreground">
                                {" "}
                                ({selectedDetail.preferred_name})
                              </span>
                            )}
                          </h2>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge
                              status={
                                selectedDetail.is_active ? "active" : "inactive"
                              }
                              label={
                                selectedDetail.is_active ? "Active" : "Inactive"
                              }
                              tone={selectedDetail.is_active ? "green" : "gray"}
                            />
                            {selectedDetail.is_collective_member && (
                              <StatusBadge
                                status="collective"
                                label="Collective"
                                tone="blue"
                              />
                            )}
                            {selectedDetail.pronouns && (
                              <span className="text-xs text-muted-foreground">
                                {selectedDetail.pronouns}
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setIsEditDialogOpen(true)}
                          className="shrink-0 touch-manipulation"
                        >
                          <span className="inline-flex items-center">
                            <Pencil className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </span>
                        </Button>
                      </div>

                      {/* Gig stats */}
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <InfoTile icon={Star} label="Total gig score">
                            {selectedStat?.total_gig_score ?? 0}
                          </InfoTile>
                          <InfoTile icon={CalendarCheck} label="Completed gigs">
                            {selectedStat?.gig_count ?? 0}
                          </InfoTile>
                          <InfoTile icon={Clock} label="Last booked">
                            {formatDate(selectedStat?.last_booked_date) ??
                              "Never"}
                          </InfoTile>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Gig score gauges how many opportunities we've given
                          this artist: legacy roster gigs plus completed
                          Greenroom bookings, both weighted by gig size
                          (S = 1, M = 2, L = 3).
                        </p>
                      </div>

                      {/* Profile */}
                      {(selectedDetail.type_of_act ||
                        selectedDetail.heritage ||
                        selectedDetail.bio ||
                        selectedDetail.genres.length > 0 ||
                        selectedDetail.locations.length > 0) && (
                        <div className="space-y-2">
                          <SectionHeader icon={User} title="Profile" />
                          {selectedDetail.type_of_act && (
                            <ContactRow
                              icon={Mic}
                              label="Type of act"
                              value={selectedDetail.type_of_act}
                            />
                          )}
                          {selectedDetail.heritage && (
                            <ContactRow
                              icon={Globe}
                              label="Heritage"
                              value={selectedDetail.heritage}
                            />
                          )}
                          {selectedDetail.genres.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Music className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {selectedDetail.genres.map((genre) => (
                                <span key={genre} className={chipClasses}>
                                  {genre}
                                </span>
                              ))}
                            </div>
                          )}
                          {selectedDetail.locations.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              {selectedDetail.locations.map((location, i) => (
                                <span key={i} className={chipClasses}>
                                  {location.city}
                                  {location.country
                                    ? ` (${location.country})`
                                    : ""}
                                </span>
                              ))}
                            </div>
                          )}
                          {selectedDetail.bio && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {selectedDetail.bio}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Contact & links */}
                      {(selectedDetail.primary_email ||
                        selectedDetail.primary_phone ||
                        selectedDetail.instagram ||
                        selectedDetail.soundcloud ||
                        selectedDetail.tiktok ||
                        selectedDetail.website ||
                        selectedDetail.previous_work_link) && (
                        <div className="space-y-2">
                          <SectionHeader icon={Mail} title="Contact & Links" />
                          {selectedDetail.primary_email && (
                            <ContactRow
                              icon={Mail}
                              label="Email"
                              value={selectedDetail.primary_email}
                              href={`mailto:${selectedDetail.primary_email}`}
                            />
                          )}
                          {selectedDetail.primary_phone && (
                            <ContactRow
                              icon={Phone}
                              label="Phone"
                              value={selectedDetail.primary_phone}
                              href={`tel:${selectedDetail.primary_phone}`}
                            />
                          )}
                          {selectedDetail.instagram && (
                            <ContactRow
                              icon={Instagram}
                              label="Instagram"
                              value={selectedDetail.instagram}
                              href={linkHref(
                                selectedDetail.instagram,
                                "https://www.instagram.com/"
                              )}
                            />
                          )}
                          {selectedDetail.soundcloud && (
                            <ContactRow
                              icon={Music}
                              label="SoundCloud"
                              value={selectedDetail.soundcloud}
                              href={linkHref(
                                selectedDetail.soundcloud,
                                "https://soundcloud.com/"
                              )}
                            />
                          )}
                          {selectedDetail.tiktok && (
                            <ContactRow
                              icon={Link2}
                              label="TikTok"
                              value={selectedDetail.tiktok}
                              href={linkHref(
                                selectedDetail.tiktok,
                                "https://www.tiktok.com/@"
                              )}
                            />
                          )}
                          {selectedDetail.website && (
                            <ContactRow
                              icon={Globe}
                              label="Website"
                              value={selectedDetail.website}
                              href={linkHref(selectedDetail.website)}
                            />
                          )}
                          {selectedDetail.previous_work_link && (
                            <ContactRow
                              icon={Link2}
                              label="Previous work"
                              value={selectedDetail.previous_work_link}
                              href={linkHref(selectedDetail.previous_work_link)}
                            />
                          )}
                        </div>
                      )}

                      {/* Booking history */}
                      <div className="space-y-2">
                        <SectionHeader
                          icon={Calendar}
                          title={`Booking History${
                            artistBookings.length > 0
                              ? ` (${artistBookings.length})`
                              : ""
                          }`}
                        />
                        {(selectedStat?.legacy_gig_score ?? 0) > 0 && (
                          <p className="text-xs text-muted-foreground">
                            Pre-Greenroom history from the roster sheet
                            contributes {selectedStat?.legacy_gig_score} points
                            to the gig score
                            {selectedStat?.last_event_name &&
                            artistBookings.length === 0
                              ? ` — most recent: ${selectedStat.last_event_name}`
                              : ""}
                            . Only Greenroom-era bookings are itemised below.
                          </p>
                        )}
                        {artistBookings.length === 0 ? (
                          <EmptyState
                            title="No Greenroom bookings for this artist yet"
                            hint="Bookings from projects and offers will show up here."
                            className="py-6"
                          />
                        ) : (
                          <div className="space-y-2">
                            {artistBookings.map((booking) => {
                              const fee = formatFee(booking.agreed_fee);
                              return (
                                <div
                                  key={booking.booking_id}
                                  className={rowClasses}
                                >
                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <div className="font-medium text-sm truncate">
                                      {booking.project_name}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
                                      {booking.event_date && (
                                        <span className="inline-flex items-center gap-1">
                                          <Calendar className="h-3 w-3 shrink-0" />
                                          {formatDate(booking.event_date)}
                                        </span>
                                      )}
                                      {booking.venue_name && (
                                        <span className="inline-flex items-center gap-1 min-w-0">
                                          <Building2 className="h-3 w-3 shrink-0" />
                                          <span className="truncate">
                                            {booking.venue_name}
                                          </span>
                                        </span>
                                      )}
                                      {fee && (
                                        <span className="tabular-nums">
                                          {fee}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <StatusBadge
                                    status={booking.status}
                                    className="shrink-0"
                                  />
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}
          </div>
        </div>

        <HelpGuideDialog
          isOpen={isHelpDialogOpen}
          onOpenChange={setIsHelpDialogOpen}
          guideId="artists"
        />
        <ArtistFormDialog
          isOpen={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          mode="create"
          initialName={search.trim()}
          onSubmit={handleCreate}
        />
        <ArtistFormDialog
          isOpen={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          mode="edit"
          initial={selectedDetail ?? null}
          onSubmit={handleEdit}
        />
      </WindowFrame>
    </>
  );
}
