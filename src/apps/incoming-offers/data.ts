export interface Offer {
  id: string;
  name: string;
  description: string;
  promoter: string;
  venue: string;
  date: string;
  fee: string;
  timings: string;
  source: "email" | "form" | "pitch";
  status: "new" | "reviewed" | "archived";
}

export const dummyOffers: Offer[] = [
  {
    id: "1",
    name: "Summer BST Festival",
    description: "Main stage slot for a 1-hour set at the annual Summer Vibes festival. Looking for high energy house/techno.",
    promoter: "Vibes Events Co.",
    venue: "Hyde Park, London",
    date: "2024-07-15",
    fee: "£5,000",
    timings: "16:00 - 17:00",
    source: "email",
    status: "new",
  },
  {
    id: "2",
    name: "Warehouse Project Opening",
    description: "Opening support for the main headliner. Great exposure opportunity.",
    promoter: "WHP",
    venue: "Depot Mayfield, Manchester",
    date: "2024-09-20",
    fee: "£1,500",
    timings: "22:00 - 23:30",
    source: "form",
    status: "new",
  },
  {
    id: "3",
    name: "Brand Launch: Nike Air Max",
    description: "DJ set for the launch party of the new Air Max campaign. Corporate gig, strict playlist guidelines.",
    promoter: "Nike / AgencyXYZ",
    venue: "Nike Town, Oxford Circus",
    date: "2024-05-10",
    fee: "£3,000",
    timings: "19:00 - 21:00",
    source: "email",
    status: "reviewed",
  },
  {
    id: "4",
    name: "Ibiza Residency - July",
    description: "Weekly slot at Amnesia for the month of July. Travel and accommodation included.",
    promoter: "Amnesia Group",
    venue: "Amnesia, Ibiza",
    date: "July 2024 (Weekly)",
    fee: "£2,000 per show",
    timings: "02:00 - 04:00",
    source: "email",
    status: "new",
  },
  {
    id: "5",
    name: "Club Night at Fold",
    description: "Intimate basement gig. 300 cap venue. Pure techno.",
    promoter: "Darkroom",
    venue: "Fold, London",
    date: "2024-06-01",
    fee: "£800",
    timings: "03:00 - 05:00",
    source: "form",
    status: "new",
  },
  {
    id: "6",
    name: "Private Yacht Party",
    description: "Exclusive birthday party for a high-profile client. NDAs required.",
    promoter: "Private",
    venue: "Monaco Harbour",
    date: "2024-08-12",
    fee: "£10,000",
    timings: "21:00 - 00:00",
    source: "email",
    status: "new",
  },
];

export interface VoteCounts {
  accept: number;
  interested: number;
  decline: number;
  recommend: number;
}

export const initialVoteCounts: Record<string, VoteCounts> = {
  "1": { accept: 2, interested: 1, decline: 0, recommend: 0 },
  "2": { accept: 3, interested: 0, decline: 0, recommend: 0 },
  "3": { accept: 0, interested: 1, decline: 1, recommend: 1 },
  "4": { accept: 4, interested: 0, decline: 0, recommend: 0 },
  "5": { accept: 1, interested: 2, decline: 0, recommend: 0 },
  "6": { accept: 0, interested: 0, decline: 2, recommend: 1 },
};
